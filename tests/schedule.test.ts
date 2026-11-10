import { describe, expect, it } from "vitest";
import { dueState, nextServiceDue, reminderFor } from "@/server/schedule-rules";
import { addMonthsISO, dateToUkLocal, todayISO, ukLocalToDate } from "@/lib/dates";
import { toE164 } from "@/lib/utils";

describe("service scheduling", () => {
  it("adds the interval to the visit date", () => {
    expect(nextServiceDue("2026-05-15", 6)).toBe("2026-11-15");
    expect(nextServiceDue("2026-11-09", 12)).toBe("2027-11-09");
  });
  it("clamps month ends", () => {
    expect(addMonthsISO("2026-08-31", 6)).toBe("2027-02-28");
    expect(addMonthsISO("2027-08-31", 6)).toBe("2028-02-29");
  });
  it("rejects silly intervals", () => {
    expect(() => nextServiceDue("2026-01-01", 0)).toThrow();
    expect(() => nextServiceDue("2026-01-01", 1.5)).toThrow();
  });
  it("classifies due state", () => {
    expect(dueState("2026-11-08", "2026-11-09")).toBe("overdue");
    expect(dueState("2026-12-09", "2026-11-09")).toBe("due-soon");
    expect(dueState("2026-12-10", "2026-11-09")).toBe("upcoming");
  });
});

describe("reminders", () => {
  const due = (dueDate: string) => ({ status: "DUE" as const, dueDate, bookedForDate: null });
  const T = "2026-11-09";
  it("picks the right reminder", () => {
    expect(reminderFor(due("2027-01-01"), T)).toBeNull();
    expect(reminderFor(due("2026-12-09"), T)).toBe("DUE_30");
    expect(reminderFor(due("2026-11-16"), T)).toBe("DUE_7");
    expect(reminderFor(due("2026-11-09"), T)).toBe("DUE_7");
    expect(reminderFor(due("2026-11-08"), T)).toBe("OVERDUE");
    expect(reminderFor(due("2026-10-10"), T)).toBe("OVERDUE_30");
  });
  it("only reminds booked visits the day before", () => {
    const b = (d: string) => ({ status: "BOOKED" as const, dueDate: "2026-10-01", bookedForDate: d });
    expect(reminderFor(b("2026-11-10"), T)).toBe("BOOKED_TOMORROW");
    expect(reminderFor(b("2026-11-20"), T)).toBeNull();
  });
});

describe("dates & phones", () => {
  it("uses UK date", () => {
    expect(todayISO(new Date("2026-06-30T23:30:00Z"))).toBe("2026-07-01"); // BST
    expect(todayISO(new Date("2026-12-31T23:30:00Z"))).toBe("2026-12-31"); // GMT
  });
  it("round-trips UK local times across BST", () => {
    expect(ukLocalToDate("2026-07-01T09:00")!.toISOString()).toBe("2026-07-01T08:00:00.000Z");
    expect(ukLocalToDate("2026-12-01T09:00")!.toISOString()).toBe("2026-12-01T09:00:00.000Z");
    expect(dateToUkLocal(new Date("2026-07-01T08:00:00Z"))).toBe("2026-07-01T09:00");
  });
  it("normalises UK numbers", () => {
    expect(toE164("07700 900123")).toBe("+447700900123");
    expect(toE164("+44 7700 900123")).toBe("+447700900123");
    expect(toE164("123")).toBeNull();
  });
});
