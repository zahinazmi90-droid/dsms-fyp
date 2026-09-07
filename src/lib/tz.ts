import { toZonedTime, format as formatTz } from "date-fns-tz";

export const APP_TZ = "Asia/Kuala_Lumpur";

/** Server-authoritative "now", always UTC underneath. Never trust client time. */
export function serverNowUtc(): Date {
  return new Date();
}

/** Convert a UTC Date to its wall-clock representation in Asia/Kuala_Lumpur. */
export function toAppTime(date: Date): Date {
  return toZonedTime(date, APP_TZ);
}

/** "HH:mm" in Asia/Kuala_Lumpur for a given UTC instant. */
export function appTimeHHmm(date: Date): string {
  return formatTz(toZonedTime(date, APP_TZ), "HH:mm", { timeZone: APP_TZ });
}

/** Day name (MONDAY..SUNDAY) in Asia/Kuala_Lumpur for a given UTC instant. */
export function appDayType(date: Date): string {
  const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  const zoned = toZonedTime(date, APP_TZ);
  return days[zoned.getDay()];
}

/** "YYYY-MM-DD" in Asia/Kuala_Lumpur for a given UTC instant. */
export function appDateString(date: Date): string {
  return formatTz(toZonedTime(date, APP_TZ), "yyyy-MM-dd", { timeZone: APP_TZ });
}

/**
 * Build a UTC Date representing "HH:mm" wall-clock time in Asia/Kuala_Lumpur
 * on the same calendar day as `referenceUtc`. Used to compute today's
 * deadline instant so it can be compared against a UTC timestamp.
 */
export function appTimeToUtc(hhmm: string, referenceUtc: Date): Date {
  const dateStr = appDateString(referenceUtc); // YYYY-MM-DD in KL
  const [h, m] = hhmm.split(":").map(Number);
  // Asia/Kuala_Lumpur is fixed UTC+8, no DST — safe to compute directly.
  const utcHour = h - 8;
  const iso = `${dateStr}T00:00:00.000Z`;
  const base = new Date(iso);
  base.setUTCHours(base.getUTCHours() + utcHour);
  base.setUTCMinutes(base.getUTCMinutes() + m);
  return base;
}

export function formatDisplay(date: Date): string {
  return formatTz(toZonedTime(date, APP_TZ), "dd/MM/yyyy HH:mm", { timeZone: APP_TZ });
}
