import { randomUUID } from "crypto";
import { db } from "@/db/client";
import { approvalRequests, students } from "@/db/schema";
import { eq } from "drizzle-orm";
import { resolveScheduleWindow } from "@/lib/rules/schedule";
import { appTimeHHmm } from "@/lib/tz";
import { findResponsibleLecturer, findHeadOfProgramme } from "@/lib/timetable";
import { notifyUser } from "@/lib/notifications/service";

export type AcademicRoutingResult = {
  approvalRequired: boolean;
  reason:
    | "AFTER_HOURS_WARDEN"
    | "WEEKEND_OR_HOLIDAY_NO_APPROVAL"
    | "CLASS_TIME_LECTURER_AND_HOP"
    | "NO_CLASS_HOP_ONLY";
};

const ALLOWED_START_HHMM = "07:00";
const ALLOWED_END_HHMM = "22:00";

/**
 * Implements sections 8-11 of the academic workflow spec:
 *   - After 22:00 or before 07:00 -> WARDEN only (after-hours/emergency).
 *   - Saturday/Sunday/holiday, within allowed hours -> no academic approval.
 *   - Weekday, within a scheduled class -> Lecturer AND HOP notified at
 *     the same time (never wait for lecturer first).
 *   - Weekday, no matching class -> HOP only.
 */
export async function routeAcademicApproval(params: {
  movementRecordId: string;
  studentId: string;
  nowUtc: Date;
}): Promise<AcademicRoutingResult> {
  const [student] = await db.select().from(students).where(eq(students.id, params.studentId)).limit(1);
  if (!student) throw new Error("Student not found during academic approval routing.");

  const nowHHmm = appTimeHHmm(params.nowUtc);
  const isAfterHours = nowHHmm < ALLOWED_START_HHMM || nowHHmm >= ALLOWED_END_HHMM;
  const studentName = student.name;

  if (isAfterHours) {
    await db.insert(approvalRequests).values({
      id: randomUUID(),
      movementRecordId: params.movementRecordId,
      approverRole: "WARDEN",
      status: "PENDING",
    });
    const { users } = await import("@/db/schema");
    const wardens = await db.select({ id: users.id }).from(users).where(eq(users.role, "warden"));
    for (const w of wardens) {
      await notifyUser({
        userId: w.id,
        type: "AFTER_HOURS_REQUEST",
        title: "🚨 Permohonan Keluar Selepas Waktu",
        message: `${studentName} (${student.matricNumber}) memohon keluar selepas waktu dibenarkan.`,
        requestId: params.movementRecordId,
        movementId: params.movementRecordId,
      });
    }
    return { approvalRequired: true, reason: "AFTER_HOURS_WARDEN" };
  }

  const window = await resolveScheduleWindow(params.nowUtc);
  if (window.source === "HOLIDAY" || window.dayType === "SATURDAY" || window.dayType === "SUNDAY") {
    return { approvalRequired: false, reason: "WEEKEND_OR_HOLIDAY_NO_APPROVAL" };
  }

  if (!student.departmentId || !student.semesterId) {
    throw new Error(
      "Student has no department/semester assigned -- cannot route academic approval. Admin must assign these first."
    );
  }

  const hop = await findHeadOfProgramme(student.departmentId);
  if (!hop) {
    throw new Error(
      "No active Head of Programme assigned for this student's department. Admin must assign one at /admin/staff before academic outing requests can be routed."
    );
  }

  const classMatch = await findResponsibleLecturer(student.departmentId, student.semesterId, params.nowUtc);

  await db.insert(approvalRequests).values({
    id: randomUUID(),
    movementRecordId: params.movementRecordId,
    approverRole: "HEAD_OF_PROGRAMME",
    assignedToUserId: hop.userId,
    status: "PENDING",
  });

  const notifyPromises: Promise<void>[] = [
    notifyUser({
      userId: hop.userId,
      type: "HOP_APPROVAL_REQUIRED",
      title: "🔔 Permohonan Keluar Baharu",
      message: `${studentName} (${student.matricNumber}) memohon keluar semasa waktu kuliah.`,
      requestId: params.movementRecordId,
      movementId: params.movementRecordId,
    }),
  ];

  if (classMatch) {
    await db.insert(approvalRequests).values({
      id: randomUUID(),
      movementRecordId: params.movementRecordId,
      approverRole: "TEACHER",
      assignedToUserId: classMatch.lecturerId,
      status: "PENDING",
    });
    notifyPromises.push(
      notifyUser({
        userId: classMatch.lecturerId,
        type: "LECTURER_APPROVAL_REQUIRED",
        title: "🔔 Permohonan Keluar Baharu",
        message: `${studentName} (${student.matricNumber}) memohon keluar semasa kelas ${classMatch.courseName ?? ""}.`,
        requestId: params.movementRecordId,
        movementId: params.movementRecordId,
      })
    );
  }

  notifyPromises.push(
    notifyUser({
      userId: params.studentId,
      type: "OUTING_SUBMITTED",
      title: "📋 Permohonan Dihantar",
      message: classMatch
        ? "Permohonan anda telah dihantar kepada Pensyarah dan Ketua Program."
        : "Permohonan anda telah dihantar kepada Ketua Program.",
      requestId: params.movementRecordId,
      movementId: params.movementRecordId,
    })
  );

  await Promise.all(notifyPromises);

  return {
    approvalRequired: true,
    reason: classMatch ? "CLASS_TIME_LECTURER_AND_HOP" : "NO_CLASS_HOP_ONLY",
  };
}
