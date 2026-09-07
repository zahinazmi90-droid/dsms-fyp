import { db } from "@/db/client";
import { classSessions, staff, departments } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { appDayType, appTimeHHmm } from "@/lib/tz";

export type ResolvedClass = {
  classSessionId: string;
  lecturerId: string;
  lecturerName: string;
  courseName: string | null;
} | null;

/**
 * Answers: "is this student's programme+semester in a scheduled class
 * right now, and if so, who teaches it?" Intentionally minimal (see the
 * comment on class_sessions in src/db/schema.ts).
 */
export async function findResponsibleLecturer(
  departmentId: string,
  semesterId: string,
  atUtc: Date
): Promise<ResolvedClass> {
  const dayType = appDayType(atUtc);
  const nowHHmm = appTimeHHmm(atUtc);

  const rows = await db
    .select({
      id: classSessions.id,
      startTime: classSessions.startTime,
      endTime: classSessions.endTime,
      lecturerId: classSessions.lecturerId,
      courseName: classSessions.courseName,
      lecturerName: staff.name,
    })
    .from(classSessions)
    .innerJoin(staff, eq(classSessions.lecturerId, staff.id))
    .where(
      and(
        eq(classSessions.departmentId, departmentId),
        eq(classSessions.semesterId, semesterId),
        eq(classSessions.dayOfWeek, dayType as never),
        eq(classSessions.isActive, true)
      )
    );

  const match = rows.find((r) => r.startTime <= nowHHmm && nowHHmm < r.endTime);
  if (!match) return null;

  return {
    classSessionId: match.id,
    lecturerId: match.lecturerId,
    lecturerName: match.lecturerName,
    courseName: match.courseName,
  };
}

/** The single active Head of Programme staff member for a department, if any. */
export async function findHeadOfProgramme(
  departmentId: string
): Promise<{ userId: string; name: string } | null> {
  const { users } = await import("@/db/schema");
  const rows = await db
    .select({ id: staff.id, name: staff.name })
    .from(staff)
    .innerJoin(users, eq(staff.id, users.id))
    .where(and(eq(staff.departmentId, departmentId), eq(staff.isActive, true), eq(users.role, "head_of_programme")))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { userId: row.id, name: row.name };
}

export async function getDepartmentName(departmentId: string): Promise<string | null> {
  const [dept] = await db.select({ name: departments.name }).from(departments).where(eq(departments.id, departmentId)).limit(1);
  return dept?.name ?? null;
}
