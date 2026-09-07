import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { approvalRequests, movementRecords, students } from "@/db/schema";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/apiError";
import { logAudit, getClientIp } from "@/lib/audit";
import { getSetting } from "@/lib/settings";
import { notifyUser } from "@/lib/notifications/service";

const Schema = z.object({
  approvalId: z.string(),
  decision: z.enum(["APPROVED", "REJECTED"]),
  remarks: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireRole("warden", "admin", "guard", "lecturer", "head_of_programme");

    if (user.role === "guard") {
      const guardCanApprove = await getSetting<boolean>("guard_can_approve");
      if (!guardCanApprove) {
        return NextResponse.json(
          { error: "Pengawal tidak dibenarkan meluluskan permohonan pada masa ini." },
          { status: 403 }
        );
      }
    }

    const body = await req.json().catch(() => null);
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }

    const [approval] = await db
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.id, parsed.data.approvalId))
      .limit(1);
    if (!approval) return NextResponse.json({ error: "Permohonan tidak ditemui." }, { status: 404 });

    // Authorization for the academic (Lecturer/HOP) flow: when a step has
    // a specific assignedToUserId, ONLY that exact person -- not merely
    // someone sharing the role -- may decide it. Admin retains override.
    if (approval.approverRole === "TEACHER" || approval.approverRole === "HEAD_OF_PROGRAMME") {
      const expectedRole = approval.approverRole === "TEACHER" ? "lecturer" : "head_of_programme";
      const isAssignedPerson = approval.assignedToUserId === user.id;
      const isAdminOverride = user.role === "admin";
      if (approval.assignedToUserId) {
        if (!isAssignedPerson && !isAdminOverride) {
          return NextResponse.json({ error: "Permohonan ini bukan ditugaskan kepada anda." }, { status: 403 });
        }
      } else if (user.role !== expectedRole && !isAdminOverride) {
        return NextResponse.json({ error: "Anda tidak mempunyai akses." }, { status: 403 });
      }
    }

    if (approval.status !== "PENDING") {
      return NextResponse.json({ error: "Permohonan ini telah diproses." }, { status: 409 });
    }

    // Concurrency-safe decision + finalization: lock every approval_requests
    // row for this movement inside a transaction so simultaneous
    // Lecturer/HOP decisions can't read stale state.
    const result = await db.transaction(async (tx) => {
      const lockedSteps = await tx
        .select()
        .from(approvalRequests)
        .where(eq(approvalRequests.movementRecordId, approval.movementRecordId))
        .for("update");

      const current = lockedSteps.find((s) => s.id === approval.id);
      if (!current || current.status !== "PENDING") {
        return { alreadyDecided: true as const };
      }

      const now = new Date().toISOString();
      await tx
        .update(approvalRequests)
        .set({ status: parsed.data.decision, remarks: parsed.data.remarks, decidedAt: now, decidedBy: user.id })
        .where(eq(approvalRequests.id, approval.id));

      const stepsAfter = lockedSteps.map((s) => (s.id === approval.id ? { ...s, status: parsed.data.decision } : s));

      const hopStep = stepsAfter.find((s) => s.approverRole === "HEAD_OF_PROGRAMME");
      const teacherStep = stepsAfter.find((s) => s.approverRole === "TEACHER");

      let recordStatus: "APPROVED" | "REJECTED" | "PENDING";

      if (hopStep) {
        // HOP decision matrix: HOP is FINAL authority regardless of
        // Lecturer's state, and never waits for Lecturer.
        if (hopStep.status === "APPROVED") recordStatus = "APPROVED";
        else if (hopStep.status === "REJECTED") recordStatus = "REJECTED";
        else recordStatus = "PENDING";
      } else {
        // No HOP step (non-academic flow, e.g. plain WARDEN/GUARD) --
        // unchanged legacy behavior.
        if (stepsAfter.some((s) => s.status === "REJECTED")) recordStatus = "REJECTED";
        else if (stepsAfter.every((s) => s.status === "APPROVED")) recordStatus = "APPROVED";
        else recordStatus = "PENDING";
      }

      if (recordStatus !== "PENDING") {
        await tx.update(movementRecords).set({ approvalStatus: recordStatus, updatedAt: now }).where(eq(movementRecords.id, approval.movementRecordId));
      }

      return { alreadyDecided: false as const, recordStatus, hopStep, teacherStep };
    });

    if (result.alreadyDecided) {
      return NextResponse.json({ error: "Permohonan ini telah diproses." }, { status: 409 });
    }

    await logAudit({
      userId: user.id,
      action: "APPROVAL_DECISION",
      target: approval.id,
      description: `${approval.approverRole} ${parsed.data.decision} for movement ${approval.movementRecordId}`,
      ipAddress: getClientIp(req),
    });

    await sendDecisionNotifications({
      approverRole: approval.approverRole,
      decision: parsed.data.decision,
      recordStatus: result.recordStatus,
      movementRecordId: approval.movementRecordId,
      hopStepExists: !!result.hopStep,
      teacherStepExists: !!result.teacherStep,
    });

    return NextResponse.json({ ok: true, recordStatus: result.recordStatus });
  } catch (err) {
    return handleApiError(err);
  }
}

