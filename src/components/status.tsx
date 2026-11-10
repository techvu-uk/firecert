/** Badges that translate stored states into consistent labels/colours across the app. */
import { Badge } from "./ui";
import { getForm } from "@/forms/registry";
import { outcomeTone } from "@/forms/format";
import { daysUntil, formatUK, todayISO } from "@/lib/dates";
import { dueState } from "@/server/schedule-rules";

export function CertStatusBadge({ status }: { status: string }) {
  if (status === "DRAFT") return <Badge tone="draft">Draft</Badge>;
  if (status === "VOID") return <Badge tone="neutral">Void</Badge>;
  return <Badge tone="info">Issued</Badge>;
}

export function OutcomeBadge({ formId, formVersion, outcome }: { formId: string; formVersion: number; outcome: string | null }) {
  if (!outcome) return null;
  let label = outcome;
  try {
    const def = getForm(formId, formVersion);
    const f = def.sections.flatMap((s) => s.fields).find((x) => x.name === def.outcomeField);
    if (f && (f.type === "radio" || f.type === "select")) label = f.options.find((o) => o.value === outcome)?.label ?? outcome;
  } catch {
    /* unknown form */
  }
  const tone = outcomeTone(outcome);
  return <Badge tone={tone === "neutral" ? "neutral" : tone}>{label.split(" – ")[0]}</Badge>;
}

export function DueBadge({ dueDate, status }: { dueDate: string; status: string }) {
  if (status === "BOOKED") return <Badge tone="info">Booked</Badge>;
  const today = todayISO();
  const s = dueState(dueDate, today);
  const d = daysUntil(dueDate, today);
  if (s === "overdue") return <Badge tone="bad">Overdue {Math.abs(d)}d</Badge>;
  if (s === "due-soon") return <Badge tone="warn">{d === 0 ? "Due today" : `Due in ${d}d`}</Badge>;
  return <Badge tone="neutral">Due {formatUK(dueDate)}</Badge>;
}

export function formTitle(formId: string, formVersion?: number) {
  try {
    return getForm(formId, formVersion).shortTitle;
  } catch {
    return formId;
  }
}
