import { getSetting } from "@/lib/settings";

/**
 * Determines whether a check-in at `checkInUtc` is late, using the deadline
 * that was SNAPSHOTTED onto the movement record at checkout time
 * (`deadlineAppliedAt` -- already grace-period-adjusted at that point).
 *
 * This deliberately does NOT re-resolve the schedule/holiday rules from
 * their current live state. If it did, an Admin changing the return
 * deadline or grace period while a student is already outside would
 * retroactively change whether that specific outing counts as late --
 * which contradicts the system's own design intent (see the comment on
 * `deadlineAppliedAt` in src/db/schema.ts) and would be unfair to students
 * who left in good faith under the rule that was active at the time.
 *
 * The only thing still read live here is the `late_detection_enabled`
 * on/off toggle -- that's a feature switch, not a specific time value, so
 * it's reasonable for it to apply immediately either way.
 */
export async function computeLateStatus(params: {
  deadlineAppliedAt: Date;
  checkInUtc: Date;
}): Promise<{ late: boolean; deadlineUtc: Date }> {
  const lateDetectionEnabled = await getSetting<boolean>("late_detection_enabled");

  if (!lateDetectionEnabled) {
    return { late: false, deadlineUtc: params.deadlineAppliedAt };
  }

  const late = params.checkInUtc.getTime() > params.deadlineAppliedAt.getTime();
  return { late, deadlineUtc: params.deadlineAppliedAt };
}

/** For students still OUTSIDE (no check-in yet): is "now" already past their snapshotted deadline? */
export async function isCurrentlyPastDeadline(deadlineAppliedAt: Date, nowUtc: Date): Promise<boolean> {
  const lateDetectionEnabled = await getSetting<boolean>("late_detection_enabled");
  if (!lateDetectionEnabled) return false;
  return nowUtc.getTime() > deadlineAppliedAt.getTime();
}
