import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
import { db, type Tx } from "@/db";
import {
  attachments,
  certificates,
  certificateSequences,
  customers,
  sites,
  users,
  type Certificate,
  type User,
} from "@/db/schema";
import { getForm, scheduleEffectFor } from "@/forms/registry";
import { formatValue } from "@/forms/format";
import type { FormData, FormDefinition, PhotoValue } from "@/forms/types";
import { validateForm } from "@/forms/validate";
import { env } from "@/lib/env";
import { todayISO } from "@/lib/dates";
import { audit } from "@/server/audit";
import { certificateIssuedMessage } from "@/server/notify/templates";
import { renderCertificatePdf, type PdfMeta } from "@/server/pdf/certificate-pdf";
import { getStorage } from "@/server/storage";
import { getCompany } from "./company";
import { applyScheduleEffect, notifySiteContact, openServiceVisit, siteContact } from "./scheduling";

export class CertificateError extends Error {
  constructor(
    message: string,
    public errors?: Record<string, string>,
  ) {
    super(message);
  }
}

// ---- Permissions -------------------------------------------------------------
export function canEditDraft(user: User, cert: Certificate) {
  return cert.status === "DRAFT" && (user.role === "ADMIN" || (user.role === "ENGINEER" && cert.engineerId === user.id));
}

/** Loads a certificate the user is allowed to see, or null. */
export async function getCertificateFor(user: User, id: string) {
  const row = await db.query.certificates.findFirst({
    where: eq(certificates.id, id),
    with: { site: { with: { customer: true } }, engineer: true, attachments: true },
  });
  if (!row) return null;
  if (user.role === "CUSTOMER") {
    if (row.status !== "ISSUED" || row.site.customerId !== user.customerId) return null;
  }
  return row;
}

// ---- Create & save drafts ----------------------------------------------------
export async function createDraft(user: User, siteId: string, formId: string) {
  const def = getForm(formId);
  const site = await db.query.sites.findFirst({ where: eq(sites.id, siteId), with: { customer: true } });
  if (!site || site.archived) throw new CertificateError("Site not found");

  const company = await getCompany();
  const previous = await db
    .select({ formId: certificates.formId, number: certificates.number })
    .from(certificates)
    .where(and(eq(certificates.siteId, site.id), eq(certificates.status, "ISSUED")))
    .orderBy(desc(certificates.issuedAt));
  const previousCertificates: Record<string, string> = {};
  for (const p of previous) if (p.number && !previousCertificates[p.formId]) previousCertificates[p.formId] = p.number;

  const data = def.prefill?.({
    today: todayISO(),
    site: {
      name: site.name,
      address: site.addressLines,
      postcode: site.postcode,
      systemCategory: site.systemCategory,
      systemType: site.systemType,
      panelMake: site.panelMake,
      panelModel: site.panelModel,
      panelLocation: site.panelLocation,
      zoneCount: site.zoneCount,
      arcConnected: site.arcConnected,
      arcDetails: site.arcDetails,
      serviceIntervalMonths: site.serviceIntervalMonths,
    },
    customer: { name: site.customer.name, accountRef: site.customer.accountRef ?? "" },
    contact: siteContact(site, site.customer),
    engineer: { name: user.name, position: user.position, qualification: user.qualification },
    company: { name: company.name },
    previousCertificates,
  }) ?? {};

  const open = def.visitType === "SERVICE" ? await openServiceVisit(db, site.id, def.serviceKind ?? "FIRE_ALARM") : null;
  const [cert] = await db
    .insert(certificates)
    .values({
      formId: def.id,
      formVersion: def.version,
      siteId: site.id,
      engineerId: user.id,
      visitId: open?.id ?? null,
      data: validateForm(def, data, "draft", todayISO()).data,
    })
    .returning();
  await audit(db, user.id, "certificate.created", "certificate", cert.id, { formId: def.id });
  return cert;
}

