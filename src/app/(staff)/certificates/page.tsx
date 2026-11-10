import Link from "next/link";
import { Card, EmptyState, LinkButton, PageHeader, RowLink } from "@/components/ui";
import { CertStatusBadge, formTitle, OutcomeBadge } from "@/components/status";
import { IconPlus, IconSearch } from "@/components/icons";
import { formatUK } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { requireUser, STAFF } from "@/server/auth";
import { certificateRows } from "@/server/queries";

export const metadata = { title: "Certificates" };

const TABS = [
  { key: "", label: "All" },
  { key: "DRAFT", label: "Drafts" },
  { key: "ISSUED", label: "Issued" },
  { key: "VOID", label: "Void" },
] as const;

export default async function CertificatesPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; mine?: string }> }) {
  const user = await requireUser(STAFF);
  const sp = await searchParams;
  const status = TABS.find((t) => t.key === sp.status)?.key || undefined;
  const q = sp.q?.trim() ?? "";
  const rows = await certificateRows({ status: status as "DRAFT" | "ISSUED" | "VOID" | undefined, q: q || undefined, limit: 200 });
  // Engineers only see their own drafts
  const visible = rows.filter((r) => r.cert.status !== "DRAFT" || user.role === "ADMIN" || r.engineer.id === user.id);

  const href = (s: string) => {
    const p = new URLSearchParams();
    if (s) p.set("status", s);
    if (q) p.set("q", q);
    return `/certificates${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Certificates"
        actions={
          <LinkButton href="/certificates/new">
            <IconPlus /> New certificate
          </LinkButton>
        }
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex gap-1 rounded-lg border border-ink-200 bg-white p-1">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={href(t.key)}
              className={cn("flex-1 rounded-md px-3 py-1.5 text-center text-sm font-semibold", (status ?? "") === t.key ? "bg-ink-800 text-white" : "text-ink-600 hover:bg-ink-50")}
            >
              {t.label}
            </Link>
          ))}
        </div>
        <form className="relative flex-1" role="search">
          {status && <input type="hidden" name="status" value={status} />}
          <IconSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search number, site, customer or postcode"
            className="h-11 w-full rounded-lg border border-ink-200 bg-white pl-10 pr-3 text-[15px] shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 sm:h-10 sm:text-sm"
          />
        </form>
      </div>
      <Card>
        {visible.length === 0 ? (
          <EmptyState title="No certificates found" />
        ) : (
          <div className="divide-y divide-ink-100">
            {visible.map((r) => (
              <RowLink key={r.cert.id} href={`/certificates/${r.cert.id}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold">
                    {r.cert.number ?? "Draft"} <span className="font-normal text-ink-500">· {r.site.name}</span>
                  </span>
                  <div className="flex shrink-0 gap-1.5">
                    <OutcomeBadge formId={r.cert.formId} formVersion={r.cert.formVersion} outcome={r.cert.outcome} />
                    <CertStatusBadge status={r.cert.status} />
                  </div>
                </div>
                <div className="truncate text-sm text-ink-500">
                  {formTitle(r.cert.formId, r.cert.formVersion)} · {r.customer.name} · {r.engineer.name} ·{" "}
                  {r.cert.issuedAt ? formatUK(r.cert.issuedAt) : `edited ${formatUK(r.cert.updatedAt)}`}
                </div>
              </RowLink>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
