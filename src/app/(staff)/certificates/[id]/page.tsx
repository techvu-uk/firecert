import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { certificates } from "@/db/schema";
import { Alert, Button, Card, CardHeader, DetailList, LinkButton, PageHeader } from "@/components/ui";
import { ActionForm, Checkbox, SubmitButton, Textarea } from "@/components/form";
import { CertStatusBadge, OutcomeBadge } from "@/components/status";
import { CertificateView } from "@/components/certificate-view";
import { CertificateEditor } from "@/components/cert-editor/editor";
import { IconDownload } from "@/components/icons";
import { getForm } from "@/forms/registry";
import { formatUKDateTime } from "@/lib/dates";
import { requireUser, STAFF } from "@/server/auth";
import { canEditDraft, getCertificateFor } from "@/server/services/certificates";
import { deleteDraftAction, voidCertificateAction } from "@/app/actions/certificates";

export default async function CertificatePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser(STAFF);
  const { id } = await params;
  const cert = await getCertificateFor(user, id);
  if (!cert) notFound();
  const def = getForm(cert.formId, cert.formVersion);
  const site = cert.site;

  const subtitle = (
    <span>
      <Link href={`/sites/${site.id}`} className="font-medium text-ink-700 hover:text-ink-900">{site.name}</Link>
      {" · "}
      {site.customer.name}
    </span>
  );

  const [supersedes, supersededBy] = await Promise.all([
    cert.supersedesId ? db.select({ id: certificates.id, number: certificates.number }).from(certificates).where(eq(certificates.id, cert.supersedesId)) : [],
    db.select({ id: certificates.id, number: certificates.number, status: certificates.status }).from(certificates).where(eq(certificates.supersedesId, cert.id)),
  ]);
  const replacesNotice = supersedes[0] && (
    <div className="mb-4">
      <Alert tone="info">
        This certificate replaces{" "}
        <Link className="font-semibold underline" href={`/certificates/${supersedes[0].id}`}>{supersedes[0].number}</Link>
        {cert.status === "DRAFT" ? ", which was voided. Correct the details and issue it to get a new certificate number." : "."}
      </Alert>
    </div>
  );

  if (cert.status === "DRAFT" && canEditDraft(user, cert)) {
    return (
      <CertificateEditor
        certId={cert.id}
        formId={cert.formId}
        formVersion={cert.formVersion}
        initialData={cert.data}
        serverUpdatedAt={cert.updatedAt.toISOString()}
        header={
          <PageHeader
            title={def.shortTitle}
            subtitle={subtitle}
            back={{ href: `/sites/${site.id}`, label: site.name }}
            actions={
              <form action={deleteDraftAction.bind(null, cert.id)}>
                <Button variant="ghost" className="text-ink-500">Delete draft</Button>
              </form>
            }
          />
        }
        notice={replacesNotice}
      />
    );
  }

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {cert.number ?? def.shortTitle} <CertStatusBadge status={cert.status} />
            <OutcomeBadge formId={cert.formId} formVersion={cert.formVersion} outcome={cert.outcome} />
          </span>
        }
        subtitle={subtitle}
        back={{ href: `/sites/${site.id}`, label: site.name }}
        actions={
          <>
            <LinkButton href={`/api/certificates/${cert.id}/pdf`} target="_blank" variant="secondary" prefetch={false}>
              View PDF
            </LinkButton>
            <LinkButton href={`/api/certificates/${cert.id}/pdf?download=1`} prefetch={false}>
              <IconDownload /> Download
            </LinkButton>
          </>
        }
      />

      {cert.status === "DRAFT" && (
        <div className="mb-4"><Alert tone="info">This draft belongs to {cert.engineer.name}. Only they (or an admin) can edit it.</Alert></div>
      )}
      {cert.status === "VOID" && (
        <div className="mb-4">
          <Alert tone="warn">
            This certificate was voided on {formatUKDateTime(cert.voidedAt)}: {cert.voidReason}
            {supersededBy[0] && (
              <>
                {" "}
                Replaced by{" "}
                <Link className="font-semibold underline" href={`/certificates/${supersededBy[0].id}`}>
                  {supersededBy[0].number ?? "a new draft"}
                </Link>
                .
              </>
            )}
          </Alert>
        </div>
      )}
      {replacesNotice}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CertificateView def={def} data={cert.data} />
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Details" />
            <DetailList
              items={[
                { label: "Type", value: def.shortTitle },
                { label: "Engineer", value: cert.engineer.name },
                { label: "Issued", value: formatUKDateTime(cert.issuedAt) },
                { label: "Form version", value: `v${cert.formVersion}` },
                { label: "PDF checksum", value: cert.pdfSha256 ? <span className="font-mono text-xs">{cert.pdfSha256.slice(0, 16)}…</span> : "" },
              ]}
            />
          </Card>
          {user.role === "ADMIN" && cert.status === "ISSUED" && (
            <Card>
              <CardHeader title="Void certificate" subtitle="Use if the certificate was issued in error. It stays on record, marked VOID." />
              <div className="p-4 sm:p-5">
                <ActionForm action={voidCertificateAction.bind(null, cert.id)}>
                  <Textarea name="reason" label="Reason" required minLength={5} />
                  <Checkbox name="reissue" label="Create a corrected copy as a new draft" defaultChecked />
                  <SubmitButton variant="danger" className="w-full">Void certificate</SubmitButton>
                </ActionForm>
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
