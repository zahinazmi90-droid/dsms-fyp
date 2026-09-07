import { NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { approvalRequests, movementRecords, students, movementTypes } from "@/db/schema";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/apiError";

export async function GET() {
  try {
    await requireRole("warden", "admin");

    const pending = await db
      .select({
        approvalId: approvalRequests.id,
        approverRole: approvalRequests.approverRole,
        requestedAt: approvalRequests.requestedAt,
        movementRecordId: movementRecords.id,
        studentName: students.name,
        matricNumber: students.matricNumber,
        movementTypeLabel: movementTypes.label,
        purpose: movementRecords.purpose,
        outsideAddress: movementRecords.outsideAddress,
        timeOut: movementRecords.timeOut,
      })
      .from(approvalRequests)
      .innerJoin(movementRecords, eq(approvalRequests.movementRecordId, movementRecords.id))
      .innerJoin(students, eq(movementRecords.studentId, students.id))
      .leftJoin(movementTypes, eq(movementRecords.movementTypeId, movementTypes.id))
      .where(and(eq(approvalRequests.status, "PENDING"), eq(approvalRequests.approverRole, "WARDEN")))
      .orderBy(desc(approvalRequests.requestedAt));

    return NextResponse.json({ pendingApprovals: pending });
  } catch (err) {
    return handleApiError(err);
  }
}
