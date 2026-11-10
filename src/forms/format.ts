/** Turns stored values into human-readable text (used by the read-only view and the PDF). */
import type { CheckValue, ColumnField, Field } from "./types";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export function formatValue(field: Field | ColumnField, value: unknown): string {
  if (value === undefined || value === null || value === "") return "";
  switch (field.type) {
    case "select":
    case "radio":
      return field.options.find((o) => o.value === value)?.label ?? String(value);
    case "yesno":
      return value === "YES" ? "Yes" : value === "NO" ? "No" : value === "NA" ? "N/A" : String(value);
    case "checkbox":
      return value ? "Yes" : "No";
    case "check": {
      const r = (value as CheckValue).result;
      const tick = field.style === "tick-cross";
      return r === "PASS" ? (tick ? "✓" : "Pass") : r === "FAIL" ? (tick ? "✗" : "Fail") : r === "NA" ? "N/A" : r === "LIM" ? "LIM" : "";
    }
    case "checklist":
      return Array.isArray(value)
        ? field.options.filter((o) => (value as string[]).includes(o.value)).map((o) => o.label).join("; ")
        : "";
    case "computed":
      return `${value}${field.unit && value !== "N/A" ? ` ${field.unit}` : ""}`;
    case "auto":
      if (field.format === "month") {
        const m = /^(\d{4})-(\d{2})/.exec(String(value));
        return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : String(value);
      }
      return field.format === "date" ? formatDate(String(value)) : String(value);
    case "date":
      return formatDate(String(value));
    case "number":
      return `${value}${field.unit ? ` ${field.unit}` : ""}`;
    case "text":
    case "textarea":
      return String(value);
    default:
      return "";
  }
}

const OUTCOME_TONE: Record<string, "good" | "warn" | "bad"> = {
  SATISFACTORY: "good",
  SATISFACTORY_OBS: "warn",
  UNSATISFACTORY: "bad",
  COMPLETE: "good",
  COMPLETE_OUTSTANDING: "warn",
  RESOLVED: "good",
  PARTIAL: "warn",
  NOT_RESOLVED: "bad",
};

export function outcomeTone(outcome: string | null | undefined): "good" | "warn" | "bad" | "neutral" {
  return (outcome && OUTCOME_TONE[outcome]) || "neutral";
}
