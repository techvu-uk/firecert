export const dynamic = "force-static";

export default function Offline() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6 text-center">
      <div>
        <h1 className="text-xl font-bold">You&apos;re offline</h1>
        <p className="mt-2 text-ink-500">
          No signal right now. Anything you&apos;ve typed into a certificate is kept on this device and will save when you reconnect.
        </p>
      </div>
    </main>
  );
}
