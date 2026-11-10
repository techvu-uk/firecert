/** Shape returned by every server action used with <ActionForm>. */
export type ActionState = {
  ok?: boolean;
  message?: string;
  detail?: string;
  errors?: Record<string, string>;
  nonce?: number;
  /** Filled in by <ActionForm> after a failed submit (not by server actions). */
  values?: Record<string, string>;
};

export function fail(message: string, errors?: Record<string, string>): ActionState {
  return { ok: false, message, errors };
}
export function success(message: string, detail?: string): ActionState {
  return { ok: true, message, detail, nonce: Date.now() };
}

/** Converts zod issues into { field: message }. */
export function zodErrors(issues: { path: (string | number)[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const k = i.path.join(".");
    if (!out[k]) out[k] = i.message;
  }
  return out;
}
