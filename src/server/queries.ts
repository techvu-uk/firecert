import "server-only";
import { and, asc, desc, eq, gte, ilike, inArray, lt, lte, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { certificates, customers, sites, users, visits } from "@/db/schema";
import { addMonthsISO, todayISO } from "@/lib/dates";

export type ScheduleFilter = "overdue" | "due30" | "booked" | "all";

export async function scheduleRows(opts: { filter: ScheduleFilter; engineerId?: string; q?: string; kind?: string; limit?: number }) {
  const today = todayISO();
  const conds: SQL[] = [
    eq(visits.type, "SERVICE"),
    inArray(visits.status, ["DUE", "BOOKED"]),
    eq(sites.archived, false),
    eq(customers.archived, false),
  ];
  if (opts.filter === "overdue") conds.push(lt(visits.dueDate, today), eq(visits.status, "DUE"));
  if (opts.filter === "due30") conds.push(gte(visits.dueDate, today), lte(visits.dueDate, addMonthsISO(today, 1)), eq(visits.status, "DUE"));
  if (opts.filter === "booked") conds.push(eq(visits.status, "BOOKED"));
  if (opts.engineerId) conds.push(eq(visits.engineerId, opts.engineerId));
  if (opts.kind) conds.push(eq(visits.serviceKind, opts.kind));
  if (opts.q) {
    const like = `%${opts.q}%`;
    conds.push(or(ilike(sites.name, like), ilike(sites.postcode, like), ilike(customers.name, like))!);
  }
  const eng = alias(users, "eng");
  return db
    .select({
      visit: visits,
      site: { id: sites.id, name: sites.name, postcode: sites.postcode, addressLines: sites.addressLines },
      customer: { id: customers.id, name: customers.name },
      engineer: { id: eng.id, name: eng.name },
    })
    .from(visits)
    .innerJoin(sites, eq(sites.id, visits.siteId))
    .innerJoin(customers, eq(customers.id, sites.customerId))
    .leftJoin(eng, eq(eng.id, visits.engineerId))
    .where(and(...conds))
    .orderBy(opts.filter === "booked" ? asc(visits.bookedFor) : asc(visits.dueDate))
    .limit(opts.limit ?? 200);
}

export async function scheduleCounts() {
  const today = todayISO();
  const in30 = addMonthsISO(today, 1);
  const [row] = await db
    .select({
      overdue: sql<number>`count(*) filter (where ${visits.status} = 'DUE' and ${visits.dueDate} < ${today})`,
      due30: sql<number>`count(*) filter (where ${visits.status} = 'DUE' and ${visits.dueDate} >= ${today} and ${visits.dueDate} <= ${in30})`,
      booked: sql<number>`count(*) filter (where ${visits.status} = 'BOOKED')`,
    })
    .from(visits)
    .innerJoin(sites, eq(sites.id, visits.siteId))
    .innerJoin(customers, eq(customers.id, sites.customerId))
    .where(and(eq(visits.type, "SERVICE"), eq(sites.archived, false), eq(customers.archived, false)));
  return { overdue: Number(row.overdue), due30: Number(row.due30), booked: Number(row.booked) };
}

export async function certificateRows(opts: {
  status?: "DRAFT" | "ISSUED" | "VOID";
  engineerId?: string;
  siteId?: string;
  customerId?: string;
  q?: string;
  limit?: number;
}) {
  const conds: SQL[] = [];
  if (opts.status) conds.push(eq(certificates.status, opts.status));
  if (opts.engineerId) conds.push(eq(certificates.engineerId, opts.engineerId));
  if (opts.siteId) conds.push(eq(certificates.siteId, opts.siteId));
  if (opts.customerId) conds.push(eq(sites.customerId, opts.customerId));
  if (opts.q) {
    const like = `%${opts.q}%`;
    conds.push(or(ilike(certificates.number, like), ilike(sites.name, like), ilike(customers.name, like), ilike(sites.postcode, like))!);
  }
  return db
    .select({
      cert: {
        id: certificates.id,
        number: certificates.number,
        formId: certificates.formId,
        formVersion: certificates.formVersion,
        status: certificates.status,
        outcome: certificates.outcome,
        issuedAt: certificates.issuedAt,
        updatedAt: certificates.updatedAt,
        createdAt: certificates.createdAt,
      },
      site: { id: sites.id, name: sites.name, postcode: sites.postcode },
      customer: { id: customers.id, name: customers.name },
      engineer: { id: users.id, name: users.name },
    })
    .from(certificates)
    .innerJoin(sites, eq(sites.id, certificates.siteId))
    .innerJoin(customers, eq(customers.id, sites.customerId))
    .innerJoin(users, eq(users.id, certificates.engineerId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(sql`coalesce(${certificates.issuedAt}, ${certificates.updatedAt})`))
    .limit(opts.limit ?? 100);
}

export async function engineers() {
  return db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(and(inArray(users.role, ["ENGINEER", "ADMIN"]), eq(users.active, true)))
    .orderBy(asc(users.name));
}

/** Open service visits for each site (one per service kind), soonest first. */
export async function openVisitsBySite(siteIds: string[]) {
  const map = new Map<string, (typeof visits.$inferSelect)[]>();
  if (siteIds.length === 0) return map;
  const rows = await db
    .select()
    .from(visits)
    .where(and(inArray(visits.siteId, siteIds), eq(visits.type, "SERVICE"), inArray(visits.status, ["DUE", "BOOKED"])))
    .orderBy(asc(visits.dueDate));
  for (const r of rows) map.set(r.siteId, [...(map.get(r.siteId) ?? []), r]);
  return map;
}