export async function saveDraft(user: User, id: string, input: FormData) {
  const [cert] = await db.select().from(certificates).where(eq(certificates.id, id));
  if (!cert) throw new CertificateError("Certificate not found");
  if (!canEditDraft(user, cert)) throw new CertificateError("This certificate can no longer be edited");
  const def = getForm(cert.formId, cert.formVersion);
  const res = validateForm(def, input, "draft", todayISO());
  // Only save if still a draft (guards against a save racing an issue)
  const updated = await db
    .update(certificates)
    .set({ data: res.data })
    .where(and(eq(certificates.id, id), eq(certificates.status, "DRAFT")))
    .returning({ updatedAt: certificates.updatedAt });
  if (updated.length === 0) throw new CertificateError("This certificate has been issued and can no longer be edited");
  return { errors: res.errors, updatedAt: updated[0].updatedAt };
}

export async function deleteDraft(user: User, id: string) {
  const [cert] = await db.select().from(certificates).where(eq(certificates.id, id));
  if (!cert || !canEditDraft(user, cert)) throw new CertificateError("Only your own drafts can be deleted");
  const files = await db.select().from(attachments).where(eq(attachments.certificateId, id));
  await db.delete(certificates).where(and(eq(certificates.id, id), eq(certificates.status, "DRAFT")));
  await Promise.all(files.map((f) => getStorage().delete(f.storageKey)));
  await audit(db, user.id, "certificate.deleted", "certificate", id);
}

// ---- PDF -------------------------------------------------------------------
async function buildPdf(cert: Certificate, def: FormDefinition, data: FormData, tx: Tx | typeof db = db) {
  const [row] = await tx
    .select({ site: sites, customer: customers, engineer: users })
    .from(sites)
    .innerJoin(customers, eq(customers.id, sites.customerId))
    .innerJoin(users, eq(users.id, cert.engineerId))
    .where(eq(sites.id, cert.siteId));
  const company = await getCompany();

  const photoIds = def.sections
    .flatMap((s) => s.fields)
    .filter((f) => f.type === "photos")
    .flatMap((f) => ((data[f.name] as PhotoValue[]) ?? []).map((p) => p.id));
  const files = photoIds.length
    ? await tx.select().from(attachments).where(and(eq(attachments.certificateId, cert.id), inArray(attachments.id, photoIds)))
    : [];
  const photos: PdfMeta["photos"] = [];
  for (const f of files) {
    const bytes = await getStorage().get(f.storageKey);
    if (bytes) photos.push({ id: f.id, bytes, mimeType: f.mimeType });
  }

  return renderCertificatePdf(def, data, {
    status: cert.status,
    number: cert.number,
    issuedAt: cert.issuedAt,
    company,
    customer: row.customer,
    site: row.site,
    engineer: row.engineer,
    photos,
  });
}

/** Returns PDF bytes: the stored file for issued certificates, a live preview for drafts. */
export async function getCertificatePdf(cert: Certificate): Promise<Uint8Array> {
  if (cert.pdfKey) {
    const stored = await getStorage().get(cert.pdfKey);
    if (stored) return stored;
  }
  const def = getForm(cert.formId, cert.formVersion);
  return buildPdf(cert, def, cert.data);
}

export function pdfFilename(cert: Certificate, siteName: string) {
  const def = getForm(cert.formId, cert.formVersion);
  const safe = (s: string) => s.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-");
  return `${safe(cert.number ?? "DRAFT")}_${safe(def.shortTitle)}_${safe(siteName)}.pdf`;
}

// ---- Issue -----------------------------------------------------------------
async function nextNumber(tx: Tx, prefix: string, year: number) {
  const [row] = await tx
    .insert(certificateSequences)
    .values({ year, lastNumber: 1 })
    .onConflictDoUpdate({
      target: certificateSequences.year,
      set: { lastNumber: sql`${certificateSequences.lastNumber} + 1` },
    })
    .returning();
  return `${prefix}-${year}-${String(row.lastNumber).padStart(6, "0")}`;
}

