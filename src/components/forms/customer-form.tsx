import { ActionForm, Checkbox, FormGrid, Input, SubmitButton, Textarea } from "@/components/form";
import { Card } from "@/components/ui";
import type { Customer } from "@/db/schema";
import type { ActionState } from "@/lib/action-state";

export function CustomerForm({ action, customer }: { action: (p: ActionState, fd: FormData) => Promise<ActionState>; customer?: Customer }) {
  const c = customer;
  return (
    <ActionForm action={action}>
      <Card className="space-y-4 p-4 sm:p-6">
        <h2 className="font-semibold">Company</h2>
        <FormGrid>
          <Input name="name" label="Customer name" defaultValue={c?.name} required />
          <Input name="accountRef" label="Account reference" defaultValue={c?.accountRef ?? ""} help="Optional – your internal reference" />
        </FormGrid>
        <FormGrid>
          <Textarea name="addressLines" label="Billing address" defaultValue={c?.addressLines} />
          <Input name="postcode" label="Postcode" defaultValue={c?.postcode} autoCapitalize="characters" />
        </FormGrid>
      </Card>
      <Card className="space-y-4 p-4 sm:p-6">
        <h2 className="font-semibold">Main contact</h2>
        <p className="-mt-2 text-sm text-ink-500">Used for reminders and certificates unless a site has its own contact.</p>
        <FormGrid>
          <Input name="contactName" label="Name" defaultValue={c?.contactName} />
          <Input name="contactEmail" label="Email" type="email" defaultValue={c?.contactEmail} />
          <Input name="contactPhone" label="Mobile number" type="tel" defaultValue={c?.contactPhone} help="Needed for SMS / WhatsApp" />
        </FormGrid>
        <div className="space-y-1 rounded-lg bg-ink-50 p-3">
          <div className="text-sm font-semibold text-ink-700">Send reminders and certificates by</div>
          <Checkbox name="notifyEmail" label="Email" defaultChecked={c?.notifyEmail ?? true} />
          <Checkbox name="notifySms" label="SMS" defaultChecked={c?.notifySms ?? false} help="Requires Twilio to be set up" />
          <Checkbox name="notifyWhatsapp" label="WhatsApp" defaultChecked={c?.notifyWhatsapp ?? false} help="Requires Twilio WhatsApp to be set up" />
        </div>
      </Card>
      <Card className="space-y-4 p-4 sm:p-6">
        <Textarea name="notes" label="Internal notes" defaultValue={c?.notes} help="Not visible to the customer" />
      </Card>
      <div className="flex justify-end">
        <SubmitButton>{c ? "Save changes" : "Create customer"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
