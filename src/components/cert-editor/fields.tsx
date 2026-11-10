"use client";
/**
 * Renders one form-definition field as an input. To support a new field TYPE, add it to
 * src/forms/types.ts, validate.ts, format.ts (and the PDF if it needs special drawing) and here.
 */
import { useState, type ReactNode } from "react";
import type { CheckField, CheckValue, ColumnField, Field, PhotoValue, SignatureValue, TableField } from "@/forms/types";
import { cn } from "@/lib/utils";
import { IconPlus, IconTrash } from "@/components/icons";
import { PhotosField } from "./photos";
import { SignaturePad } from "./signature-pad";

const inputCls =
  "block w-full rounded-lg border bg-white px-3 h-11 text-[16px] sm:text-sm text-ink-900 shadow-sm placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-ink-50 disabled:text-ink-600";

type Errors = Record<string, string>;

function Segmented({
  options,
  value,
  onChange,
  disabled,
  invalid,
  tones,
}: {
  options: { value: string; label: ReactNode }[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  tones?: Record<string, string>;
}) {
  return (
    <div role="radiogroup" className={cn("inline-flex w-full min-w-0 rounded-lg border bg-white p-1 sm:w-auto", invalid ? "border-brand-400" : "border-ink-200")}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(active ? "" : o.value)}
            className={cn(
              "h-10 min-w-0 flex-1 rounded-md px-2 text-sm font-semibold transition sm:min-w-[3.75rem] sm:flex-none sm:px-3",
              active ? (tones?.[o.value] ?? "bg-ink-800 text-white") : "text-ink-600 hover:bg-ink-50",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function ScalarInput({
  field,
  value,
  onChange,
  disabled,
  invalid,
  id,
}: {
  field: Field | ColumnField;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
  invalid?: boolean;
  id: string;
}) {
  const cls = cn(inputCls, invalid ? "border-brand-500" : "border-ink-200");
  switch (field.type) {
    case "text":
      return <input id={id} className={cls} value={(value as string) ?? ""} disabled={disabled} placeholder={field.placeholder} maxLength={field.maxLength ?? 500} onChange={(e) => onChange(e.target.value)} />;
    case "textarea":
      return (
        <textarea
          id={id}
          className={cn(cls, "h-auto py-2")}
          rows={field.rows ?? 3}
          value={(value as string) ?? ""}
          disabled={disabled}
          placeholder={field.placeholder}
          maxLength={field.maxLength ?? 5000}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "number":
      return (
        <div className="relative">
          <input
            id={id}
            className={cn(cls, field.unit && "pr-12")}
            type="text"
            inputMode={field.decimals === 0 ? "numeric" : "decimal"}
            value={value === null || value === undefined ? "" : String(value)}
            disabled={disabled}
            onChange={(e) => {
              const raw = e.target.value.replace(",", ".");
              if (raw === "") return onChange(null);
              // Keep partially typed numbers like "12." as strings until complete
              onChange(/^-?\d*\.?\d*$/.test(raw) && !/\.$/.test(raw) && raw !== "-" ? Number(raw) : raw);
            }}
          />
          {field.unit && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-400">{field.unit}</span>}
        </div>
      );
    case "date":
      return <input id={id} type="date" className={cls} value={(value as string) ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value)} />;
    case "select":
      return (
        <select id={id} className={cn(cls, "pr-8")} value={(value as string) ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select…</option>
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case "yesno":
      return (
        <Segmented
          value={(value as string) ?? ""}
          onChange={onChange}
          disabled={disabled}
          invalid={invalid}
          options={[{ value: "YES", label: "Yes" }, { value: "NO", label: "No" }, ...(field.allowNA ? [{ value: "NA", label: "N/A" }] : [])]}
        />
      );
    default:
      return null;
  }
}

function Label({ htmlFor, field, children }: { htmlFor?: string; field: Field | ColumnField; children?: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink-800">
      {field.label}
      {"required" in field && field.required && <span className="ml-0.5 text-brand-600">*</span>}
      {children}
    </label>
  );
}

function ErrorText({ msg }: { msg?: string }) {
  return msg ? <p className="mt-1 text-sm font-medium text-brand-700">{msg}</p> : null;
}

export function FieldInput({
  field,
  value,
  onChange,
  errors,
  disabled,
  certId,
  data,
}: {
  field: Field;
  value: unknown;
  onChange: (v: unknown) => void;
  errors: Errors;
  disabled?: boolean;
  certId: string;
  data?: Record<string, unknown>;
}) {
  const id = `f-${field.name}`;
  const err = errors[field.name];
  const help = "help" in field && field.help ? <p className="mt-1 text-xs text-ink-500">{field.help}</p> : null;

  switch (field.type) {
    case "note":
      return <p className="rounded-lg bg-ink-50 p-3 text-sm leading-relaxed text-ink-700">{field.text}</p>;

    case "checkbox":
      return (
        <div>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={Boolean(value)}
              disabled={disabled}
              onChange={(e) => onChange(e.target.checked)}
              className="mt-0.5 h-5 w-5 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm font-medium text-ink-800">{field.label}</span>
          </label>
          <ErrorText msg={err} />
        </div>
      );

    case "check":
      return <CheckInput field={field} value={value as CheckValue | undefined} onChange={onChange} errors={errors} disabled={disabled} />;

    case "checklist": {
      const picked = Array.isArray(value) ? (value as string[]) : [];
      return (
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-ink-800">
            {field.label}
            {field.required && <span className="ml-0.5 text-brand-600">*</span>}
          </legend>
          <div className={cn("grid gap-1 rounded-lg border p-2 sm:grid-cols-2", err ? "border-brand-400" : "border-ink-100 bg-ink-50/50")}>
            {field.options.map((o) => (
              <label key={o.value} className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-white">
                <input
                  type="checkbox"
                  checked={picked.includes(o.value)}
                  disabled={disabled}
                  onChange={(e) => onChange(e.target.checked ? [...picked, o.value] : picked.filter((x) => x !== o.value))}
                  className="mt-0.5 h-5 w-5 shrink-0 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="text-sm text-ink-800">{o.label}</span>
              </label>
            ))}
          </div>
          <ErrorText msg={err} />
          {help}
        </fieldset>
      );
    }

    case "computed":
    case "auto":
      return (
        <div>
          <span className="mb-1.5 block text-sm font-medium text-ink-800">{field.label}</span>
          <div className="flex h-11 items-center rounded-lg border border-dashed border-ink-200 bg-ink-50 px-3 text-sm text-ink-700">
            {field.type === "computed"
              ? `${field.compute(data ?? {})}${field.unit ? ` ${field.unit}` : ""}`
              : field.placeholder ?? "Set automatically when the certificate is issued"}
          </div>
          {help}
        </div>
      );

    case "radio":
      return (
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-ink-800">
            {field.label}
            {field.required && <span className="ml-0.5 text-brand-600">*</span>}
          </legend>
          <div className="grid gap-2">
            {field.options.map((o) => {
              const active = value === o.value;
              return (
                <label
                  key={o.value}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 text-sm transition",
                    active ? "border-brand-500 bg-brand-50 font-semibold text-ink-900" : "border-ink-200 bg-white hover:border-ink-300",
                    disabled && "cursor-default",
                  )}
                >
                  <input
                    type="radio"
                    name={id}
                    checked={active}
                    disabled={disabled}
                    onChange={() => onChange(o.value)}
                    className="h-4 w-4 border-ink-300 text-brand-600 focus:ring-brand-500"
                  />
                  {o.label}
                </label>
              );
            })}
          </div>
          <ErrorText msg={err} />
          {help}
        </fieldset>
      );

    case "signature":
      return (
        <div>
          <Label field={field} />
          <SignaturePad value={value as SignatureValue} onChange={onChange} disabled={disabled} invalid={!!err} />
          <ErrorText msg={err} />
        </div>
      );

    case "photos":
      return (
        <div>
          <Label field={field} />
          <PhotosField
            certId={certId}
            fieldName={field.name}
            value={(value as PhotoValue[]) ?? []}
            max={field.maxPhotos ?? 20}
            onChange={onChange}
            disabled={disabled}
          />
          <ErrorText msg={err} />
        </div>
      );

    case "table":
      return <TableInput field={field} value={(value as Record<string, unknown>[]) ?? []} onChange={onChange} errors={errors} disabled={disabled} />;

    default:
      return (
        <div>
          <Label htmlFor={id} field={field} />
          <ScalarInput id={id} field={field} value={value} onChange={onChange} disabled={disabled} invalid={!!err} />
          <ErrorText msg={err} />
          {help}
        </div>
      );
  }
}

function TableInput({
  field,
  value,
  onChange,
  errors,
  disabled,
}: {
  field: TableField;
  value: Record<string, unknown>[];
  onChange: (v: unknown) => void;
  errors: Errors;
  disabled?: boolean;
}) {
  const max = field.maxRows ?? 200;
  const update = (i: number, col: string, v: unknown) => onChange(value.map((r, j) => (j === i ? { ...r, [col]: v } : r)));
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-ink-800">
          {field.label}
          {field.required && <span className="ml-0.5 text-brand-600">*</span>}
        </span>
        <span className="text-xs text-ink-500">{value.length} row{value.length === 1 ? "" : "s"}</span>
      </div>
      {field.help && <p className="-mt-1 mb-2 text-xs text-ink-500">{field.help}</p>}
      <div className="space-y-3">
        {value.map((row, i) => (
          <div key={i} className="rounded-lg border border-ink-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-ink-500">#{i + 1}</span>
              {!disabled && (
                <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100" aria-label={`Remove row ${i + 1}`}>
                  <IconTrash width={18} height={18} />
                </button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(140px,1fr))]">
              {field.columns.map((col) => {
                const path = `${field.name}.${i}.${col.name}`;
                const cid = `f-${path}`;
                return (
                  <div key={col.name}>
                    <Label htmlFor={cid} field={col} />
                    <ScalarInput id={cid} field={col} value={row[col.name]} onChange={(v) => update(i, col.name, v)} disabled={disabled} invalid={!!errors[path]} />
                    <ErrorText msg={errors[path]} />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {!disabled && value.length < max && (
        <button
          type="button"
          onClick={() => onChange([...value, {}])}
          className="mt-3 inline-flex h-11 items-center gap-2 rounded-lg border border-dashed border-ink-300 bg-white px-4 text-sm font-semibold text-ink-700 hover:bg-ink-50"
        >
          <IconPlus /> {field.addLabel ?? "Add row"}
        </button>
      )}
      <ErrorText msg={errors[field.name]} />
    </div>
  );
}

function CheckInput({
  field,
  value,
  onChange,
  errors,
  disabled,
}: {
  field: CheckField;
  value: CheckValue | undefined;
  onChange: (v: unknown) => void;
  errors: Errors;
  disabled?: boolean;
}) {
  const v = value ?? { result: "" };
  const err = errors[field.name];
  const noteErr = errors[`${field.name}.note`];
  const [showNote, setShowNote] = useState(!!v.note);
  const tick = field.style === "tick-cross";
  const needsNote = v.result === "FAIL" || v.result === "LIM";
  const options = [
    { value: "PASS", label: tick ? <span className="text-lg leading-none">✓</span> : "Pass" },
    { value: "FAIL", label: tick ? <span className="text-lg leading-none">✗</span> : "Fail" },
    { value: "NA", label: "N/A" },
    ...(field.allowLim ? [{ value: "LIM", label: "LIM" }] : []),
  ];
  return (
    <div className={cn("rounded-lg border p-3", err || noteErr ? "border-brand-300 bg-brand-50/40" : "border-ink-100 bg-ink-50/50")}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <span className="flex gap-2 text-sm font-medium text-ink-800">
          {field.number && <span className="w-6 shrink-0 text-right font-semibold text-ink-400">{field.number}</span>}
          <span>
            {field.label}
            {field.required && <span className="ml-0.5 text-brand-600">*</span>}
          </span>
        </span>
        <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:shrink-0">
          <Segmented
            value={v.result}
            disabled={disabled}
            invalid={!!err}
            onChange={(r) => onChange({ ...v, result: r })}
            options={options}
            tones={{ PASS: "bg-emerald-600 text-white", FAIL: "bg-brand-600 text-white", NA: "bg-ink-600 text-white", LIM: "bg-amber-600 text-white" }}
          />
          {!needsNote && !showNote && !disabled && (
            <button type="button" onClick={() => setShowNote(true)} className="whitespace-nowrap text-xs font-semibold text-ink-500 hover:text-ink-800">
              + Comment
            </button>
          )}
        </div>
      </div>
      {(needsNote || showNote || v.note) && (
        <textarea
          rows={2}
          value={v.note ?? ""}
          disabled={disabled}
          placeholder={
            v.result === "FAIL" ? "Describe the defect and action needed (required)" : v.result === "LIM" ? "Describe the limitation agreed (required)" : "Comment"
          }
          onChange={(e) => onChange({ ...v, note: e.target.value })}
          className={cn(inputCls, "mt-2 h-auto py-2", noteErr ? "border-brand-500" : "border-ink-200")}
        />
      )}
      <ErrorText msg={err ?? noteErr} />
      {field.help && <p className="mt-1 text-xs text-ink-500">{field.help}</p>}
    </div>
  );
}
