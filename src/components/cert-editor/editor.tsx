"use client";
/**
 * Certificate editor. Renders any FormDefinition, autosaves to the server, keeps a backup
 * on the device in case of lost signal, and runs the same validation as the server.
 */
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getForm, scheduleEffectFor } from "@/forms/registry";
import type { FormData } from "@/forms/types";
import { completion, conditionMet, validateForm } from "@/forms/validate";
import { todayISO, formatUK } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { issueCertificateAction, type IssueState } from "@/app/actions/certificates";
import { IconAlert, IconCheck } from "@/components/icons";
import { FieldInput } from "./fields";

type SaveState = "saved" | "saving" | "pending" | "offline" | "error";

export function CertificateEditor({
  certId,
  formId,
  formVersion,
  initialData,
  serverUpdatedAt,
  header,
  notice,
}: {
  certId: string;
  formId: string;
  formVersion: number;
  initialData: FormData;
  serverUpdatedAt: string;
  header: React.ReactNode;
  notice?: React.ReactNode;
}) {
  const def = useMemo(() => getForm(formId, formVersion), [formId, formVersion]);
  const router = useRouter();
  const storageKey = `firecert-draft-${certId}`;

  const [data, setData] = useState<FormData>(initialData);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [showRequired, setShowRequired] = useState(false);
  const [localBackup, setLocalBackup] = useState<{ data: FormData; savedAt: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState("");
  const [issued, setIssued] = useState<IssueState | null>(null);
  const [activeSection, setActiveSection] = useState(def.sections[0]?.id);

  const dirty = useRef(false);
  const latest = useRef(data);
  latest.current = data;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<Promise<boolean> | null>(null);

  // ---- Local backup check on load -------------------------------------------
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const backup = JSON.parse(raw) as { data: FormData; savedAt: string };
      if (new Date(backup.savedAt) > new Date(serverUpdatedAt) && JSON.stringify(backup.data) !== JSON.stringify(initialData)) {
        setLocalBackup(backup);
      } else {
        localStorage.removeItem(storageKey);
      }
    } catch {
      /* storage unavailable */
    }
  }, [storageKey, serverUpdatedAt, initialData]);

  // ---- Saving -----------------------------------------------------------------
  const save = useCallback(async (): Promise<boolean> => {
    if (inflight.current) await inflight.current;
    if (!dirty.current) return true;
    dirty.current = false;
    const snapshot = latest.current;
    setSaveState("saving");
    const p = (async () => {
      try {
        const res = await fetch(`/api/certificates/${certId}/draft`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: snapshot }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          dirty.current = true;
          setSaveState("error");
          setIssueError(json.error ?? "Couldn't save");
          return false;
        }
        setServerErrors(json.errors ?? {});
        setSavedAt(new Date());
        if (!dirty.current) {
          setSaveState("saved");
          try {
            localStorage.removeItem(storageKey);
          } catch {}
        }
        return true;
      } catch {
        dirty.current = true;
        setSaveState("offline");
        return false;
      } finally {
        inflight.current = null;
      }
    })();
    inflight.current = p;
    return p;
  }, [certId, storageKey]);

  const scheduleSave = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), 1200);
  }, [save]);

  const setField = useCallback(
    (name: string, v: unknown) => {
      setData((d) => {
        const next = { ...d, [name]: v };
        try {
          localStorage.setItem(storageKey, JSON.stringify({ data: next, savedAt: new Date().toISOString() }));
        } catch {}
        return next;
      });
      dirty.current = true;
      setSaveState("pending");
      scheduleSave();
    },
    [scheduleSave, storageKey],
  );

  // Retry when the connection comes back; save before leaving the page
  useEffect(() => {
    const online = () => dirty.current && void save();
    const hide = () => {
      if (document.visibilityState === "hidden" && dirty.current) void save();
    };
    const unload = (e: BeforeUnloadEvent) => {
      if (dirty.current) {
        e.preventDefault();
      }
    };
    window.addEventListener("online", online);
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("beforeunload", unload);
    const retry = setInterval(() => dirty.current && navigator.onLine && void save(), 15000);
    return () => {
      window.removeEventListener("online", online);
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("beforeunload", unload);
      clearInterval(retry);
    };
  }, [save]);

  // ---- Validation ---------------------------------------------------------------
  const today = todayISO();
  const progress = useMemo(() => completion(def, data, today), [def, data, today]);
  const draftErrors = useMemo(() => validateForm(def, data, "draft", today).errors, [def, data, today]);
  const errors = showRequired ? { ...serverErrors, ...progress.errors } : { ...serverErrors, ...draftErrors };

  const visibleSections = def.sections.filter((s) => conditionMet(s.showIf, data));
  const countIn = (errs: Record<string, string>, sid: string) => {
    const s = def.sections.find((x) => x.id === sid)!;
    const names = new Set(s.fields.map((f) => f.name));
    return Object.keys(errs).filter((k) => names.has(k.split(".")[0])).length;
  };
  const sectionErrorCount = (sid: string) => countIn(errors, sid);

  const jumpTo = (sectionId: string) => {
    setActiveSection(sectionId);
    document.getElementById(`section-${sectionId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const tryIssue = () => {
    setShowRequired(true);
    setIssueError("");
    if (Object.keys(progress.errors).length > 0) {
      const first = visibleSections.find((s) => countIn(progress.errors, s.id) > 0) ?? visibleSections[0];
      setTimeout(() => jumpTo(first.id), 50);
      return;
    }
    setConfirming(true);
  };

  const doIssue = async () => {
    setIssuing(true);
    setIssueError("");
    if (timer.current) clearTimeout(timer.current);
    const ok = await save();
    if (!ok) {
      setIssuing(false);
      setConfirming(false);
      setIssueError("Couldn't save your latest changes. Check your connection and try again.");
      return;
    }
    const res = await issueCertificateAction(certId);
    setIssuing(false);
    setConfirming(false);
    if (res.ok) {
      try {
        localStorage.removeItem(storageKey);
      } catch {}
      setIssued(res);
    } else {
      setIssueError(res.message ?? "Couldn't issue the certificate");
      if (res.errors) setServerErrors(res.errors);
    }
  };

  const previewPdf = async () => {
    const w = window.open("about:blank", "_blank");
    await save();
    if (w) w.location.href = `/api/certificates/${certId}/pdf`;
  };

  // ---- Issued screen --------------------------------------------------------------
  if (issued?.ok) {
    return (
      <div className="mx-auto max-w-lg py-10 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <IconCheck width={30} height={30} />
        </div>
        <h1 className="mt-4 text-2xl font-bold">Certificate issued</h1>
        <p className="mt-2 text-ink-600">
          Certificate <span className="font-semibold text-ink-900">{issued.number}</span> has been issued, locked and sent to the customer.
        </p>
        {issued.nextDue && <p className="mt-1 text-ink-600">Next service due {formatUK(issued.nextDue)}.</p>}
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <a href={`/api/certificates/${certId}/pdf?download=1`} className="inline-flex h-11 items-center justify-center rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white">
            Download PDF
          </a>
          <button onClick={() => router.refresh()} className="inline-flex h-11 items-center justify-center rounded-lg border border-ink-200 bg-white px-5 text-sm font-semibold">
            View certificate
          </button>
        </div>
      </div>
    );
  }

  const saveLabel = {
    saved: savedAt ? `Saved ${savedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : "All changes saved",
    saving: "Saving…",
    pending: "Unsaved changes",
    offline: "Offline – kept on this device",
    error: "Save failed – retrying",
  }[saveState];

  return (
    <div className="pb-24">
      {header}
      {notice}

      {localBackup && (
        <div className="mb-4 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Unsaved changes from {new Date(localBackup.savedAt).toLocaleString("en-GB")} were found on this device.
          </span>
          <div className="flex gap-2">
            <button
              className="h-9 rounded-lg bg-amber-600 px-3 font-semibold text-white"
              onClick={() => {
                setData(localBackup.data);
                dirty.current = true;
                setLocalBackup(null);
                void save();
              }}
            >
              Restore
            </button>
            <button
              className="h-9 rounded-lg px-3 font-semibold"
              onClick={() => {
                try {
                  localStorage.removeItem(storageKey);
                } catch {}
                setLocalBackup(null);
              }}
            >
              Discard
            </button>
          </div>
        </div>
      )}

      <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-8">
        {/* Section navigation */}
        <nav className="sticky top-[57px] z-20 -mx-4 mb-4 overflow-x-auto border-b border-ink-200 bg-ink-50/95 px-4 py-2 backdrop-blur lg:top-8 lg:mx-0 lg:mb-0 lg:h-fit lg:overflow-visible lg:border-0 lg:bg-transparent lg:p-0">
          <div className="mb-3 hidden lg:block">
            <div className="flex justify-between text-xs font-semibold text-ink-500">
              <span>Progress</span>
              <span>
                {progress.done}/{progress.total}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-200">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
            </div>
          </div>
          <ul className="flex gap-1.5 lg:flex-col lg:gap-0.5">
            {visibleSections.map((s, i) => {
              const n = sectionErrorCount(s.id);
              return (
                <li key={s.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => jumpTo(s.id)}
                    className={cn(
                      "flex w-full items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-left text-sm font-medium lg:rounded-lg lg:py-2",
                      activeSection === s.id ? "bg-ink-800 text-white lg:bg-white lg:text-ink-900 lg:shadow-sm" : "text-ink-600 hover:bg-white",
                    )}
                  >
                    <span className="hidden w-5 text-xs text-ink-400 lg:inline">{i + 1}</span>
                    <span className="flex-1">{s.title}</span>
                    {n > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-[11px] font-bold text-white">{n}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0 space-y-5">
          {showRequired && Object.keys(progress.errors).length > 0 && (
            <div className="flex gap-3 rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800" role="alert">
              <IconAlert className="shrink-0" />
              <div>
                <p className="font-semibold">
                  {Object.keys(progress.errors).length} item{Object.keys(progress.errors).length === 1 ? "" : "s"} still need completing before this can be issued.
                </p>
                <p>Sections with a red count need attention.</p>
              </div>
            </div>
          )}

          {visibleSections.map((section) => (
            <section
              key={section.id}
              id={`section-${section.id}`}
              className="scroll-mt-32 rounded-xl border border-ink-200 bg-white shadow-sm lg:scroll-mt-8"
              onFocusCapture={() => setActiveSection(section.id)}
            >
              <header className="border-b border-ink-100 px-4 py-3 sm:px-5">
                <h2 className="font-semibold">{section.title}</h2>
                {section.description && <p className="text-sm text-ink-500">{section.description}</p>}
              </header>
              <div className="grid grid-cols-6 gap-4 p-4 sm:p-5">
                {section.fields
                  .filter((f) => conditionMet(f.showIf, data))
                  .map((f) => (
                    <div
                      key={f.name}
                      className={cn(
                        "col-span-6",
                        f.width === "half" && "sm:col-span-3",
                        f.width === "third" && "sm:col-span-3 lg:col-span-2",
                      )}
                    >
                      <FieldInput field={f} value={data[f.name]} onChange={(v) => setField(f.name, v)} errors={errors} certId={certId} data={data} />
                    </div>
                  ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* Sticky action bar */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-ink-200 bg-white/95 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5 sm:px-6 lg:px-8">
          <div className="min-w-0 flex-1">
            <div
              className={cn(
                "flex items-center gap-1.5 truncate text-xs font-semibold",
                saveState === "offline" || saveState === "error" ? "text-amber-700" : "text-ink-500",
              )}
            >
              <span className={cn("h-2 w-2 shrink-0 rounded-full", saveState === "saved" ? "bg-emerald-500" : saveState === "saving" || saveState === "pending" ? "bg-sky-500" : "bg-amber-500")} />
              {saveLabel}
            </div>
            <div className="text-xs text-ink-400 lg:hidden">
              {progress.done}/{progress.total} required complete
            </div>
          </div>
          <button type="button" onClick={previewPdf} className="h-11 rounded-lg border border-ink-200 bg-white px-3 text-sm font-semibold text-ink-700 sm:px-4">
            Preview
          </button>
          <button type="button" onClick={tryIssue} className="h-11 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 sm:px-5">
            Issue
          </button>
        </div>
        {issueError && <div className="border-t border-brand-200 bg-brand-50 px-4 py-2 text-center text-sm font-medium text-brand-800">{issueError}</div>}
      </div>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 p-4 sm:items-center" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold">Issue this certificate?</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-ink-600">
              <li>It will be given a certificate number and locked – it can&apos;t be edited afterwards.</li>
              <li>The PDF will be emailed to the customer and appear in their portal.</li>
              {scheduleEffectFor(def, data) !== "none" && <li>The site&apos;s next service will be scheduled automatically.</li>}
            </ul>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button onClick={() => setConfirming(false)} disabled={issuing} className="h-11 rounded-lg border border-ink-200 px-4 text-sm font-semibold">
                Go back
              </button>
              <button onClick={doIssue} disabled={issuing} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white disabled:opacity-60">
                {issuing && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                {issuing ? "Issuing…" : "Issue certificate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
