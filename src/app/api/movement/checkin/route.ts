import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { movementRecords } from "@/db/schema";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/apiError";
import { logAudit, getClientIp } from "@/lib/audit";
import { computeLateStatus } from "@/lib/rules/lateDetection";
import { resolveScheduleWindow } from "@/lib/rules/schedule";
import { verifyCampusLocation } from "@/lib/rules/locationCheck";

const Schema = z.object({
  idempotencyKey: z.string().min(8),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireRole("student");
    const body = await req.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Input tidak sah." }, { status: 400 });
    }

    const locationCheck = await verifyCampusLocation({ latitude: parsed.data.latitude, longitude: parsed.data.longitude });
    if (!locationCheck.ok) {
      return NextResponse.json({ error: locationCheck.error }, { status: 403 });
    }

    // Idempotency: same key already processed -> return existing result, no duplicate write.
    const [dupCheck] = await db
      .select()
      .from(movementRecords)
      .where(eq(movementRecords.idempotencyKey, parsed.data.idempotencyKey))
      .limit(1);
    if (dupCheck && dupCheck.timeIn) {
      return NextResponse.json({ ok: true, record: dupCheck, deduped: true });
    }

    // Find the student's currently active OUT record (system finds it automatically —
    // student never has to "search" like with the physical book).
    const [active] = await db
      .select()
      .from(movementRecords)
      .where(and(eq(movementRecords.studentId, user.id), isNull(movementRecords.timeIn)))
      .limit(1);

    if (!active) {
      return NextResponse.json(
        { error: "Tiada rekod KELUAR aktif ditemui. Anda mungkin sudah berada di dalam kolej." },
        { status: 409 }
      );
    }

    if (active.approvalStatus === "PENDING") {
      return NextResponse.json(
        { error: "Permohonan KELUAR anda masih menunggu kelulusan dan belum aktif." },
        { status: 409 }
      );
    }
    if (active.approvalStatus === "REJECTED") {
      return NextResponse.json(
        { error: "Permohonan KELUAR anda telah ditolak. Sila hubungi Warden." },
        { status: 409 }
      );
    }

    const nowUtc = new Date();

    // Use the deadline snapshotted at checkout time. Defensive fallback to a
    // fresh resolve only covers the unlikely case of an older record that
    // predates this snapshot existing at all -- normal operation always has
    // deadlineAppliedAt populated by the checkout route.
    let deadlineAppliedAt: Date;
    if (active.deadlineAppliedAt) {
      deadlineAppliedAt = new Date(active.deadlineAppliedAt);
    } else {
      const window = await resolveScheduleWindow(new Date(active.timeOut));
      deadlineAppliedAt = window.returnDeadlineUtc;
    }

    const { late } = await computeLateStatus({
      deadlineAppliedAt,
      checkInUtc: nowUtc,
    });

    await db
      .update(movementRecords)
      .set({
        timeIn: nowUtc.toISOString(),
        lateStatus: late ? "LATE" : "ON_TIME",
        updatedAt: nowUtc.toISOString(),
        // Overwrite idempotency key with this check-in's key so a retry of the
        // *check-in* action is also deduped (the OUT-side key already served its purpose).
        idempotencyKey: parsed.data.idempotencyKey,
      })
      .where(eq(movementRecords.id, active.id));

    await logAudit({
      userId: user.id,
      action: "MOVEMENT_CHECKIN",
      target: active.id,
      description: `${late ? "Late return" : "On-time return"}; Device: ${req.headers.get("user-agent") ?? "unknown"}`,
      ipAddress: getClientIp(req),
    });

    const [updated] = await db.select().from(movementRecords).where(eq(movementRecords.id, active.id)).limit(1);
    return NextResponse.json({
      ok: true,
      record: updated,
      late,
      message: late
        ? "Rekod masuk direkodkan. AMARAN: Anda pulang lewat daripada waktu yang ditetapkan."
        : "Rekod masuk telah berjaya direkodkan.",
    });
  } catch (err) {
    return handleApiError(err);
  }
}
