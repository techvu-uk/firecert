"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fail, type ActionState } from "@/lib/action-state";
import { assertUser, STAFF } from "@/server/auth";
import { CertificateError, createDraft, deleteDraft, issueCertificate, voidCertificate } from "@/server/services/certificates";

export async function createCertificateAction(siteId: string, formId: string) {
  const user = await assertUser(STAFF);
  const cert = await createDraft(user, siteId, formId);
  redirect(`/certificates/${cert.id}`);
}

export type IssueState = ActionState & { number?: string; nextDue?: string | null };

export async function issueCertificateAction(id: string): Promise<IssueState> {
  const user = await assertUser(STAFF);
  try {
    const r = await issueCertificate(user, id);
    // No revalidate here: the editor shows its own confirmation, then refreshes on demand
    return { ok: true, number: r.number, nextDue: r.nextDue };
  } catch (e) {
    if (e instanceof CertificateError) return { ok: false, message: e.message, errors: e.errors };
    console.error(e);
    return { ok: false, message: "Something went wrong issuing the certificate. Nothing has been issued – please try again." };
  }
}

export async function voidCertificateAction(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await assertUser(["ADMIN"]);
  const reason = String(fd.get("reason") ?? "");
  const reissue = fd.get("reissue") === "on";
  let newId: string | null = null;
  try {
    ({ newId } = await voidCertificate(user, id, reason, reissue));
  } catch (e) {
    if (e instanceof CertificateError) return fail(e.message, { reason: e.message });
    throw e;
  }
  revalidatePath(`/certificates/${id}`);
  redirect(`/certificates/${newId ?? id}`);
}

export async function deleteDraftAction(id: string) {
  const user = await assertUser(STAFF);
  await deleteDraft(user, id);
  redirect("/certificates?status=DRAFT");
}
