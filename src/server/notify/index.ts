import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { notificationLogs } from "@/db/schema";
import { CHANNELS, type ChannelName, type OutgoingMessage } from "./channels";

export interface NotifyOptions {
  kind: string;
  channel: ChannelName;
  message: OutgoingMessage;
  visitId?: string | null;
  certificateId?: string | null;
  /** If set, the same key is never sent twice (failed sends are retried on the next run). */
  dedupeKey?: string;
}

export type NotifyOutcome = "SENT" | "LOGGED" | "FAILED" | "DUPLICATE" | "DISABLED";

/**
 * Sends one message and records it in the notification log.
 * The log row is claimed BEFORE sending, so two overlapping reminder runs can't double-send.
 */
export async function notify(opts: NotifyOptions): Promise<NotifyOutcome> {
  const channel = CHANNELS[opts.channel];
  if (!channel.enabled()) return "DISABLED";

  const base = {
    kind: opts.kind,
    channel: opts.channel,
    recipient: opts.message.to,
    subject: opts.message.subject,
    visitId: opts.visitId ?? null,
    certificateId: opts.certificateId ?? null,
    status: "PENDING",
    error: null,
  };

  let logId: string | undefined;
  if (opts.dedupeKey) {
    const [row] = await db
      .insert(notificationLogs)
      .values({ ...base, dedupeKey: opts.dedupeKey })
      .onConflictDoUpdate({
        target: notificationLogs.dedupeKey,
        set: { status: "PENDING", error: null, createdAt: sql`now()` },
        setWhere: eq(notificationLogs.status, "FAILED"),
      })
      .returning({ id: notificationLogs.id });
    if (!row) return "DUPLICATE";
    logId = row.id;
  } else {
    const [row] = await db.insert(notificationLogs).values(base).returning({ id: notificationLogs.id });
    logId = row.id;
  }

  try {
    const res = await channel.send(opts.message);
    await db.update(notificationLogs).set({ status: res.status }).where(eq(notificationLogs.id, logId));
    return res.status;
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`[notify] ${opts.channel} to ${opts.message.to} failed: ${error}`);
    await db
      .update(notificationLogs)
      .set({ status: "FAILED", error: error.slice(0, 1000) })
      .where(and(eq(notificationLogs.id, logId)));
    return "FAILED";
  }
}
