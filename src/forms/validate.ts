/**
 * Validates and cleans form data against a FormDefinition.
 *
 *  - "draft" mode: checks formats only (so engineers can save part-complete work).
 *  - "issue" mode: also enforces required fields, notes on failed checks, and strips
 *    values from fields that are hidden by conditions, so the issued record is exact.
 *
 * Runs on the server for every save; the browser uses the same code for instant feedback.
 */
import type {
  CheckValue,
  ColumnField,
  Condition,
  Field,
  FormData,
  FormDefinition,
  PhotoValue,
  SignatureValue,
} from "./types";

export type ValidationMode = "draft" | "issue";
export type ValidationResult = { ok: boolean; errors: Record<string, string>; data: FormData };

const MAX_SIGNATURE_BYTES = 400_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function conditionMet(cond: Condition | undefined, data: FormData): boolean {
  if (!cond) return true;
  const actual = data[cond.field];
  const wanted = Array.isArray(cond.equals) ? cond.equals : [cond.equals];
  return wanted.some((w) => (typeof w === "boolean" ? Boolean(actual) === w : actual === w));
}

export function isValidDate(s: unknown): s is string {
  if (typeof s !== "string" || !DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
}

function toNumber(v: unknown): number | null | "invalid" {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.trim()) : NaN;
  return Number.isFinite(n) ? n : "invalid";
}

type Ctx = { mode: ValidationMode; today: string; errors: Record<string, string>; data: FormData };

/** Validates a scalar value (top-level field or table cell). Returns the cleaned value. */
function validateScalar(field: Field | ColumnField, raw: unknown, path: string, ctx: Ctx): unknown {
  const issue = ctx.mode === "issue";
  const required = issue && "required" in field && !!field.required;
  const fail = (msg: string) => {
    ctx.errors[path] = msg;
  };

  switch (field.type) {
    case "text":
    case "textarea": {
      if (raw !== undefined && raw !== null && typeof raw !== "string") return fail("Must be text"), "";
      const v = (raw ?? "") as string;
      const max = field.maxLength ?? (field.type === "text" ? 500 : 5000);
      if (v.length > max) fail(`Maximum ${max} characters`);
      if (required && v.trim() === "") fail("Required");
      return v;
    }
    case "number": {
      const n = toNumber(raw);
      if (n === "invalid") return fail("Enter a number"), null;
      if (n === null) {
        if (required) fail("Required");
        return null;
      }
      if (field.min !== undefined && n < field.min) fail(`Must be at least ${field.min}`);
      if (field.max !== undefined && n > field.max) fail(`Must be no more than ${field.max}`);
      const dp = field.decimals ?? 2;
      const factor = 10 ** dp;
      if (Math.abs(Math.round(n * factor) - n * factor) > 1e-6)
        fail(dp === 0 ? "Must be a whole number" : `Maximum ${dp} decimal places`);
      return n;
    }
    case "date": {
      if (isEmpty(raw)) {
        if (required) fail("Required");
        return "";
      }
      if (!isValidDate(raw)) return fail("Enter a valid date"), "";
      if (field.notFuture && raw > ctx.today) fail("Date cannot be in the future");
      return raw;
    }
    case "select":
    case "radio": {
      if (isEmpty(raw)) {
        if (required) fail("Required");
        return "";
      }
      if (!field.options.some((o) => o.value === raw)) return fail("Choose a valid option"), "";
      return raw;
    }
    case "yesno": {
      if (isEmpty(raw)) {
        if (required) fail("Required");
        return "";
      }
      const allowed = field.allowNA ? ["YES", "NO", "NA"] : ["YES", "NO"];
      if (!allowed.includes(raw as string)) return fail("Choose a valid option"), "";
      return raw;
    }
    default:
      return raw;
  }
}

