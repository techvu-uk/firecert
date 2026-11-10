import { ActionForm, Checkbox, FormGrid, Input, Select, SubmitButton, Textarea } from "@/components/form";
import { Card } from "@/components/ui";
import type { Site } from "@/db/schema";
import type { ActionState } from "@/lib/action-state";
import { SYSTEM_TYPES } from "@/forms/definitions/shared";
import { SYSTEM_CATEGORIES } from "@/server/validation";

export function SiteForm({
  action,
  site,
  engineers,
  defaultInterval,
  currentDue,
  currentElDue,
}: {
  action: (p: ActionState, fd: FormData) => Promise<ActionState>;
  site?: Site;
  engineers: { id: string; name: string }[];
  defaultInterval: number;
  currentDue?: string | null;
  currentElDue?: string | null;
}) {
  const s = site;
  return (
    <ActionForm action={action}>
      <Card className="space-y-4 p-4 sm:p-6">
        <h2 className="font-semibold">Premises</h2>
        <Input name="name" label="Site name" defaultValue={s?.name} required placeholder="e.g. Acme House" />
        <FormGrid>
          <Textarea name="addressLines" label="Address" defaultValue={s?.addressLines} required />
          <Input name="postcode" label="Postcode" defaultValue={s?.postcode} required autoCapitalize="characters" />
        </FormGrid>
        <Textarea name="accessNotes" label="Access notes for engineers" defaultValue={s?.accessNotes} placeholder="Key holder, parking, alarm codes location…" />
      </Card>

      <Card className="space-y-4 p-4 sm:p-6">
        <h2 className="font-semibold">Site contact</h2>
        <p className="-mt-2 text-sm text-ink-500">Leave blank to use the customer&apos;s main contact.</p>
        <FormGrid>
          <Input name="contactName" label="Name" defaultValue={s?.contactName} />
          <Input name="contactEmail" label="Email" type="email" defaultValue={s?.contactEmail} />
          <Input name="contactPhone" label="Mobile number" type="tel" defaultValue={s?.contactPhone} />
        </FormGrid>
      </Card>

      <Card className="space-y-4 p-4 sm:p-6">
        <h2 className="font-semibold">Fire alarm system</h2>
        <p className="-mt-2 text-sm text-ink-500">These details pre-fill every certificate for this site.</p>
        <FormGrid>
          <Input name="systemCategory" label="System category" defaultValue={s?.systemCategory} list="system-categories" placeholder="e.g. L2 or L2/M" help="BS 5839-1 category (or BS 5839-6 grade, e.g. L2 – Grade A)" />
          <datalist id="system-categories">
            {SYSTEM_CATEGORIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <Select name="systemType" label="System type" defaultValue={s?.systemType} placeholder="Select…" options={SYSTEM_TYPES} />
          <Input name="panelMake" label="Panel manufacturer" defaultValue={s?.panelMake} />
          <Input name="panelModel" label="Panel model" defaultValue={s?.panelModel} />
          <Input name="panelLocation" label="Panel location" defaultValue={s?.panelLocation} />
          <Input name="zoneCount" label="Number of zones" type="number" inputMode="numeric" min={0} defaultValue={s?.zoneCount ?? ""} />
        </FormGrid>
        <Checkbox name="arcConnected" label="Connected to an Alarm Receiving Centre (ARC)" defaultChecked={s?.arcConnected} />
        <Input name="arcDetails" label="ARC name / account number" defaultValue={s?.arcDetails} />
      </Card>

      <Card className="space-y-4 p-4 sm:p-6">
        <h2 className="font-semibold">Servicing</h2>
        <p className="-mt-2 text-sm text-ink-500">The interval applies to the fire alarm. Emergency lighting uses the interval recorded on its certificate (normally 12 months).</p>
        <FormGrid>
          <Select
            name="serviceIntervalMonths"
            label="Fire alarm service interval"
            defaultValue={String(s?.serviceIntervalMonths ?? defaultInterval)}
            options={[1, 3, 4, 6, 12].map((m) => ({ value: String(m), label: m === 1 ? "Monthly" : `Every ${m} months` }))}
            help="BS 5839-1 recommends periodic inspection at intervals not exceeding 6 months."
          />
          <Select
            name="assignedEngineerId"
            label="Usual engineer"
            defaultValue={s?.assignedEngineerId ?? ""}
            placeholder="Unassigned"
            options={engineers.map((e) => ({ value: e.id, label: e.name }))}
          />
          <Input
            name="nextServiceDue"
            label={currentDue ? "Change next fire alarm service due" : "Next fire alarm service due"}
            type="date"
            help={
              currentDue
                ? "Leave blank to keep the current due date."
                : "Leave blank to schedule automatically when the first certificate is issued."
            }
          />
          <Input
            name="nextElDue"
            label={currentElDue ? "Change emergency lighting inspection due" : "Emergency lighting inspection due"}
            type="date"
            help={currentElDue ? "Leave blank to keep the current date." : "Only if this site has emergency lighting. Also set automatically when an emergency lighting certificate is issued."}
          />
        </FormGrid>
      </Card>

      <div className="flex justify-end">
        <SubmitButton>{s ? "Save changes" : "Create site"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
