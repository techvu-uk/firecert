/** Date helpers. Calendar dates are stored as "YYYY-MM-DD" strings in UK local time. */
import { addMonths, differenceInCalendarDays, parseISO, format } from "date-fns";

export const APP_TZ = "Europe/London";

/** Today's date in the UK as YYYY-MM-DD. */
export function todayISO(now: Date = new Date(), tz = APP_TZ): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Adds months, clamping to month end (31 Jan + 1 month = 28/29 Feb). */
export function addMonthsISO(dateISO: string, months: number): string {
  return format(addMonths(parseISO(dateISO), months), "yyyy-MM-dd");
}

export function daysUntil(dateISO: string, todayIso: string): number {
  return differenceInCalendarDays(parseISO(dateISO), parseISO(todayIso));
}

export function formatUK(dateISO: string | Date | null | undefined): string {
  if (!dateISO) return "";
  if (dateISO instanceof Date) {
    return new Intl.DateTimeFormat("en-GB", { timeZone: APP_TZ, day: "2-digit", month: "short", year: "numeric" }).format(dateISO);
  }
  return format(parseISO(dateISO), "dd MMM yyyy");
}

export function formatUKDateTime(d: Date | null | undefined): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** Converts a UK local "YYYY-MM-DDTHH:mm" (from <input type=datetime-local>) to a Date. */
export function ukLocalToDate(local: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  // Work out the UK offset at that moment (0 in winter, +1h in summer)
  const probe = new Date(asUtc);
  const ukParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TZ,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(probe);
  const offsetHours = (Number(ukParts) - probe.getUTCHours() + 24) % 24;
  return new Date(asUtc - offsetHours * 3600_000);
}

/** Inverse of ukLocalToDate, for pre-filling datetime-local inputs. */
export function dateToUkLocal(d: Date | null | undefined): string {
  if (!d) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
