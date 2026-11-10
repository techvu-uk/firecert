import { ActionForm, FormGrid, Input, SubmitButton, Textarea } from "@/components/form";
import { Card, PageHeader } from "@/components/ui";
import { saveSettings } from "@/app/actions/admin";
import { ADMIN, requireUser } from "@/server/auth";
import { getCompany } from "@/server/services/company";
import { env } from "@/lib/env";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireUser(ADMIN);
  const c = await getCompany();
  const channels = [
    { name: "Email", on: !!env.smtp.host, note: env.smtp.host ? `via ${env.smtp.host}` : "Not configured – emails are logged only" },
    { name: "SMS", on: !!(env.twilio.sid && env.twilio.smsFrom), note: env.twilio.smsFrom ? `from ${env.twilio.smsFrom}` : "Add Twilio settings to enable" },
    { name: "WhatsApp", on: !!(env.twilio.sid && env.twilio.whatsappFrom), note: env.twilio.whatsappFrom ? "Twilio WhatsApp" : "Add Twilio WhatsApp settings to enable" },
  ];
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Settings" subtitle="Company details printed on every certificate" />
      <ActionForm action={saveSettings}>
        <Card className="space-y-4 p-4 sm:p-6">
          <FormGrid>
            <Input name="name" label="Company name" defaultValue={c.name} required />
            <Input name="tagline" label="Tagline" defaultValue={c.tagline} placeholder="e.g. Your Gate to Technology" />
            <Input name="phone" label="Phone" defaultValue={c.phone} />
            <Input name="mobile" label="Mobile / WhatsApp" defaultValue={c.mobile} />
            <Input name="email" label="Email" type="email" defaultValue={c.email} />
            <Input name="website" label="Website" defaultValue={c.website} />
            <Input name="companyRegNo" label="Company registration no." defaultValue={c.companyRegNo} />
          </FormGrid>
          <Textarea name="addressLines" label="Address" defaultValue={c.addressLines} />
          <FormGrid>
            <Input name="certificationBody" label="Certification body / scheme" defaultValue={c.certificationBody} placeholder="e.g. BAFE SP203-1" />
            <Input name="certificationNo" label="Certification number" defaultValue={c.certificationNo} />
            <Input name="certPrefix" label="Certificate number prefix" defaultValue={c.certPrefix} help="e.g. TV gives TV-2026-000001" required />
            <Input name="defaultServiceMonths" label="Default service interval (months)" type="number" min={1} max={24} defaultValue={c.defaultServiceMonths} required />
          </FormGrid>
          <div className="flex justify-end">
            <SubmitButton>Save settings</SubmitButton>
          </div>
        </Card>
      </ActionForm>
      <Card className="p-4 sm:p-6">
        <h2 className="font-semibold">Notification channels</h2>
        <p className="mb-3 text-sm text-ink-500">Configured on the server (see the deployment guide).</p>
        <ul className="divide-y divide-ink-100">
          {channels.map((ch) => (
            <li key={ch.name} className="flex items-center justify-between py-2.5 text-sm">
              <span className="font-medium">{ch.name}</span>
              <span className={ch.on ? "font-semibold text-emerald-700" : "text-ink-500"}>{ch.on ? `On · ${ch.note}` : ch.note}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
