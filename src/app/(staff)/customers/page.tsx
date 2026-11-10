import { and, asc, count, eq, ilike, or } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { customers, sites } from "@/db/schema";
import { Card, EmptyState, LinkButton, PageHeader, RowLink } from "@/components/ui";
import { IconPlus, IconSearch } from "@/components/icons";
import { requireUser, STAFF } from "@/server/auth";

export const metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; archived?: string }> }) {
  const user = await requireUser(STAFF);
  const { q = "", archived } = await searchParams;
  const showArchived = archived === "1";
  const like = `%${q.trim()}%`;

  const rows = await db
    .select({ c: customers, siteCount: count(sites.id) })
    .from(customers)
    .leftJoin(sites, and(eq(sites.customerId, customers.id), eq(sites.archived, false)))
    .where(
      and(
        eq(customers.archived, showArchived),
        q.trim()
          ? or(ilike(customers.name, like), ilike(customers.accountRef, like), ilike(customers.postcode, like), ilike(sites.name, like), ilike(sites.postcode, like))
          : undefined,
      ),
    )
    .groupBy(customers.id)
    .orderBy(asc(customers.name))
    .limit(300);

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle={`${rows.length} ${showArchived ? "archived " : ""}customer${rows.length === 1 ? "" : "s"}`}
        actions={
          user.role === "ADMIN" && (
            <LinkButton href="/customers/new">
              <IconPlus /> New customer
            </LinkButton>
          )
        }
      />
      <form className="mb-4 flex gap-2" role="search">
        <div className="relative flex-1">
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search customers, sites or postcodes"
            className="h-11 w-full rounded-lg border border-ink-200 bg-white pl-10 pr-3 text-[15px] shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 sm:h-10 sm:text-sm"
          />
        </div>
        {showArchived && <input type="hidden" name="archived" value="1" />}
      </form>
      <Card>
        {rows.length === 0 ? (
          <EmptyState title={q ? "No matches" : "No customers yet"} body={q ? "Try a different search." : "Add your first customer to get started."} />
        ) : (
          <div className="divide-y divide-ink-100">
            {rows.map(({ c, siteCount }) => (
              <RowLink key={c.id} href={`/customers/${c.id}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold">{c.name}</span>
                  <span className="shrink-0 text-sm text-ink-500">
                    {siteCount} site{siteCount === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="truncate text-sm text-ink-500">
                  {[c.accountRef, c.contactName, c.postcode].filter(Boolean).join(" · ") || "No contact details"}
                </div>
              </RowLink>
            ))}
          </div>
        )}
      </Card>
      <div className="mt-4 text-center">
        <Link href={showArchived ? "/customers" : "/customers?archived=1"} className="text-sm font-medium text-ink-500 hover:text-ink-800">
          {showArchived ? "Show active customers" : "Show archived customers"}
        </Link>
      </div>
    </>
  );
}
