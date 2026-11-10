import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { Alert, Card, PageHeader } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/form";
import { UserForm } from "@/components/forms/user-form";
import { saveStaffUser } from "@/app/actions/admin";
import { resendInviteAction } from "@/app/actions/customers";
import { ADMIN, requireUser } from "@/server/auth";

export const metadata = { title: "Edit staff" };

export default async function EditUser({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ invited?: string }> }) {
  await requireUser(ADMIN);
  const { id } = await params;
  const { invited } = await searchParams;
  const [u] = await db.select().from(users).where(eq(users.id, id));
  if (!u || u.role === "CUSTOMER") notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title={u.name} back={{ href: "/users", label: "Staff" }} />
      {invited && <Alert tone="good">Account created and an invitation email has been sent to {u.email}.</Alert>}
      <UserForm action={saveStaffUser.bind(null, id)} user={u} />
      <Card className="p-4 sm:p-6">
        <h2 className="font-semibold">{u.passwordHash ? "Password reset" : "Invitation"}</h2>
        <p className="mb-3 text-sm text-ink-500">Sends a new link by email and shows it here so you can share it directly.</p>
        <ActionForm action={resendInviteAction.bind(null, id)}>
          <SubmitButton variant="secondary">{u.passwordHash ? "Send password reset link" : "Resend invitation"}</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
