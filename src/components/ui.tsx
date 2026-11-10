/** Shared presentational components (server-safe). */
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm disabled:bg-brand-600/60",
  secondary: "bg-white text-ink-800 border border-ink-200 hover:bg-ink-50 shadow-sm",
  ghost: "text-ink-700 hover:bg-ink-100",
  danger: "bg-white text-brand-700 border border-brand-200 hover:bg-brand-50",
};
const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 h-11 sm:h-10 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed whitespace-nowrap";

export function Button({ variant = "primary", className, ...p }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={cn(btnBase, variants[variant], className)} {...p} />;
}

export function LinkButton({ variant = "primary", className, ...p }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={cn(btnBase, variants[variant], className)} {...p} />;
}

export function Card({ className, children, ...p }: ComponentProps<"div">) {
  return (
    <div className={cn("rounded-xl border border-ink-200 bg-white shadow-sm", className)} {...p}>
      {children}
    </div>
  );
}

export function CardHeader({ title, action, subtitle }: { title: ReactNode; action?: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-ink-100 px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-ink-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-5 sm:mb-6">
      {back && (
        <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-ink-500 hover:text-ink-800">
          <span aria-hidden>←</span> {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-ink-900 sm:text-2xl">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-ink-500">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

type Tone = "neutral" | "good" | "warn" | "bad" | "info" | "draft";
const tones: Record<Tone, string> = {
  neutral: "bg-ink-100 text-ink-700",
  good: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  warn: "bg-amber-50 text-amber-800 ring-amber-600/20",
  bad: "bg-brand-50 text-brand-700 ring-brand-600/20",
  info: "bg-sky-50 text-sky-700 ring-sky-600/20",
  draft: "bg-violet-50 text-violet-700 ring-violet-600/20",
};
export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ring-transparent", tones[tone], className)}>
      {children}
    </span>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="px-6 py-10 text-center">
      <p className="font-semibold text-ink-800">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-sm text-sm text-ink-500">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, tone, href }: { label: string; value: number | string; tone?: Tone; href?: string }) {
  const inner = (
    <>
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</div>
      <div className={cn("mt-1 text-2xl font-bold sm:text-3xl", tone === "bad" ? "text-brand-700" : tone === "warn" ? "text-amber-700" : "text-ink-900")}>
        {value}
      </div>
    </>
  );
  const cls = "block rounded-xl border border-ink-200 bg-white p-4 shadow-sm";
  return href ? (
    <Link href={href} className={cn(cls, "transition hover:border-ink-300 hover:shadow")}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

/** Key/value list for detail pages. */
export function DetailList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-ink-100">
      {items.map((i) => (
        <div key={i.label} className="grid grid-cols-1 gap-0.5 px-4 py-2.5 sm:grid-cols-3 sm:gap-4 sm:px-5">
          <dt className="text-sm text-ink-500">{i.label}</dt>
          <dd className="text-sm text-ink-900 sm:col-span-2 whitespace-pre-line break-words">{i.value || <span className="text-ink-400">–</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "warn" | "bad" | "good"; children: ReactNode }) {
  const t = {
    info: "bg-sky-50 text-sky-900 border-sky-200",
    warn: "bg-amber-50 text-amber-900 border-amber-200",
    bad: "bg-brand-50 text-brand-800 border-brand-200",
    good: "bg-emerald-50 text-emerald-900 border-emerald-200",
  }[tone];
  return <div className={cn("rounded-lg border px-4 py-3 text-sm", t)}>{children}</div>;
}

/** Responsive list row used instead of tables so lists read well on phones. */
export function RowLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-3 px-4 py-3 transition hover:bg-ink-50 sm:px-5", className)}>
      <div className="min-w-0 flex-1">{children}</div>
      <span className="text-ink-300" aria-hidden>›</span>
    </Link>
  );
}
