import Link from "next/link";
import { ActionForm, Input, SubmitButton } from "@/components/form";
import { setPasswordAction } from "@/app/actions/auth";
import { findValidToken } from "@/server/auth";

export const metadata = { title: "Set password" };

export default async function SetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const valid = await findValidToken(token);
  if (!valid) {
    return (
      <>
        <h1 className="text-lg font-bold">Link expired</h1>
        <p className="mt-2 text-sm text-ink-500">
          This link has expired or has already been used. Ask for a new one, or reset your password.
        </p>
        <Link href="/forgot" className="mt-4 inline-block text-sm font-semibold text-brand-700">Reset password</Link>
      </>
    );
  }
  return (
    <>
      <h1 className="text-lg font-bold">{valid.token.type === "INVITE" ? `Welcome, ${valid.user.name}` : "Choose a new password"}</h1>
      <p className="mb-5 mt-1 text-sm text-ink-500">Signing in as {valid.user.email}</p>
      <ActionForm action={setPasswordAction}>
        <input type="hidden" name="token" value={token} />
        <Input name="password" label="New password" type="password" autoComplete="new-password" required help="At least 10 characters, with letters and numbers." />
        <Input name="confirm" label="Confirm password" type="password" autoComplete="new-password" required />
        <SubmitButton className="w-full">Save and sign in</SubmitButton>
      </ActionForm>
    </>
  );
}
