import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { students, departments, semesters } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { computeStudentStatus } from "@/lib/rules/status";
import { handleApiError } from "@/lib/apiError";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ user: null });

    if (user.role === "student") {
      const [row] = await db
        .select({
          id: students.id,
          matricNumber: students.matricNumber,
          name: students.name,
          phone: students.phone,
          departmentName: departments.name,
          semesterLabel: semesters.label,
        })
        .from(students)
        .leftJoin(departments, eq(students.departmentId, departments.id))
        .leftJoin(semesters, eq(students.semesterId, semesters.id))
        .where(eq(students.id, user.id))
        .limit(1);

      const { status } = await computeStudentStatus(user.id);

      return NextResponse.json({
        user: { ...user, profile: row, status },
      });
    }

    return NextResponse.json({ user });
  } catch (err) {
    return handleApiError(err);
  }
}
