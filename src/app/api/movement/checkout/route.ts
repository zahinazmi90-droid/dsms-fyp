import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { movementRecords, movementTypes, approvalRequests, students } from "@/db/schema";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/apiError";
import { logAudit, getClientIp } from "@/lib/audit";
import { resolveScheduleWindow } from "@/lib/rules/schedule";
import { routeAcademicApproval } from "@/lib/rules/academicApproval";
import { verifyCampusLocation } from "@/lib/rules/locationCheck";
import { getSetting } from "@/lib/settings";

const Schema = z.object({
  movementTypeId: z.enum(["NORMAL", "STUDY", "OVERNIGHT", "EMERGENCY"]),
  purpose: z.string().max(500).optional(),
  outsideAddress: z.string().max(500).optional(),
  expectedReturnAt: z.string().optional(), // ISO, only meaningful for OVERNIGHT
  emergencyReason: z.string().max(500).optional(),
  emergencyFellowId: z.string().optional(),
  phoneConfirmed: z.boolean().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  idempotencyKey: z.string().min(8),
});

export async function POST(req: Request) {
  try {
    const user = await requireRole("student");
    const body = await req.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Input tidak sah." }, { status: 400 });
    }
    const data = parsed.data;

    // --- Idempotency: if this exact key was already used, return the existing record instead of creating a duplicate.
    const [existingByKey] = await db
      .select()
      .from(movementRecords)
      .where(eq(movementRecords.idempotencyKey, data.idempotencyKey))
      .limit(1);
    if (existingByKey) {
      return NextResponse.json({ ok: true, record: existingByKey, deduped: true });
    }

    // --- Duplicate prevention: student cannot have two active (no time_in) OUT records.
    const [activeExisting] = await db
      .select()
      .from(movementRecords)
      .where(and(eq(movementRecords.studentId, user.id), isNull(movementRecords.timeIn)))
      .limit(1);
    if (activeExisting) {
      return NextResponse.json(
        { error: "Anda sudah mempunyai rekod KELUAR yang aktif. Sila MASUK dahulu sebelum KELUAR semula." },
        { status: 409 }
      );
    }

    // --- Movement type must be active/configured.
    const [mtype] = await db.select().from(movementTypes).where(eq(movementTypes.id, data.movementTypeId)).limit(1);
    if (!mtype || !mtype.isActive) {
      return NextResponse.json({ error: "Jenis pergerakan ini tidak diaktifkan." }, { status: 400 });
    }

    // --- Campus GPS location check (if enabled by Admin). Skipped for
    // EMERGENCY -- a student in genuine distress may not be on campus at
    // all, and blocking that report on a location check would be harmful.
    if (data.movementTypeId !== "EMERGENCY") {
      const locationCheck = await verifyCampusLocation({ latitude: data.latitude, longitude: data.longitude });
      if (!locationCheck.ok) {
        return NextResponse.json({ error: locationCheck.error }, { status: 403 });
      }
    }

    // --- Server-side required-field enforcement (never trust client).
    if (mtype.requiresPurpose && (await getSetting<boolean>("purpose_required")) && !data.purpose?.trim()) {
      return NextResponse.json({ error: "Tujuan diperlukan." }, { status: 400 });
    }
    if (mtype.requiresAddress) {
      const addrRequired = await getSetting<boolean>("address_required_for_overnight");
      if (addrRequired && !data.outsideAddress?.trim()) {
        return NextResponse.json({ error: "Alamat luar diperlukan untuk bermalam." }, { status: 400 });
      }
      // Overnight's expected return must be a real, parseable date that is
      // actually in the future relative to this checkout, and within a sane
      // window -- previously any string (including dates years in the past)
      // was accepted without any check at all.
      if (data.expectedReturnAt) {
        const expectedDate = new Date(data.expectedReturnAt);
        if (Number.isNaN(expectedDate.getTime())) {
          return NextResponse.json({ error: "Format tarikh/masa jangkaan pulang tidak sah." }, { status: 400 });
        }
        const nowForValidation = new Date();
        if (expectedDate.getTime() <= nowForValidation.getTime()) {
          return NextResponse.json(
            { error: "Tarikh/masa jangkaan pulang mesti selepas masa keluar sekarang." },
            { status: 400 }
          );
        }
        const maxFutureMs = 30 * 24 * 60 * 60 * 1000; // 30 days
        if (expectedDate.getTime() - nowForValidation.getTime() > maxFutureMs) {
          return NextResponse.json(
            { error: "Tarikh jangkaan pulang terlalu jauh pada masa hadapan (maksimum 30 hari)." },
            { status: 400 }
          );
        }
      }
    }
    if (data.movementTypeId === "EMERGENCY" && !data.emergencyReason?.trim()) {
      return NextResponse.json({ error: "Sebab kecemasan diperlukan." }, { status: 400 });
    }
    const phoneRequired = await getSetting<boolean>("phone_required");
    if (phoneRequired && data.movementTypeId !== "EMERGENCY" && !data.phoneConfirmed) {
      return NextResponse.json({ error: "Sila sahkan nombor telefon anda." }, { status: 400 });
    }

    const [studentRow] = await db.select().from(students).where(eq(students.id, user.id)).limit(1);
    if (!studentRow || !studentRow.isActive) {
      return NextResponse.json({ error: "Akaun pelajar tidak aktif." }, { status: 403 });
    }

    // --- Server-generated timestamp only. Client cannot supply time_out.
    const nowUtc = new Date();
    const window = await resolveScheduleWindow(nowUtc);

    // Snapshot the FINAL deadline (schedule deadline + grace period, both as
    // they stand right now) onto the record. This is what late-detection
    // will compare against at check-in time -- it is never re-resolved from
    // live settings later, so an Admin changing the schedule or grace period
    // while this student is already outside cannot retroactively change
    // whether this specific outing counts as late.
    const graceMinutesAtCheckout = (await getSetting<number>("late_grace_minutes")) ?? 0;
    const deadlineWithGrace = new Date(window.returnDeadlineUtc.getTime() + graceMinutesAtCheckout * 60_000);

    // For STUDY (the academic/class-time outing type), approval routing is
    // determined dynamically per the academic workflow rules -- not simply
    // "requiresApproval = true always" -- since weekend/holiday requests
    // need no academic approval, and after-hours requests route to Warden
    // instead of Lecturer/HOP. Other approval-required types keep the
    // existing single-WARDEN-step behavior unchanged.
    let approvalRequired: boolean;
    if (data.movementTypeId === "STUDY") {
      approvalRequired = true; // provisional; corrected below once actually routed
    } else {
      approvalRequired = mtype.requiresApproval;
    }

    const recordId = randomUUID();

    try {
      await db.insert(movementRecords).values({
        id: recordId,
        studentId: user.id,
        movementTypeId: data.movementTypeId,
        purpose: data.purpose?.trim() || null,
        outsideAddress: data.outsideAddress?.trim() || null,
        emergencyReason: data.emergencyReason?.trim() || null,
        emergencyFellowId: data.emergencyFellowId || null,
        timeOut: nowUtc.toISOString(),
        expectedReturnAt: data.expectedReturnAt || null,
        deadlineAppliedAt: deadlineWithGrace.toISOString(),
        lateStatus: "PENDING",
        approvalStatus: approvalRequired ? "PENDING" : "NOT_REQUIRED",
        createdBy: user.id,
        idempotencyKey: data.idempotencyKey,
      });
    } catch (err: unknown) {
      const pgError = err as { code?: string; constraint?: string };
      if (pgError?.code === "23505" && pgError?.constraint === "movement_one_active_per_student_idx") {
        return NextResponse.json(
          { error: "Anda sudah mempunyai rekod KELUAR yang aktif. Sila MASUK dahulu sebelum KELUAR semula." },
          { status: 409 }
        );
      }
      throw err;
    }

    if (data.movementTypeId === "STUDY") {
      const academicRouting = await routeAcademicApproval({
        movementRecordId: recordId,
        studentId: user.id,
        nowUtc,
      });
      approvalRequired = academicRouting.approvalRequired;
      if (!approvalRequired) {
        await db.update(movementRecords).set({ approvalStatus: "NOT_REQUIRED" }).where(eq(movementRecords.id, recordId));
      }
    } else if (approvalRequired) {
      await db.insert(approvalRequests).values({
        id: randomUUID(),
        movementRecordId: recordId,
        approverRole: "WARDEN",
        status: "PENDING",
      });
    }

    await logAudit({
      userId: user.id,
      action: "MOVEMENT_CHECKOUT",
      target: recordId,
      description: `Movement type: ${data.movementTypeId}; Device: ${req.headers.get("user-agent") ?? "unknown"}`,
      ipAddress: getClientIp(req),
    });

    const [record] = await db.select().from(movementRecords).where(eq(movementRecords.id, recordId)).limit(1);
    return NextResponse.json({
      ok: true,
      record,
      message: approvalRequired
        ? "Permohonan anda telah dihantar dan menunggu kelulusan."
        : "Rekod keluar anda telah berjaya direkodkan.",
    });
  } catch (err) {
    return handleApiError(err);
  }
}
