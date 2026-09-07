import { NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { approvalRequests, movementRecords, students, movementTypes } from "@/db/schema";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/apiError";

export async function GET() {
  try {
    const user = await requireRole("lecturer", "head_of_programme");

    const rows = await db
      .select({
        approvalId: approvalRequests.id,
        approverRole: approvalRequests.approverRole,
        status: approvalRequests.status,
        requestedAt: approvalRequests.requestedAt,
        movementRecordId: movementRecords.id,
        movementApprovalStatus: movementRecords.approvalStatus,
        studentName: students.name,
        matricNumber: students.matricNumber,
        movementTypeLabel: movementTypes.label,
        purpose: movementRecords.purpose,
        timeOut: movementRecords.timeOut,
      })
      .from(approvalRequests)
      .innerJoin(movementRecords, eq(approvalRequests.movementRecordId, movementRecords.id))
      .innerJoin(students, eq(movementRecords.studentId, students.id))
      .leftJoin(movementTypes, eq(movementRecords.movementTypeId, movementTypes.id))
      .where(and(eq(approvalRequests.assignedToUserId, user.id)))
      .orderBy(desc(approvalRequests.requestedAt));

    return NextResponse.json({ requests: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
