import { db } from "@/db/client";
import { scheduleRules, holidayDates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { appDateString, appDayType, appTimeToUtc } from "@/lib/tz";

export type ResolvedWindow = {
  source: "HOLIDAY" | "WEEKDAY_RULE";
  dayType: string;
  outingStartLocal: string; // "HH:mm"
  returnDeadlineLocal: string; // "HH:mm"
  outingStartUtc: Date;
  returnDeadlineUtc: Date;
};

/**
 * Resolves the applicable outing-start / return-deadline window for a given
 * instant, following priority:
 *   1. An active Holiday entry for that calendar date (Asia/Kuala_Lumpur)
 *   2. The active ScheduleRule for that day-of-week
 * Never hardcodes times — always reads from DB (Admin-configurable).
 */
export async function resolveScheduleWindow(referenceUtc: Date): Promise<ResolvedWindow> {
  const dateStr = appDateString(referenceUtc);

  const holidayRows = await db
    .select()
    .from(holidayDates)
    .where(eq(holidayDates.date, dateStr));
  const activeHoliday = holidayRows.find((h) => h.isActive);

  if (activeHoliday) {
    return {
      source: "HOLIDAY",
      dayType: "HOLIDAY",
      outingStartLocal: activeHoliday.outingStart,
      returnDeadlineLocal: activeHoliday.returnDeadline,
      outingStartUtc: appTimeToUtc(activeHoliday.outingStart, referenceUtc),
      returnDeadlineUtc: appTimeToUtc(activeHoliday.returnDeadline, referenceUtc),
    };
  }

  const dayType = appDayType(referenceUtc);
  const ruleRows = await db
    .select()
    .from(scheduleRules)
    .where(eq(scheduleRules.dayType, dayType as never));
  const rule = ruleRows.find((r) => r.isActive) ?? ruleRows[0];

  if (!rule) {
    throw new Error(`No schedule rule configured for ${dayType}. Admin must configure this in /admin/settings.`);
  }

  return {
    source: "WEEKDAY_RULE",
    dayType,
    outingStartLocal: rule.outingStart,
    returnDeadlineLocal: rule.returnDeadline,
    outingStartUtc: appTimeToUtc(rule.outingStart, referenceUtc),
    returnDeadlineUtc: appTimeToUtc(rule.returnDeadline, referenceUtc),
  };
}
