"use client";
/**
 * Form kit for admin screens. <ActionForm> runs a server action and shows field errors
 * returned from it next to the matching inputs.
 */
import { createContext, useActionState, useContext, type ComponentProps, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/utils";
import type { ActionState } from "@/lib/action-state";

const ErrorsCtx = createContext<Record<string, string>>({});
/** Values the user submitted, fed back after a failed submit so nothing they typed is lost. */
const ValuesCtx = createContext<Record<string, string> | null>(null);
const NEVER_ECHO = new Set(["password", "confirm"]);

export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, formAction] = useActionState(async (prev: ActionState, fd: FormData) => {
    const res = await action(prev, fd);
    if (res && !res.ok) {
      const values: Record<string, string> = {};
      fd.forEach((v, k) => {
        if (typeof v === "string" && !k.startsWith("$ACTION") && !NEVER_ECHO.has(k)) values[k] = v;
      });
      return { ...res, values };
    }
    return res;
  }, {} as ActionState);
  return (
    <ValuesCtx.Provider value={state.values ?? null}>
    <ErrorsCtx.Provider value={state.errors ?? {}}>
      <form action={formAction} className={cn("space-y-4", className)} key={resetOnSuccess && state.ok ? state.nonce : undefined}>
        {state.message && (
          <div
            role={state.ok ? "status" : "alert"}
            className={cn(
              "rounded-lg border px-4 py-3 text-sm",
              state.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-brand-200 bg-brand-50 text-brand-800",
            )}
          >
            {state.message}
            {state.detail && <div className="mt-2 break-all font-mono text-xs">{state.detail}</div>}
          </div>
        )}
        {children}
      </form>
    </ErrorsCtx.Provider>
    </ValuesCtx.Provider>
  );
}

const inputCls =
  "block w-full rounded-lg border border-ink-200 bg-white px-3 h-11 sm:h-10 text-[15px] sm:text-sm text-ink-900 shadow-sm placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-ink-50";

function Wrap({ name, label, help, children, className, required }: { name: string; label: string; help?: string; children: ReactNode; className?: string; required?: boolean }) {
  const err = useContext(ErrorsCtx)[name];
  return (
    <div className={className}>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-ink-700">
        {label}
        {required && <span className="ml-0.5 text-brand-600">*</span>}
      </label>
      {children}
      {err ? (
        <p className="mt-1 text-sm text-brand-700" id={`${name}-error`}>{err}</p>
      ) : help ? (
        <p className="mt-1 text-xs text-ink-500">{help}</p>
      ) : null}
    </div>
  );
}

type InputProps = ComponentProps<"input"> & { name: string; label: string; help?: string; wrapClass?: string };
function useSubmitted(name: string, fallback: unknown) {
  const vals = useContext(ValuesCtx);
  return vals && name in vals ? vals[name] : (fallback as string | number | readonly string[] | undefined);
}

export function Input({ name, label, help, wrapClass, className, required, defaultValue, ...p }: InputProps) {
  const err = useContext(ErrorsCtx)[name];
  const value = useSubmitted(name, defaultValue);
  return (
    <Wrap name={name} label={label} help={help} className={wrapClass} required={required}>
      <input
        id={name}
        name={name}
        required={required}
        aria-invalid={!!err}
        defaultValue={value}
        className={cn(inputCls, err && "border-brand-500", className)}
        {...p}
      />
    </Wrap>
  );
}

type TextareaProps = ComponentProps<"textarea"> & { name: string; label: string; help?: string; wrapClass?: string };
export function Textarea({ name, label, help, wrapClass, className, required, defaultValue, ...p }: TextareaProps) {
  const value = useSubmitted(name, defaultValue);
  return (
    <Wrap name={name} label={label} help={help} className={wrapClass} required={required}>
      <textarea id={name} name={name} required={required} rows={3} defaultValue={value} className={cn(inputCls, "h-auto py-2", className)} {...p} />
    </Wrap>
  );
}

type SelectProps = ComponentProps<"select"> & {
  name: string;
  label: string;
  help?: string;
  wrapClass?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
};
export function Select({ name, label, help, wrapClass, options, placeholder, className, required, defaultValue, ...p }: SelectProps) {
  const value = useSubmitted(name, defaultValue);
  return (
    <Wrap name={name} label={label} help={help} className={wrapClass} required={required}>
      <select id={name} name={name} required={required} defaultValue={value} className={cn(inputCls, "pr-8", className)} {...p}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Wrap>
  );
}

export function Checkbox({ name, label, help, defaultChecked }: { name: string; label: string; help?: string; defaultChecked?: boolean }) {
  const vals = useContext(ValuesCtx);
  const checked = vals ? vals[name] === "on" : defaultChecked;
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg py-1">
      <input
        type="checkbox"
        name={name}
        defaultChecked={checked}
        className="mt-0.5 h-5 w-5 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
      />
      <span>
        <span className="block text-sm font-medium text-ink-800">{label}</span>
        {help && <span className="block text-xs text-ink-500">{help}</span>}
      </span>
    </label>
  );
}

export function SubmitButton({ children, variant = "primary", className }: { children: ReactNode; variant?: "primary" | "danger" | "secondary"; className?: string }) {
  const { pending } = useFormStatus();
  const v = {
    primary: "bg-brand-600 text-white hover:bg-brand-700",
    danger: "bg-white text-brand-700 border border-brand-200 hover:bg-brand-50",
    secondary: "bg-white text-ink-800 border border-ink-200 hover:bg-ink-50",
  }[variant];
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold shadow-sm transition disabled:opacity-60 sm:h-10",
        v,
        className,
      )}
    >
      {pending && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

export function FormGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}
