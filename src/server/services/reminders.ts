import "server-only";
import { and, eq, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { customers, sites, visits } from "@/db/schema";
import { addMonthsISO, daysUntil, todayISO } from "@/lib/dates";
import { env } from "@/lib/env";
import { oneLine } from "@/lib/utils";
import { notify } from "@/server/notify";
import { officeDigestMessage, reminderMessage } from "@/server/notify/templates";
import { dueState, reminderFor, REMINDER_LABEL } from "@/server/schedule-rules";
import { getCompany } from "./company";
import { serviceKind } from "@/lib/service-kinds";
import { notifySiteContact } from "./scheduling";

/**
 * Daily reminder job. Safe to run as often as you like — every message has a dedupe key,
 * so each reminder reaches each person at most once.
 *
 * Trigger it daily (e.g. 08:00) with `npm run reminders` or GET /api/cron/reminders.
 */
export async function runReminders(now = new Date()) {
  const today = todayISO(now);
  const company = await getCompany();
  const horizon = addMonthsISO(today, 2);

  const rows = await db
    .select({ visit: visits, site: sites, customer: customers })
    .from(visits)
    .innerJoin(sites, eq(sites.id, visits.siteId))
    .innerJoin(customers, eq(customers.id, sites.customerId))
    .where(
      and(
        eq(visits.type, "SERVICE"),
        inArray(visits.status, ["DUE", "BOOKED"]),
        eq(sites.archived, false),
        eq(customers.archived, false),
        lte(visits.dueDate, horizon),
      ),
    );

  let considered = 0;
  for (const { visit, site, customer } of rows) {
    const bookedForDate = visit.bookedFor ? todayISO(visit.bookedFor) : null;
    const kind = reminderFor({ status: visit.status as "DUE" | "BOOKED", dueDate: visit.dueDate, bookedForDate }, today);
    if (!kind) continue;
    considered++;
    await notifySiteContact({
      site,
      customer,
      kind,
      visitId: visit.id,
      dedupePrefix: `visit:${visit.id}:${kind}${kind === "BOOKED_TOMORROW" ? `:${bookedForDate}` : ""}`,
      build: (name) =>
        reminderMessage(kind, {
          service: serviceKind(visit.serviceKind).service,
          company: company.name,
          companyPhone: company.phone,
          customerName: name,
          siteName: site.name,
          siteAddress: oneLine(site.addressLines, site.postcode),
          dueDate: visit.dueDate,
          bookedFor: visit.bookedFor,
          portalUrl: `${env.appUrl}/portal`,
        }),
    });
  }

  // One daily digest to the office listing unbooked visits that are overdue or due within 30 days
  let digest = 0;
  if (env.officeEmail) {
    const attention = rows
      .filter(({ visit }) => visit.status === "DUE" && dueState(visit.dueDate, today) !== "upcoming")
      .sort((a, b) => a.visit.dueDate.localeCompare(b.visit.dueDate))
      .map(({ visit, site, customer }) => ({
        site: site.name,
        customer: customer.name,
        due: visit.dueDate,
        service: serviceKind(visit.serviceKind).service,
        state: daysUntil(visit.dueDate, today) < 0 ? REMINDER_LABEL.OVERDUE : "Due soon",
      }));
    if (attention.length) {
      const msg = officeDigestMessage(company.name, attention, `${env.appUrl}/schedule`);
      await notify({
        kind: "OFFICE_DIGEST",
        channel: "email",
        dedupeKey: `digest:${today}:${env.officeEmail.toLowerCase()}`,
        message: { to: env.officeEmail, ...msg },
      });
      digest = attention.length;
    }
  }

  return { today, openVisits: rows.length, remindersConsidered: considered, digestItems: digest };
}