function validateField(field: Field, raw: unknown, ctx: Ctx): unknown {
  const issue = ctx.mode === "issue";
  const path = field.name;
  const fail = (msg: string, p = path) => {
    ctx.errors[p] = msg;
  };

  switch (field.type) {
    case "note":
      return undefined;
    case "checkbox": {
      const v = raw === true || raw === "true" || raw === "on";
      if (issue && field.required && !v) fail("Must be ticked");
      return v;
    }
    case "check": {
      const v = (raw && typeof raw === "object" ? raw : {}) as Partial<CheckValue>;
      const result = (v.result ?? "") as CheckValue["result"];
      const note = typeof v.note === "string" ? v.note : "";
      const allowed = field.allowLim ? ["", "PASS", "FAIL", "NA", "LIM"] : ["", "PASS", "FAIL", "NA"];
      if (!allowed.includes(result)) return fail("Choose a valid result"), { result: "" };
      if (issue && field.required && result === "") fail("Required");
      if (issue && result === "FAIL" && note.trim() === "") fail("Describe the failure", `${path}.note`);
      if (issue && result === "LIM" && note.trim() === "") fail("Describe the limitation", `${path}.note`);
      if (note.length > 2000) fail("Maximum 2000 characters", `${path}.note`);
      return note ? { result, note } : { result };
    }
    case "checklist": {
      if (raw === undefined || raw === null) {
        if (issue && field.required) fail("Tick at least one");
        return [];
      }
      if (!Array.isArray(raw)) return fail("Invalid selection"), [];
      const valid = new Set(field.options.map((o) => o.value));
      // Keep option order, drop unknown values and duplicates
      const picked = field.options.map((o) => o.value).filter((v) => (raw as unknown[]).includes(v) && valid.has(v));
      if (issue && field.required && picked.length === 0) fail("Tick at least one");
      return picked;
    }
    case "computed":
      return field.compute(ctx.data);
    case "auto":
      // Filled by the system on issue; anything sent by the browser is ignored
      return undefined;
    case "signature": {
      if (raw === null || raw === undefined || raw === "") {
        if (issue && field.required) fail("Signature required");
        return null;
      }
      const v = raw as SignatureValue;
      if (
        !v ||
        typeof v !== "object" ||
        typeof v.image !== "string" ||
        !v.image.startsWith("data:image/png;base64,") ||
        v.image.length > MAX_SIGNATURE_BYTES
      ) {
        fail("Invalid signature – please sign again");
        return null;
      }
      return { image: v.image, signedAt: typeof v.signedAt === "string" ? v.signedAt : new Date().toISOString() };
    }
    case "photos": {
      if (raw === undefined || raw === null) return [];
      if (!Array.isArray(raw)) return fail("Invalid photos"), [];
      const photos = (raw as PhotoValue[])
        .filter((p) => p && typeof p.id === "string")
        .map((p) => ({ id: p.id, caption: typeof p.caption === "string" ? p.caption.slice(0, 200) : "" }));
      const max = field.maxPhotos ?? 20;
      if (photos.length > max) fail(`Maximum ${max} photos`);
      if (issue && field.required && photos.length === 0) fail("Add at least one photo");
      return photos;
    }
    case "table": {
      if (raw !== undefined && raw !== null && !Array.isArray(raw)) return fail("Invalid table"), [];
      const rows = ((raw as Record<string, unknown>[] | undefined) ?? []).filter(
        (r) => r && typeof r === "object",
      );
      const max = field.maxRows ?? 200;
      if (rows.length > max) fail(`Maximum ${max} rows`);
      const min = field.minRows ?? (field.required ? 1 : 0);
      if (issue && field.required && rows.length < min) fail(min === 1 ? "Add at least one row" : `Add at least ${min} rows`);
      return rows.map((row, i) => {
        const clean: Record<string, unknown> = {};
        for (const col of field.columns) {
          clean[col.name] = validateScalar(col, row[col.name], `${path}.${i}.${col.name}`, ctx);
        }
        return clean;
      });
    }
    default:
      return validateScalar(field, raw, path, ctx);
  }
}

export function validateForm(
  def: FormDefinition,
  input: FormData,
  mode: ValidationMode,
  today: string,
): ValidationResult {
  const src = input && typeof input === "object" ? input : {};
  const ctx: Ctx = { mode, today, errors: {}, data: src };
  const data: FormData = {};

  for (const section of def.sections) {
    const sectionVisible = conditionMet(section.showIf, src);
    for (const field of section.fields) {
      if (field.type === "note") continue;
      const visible = sectionVisible && conditionMet(field.showIf, src);
      if (!visible) {
        // Keep hidden values in drafts (so toggling a Yes/No doesn't lose work),
        // but strip them from issued certificates.
        if (mode === "draft" && src[field.name] !== undefined) data[field.name] = src[field.name];
        continue;
      }
      const value = validateField(field, src[field.name], ctx);
      if (value !== undefined) data[field.name] = value;
    }
  }

  return { ok: Object.keys(ctx.errors).length === 0, errors: ctx.errors, data };
}

/** Count of required fields still missing — used for the progress indicator. */
export function completion(def: FormDefinition, input: FormData, today: string) {
  const res = validateForm(def, input, "issue", today);
  let total = 0;
  for (const section of def.sections) {
    if (!conditionMet(section.showIf, input)) continue;
    for (const f of section.fields) {
      if ("required" in f && f.required && conditionMet(f.showIf, input)) total++;
    }
  }
  const missing = new Set(Object.keys(res.errors).map((k) => k.split(".")[0])).size;
  return { total, done: Math.max(0, total - missing), errors: res.errors };
}
