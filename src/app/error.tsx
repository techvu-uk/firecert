"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-[60vh] items-center justify-center p-6 text-center">
      <div>
        <h1 className="text-xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-ink-500">The problem has been logged. Please try again.</p>
        <button onClick={reset} className="mt-4 rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white">Try again</button>
      </div>
    </main>
  );
}
