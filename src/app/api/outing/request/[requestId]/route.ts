import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { movementRecords, students, movementTypes, approvalRequests } from "@/db/schema";
import { requireUser } from "@/lib/auth/session";
import { handleApiError } from "@/lib/apiError";

export async function GET(_req: Request, { params }: { params: Promise<{ requestId: string }> }) {
  try {
    const user = await requireUser();
    const { requestId } = await params;

    const [movement] = await db
      .select({
        id: movementRecords.id,
        studentId: movementRecords.studentId,
        movementTypeLabel: movementTypes.label,
        purpose: movementRecords.purpose,
        timeOut: movementRecords.timeOut,
        timeIn: movementRecords.timeIn,
        approvalStatus: movementRecords.approvalStatus,
        studentName: students.name,
        matricNumber: students.matricNumber,
      })
      .from(movementRecords)
      .innerJoin(students, eq(movementRecords.studentId, students.id))
      .leftJoin(movementTypes, eq(movementRecords.movementTypeId, movementTypes.id))
      .where(eq(movementRecords.id, requestId))
      .limit(1);

    if (!movement) return NextResponse.json({ error: "Permohonan tidak ditemui." }, { status: 404 });

    const isOwner = movement.studentId === user.id;
    const isStaffOverride = ["warden", "admin"].includes(user.role);

    let isAssignedDecider = false;
    if (!isOwner && !isStaffOverride) {
      const steps = await db.select().from(approvalRequests).where(eq(approvalRequests.movementRecordId, requestId));
      isAssignedDecider = steps.some((s) => s.assignedToUserId === user.id);
    }

    if (!isOwner && !isStaffOverride && !isAssignedDecider) {
      return NextResponse.json({ error: "Anda tidak mempunyai akses kepada permohonan ini." }, { status: 403 });
    }

    return NextResponse.json({ request: movement });
  } catch (err) {
    return handleApiError(err);
  }
}
