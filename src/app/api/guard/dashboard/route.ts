import { NextResponse } from "next/server";
import { eq, isNull, sql, and, or } from "drizzle-orm";
import { db } from "@/db/client";
import { movementRecords, movementTypes, students, departments, semesters } from "@/db/schema";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/apiError";
import { getSetting } from "@/lib/settings";

export async function GET() {
  try {
    await requireRole("guard", "warden", "admin");

    const [{ totalStudents: totalStudentsRaw }] = await db
      .select({ totalStudents: sql<number>`count(*)` })
      .from(students)
      .where(eq(students.isActive, true));
    const totalStudents = Number(totalStudentsRaw);

    const allOutside = await db
      .select({
        recordId: movementRecords.id,
        studentId: students.id,
        name: students.name,
        matricNumber: students.matricNumber,
        departmentName: departments.name,
        semesterLabel: semesters.label,
        phone: students.phone,
        movementTypeId: movementRecords.movementTypeId,
        movementTypeLabel: movementTypes.label,
        purpose: movementRecords.purpose,
        timeOut: movementRecords.timeOut,
        expectedReturnAt: movementRecords.expectedReturnAt,
        approvalStatus: movementRecords.approvalStatus,
        deadlineAppliedAt: movementRecords.deadlineAppliedAt,
      })
      .from(movementRecords)
      .innerJoin(students, eq(movementRecords.studentId, students.id))
      .leftJoin(departments, eq(students.departmentId, departments.id))
      .leftJoin(semesters, eq(students.semesterId, semesters.id))
      .leftJoin(movementTypes, eq(movementRecords.movementTypeId, movementTypes.id))
      .where(
        and(
          isNull(movementRecords.timeIn),
          or(eq(movementRecords.approvalStatus, "NOT_REQUIRED"), eq(movementRecords.approvalStatus, "APPROVED"))
        )
      );

    const guardCanViewPhone = await getSetting<boolean>("guard_can_view_phone");
    const lateDetectionEnabled = await getSetting<boolean>("late_detection_enabled");

    const now = new Date();
    let outsideCount = 0;
    let lateCount = 0;

    // No extra queries needed here at all: each record already carries its
    // own deadlineAppliedAt, snapshotted at checkout time. Reading it
    // directly (rather than re-resolving schedule/holiday rules per row) is
    // both faster AND more correct -- it reflects the rule that was
    // actually in effect when each student checked out, not whatever the
    // schedule happens to say right now.
    const table = allOutside.map((r) => {
      const checkOutUtc = new Date(r.timeOut);
      const deadlineAppliedAt = r.deadlineAppliedAt ? new Date(r.deadlineAppliedAt) : null;
      const late = lateDetectionEnabled && deadlineAppliedAt ? now.getTime() > deadlineAppliedAt.getTime() : false;
      if (late) lateCount++;
      else outsideCount++;
      const durationMin = Math.round((now.getTime() - checkOutUtc.getTime()) / 60000);
      return {
        recordId: r.recordId,
        studentId: r.studentId,
        name: r.name,
        matricNumber: r.matricNumber,
        departmentName: r.departmentName,
        semesterLabel: r.semesterLabel,
        phone: guardCanViewPhone ? r.phone : null,
        movementType: r.movementTypeLabel,
        purpose: r.purpose,
        timeOut: r.timeOut,
        expectedReturnAt: r.expectedReturnAt,
        durationMinutes: durationMin,
        status: late ? "LATE" : "OUTSIDE",
      };
    });

    const inCollege = totalStudents - (outsideCount + lateCount);

    return NextResponse.json({
      counts: {
        totalStudents,
        inCollege: Math.max(inCollege, 0),
        outside: outsideCount,
        late: lateCount,
      },
      currentlyOutside: table.sort((a, b) => (a.timeOut < b.timeOut ? 1 : -1)),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
