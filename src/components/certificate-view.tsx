/** Read-only rendering of a certificate's contents (same layout logic as the PDF). */
import { formatValue, outcomeTone } from "@/forms/format";
import type { CheckValue, FormData, FormDefinition, PhotoValue, SignatureValue } from "@/forms/types";
import { conditionMet } from "@/forms/validate";
import { cn } from "@/lib/utils";
import { Card } from "./ui";

export function CertificateView({ def, data }: { def: FormDefinition; data: FormData }) {
  return (
    <div className="space-y-5">
      {def.sections
        .filter((s) => conditionMet(s.showIf, data))
        .map((section) => (
          <Card key={section.id}>
            <h2 className="border-b border-ink-100 px-4 py-3 font-semibold sm:px-5">{section.title}</h2>
            <dl className="divide-y divide-ink-100">
              {section.fields
                .filter((f) => conditionMet(f.showIf, data))
                .map((f) => {
                  const v = data[f.name];
                  if (f.type === "note") return <p key={f.name} className="px-4 py-3 text-sm text-ink-600 sm:px-5">{f.text}</p>;
                  if (f.type === "table") {
                    const rows = (v as Record<string, unknown>[]) ?? [];
                    return (
                      <div key={f.name} className="px-4 py-3 sm:px-5">
                        <dt className="mb-2 text-sm font-medium text-ink-700">{f.label}</dt>
                        {rows.length === 0 ? (
                          <dd className="text-sm text-ink-400">None recorded</dd>
                        ) : (
                          <dd className="-mx-4 overflow-x-auto sm:mx-0">
                            <table className="w-full min-w-[480px] text-left text-sm">
                              <thead>
                                <tr className="bg-ink-50 text-xs uppercase tracking-wide text-ink-500">
                                  {f.columns.map((c) => (
                                    <th key={c.name} className="px-3 py-2 font-semibold">{c.label}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-ink-100">
                                {rows.map((r, i) => (
                                  <tr key={i}>
                                    {f.columns.map((c) => (
                                      <td key={c.name} className="px-3 py-2 align-top">{formatValue(c, r[c.name]) || "–"}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </dd>
                        )}
                      </div>
                    );
                  }
                  if (f.type === "photos") {
                    const photos = (v as PhotoValue[]) ?? [];
                    if (!photos.length) return null;
                    return (
                      <div key={f.name} className="px-4 py-3 sm:px-5">
                        <dt className="mb-2 text-sm font-medium text-ink-700">{f.label}</dt>
                        <dd className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                          {photos.map((p) => (
                            <figure key={p.id}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={`/api/photos/${p.id}`} alt={p.caption || "Photo"} className="aspect-[4/3] w-full rounded-lg bg-ink-100 object-cover" />
                              {p.caption && <figcaption className="mt-1 text-xs text-ink-500">{p.caption}</figcaption>}
                            </figure>
                          ))}
                        </dd>
                      </div>
                    );
                  }
                  let content: React.ReactNode = formatValue(f, v);
                  if (f.type === "signature") {
                    const sig = v as SignatureValue;
                    // eslint-disable-next-line @next/next/no-img-element
                    content = sig?.image ? <img src={sig.image} alt="Signature" className="h-14 object-contain" /> : "";
                  }
                  const check = f.type === "check" ? (v as CheckValue) : null;
                  const tone = f.type === "radio" || f.type === "select" ? outcomeTone(v as string) : "neutral";
                  return (
                    <div key={f.name} className="grid grid-cols-1 gap-0.5 px-4 py-2.5 sm:grid-cols-5 sm:gap-4 sm:px-5">
                      <dt className="text-sm text-ink-500 sm:col-span-3">
                        {f.type === "check" && f.number ? <span className="mr-1.5 font-semibold text-ink-400">{f.number}</span> : null}
                        {f.label}
                      </dt>
                      <dd
                        className={cn(
                          "text-sm sm:col-span-2 whitespace-pre-line break-words",
                          check?.result === "PASS" && "font-semibold text-emerald-700",
                          check?.result === "FAIL" && "font-semibold text-brand-700",
                          tone === "good" && "font-semibold text-emerald-700",
                          tone === "warn" && "font-semibold text-amber-700",
                          tone === "bad" && "font-semibold text-brand-700",
                        )}
                      >
                        {content || <span className="font-normal text-ink-400">–</span>}
                        {check?.note && <span className="mt-0.5 block font-normal text-ink-700">{check.note}</span>}
                      </dd>
                    </div>
                  );
                })}
            </dl>
          </Card>
        ))}
    </div>
  );
}
