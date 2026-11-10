/**
 * Pure scheduling rules (no database) — easy to test and to change in one place.
 */
import { addMonthsISO, daysUntil } from "@/lib/dates";

export const REMINDER_KINDS = ["DUE_30", "DUE_7", "OVERDUE", "OVERDUE_30", "BOOKED_TOMORROW"] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

export const REMINDER_LABEL: Record<ReminderKind, string> = {
  DUE_30: "Due in 30 days",
  DUE_7: "Due in 7 days",
  OVERDUE: "Overdue",
  OVERDUE_30: "Overdue by 30 days",
  BOOKED_TOMORROW: "Visit tomorrow",
};

/** Next service due date: interval months after the date of the visit. */
export function nextServiceDue(visitDateISO: string, intervalMonths: number): string {
  if (!Number.isInteger(intervalMonths) || intervalMonths < 1 || intervalMonths > 24)
    throw new Error("Service interval must be 1–24 months");
  return addMonthsISO(visitDateISO, intervalMonths);
}

export type DueState = "overdue" | "due-soon" | "upcoming";

export function dueState(dueDateISO: string, todayISO: string): DueState {
  const d = daysUntil(dueDateISO, todayISO);
  if (d < 0) return "overdue";
  if (d <= 30) return "due-soon";
  return "upcoming";
}

/**
 * Which reminder (if any) applies to an open visit today. Only the single most relevant
 * reminder is returned, so if the job doesn't run for a few days nobody gets a burst of
 * stale messages. Each kind is sent at most once per visit (enforced by the dedupe key).
 */
export function reminderFor(
  visit: { status: "DUE" | "BOOKED"; dueDate: string; bookedForDate: string | null },
  todayISO: string,
): ReminderKind | null {
  if (visit.status === "BOOKED" && visit.bookedForDate) {
    const d = daysUntil(visit.bookedForDate, todayISO);
    return d === 1 || d === 0 ? "BOOKED_TOMORROW" : null;
  }
  const d = daysUntil(visit.dueDate, todayISO);
  if (d <= -30) return "OVERDUE_30";
  if (d < 0) return "OVERDUE";
  if (d <= 7) return "DUE_7";
  if (d <= 30) return "DUE_30";
  return null;
}
