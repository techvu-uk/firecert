import "server-only";
import { db, type Tx } from "@/db";
import { auditLogs } from "@/db/schema";

export async function audit(
  executor: Tx | typeof db,
  userId: string | null,
  action: string,
  entity: string,
  entityId: string,
  details?: Record<string, unknown>,
) {
  await executor.insert(auditLogs).values({ userId, action, entity, entityId, details });
}
