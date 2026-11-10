import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { certificates } from "@/db/schema";
import { Card, CardHeader, EmptyState, LinkButton, PageHeader, RowLink, Stat } from "@/components/ui";
import { CertStatusBadge, formTitle, OutcomeBadge } from "@/components/status";
import { IconPlus } from "@/components/icons";
import { formatUK, formatUKDateTime, todayISO } from "@/lib/dates";
import { requireUser, STAFF } from "@/server/auth";
import { serviceKind } from "@/lib/service-kinds";
import { certificateRows, scheduleCounts, scheduleRows } from "@/server/queries";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const user = await requireUser(STAFF);
  const isAdmin = user.role === "ADMIN";
  const monthStart = new Date(`${todayISO().slice(0, 7)}-01T00:00:00Z`);

  const [counts, booked, drafts, recent, issuedThisMonth] = await Promise.all([
    scheduleCounts(),
    scheduleRows({ filter: "booked", engineerId: isAdmin ? undefined : user.id, limit: 8 }),
    certificateRows({ status: "DRAFT", engineerId: isAdmin ? undefined : user.id, limit: 8 }),
    certificateRows({ status: "ISSUED", limit: 6 }),
    db
      .select({ n: sql<number>`count(*)` })
      .from(certificates)
      .where(and(eq(certificates.status, "ISSUED"), gte(certificates.issuedAt, monthStart))),
  ]);

  return (
    <>
      <PageHeader
        title={`Hello, ${user.name.split(" ")[0]}`}
        subtitle={new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" }).format(new Date())}
        actions={
          <LinkButton href="/certificates/new">
            <IconPlus /> New certificate
          </LinkButton>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Overdue" value={counts.overdue} tone={counts.overdue ? "bad" : undefined} href="/schedule?filter=overdue" />
        <Stat label="Due in 30 days" value={counts.due30} tone={counts.due30 ? "warn" : undefined} href="/schedule?filter=due30" />
        <Stat label="Booked visits" value={counts.booked} href="/schedule?filter=booked" />
        <Stat label="Issued this month" value={Number(issuedThisMonth[0].n)} href="/certificates?status=ISSUED" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={isAdmin ? "Booked visits" : "My booked visits"} action={<LinkButton href="/schedule?filter=booked" variant="ghost" className="h-8 px-2">View all</LinkButton>} />
          {booked.length === 0 ? (
            <EmptyState title="No visits booked" body={isAdmin ? "Book visits from the schedule." : "Visits booked for you will appear here."} />
          ) : (
            <div className="divide-y divide-ink-100">
              {booked.map((r) => (
                <RowLink key={r.visit.id} href={`/sites/${r.site.id}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold">{r.site.name}</span>
                    <span className="shrink-0 text-sm font-medium text-ink-700">{formatUKDateTime(r.visit.bookedFor)}</span>
                  </div>
                  <div className="truncate text-sm text-ink-500">
                    {serviceKind(r.visit.serviceKind).label} · {r.customer.name} · {r.site.postcode}
                    {isAdmin && r.engineer?.name ? ` · ${r.engineer.name}` : ""}
                  </div>
                </RowLink>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title={isAdmin ? "Drafts in progress" : "My drafts"} action={<LinkButton href="/certificates?status=DRAFT" variant="ghost" className="h-8 px-2">View all</LinkButton>} />
          {drafts.length === 0 ? (
            <EmptyState title="No drafts" body="Certificates you start but haven't issued yet appear here." />
          ) : (
            <div className="divide-y divide-ink-100">
              {drafts.map((r) => (
                <RowLink key={r.cert.id} href={`/certificates/${r.cert.id}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold">{r.site.name}</span>
                    <CertStatusBadge status={r.cert.status} />
                  </div>
                  <div className="truncate text-sm text-ink-500">
                    {formTitle(r.cert.formId, r.cert.formVersion)} · edited {formatUK(r.cert.updatedAt)}
                    {isAdmin ? ` · ${r.engineer.name}` : ""}
                  </div>
                </RowLink>
              ))}
            </div>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Recently issued" action={<LinkButton href="/certificates?status=ISSUED" variant="ghost" className="h-8 px-2">View all</LinkButton>} />
          {recent.length === 0 ? (
            <EmptyState title="Nothing issued yet" />
          ) : (
            <div className="divide-y divide-ink-100">
              {recent.map((r) => (
                <RowLink key={r.cert.id} href={`/certificates/${r.cert.id}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="truncate font-semibold">
                      {r.cert.number} <span className="font-normal text-ink-500">· {r.site.name}</span>
                    </span>
                    <OutcomeBadge formId={r.cert.formId} formVersion={r.cert.formVersion} outcome={r.cert.outcome} />
                  </div>
                  <div className="truncate text-sm text-ink-500">
                    {formTitle(r.cert.formId, r.cert.formVersion)} · {r.customer.name} · {formatUK(r.cert.issuedAt)}
                  </div>
                </RowLink>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
