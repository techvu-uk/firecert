import { ActionForm, Checkbox, FormGrid, Input, Select, SubmitButton } from "@/components/form";
import { Card } from "@/components/ui";
import type { User } from "@/db/schema";
import type { ActionState } from "@/lib/action-state";

export function UserForm({ action, user }: { action: (p: ActionState, fd: FormData) => Promise<ActionState>; user?: User }) {
  return (
    <ActionForm action={action}>
      <Card className="space-y-4 p-4 sm:p-6">
        <FormGrid>
          <Input name="name" label="Full name" defaultValue={user?.name} required />
          <Input name="email" label="Email" type="email" defaultValue={user?.email} required />
          <Input name="phone" label="Mobile" type="tel" defaultValue={user?.phone} />
          <Select
            name="role"
            label="Role"
            defaultValue={user?.role ?? "ENGINEER"}
            options={[
              { value: "ENGINEER", label: "Engineer – completes certificates" },
              { value: "ADMIN", label: "Admin – office, full access" },
            ]}
          />
          <Input name="position" label="Position" defaultValue={user?.position} placeholder="e.g. Senior Fire Alarm Engineer" help="Printed on certificates" />
          <Input name="qualification" label="Qualifications / card no." defaultValue={user?.qualification} placeholder="e.g. FIA Unit 3" help="Printed on certificates" />
        </FormGrid>
        <Checkbox name="active" label="Account active" defaultChecked={user?.active ?? true} help="Inactive users can't sign in" />
      </Card>
      <div className="flex justify-end">
        <SubmitButton>{user ? "Save changes" : "Create and send invite"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
