import { desc } from "drizzle-orm";
import { db } from "@/db";
import { notificationLogs } from "@/db/schema";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { formatUKDateTime } from "@/lib/dates";
import { ADMIN, requireUser } from "@/server/auth";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  await requireUser(ADMIN);
  const rows = await db.select().from(notificationLogs).orderBy(desc(notificationLogs.createdAt)).limit(300);
  return (
    <>
      <PageHeader title="Notification log" subtitle="Every reminder, booking confirmation and certificate email sent (last 300)" />
      <Card>
        {rows.length === 0 ? (
          <EmptyState title="Nothing sent yet" />
        ) : (
          <div className="divide-y divide-ink-100">
            {rows.map((n) => (
              <div key={n.id} className="px-4 py-3 sm:px-5">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{n.subject || n.kind}</span>
                  <Badge tone={n.status === "SENT" ? "good" : n.status === "FAILED" ? "bad" : n.status === "LOGGED" ? "neutral" : "info"}>{n.status}</Badge>
                </div>
                <div className="truncate text-xs text-ink-500">
                  {n.channel} · {n.recipient} · {n.kind} · {formatUKDateTime(n.createdAt)}
                </div>
                {n.error && <div className="mt-1 text-xs text-brand-700">{n.error}</div>}
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