async function sendDecisionNotifications(params: {
  approverRole: string;
  decision: "APPROVED" | "REJECTED";
  recordStatus: "APPROVED" | "REJECTED" | "PENDING";
  movementRecordId: string;
  hopStepExists: boolean;
  teacherStepExists: boolean;
}) {
  const [movement] = await db.select().from(movementRecords).where(eq(movementRecords.id, params.movementRecordId)).limit(1);
  if (!movement) return;
  const [student] = await db.select().from(students).where(eq(students.id, movement.studentId)).limit(1);
  if (!student) return;

  const studentUserId = student.id;

  if (params.approverRole === "TEACHER") {
    if (params.recordStatus === "PENDING") {
      await notifyUser({
        userId: studentUserId,
        type: params.decision === "APPROVED" ? "LECTURER_APPROVED" : "LECTURER_REJECTED",
        title: params.decision === "APPROVED" ? "Pensyarah Meluluskan" : "Pensyarah Tidak Meluluskan",
        message:
          params.decision === "APPROVED"
            ? "Pensyarah anda telah meluluskan permohonan. Menunggu keputusan muktamad Ketua Program."
            : "Pensyarah anda tidak meluluskan permohonan. Menunggu keputusan muktamad Ketua Program.",
        requestId: params.movementRecordId,
        movementId: params.movementRecordId,
      });
    }
    return;
  }

  if (params.approverRole === "HEAD_OF_PROGRAMME") {
    await notifyUser({
      userId: studentUserId,
      type: params.decision === "APPROVED" ? "OUTING_APPROVED" : "OUTING_REJECTED",
      title: params.decision === "APPROVED" ? "🟢 Permohonan Diluluskan" : "🔴 Permohonan Ditolak",
      message:
        params.decision === "APPROVED"
          ? "Ketua Program telah meluluskan permohonan keluar anda."
          : "Ketua Program telah menolak permohonan keluar anda.",
      requestId: params.movementRecordId,
      movementId: params.movementRecordId,
    });

    if (params.teacherStepExists) {
      const steps = await db.select().from(approvalRequests).where(eq(approvalRequests.movementRecordId, params.movementRecordId));
      const teacherStep = steps.find((s) => s.approverRole === "TEACHER");
      const teacherAssignee = teacherStep?.assignedToUserId;
      if (teacherAssignee) {
        await notifyUser({
          userId: teacherAssignee,
          type: params.decision === "APPROVED" ? "HOP_APPROVED" : "HOP_REJECTED",
          title: "Permohonan Selesai",
          message:
            params.decision === "APPROVED"
              ? "Ketua Program telah meluluskan permohonan keluar ini."
              : "Ketua Program telah menolak permohonan keluar ini.",
          requestId: params.movementRecordId,
          movementId: params.movementRecordId,
        });
      }
    }
    return;
  }

  if (params.approverRole === "WARDEN") {
    await notifyUser({
      userId: studentUserId,
      type: params.decision === "APPROVED" ? "WARDEN_APPROVED" : "WARDEN_REJECTED",
      title: params.decision === "APPROVED" ? "Permohonan Kecemasan Diluluskan" : "Permohonan Kecemasan Ditolak",
      message:
        params.decision === "APPROVED"
          ? "Warden telah meluluskan permohonan keluar selepas waktu anda."
          : "Warden telah menolak permohonan keluar selepas waktu anda.",
      requestId: params.movementRecordId,
      movementId: params.movementRecordId,
    });
  }
}
