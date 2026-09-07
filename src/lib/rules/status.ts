import { db } from "@/db/client";
import { movementRecords } from "@/db/schema";
import { eq, desc, isNull, and } from "drizzle-orm";
import { isCurrentlyPastDeadline } from "./lateDetection";
import { resolveScheduleWindow } from "./schedule";

export type StudentStatus =
  | "IN_COLLEGE"
  | "OUTSIDE"
  | "LATE"
  | "OVERNIGHT"
  | "PENDING_APPROVAL"
  | "REJECTED";

/**
 * Computes a student's CURRENT status purely from movement_records —
 * never from a manually-set flag. This is the single source of truth
 * used by the student dashboard, guard dashboard, and warden dashboard.
 */
export async function computeStudentStatus(studentId: string): Promise<{
  status: StudentStatus;
  activeRecordId: string | null;
}> {
  const [active] = await db
    .select()
    .from(movementRecords)
    .where(and(eq(movementRecords.studentId, studentId), isNull(movementRecords.timeIn)))
    .orderBy(desc(movementRecords.timeOut))
    .limit(1);

  if (!active) {
    return { status: "IN_COLLEGE", activeRecordId: null };
  }

  if (active.approvalStatus === "PENDING") {
    return { status: "PENDING_APPROVAL", activeRecordId: active.id };
  }

  // A rejected movement is NOT a normal valid outing -- the check-in
  // route already refuses a normal check-in for this case, so the
  // status shown must be consistent: distinctly REJECTED, not OUTSIDE.
  if (active.approvalStatus === "REJECTED") {
    return { status: "REJECTED", activeRecordId: active.id };
  }

  if (active.movementTypeId === "OVERNIGHT") {
    return { status: "OVERNIGHT", activeRecordId: active.id };
  }

  const now = new Date();
  // Use the deadline snapshotted at checkout time (see checkout/route.ts and
  // lateDetection.ts) rather than re-resolving live schedule rules -- this
  // is the same fix applied consistently everywhere late status is computed.
  const deadlineAppliedAt = active.deadlineAppliedAt
    ? new Date(active.deadlineAppliedAt)
    : (await resolveScheduleWindow(new Date(active.timeOut))).returnDeadlineUtc;
  const pastDeadline = await isCurrentlyPastDeadline(deadlineAppliedAt, now);
  if (pastDeadline) {
    return { status: "LATE", activeRecordId: active.id };
  }

  return { status: "OUTSIDE", activeRecordId: active.id };
}
