import Link from "next/link";
import { ActionForm, Input, SubmitButton } from "@/components/form";
import { loginAction } from "@/app/actions/auth";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <h1 className="text-lg font-bold">Sign in</h1>
      <p className="mb-5 mt-1 text-sm text-ink-500">Engineers, office staff and customers all sign in here.</p>
      <ActionForm action={loginAction}>
        <input type="hidden" name="next" value={next ?? ""} />
        <Input name="email" label="Email" type="email" autoComplete="email" required autoFocus />
        <Input name="password" label="Password" type="password" autoComplete="current-password" required />
        <SubmitButton className="w-full">Sign in</SubmitButton>
      </ActionForm>
      <Link href="/forgot" className="mt-4 block text-center text-sm font-medium text-ink-500 hover:text-ink-800">
        Forgotten your password?
      </Link>
    </>
  );
}
