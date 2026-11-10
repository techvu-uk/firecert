import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { customers, sites } from "@/db/schema";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui";
import { DueBadge } from "@/components/status";
import { PortalCertList } from "@/components/portal-cert-list";
import { formatUK, formatUKDateTime } from "@/lib/dates";
import { oneLine } from "@/lib/utils";
import { requireUser } from "@/server/auth";
import { certificateRows, openVisitsBySite } from "@/server/queries";
import { serviceKind } from "@/lib/service-kinds";
import { getCompany } from "@/server/services/company";

export const metadata = { title: "My sites" };

export default async function PortalHome() {
  const user = await requireUser(["CUSTOMER"]);
  const customerId = user.customerId!;
  const [[customer], siteRows, certs, company] = await Promise.all([
    db.select().from(customers).where(eq(customers.id, customerId)),
    db.select().from(sites).where(and(eq(sites.customerId, customerId), eq(sites.archived, false))).orderBy(asc(sites.name)),
    certificateRows({ customerId, status: "ISSUED", limit: 10 }),
    getCompany(),
  ]);
  const due = await openVisitsBySite(siteRows.map((s) => s.id));

  return (
    <>
      <PageHeader title={customer?.name ?? "My sites"} subtitle={`Fire alarm certificates and servicing from ${company.name}`} />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">Your sites</h2>
          {siteRows.length === 0 ? (
            <Card><EmptyState title="No sites yet" /></Card>
          ) : (
            siteRows.map((s) => {
              const vs = due.get(s.id) ?? [];
              const v = vs[0];
              return (
                <Link key={s.id} href={`/portal/sites/${s.id}`} className="block rounded-xl border border-ink-200 bg-white p-4 shadow-sm transition hover:border-ink-300 hover:shadow">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold">{s.name}</div>
                      <div className="truncate text-sm text-ink-500">{oneLine(s.addressLines, s.postcode)}</div>
                    </div>
                    {v && <DueBadge dueDate={v.dueDate} status={v.status} />}
                  </div>
                  <div className="mt-3 space-y-0.5 text-sm text-ink-600">
                    {vs.length === 0 && "No service scheduled"}
                    {vs.map((x) => (
                      <div key={x.id}>
                        {serviceKind(x.serviceKind).serviceTitle}:{" "}
                        {x.bookedFor ? `booked ${formatUKDateTime(x.bookedFor)}` : `due ${formatUK(x.dueDate)}`}
                      </div>
                    ))}
                  </div>
                </Link>
              );
            })
          )}
        </div>
        <div className="lg:col-span-3">
          <Card>
            <CardHeader title="Latest certificates" subtitle="Tap a certificate to view, or download a copy" />
            {certs.length === 0 ? <EmptyState title="No certificates yet" body="Certificates appear here as soon as your engineer issues them." /> : <PortalCertList rows={certs} />}
          </Card>
          {company.phone || company.email ? (
            <p className="mt-4 text-center text-sm text-ink-500">
              Questions or need to rearrange a visit? Contact {company.name}
              {company.phone ? ` on ${company.phone}` : ""}
              {company.email ? ` or ${company.email}` : ""}.
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}
