import Link from "next/link";
import { ActionForm, Input, SubmitButton } from "@/components/form";
import { forgotAction } from "@/app/actions/auth";

export const metadata = { title: "Reset password" };

export default function ForgotPage() {
  return (
    <>
      <h1 className="text-lg font-bold">Reset your password</h1>
      <p className="mb-5 mt-1 text-sm text-ink-500">We&apos;ll email you a link to choose a new password.</p>
      <ActionForm action={forgotAction}>
        <Input name="email" label="Email" type="email" autoComplete="email" required />
        <SubmitButton className="w-full">Send reset link</SubmitButton>
      </ActionForm>
      <Link href="/login" className="mt-4 block text-center text-sm font-medium text-ink-500 hover:text-ink-800">
        Back to sign in
      </Link>
    </>
  );
}
