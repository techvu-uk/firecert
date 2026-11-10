import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { sites, users, visits } from "@/db/schema";
import { Alert, Badge, Button, Card, CardHeader, DetailList, EmptyState, LinkButton, PageHeader, RowLink } from "@/components/ui";
import { CertStatusBadge, DueBadge, formTitle, OutcomeBadge } from "@/components/status";
import { IconEdit } from "@/components/icons";
import { activeForms } from "@/forms/registry";
import { serviceKind } from "@/lib/service-kinds";
import { formatUK, formatUKDateTime } from "@/lib/dates";
import { requireUser, STAFF } from "@/server/auth";
import { certificateRows } from "@/server/queries";
import { createCertificateAction } from "@/app/actions/certificates";
import { setSiteArchived } from "@/app/actions/customers";

export default async function SitePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(STAFF);
  const isAdmin = user.role === "ADMIN";
  const { id } = await params;
  const site = await db.query.sites.findFirst({ where: eq(sites.id, id), with: { customer: true, assignedEngineer: true } });
  if (!site) notFound();

  const [certs, history] = await Promise.all([
    certificateRows({ siteId: id, limit: 50 }),
    db
      .select({ v: visits, engineer: users.name })
      .from(visits)
      .leftJoin(users, eq(users.id, visits.engineerId))
      .where(eq(visits.siteId, id))
      .orderBy(desc(visits.dueDate))
      .limit(20),
  ]);
  const open = history
    .filter((h) => h.v.type === "SERVICE" && (h.v.status === "DUE" || h.v.status === "BOOKED"))
    .map((h) => h.v)
    .sort((x, y) => x.dueDate.localeCompare(y.dueDate));
  const visible = certs.filter((c) => c.cert.status !== "DRAFT" || isAdmin || c.engineer.id === user.id);

  return (
    <>
      <PageHeader
        title={site.name}
        subtitle={
          <Link href={`/customers/${site.customerId}`} className="font-medium text-ink-600 hover:text-ink-900">
            {site.customer.name}
          </Link>
        }
        back={{ href: `/customers/${site.customerId}`, label: site.customer.name }}
        actions={
          isAdmin && (
            <LinkButton href={`/sites/${id}/edit`} variant="secondary">
              <IconEdit /> Edit site
            </LinkButton>
          )
        }
      />
      {site.archived && (
        <div className="mb-4">
          <Alert tone="warn">This site is archived. Reminders are switched off.</Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {!site.archived && (
            <Card>
              <CardHeader title="Start a certificate" subtitle="System details are filled in from this site automatically." />
              <div className="grid gap-2 p-4 sm:grid-cols-3 sm:p-5">
                {activeForms().map((f) => (
                  <form key={f.id} action={createCertificateAction.bind(null, id, f.id)}>
                    <button className="flex h-full w-full flex-col items-start rounded-lg border border-ink-200 p-3 text-left transition hover:border-brand-300 hover:bg-brand-50/50">
                      <span className="text-sm font-semibold">{f.shortTitle}</span>
                      <span className="mt-0.5 text-xs text-ink-500">{f.description}</span>
                    </button>
                  </form>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Certificates" />
            {visible.length === 0 ? (
              <EmptyState title="No certificates yet" />
            ) : (
              <div className="divide-y divide-ink-100">
                {visible.map((r) => (
                  <RowLink key={r.cert.id} href={`/certificates/${r.cert.id}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold">{r.cert.number ?? formTitle(r.cert.formId, r.cert.formVersion)}</span>
                      <div className="flex shrink-0 gap-1.5">
                        <OutcomeBadge formId={r.cert.formId} formVersion={r.cert.formVersion} outcome={r.cert.outcome} />
                        <CertStatusBadge status={r.cert.status} />
                      </div>
                    </div>
                    <div className="truncate text-sm text-ink-500">
                      {formTitle(r.cert.formId, r.cert.formVersion)} · {r.engineer.name} ·{" "}
                      {r.cert.issuedAt ? formatUK(r.cert.issuedAt) : `edited ${formatUK(r.cert.updatedAt)}`}
                    </div>
                  </RowLink>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Next service" />
            {open.length === 0 ? (
              <p className="p-4 text-sm text-ink-500 sm:p-5">
                Not scheduled. The next service is scheduled automatically when an inspection or commissioning certificate is issued
                {isAdmin ? ", or you can set a date by editing the site." : "."}
              </p>
            ) : (
              <div className="divide-y divide-ink-100">
                {open.map((v) => (
                  <div key={v.id} className="space-y-2 p-4 sm:p-5">
                    <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">{serviceKind(v.serviceKind).serviceTitle}</div>
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-bold">{formatUK(v.dueDate)}</span>
                      <DueBadge dueDate={v.dueDate} status={v.status} />
                    </div>
                    {v.bookedFor && <p className="text-sm text-ink-600">Booked for {formatUKDateTime(v.bookedFor)}</p>}
                    {isAdmin && (
                      <LinkButton href={`/schedule/${v.id}`} variant="secondary" className="w-full">
                        {v.status === "BOOKED" ? "Change booking" : "Book visit"}
                      </LinkButton>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="border-t border-ink-100 px-4 py-3 text-xs text-ink-500 sm:px-5">
              Fire alarm interval: every {site.serviceIntervalMonths} months
              {site.lastServiceDate ? ` · last service ${formatUK(site.lastServiceDate)}` : ""}
            </p>
          </Card>

          <Card>
            <CardHeader title="Site details" />
            <DetailList
              items={[
                { label: "Address", value: [site.addressLines, site.postcode].filter(Boolean).join("\n") },
                { label: "Contact", value: [site.contactName, site.contactEmail, site.contactPhone].filter(Boolean).join("\n") || "Uses customer contact" },
                { label: "Category", value: site.systemCategory },
                { label: "System", value: [site.systemType, site.panelMake, site.panelModel].filter(Boolean).join(" · ") },
                { label: "Panel location", value: site.panelLocation },
                { label: "Zones", value: site.zoneCount?.toString() ?? "" },
                { label: "ARC", value: site.arcConnected ? site.arcDetails || "Yes" : "No" },
                { label: "Engineer", value: site.assignedEngineer?.name ?? "" },
                { label: "Access notes", value: site.accessNotes },
              ]}
            />
          </Card>

          <Card>
            <CardHeader title="Visit history" />
            {history.length === 0 ? (
              <EmptyState title="No visits yet" />
            ) : (
              <ul className="divide-y divide-ink-100">
                {history.map(({ v, engineer }) => (
                  <li key={v.id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm sm:px-5">
                    <span>
                      {formatUK(v.dueDate)} <span className="text-ink-500">· {serviceKind(v.serviceKind).label.toLowerCase()}{engineer ? ` · ${engineer}` : ""}</span>
                    </span>
                    {v.status === "COMPLETED" ? <Badge tone="good">Done</Badge> : v.status === "CANCELLED" ? <Badge>Cancelled</Badge> : <DueBadge dueDate={v.dueDate} status={v.status} />}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {isAdmin && (
            <form action={setSiteArchived.bind(null, id, !site.archived)}>
              <Button variant="danger" className="w-full">{site.archived ? "Restore site" : "Archive site"}</Button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
