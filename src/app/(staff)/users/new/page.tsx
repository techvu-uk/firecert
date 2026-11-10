import { PageHeader } from "@/components/ui";
import { UserForm } from "@/components/forms/user-form";
import { saveStaffUser } from "@/app/actions/admin";
import { ADMIN, requireUser } from "@/server/auth";

export const metadata = { title: "Add staff" };

export default async function NewUser() {
  await requireUser(ADMIN);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Add staff member" subtitle="They'll get an email to set their password." back={{ href: "/users", label: "Staff" }} />
      <UserForm action={saveStaffUser.bind(null, null)} />
    </div>
  );
}
