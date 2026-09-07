import { NextResponse } from "next/server";
import { eq, like, or, desc } from "drizzle-orm";
import { db } from "@/db/client";
import { students, departments, semesters, movementRecords, movementTypes } from "@/db/schema";
import { requireRole } from "@/lib/auth/session";
import { handleApiError } from "@/lib/apiError";
import { computeStudentStatus } from "@/lib/rules/status";
import { getSetting } from "@/lib/settings";

export async function GET(req: Request) {
  try {
    const user = await requireRole("guard", "warden", "admin");
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();

    if (!q) return NextResponse.json({ results: [] });

    const rows = await db
      .select({
        id: students.id,
        name: students.name,
        matricNumber: students.matricNumber,
        phone: students.phone,
        departmentName: departments.name,
        semesterLabel: semesters.label,
      })
      .from(students)
      .leftJoin(departments, eq(students.departmentId, departments.id))
      .leftJoin(semesters, eq(students.semesterId, semesters.id))
      .where(or(like(students.name, `%${q}%`), like(students.matricNumber, `%${q}%`)))
      .limit(20);

    const canViewPhone =
      user.role === "guard"
        ? await getSetting<boolean>("guard_can_view_phone")
        : user.role === "warden"
        ? await getSetting<boolean>("warden_can_view_phone")
        : true;

    const results = await Promise.all(
      rows.map(async (s) => {
        const { status } = await computeStudentStatus(s.id);
        const [lastRecord] = await db
          .select({
            movementTypeLabel: movementTypes.label,
            timeOut: movementRecords.timeOut,
            timeIn: movementRecords.timeIn,
            purpose: movementRecords.purpose,
          })
          .from(movementRecords)
          .leftJoin(movementTypes, eq(movementRecords.movementTypeId, movementTypes.id))
          .where(eq(movementRecords.studentId, s.id))
          .orderBy(desc(movementRecords.timeOut))
          .limit(1);

        return {
          ...s,
          phone: canViewPhone ? s.phone : null,
          status,
          lastRecord: lastRecord ?? null,
        };
      })
    );

    return NextResponse.json({ results });
  } catch (err) {
    return handleApiError(err);
  }
}
