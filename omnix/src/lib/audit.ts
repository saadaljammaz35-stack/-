import "server-only";
import type { Db } from "@/lib/db/pool";
import type { AuthContext } from "@/lib/auth/session";
import { redact } from "@/lib/security/redact";

export async function audit(
  db: Db,
  ctx: Pick<AuthContext, "userId" | "workspaceId"> & { requestId?: string; ip?: string | null },
  action: string,
  resourceType: string,
  resourceId: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await db.query(
    `INSERT INTO ai_audit_events (actor_id, workspace_id, action, resource_type, resource_id, request_id, ip, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [ctx.userId, ctx.workspaceId, action, resourceType, resourceId, ctx.requestId ?? null, ctx.ip ?? null, redact(metadata)],
  );
}
