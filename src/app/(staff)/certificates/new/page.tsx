import { and, asc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { customers, sites } from "@/db/schema";
import { Card, EmptyState, PageHeader, RowLink } from "@/components/ui";
import { IconSearch } from "@/components/icons";
import { activeForms } from "@/forms/registry";
import { requireUser, STAFF } from "@/server/auth";
import { createCertificateAction } from "@/app/actions/certificates";

export const metadata = { title: "New certificate" };

export default async function NewCertificate({ searchParams }: { searchParams: Promise<{ siteId?: string; q?: string }> }) {
  await requireUser(STAFF);
  const { siteId, q = "" } = await searchParams;

  if (siteId) {
    const site = await db.query.sites.findFirst({ where: eq(sites.id, siteId), with: { customer: true } });
    if (site && !site.archived) {
      return (
        <div className="mx-auto max-w-2xl">
          <PageHeader title="Choose certificate type" subtitle={`${site.name} · ${site.customer.name}`} back={{ href: "/certificates/new", label: "Choose a different site" }} />
          <div className="grid gap-3">
            {activeForms().map((f) => (
              <form key={f.id} action={createCertificateAction.bind(null, site.id, f.id)}>
                <button className="w-full rounded-xl border border-ink-200 bg-white p-4 text-left shadow-sm transition hover:border-brand-300 hover:bg-brand-50/40">
                  <div className="font-semibold">{f.shortTitle}</div>
                  <div className="mt-0.5 text-sm text-ink-500">{f.description}</div>
                </button>
              </form>
            ))}
          </div>
        </div>
      );
    }
  }

  const like = `%${q.trim()}%`;
  const rows = await db
    .select({ site: sites, customer: customers.name })
    .from(sites)
    .innerJoin(customers, eq(customers.id, sites.customerId))
    .where(
      and(
        eq(sites.archived, false),
        eq(customers.archived, false),
        q.trim() ? or(ilike(sites.name, like), ilike(sites.postcode, like), ilike(customers.name, like), ilike(sites.addressLines, like)) : undefined,
      ),
    )
    .orderBy(asc(sites.name))
    .limit(50);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New certificate" subtitle="Which site are you at?" back={{ href: "/certificates", label: "Certificates" }} />
      <form className="relative mb-4" role="search">
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
        <input
          name="q"
          defaultValue={q}
          autoFocus
          placeholder="Search site, customer or postcode"
          className="h-12 w-full rounded-lg border border-ink-200 bg-white pl-10 pr-3 text-[16px] shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        />
      </form>
      <Card>
        {rows.length === 0 ? (
          <EmptyState title="No sites found" body="Sites are added from a customer's page." />
        ) : (
          <div className="divide-y divide-ink-100">
            {rows.map(({ site, customer }) => (
              <RowLink key={site.id} href={`/certificates/new?siteId=${site.id}`}>
                <div className="truncate font-semibold">{site.name}</div>
                <div className="truncate text-sm text-ink-500">
                  {customer} · {site.postcode}
                </div>
              </RowLink>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