export async function issueCertificate(user: User, id: string) {
  const today = todayISO();
  const company = await getCompany();

  const result = await db.transaction(async (tx) => {
    const [cert] = await tx.select().from(certificates).where(eq(certificates.id, id)).for("update");
    if (!cert) throw new CertificateError("Certificate not found");
    if (cert.status !== "DRAFT") throw new CertificateError("This certificate has already been issued");
    if (!canEditDraft(user, cert)) throw new CertificateError("You can only issue your own certificates");

    const def = getForm(cert.formId, cert.formVersion);
    const check = validateForm(def, cert.data, "issue", today);
    if (!check.ok) throw new CertificateError("Please complete the highlighted fields before issuing", check.errors);

    const [site] = await tx.select().from(sites).where(eq(sites.id, cert.siteId)).for("update");
    const effect = scheduleEffectFor(def, check.data);
    const visitDate = check.data[def.visitDateField] as string;
    const interval = def.intervalField ? Number(check.data[def.intervalField]) : site.serviceIntervalMonths;
    const { nextDue, closedVisitId } = await applyScheduleEffect(tx, site, effect, visitDate, def.serviceKind ?? "FIRE_ALARM", interval);
    if (def.nextDueField && nextDue) check.data[def.nextDueField] = nextDue;

    const number = await nextNumber(tx, company.certPrefix || "FC", Number(today.slice(0, 4)));
    const issuedAt = new Date();
    const outcome = def.outcomeField ? ((check.data[def.outcomeField] as string) ?? null) : null;
    const issued: Certificate = {
      ...cert,
      status: "ISSUED",
      number,
      issuedAt,
      data: check.data,
      outcome,
      visitId: closedVisitId ?? cert.visitId,
    };

    // The PDF is generated and stored inside the transaction: if this fails, nothing is issued.
    const pdf = await buildPdf(issued, def, check.data, tx);
    const pdfKey = `certificates/${today.slice(0, 4)}/${number}.pdf`;
    await getStorage().put(pdfKey, pdf);
    const pdfSha256 = createHash("sha256").update(pdf).digest("hex");

    // Remove photos that were uploaded but then removed from the form
    const keptPhotoIds = new Set(
      def.sections
        .flatMap((s) => s.fields)
        .filter((f) => f.type === "photos")
        .flatMap((f) => ((check.data[f.name] as PhotoValue[]) ?? []).map((p) => p.id)),
    );
    const allPhotos = await tx.select().from(attachments).where(eq(attachments.certificateId, id));
    const orphaned = allPhotos.filter((p) => !keptPhotoIds.has(p.id));
    if (orphaned.length) await tx.delete(attachments).where(inArray(attachments.id, orphaned.map((p) => p.id)));

    await tx
      .update(certificates)
      .set({ status: "ISSUED", number, issuedAt, data: check.data, outcome, pdfKey, pdfSha256, visitId: issued.visitId })
      .where(eq(certificates.id, id));
    await audit(tx, user.id, "certificate.issued", "certificate", id, { number, nextDue });

    return { cert: { ...issued, pdfKey, pdfSha256 }, def, pdf, nextDue, orphaned };
  });

  await Promise.all(result.orphaned.map((p) => getStorage().delete(p.storageKey).catch(() => undefined)));

  // Email the customer (outside the transaction — a mail failure must not undo the issue)
  try {
    const site = await db.query.sites.findFirst({ where: eq(sites.id, result.cert.siteId), with: { customer: true } });
    if (site) {
      const outcomeField = result.def.sections.flatMap((s) => s.fields).find((f) => f.name === result.def.outcomeField);
      await notifySiteContact({
        site,
        customer: site.customer,
        kind: "CERT_ISSUED",
        certificateId: result.cert.id,
        dedupePrefix: `cert:${result.cert.id}`,
        attachments: [{ filename: pdfFilename(result.cert, site.name), content: result.pdf, contentType: "application/pdf" }],
        build: (name) => ({
          ...certificateIssuedMessage({
            company: company.name,
            customerName: name,
            siteName: site.name,
            certTitle: result.def.shortTitle + " certificate",
            certNumber: result.cert.number!,
            outcome: outcomeField ? formatValue(outcomeField, result.cert.outcome) : "",
            nextDue: result.nextDue,
            portalUrl: `${env.appUrl}/portal`,
          }),
        }),
      });
    }
  } catch (e) {
    console.error("[issue] customer notification failed", e);
  }

  return { number: result.cert.number!, nextDue: result.nextDue };
}

