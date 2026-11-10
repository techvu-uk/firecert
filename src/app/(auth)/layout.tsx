import { IconFlame } from "@/components/icons";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="safe-top flex min-h-screen flex-col items-center justify-center bg-ink-50 px-4 py-10">
      <div className="mb-6 flex items-center gap-2.5">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow">
          <IconFlame width={22} height={22} />
        </span>
        <span className="text-xl font-bold tracking-tight">FireCert</span>
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-ink-200 bg-white p-6 shadow-sm sm:p-8">{children}</div>
    </main>
  );
}
