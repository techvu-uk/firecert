import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center p-6 text-center">
      <div>
        <h1 className="text-xl font-bold">Not found</h1>
        <p className="mt-2 text-ink-500">This page doesn&apos;t exist or you don&apos;t have access to it.</p>
        <Link href="/" className="mt-4 inline-block font-semibold text-brand-700">Go home</Link>
      </div>
    </main>
  );
}
