import Link from "next/link";
import { Card, EmptyState, PageHeader, RowLink } from "@/components/ui";
import { DueBadge } from "@/components/status";
import { IconSearch } from "@/components/icons";
import { formatUK, formatUKDateTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { serviceKind } from "@/lib/service-kinds";
import { requireUser, STAFF } from "@/server/auth";
import { scheduleCounts, scheduleRows, type ScheduleFilter } from "@/server/queries";

export const metadata = { title: "Schedule" };

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ filter?: string; q?: string; mine?: string }> }) {
  const user = await requireUser(STAFF);
  const sp = await searchParams;
  const filter: ScheduleFilter = (["overdue", "due30", "booked", "all"] as const).find((f) => f === sp.filter) ?? "due30";
  const mine = sp.mine === "1";
  const q = sp.q?.trim() ?? "";
  const [rows, counts] = await Promise.all([
    scheduleRows({ filter, q: q || undefined, engineerId: mine ? user.id : undefined }),
    scheduleCounts(),
  ]);
  const isAdmin = user.role === "ADMIN";

  const tabs: { key: ScheduleFilter; label: string; count?: number }[] = [
    { key: "overdue", label: "Overdue", count: counts.overdue },
    { key: "due30", label: "Due in 30 days", count: counts.due30 },
    { key: "booked", label: "Booked", count: counts.booked },
    { key: "all", label: "All upcoming" },
  ];
  const href = (f: string, m = mine) => {
    const p = new URLSearchParams({ filter: f });
    if (q) p.set("q", q);
    if (m) p.set("mine", "1");
    return `/schedule?${p}`;
  };

  return (
    <>
      <PageHeader title="Service schedule" subtitle="Next service due for every active site" />
      <div className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-1 rounded-lg border border-ink-200 bg-white p-1 sm:w-auto">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={href(t.key)}
              className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold", filter === t.key ? "bg-ink-800 text-white" : "text-ink-600 hover:bg-ink-50")}
            >
              {t.label}
              {t.count !== undefined && (
                <span className={cn("rounded-full px-1.5 text-xs", filter === t.key ? "bg-white/20" : t.key === "overdue" && t.count ? "bg-brand-100 text-brand-700" : "bg-ink-100")}>{t.count}</span>
              )}
            </Link>
          ))}
        </div>
      </div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <form className="relative flex-1" role="search">
          <input type="hidden" name="filter" value={filter} />
          {mine && <input type="hidden" name="mine" value="1" />}
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search site, customer or postcode"
            className="h-11 w-full rounded-lg border border-ink-200 bg-white pl-10 pr-3 text-[15px] shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 sm:h-10 sm:text-sm"
          />
        </form>
        <Link href={href(filter, !mine)} className={cn("rounded-lg border px-3 py-2 text-center text-sm font-semibold", mine ? "border-brand-300 bg-brand-50 text-brand-700" : "border-ink-200 bg-white text-ink-600")}>
          {mine ? "Showing my visits" : "Only my visits"}
        </Link>
      </div>
      <Card>
        {rows.length === 0 ? (
          <EmptyState title="Nothing here" body={filter === "overdue" ? "No overdue services – nice work." : undefined} />
        ) : (
          <div className="divide-y divide-ink-100">
            {rows.map((r) => (
              <RowLink key={r.visit.id} href={isAdmin ? `/schedule/${r.visit.id}` : `/sites/${r.site.id}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold">{r.site.name}</span>
                  <DueBadge dueDate={r.visit.dueDate} status={r.visit.status} />
                </div>
                <div className="truncate text-sm text-ink-500">
                  <span className="font-medium text-ink-700">{serviceKind(r.visit.serviceKind).label}</span> · {r.customer.name} · {r.site.postcode} · due {formatUK(r.visit.dueDate)}
                  {r.visit.bookedFor ? ` · booked ${formatUKDateTime(r.visit.bookedFor)}` : ""}
                  {r.engineer?.name ? ` · ${r.engineer.name}` : ""}
                </div>
              </RowLink>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
