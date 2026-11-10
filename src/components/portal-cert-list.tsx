import { formTitle, OutcomeBadge } from "@/components/status";
import { IconDownload, IconFile } from "@/components/icons";
import { formatUK } from "@/lib/dates";

type Row = {
  cert: { id: string; number: string | null; formId: string; formVersion: number; outcome: string | null; issuedAt: Date | null };
  site: { name: string };
};

export function PortalCertList({ rows, showSite = true }: { rows: Row[]; showSite?: boolean }) {
  return (
    <ul className="divide-y divide-ink-100">
      {rows.map((r) => (
        <li key={r.cert.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
          <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-600 sm:flex">
            <IconFile />
          </span>
          <a href={`/api/certificates/${r.cert.id}/pdf`} target="_blank" className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{formTitle(r.cert.formId, r.cert.formVersion)}</span>
              <OutcomeBadge formId={r.cert.formId} formVersion={r.cert.formVersion} outcome={r.cert.outcome} />
            </div>
            <div className="truncate text-sm text-ink-500">
              {r.cert.number} · {formatUK(r.cert.issuedAt)}
              {showSite ? ` · ${r.site.name}` : ""}
            </div>
          </a>
          <a
            href={`/api/certificates/${r.cert.id}/pdf?download=1`}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 text-sm font-semibold text-ink-700 shadow-sm hover:bg-ink-50"
            aria-label={`Download ${r.cert.number}`}
          >
            <IconDownload width={18} height={18} />
            <span className="hidden sm:inline">Download</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
