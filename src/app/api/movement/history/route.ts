import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { movementRecords, movementTypes } from "@/db/schema";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/apiError";

export async function GET() {
  try {
    const user = await requireRole("student");

    const rows = await db
      .select({
        id: movementRecords.id,
        movementTypeId: movementRecords.movementTypeId,
        movementTypeLabel: movementTypes.label,
        purpose: movementRecords.purpose,
        outsideAddress: movementRecords.outsideAddress,
        timeOut: movementRecords.timeOut,
        timeIn: movementRecords.timeIn,
        lateStatus: movementRecords.lateStatus,
        approvalStatus: movementRecords.approvalStatus,
      })
      .from(movementRecords)
      .leftJoin(movementTypes, eq(movementRecords.movementTypeId, movementTypes.id))
      .where(eq(movementRecords.studentId, user.id))
      .orderBy(desc(movementRecords.timeOut));

    return NextResponse.json({ records: rows });
  } catch (err) {
    return handleApiError(err);
  }
}
