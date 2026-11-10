import "server-only";
import { and, eq, inArray, max } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { customers, sites, visits, type Site } from "@/db/schema";
import { env } from "@/lib/env";
import { oneLine, toE164 } from "@/lib/utils";
import type { ScheduleEffect } from "@/forms/types";
import { serviceKind, type ServiceKind } from "@/lib/service-kinds";
import { notify } from "@/server/notify";
import { visitBookedMessage } from "@/server/notify/templates";
import { nextServiceDue } from "@/server/schedule-rules";
import { audit } from "@/server/audit";
import { getCompany } from "./company";

const OPEN = ["DUE", "BOOKED"] as const;

export async function openServiceVisit(tx: Tx | typeof db, siteId: string, kind: ServiceKind = "FIRE_ALARM") {
  const [v] = await tx
    .select()
    .from(visits)
    .where(
      and(
        eq(visits.siteId, siteId),
        eq(visits.type, "SERVICE"),
        eq(visits.serviceKind, kind),
        inArray(visits.status, [...OPEN]),
      ),
    )
    .limit(1);
  return v ?? null;
}

/** Creates the open service visit of a kind for a site, or moves its due date. */
export async function setNextServiceDue(tx: Tx, site: Site, dueDate: string, kind: ServiceKind = "FIRE_ALARM") {
  const open = await openServiceVisit(tx, site.id, kind);
  if (open) {
    await tx.update(visits).set({ dueDate }).where(eq(visits.id, open.id));
    return open.id;
  }
  const [v] = await tx
    .insert(visits)
    .values({ siteId: site.id, type: "SERVICE", serviceKind: kind, status: "DUE", dueDate, engineerId: site.assignedEngineerId })
    .returning({ id: visits.id });
  return v.id;
}

/**
 * Called inside the issue transaction. Closes the open service visit of this kind and
 * schedules the next one from the visit date. Returns the new due date and the closed visit.
 */
export async function applyScheduleEffect(
  tx: Tx,
  site: Site,
  effect: ScheduleEffect,
  visitDate: string,
  kind: ServiceKind,
  intervalMonths: number,
): Promise<{ nextDue: string | null; closedVisitId: string | null }> {
  if (effect === "none") return { nextDue: null, closedVisitId: null };

  const [open] = await tx
    .select()
    .from(visits)
    .where(
      and(
        eq(visits.siteId, site.id),
        eq(visits.type, "SERVICE"),
        eq(visits.serviceKind, kind),
        inArray(visits.status, [...OPEN]),
      ),
    )
    .for("update");

  if (open) {
    await tx
      .update(visits)
      .set(
        effect === "complete-service"
          ? { status: "COMPLETED", completedAt: new Date(), serviceDate: visitDate }
          : { status: "CANCELLED", notes: [open.notes, "Superseded by installation/commissioning"].filter(Boolean).join(" · ") },
      )
      .where(eq(visits.id, open.id));
  }

  // Never move the schedule backwards if an older certificate is issued late
  const [{ latest }] = await tx
    .select({ latest: max(visits.serviceDate) })
    .from(visits)
    .where(and(eq(visits.siteId, site.id), eq(visits.serviceKind, kind), eq(visits.status, "COMPLETED")));
  const base = latest && latest > visitDate ? latest : visitDate;
  const nextDue = nextServiceDue(base, intervalMonths);
  if (kind === "FIRE_ALARM") await tx.update(sites).set({ lastServiceDate: base }).where(eq(sites.id, site.id));
  await tx
    .insert(visits)
    .values({ siteId: site.id, type: "SERVICE", serviceKind: kind, status: "DUE", dueDate: nextDue, engineerId: site.assignedEngineerId });

  return { nextDue, closedVisitId: open?.id ?? null };
}

export function siteContact(site: Site, customer: typeof customers.$inferSelect) {
  return {
    name: site.contactName || customer.contactName || customer.name,
    email: site.contactEmail || customer.contactEmail,
    phone: site.contactPhone || customer.contactPhone,
  };
}

/** Sends a message to a site's contact on every channel the customer has opted into. */
export async function notifySiteContact(opts: {
  site: Site;
  customer: typeof customers.$inferSelect;
  kind: string;
  visitId?: string;
  certificateId?: string;
  dedupePrefix?: string;
  build: (contactName: string) => { subject: string; text: string; html?: string; sms?: string };
  attachments?: { filename: string; content: Uint8Array; contentType: string }[];
}) {
  const contact = siteContact(opts.site, opts.customer);
  const msg = opts.build(contact.name);
  const phone = contact.phone ? toE164(contact.phone) : null;
  const sends: Promise<unknown>[] = [];
  const key = (ch: string, to: string) => (opts.dedupePrefix ? `${opts.dedupePrefix}:${ch}:${to.toLowerCase()}` : undefined);

  if (opts.customer.notifyEmail && contact.email) {
    sends.push(
      notify({
        kind: opts.kind,
        channel: "email",
        visitId: opts.visitId,
        certificateId: opts.certificateId,
        dedupeKey: key("email", contact.email),
        message: { to: contact.email, subject: msg.subject, text: msg.text, html: msg.html, attachments: opts.attachments },
      }),
    );
  }
  for (const ch of ["sms", "whatsapp"] as const) {
    const wanted = ch === "sms" ? opts.customer.notifySms : opts.customer.notifyWhatsapp;
    if (wanted && phone && msg.sms) {
      sends.push(
        notify({
          kind: opts.kind,
          channel: ch,
          visitId: opts.visitId,
          dedupeKey: key(ch, phone),
          message: { to: phone, subject: msg.subject, text: msg.sms },
        }),
      );
    }
  }
  await Promise.all(sends);
}

export async function bookVisit(userId: string, visitId: string, bookedFor: Date, engineerId: string | null, notes: string, sendNotice: boolean) {
  const result = await db.transaction(async (tx) => {
    const [v] = await tx.select().from(visits).where(eq(visits.id, visitId)).for("update");
    if (!v) throw new Error("Visit not found");
    if (v.status !== "DUE" && v.status !== "BOOKED") throw new Error("This visit is already closed");
    await tx.update(visits).set({ status: "BOOKED", bookedFor, engineerId, notes }).where(eq(visits.id, visitId));
    await audit(tx, userId, "visit.booked", "visit", visitId, { bookedFor: bookedFor.toISOString(), engineerId });
    return v;
  });

  if (sendNotice) {
    const [row] = await db
      .select({ site: sites, customer: customers })
      .from(sites)
      .innerJoin(customers, eq(customers.id, sites.customerId))
      .where(eq(sites.id, result.siteId));
    const company = await getCompany();
    await notifySiteContact({
      site: row.site,
      customer: row.customer,
      kind: "BOOKED",
      visitId,
      build: (name) =>
        visitBookedMessage({
          service: serviceKind(result.serviceKind).service,
          company: company.name,
          companyPhone: company.phone,
          customerName: name,
          siteName: row.site.name,
          siteAddress: oneLine(row.site.addressLines, row.site.postcode),
          dueDate: result.dueDate,
          bookedFor,
          portalUrl: `${env.appUrl}/portal`,
        }),
    });
  }
}

export async function unbookVisit(userId: string, visitId: string) {
  await db.transaction(async (tx) => {
    const [v] = await tx.select().from(visits).where(eq(visits.id, visitId)).for("update");
    if (!v || v.status !== "BOOKED") throw new Error("Visit is not booked");
    await tx.update(visits).set({ status: "DUE", bookedFor: null }).where(eq(visits.id, visitId));
    await audit(tx, userId, "visit.unbooked", "visit", visitId);
  });
}