// ---- Void / reissue (admin) --------------------------------------------------
export async function voidCertificate(user: User, id: string, reason: string, reissue: boolean) {
  if (user.role !== "ADMIN") throw new CertificateError("Only an admin can void certificates");
  if (reason.trim().length < 5) throw new CertificateError("Please give a reason (at least 5 characters)");

  return db.transaction(async (tx) => {
    const [cert] = await tx.select().from(certificates).where(eq(certificates.id, id)).for("update");
    if (!cert || cert.status !== "ISSUED") throw new CertificateError("Only issued certificates can be voided");
    const def = getForm(cert.formId, cert.formVersion);
    const voided: Certificate = { ...cert, status: "VOID", voidedAt: new Date(), voidReason: reason.trim() };
    const pdf = await buildPdf(voided, def, cert.data, tx);
    const pdfKey = `certificates/${cert.number!.split("-").at(-2)}/${cert.number}-VOID.pdf`;
    await getStorage().put(pdfKey, pdf);
    await tx
      .update(certificates)
      .set({ status: "VOID", voidedAt: voided.voidedAt, voidReason: voided.voidReason, pdfKey })
      .where(eq(certificates.id, id));
    await audit(tx, user.id, "certificate.voided", "certificate", id, { reason });

    if (!reissue) return { newId: null };
    const [copy] = await tx
      .insert(certificates)
      .values({
        formId: cert.formId,
        formVersion: cert.formVersion,
        siteId: cert.siteId,
        visitId: cert.visitId,
        engineerId: cert.engineerId,
        data: cert.data,
        supersedesId: cert.id,
      })
      .returning({ id: certificates.id });
    // Photos are copied by reference to new attachment rows
    const photos = await tx.select().from(attachments).where(eq(attachments.certificateId, id));
    if (photos.length) {
      const idMap = new Map<string, string>();
      const rows = photos.map((p) => {
        const nid = randomUUID();
        idMap.set(p.id, nid);
        return { ...p, id: nid, certificateId: copy.id };
      });
      await tx.insert(attachments).values(rows);
      const data = JSON.parse(JSON.stringify(cert.data), (_k, v) =>
        v && typeof v === "object" && typeof v.id === "string" && idMap.has(v.id) ? { ...v, id: idMap.get(v.id) } : v,
      );
      await tx.update(certificates).set({ data }).where(eq(certificates.id, copy.id));
    }
    await audit(tx, user.id, "certificate.reissue_draft", "certificate", copy.id, { supersedes: id });
    return { newId: copy.id };
  });
}

// ---- Photos ------------------------------------------------------------------
const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png" };
export const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

function sniffImage(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  return null;
}

export async function addPhoto(user: User, certId: string, fieldName: string, bytes: Uint8Array) {
  const [cert] = await db.select().from(certificates).where(eq(certificates.id, certId));
  if (!cert || !canEditDraft(user, cert)) throw new CertificateError("This certificate can no longer be edited");
  const def = getForm(cert.formId, cert.formVersion);
  const field = def.sections.flatMap((s) => s.fields).find((f) => f.name === fieldName && f.type === "photos");
  if (!field) throw new CertificateError("Unknown photo field");
  if (bytes.length > MAX_PHOTO_BYTES) throw new CertificateError("Photo is too large (max 8 MB)");
  const mime = sniffImage(bytes);
  if (!mime) throw new CertificateError("Only JPEG or PNG photos are supported");
  const id = randomUUID();
  const storageKey = `photos/${certId}/${id}.${PHOTO_TYPES[mime]}`;
  await getStorage().put(storageKey, bytes);
  await db.insert(attachments).values({ id, certificateId: certId, fieldName, storageKey, mimeType: mime, sizeBytes: bytes.length });
  return { id };
}

export async function getPhoto(user: User, attachmentId: string) {
  const [a] = await db.select().from(attachments).where(eq(attachments.id, attachmentId));
  if (!a) return null;
  const cert = await getCertificateFor(user, a.certificateId);
  if (!cert) return null;
  const bytes = await getStorage().get(a.storageKey);
  return bytes ? { bytes, mimeType: a.mimeType } : null;
}
