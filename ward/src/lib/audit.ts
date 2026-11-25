import { json, type OrgContext, type Queryable } from '@/lib/db';

export interface AuditActor {
  type: 'user' | 'agent' | 'system';
  id: string | null;
}

export function actorOf(ctx: OrgContext, agentId?: string | null): AuditActor {
  if (agentId) return { type: 'agent', id: agentId };
  if (ctx.role === 'system' || !ctx.userId) return { type: 'system', id: null };
  return { type: 'user', id: ctx.userId };
}

/** Append-only audit trail (the request role cannot update or delete rows). */
export async function audit(
  q: Queryable,
  ctx: OrgContext,
  action: string,
  entity?: { type: string; id?: string | null },
  details: Record<string, unknown> = {},
  agentId?: string | null,
): Promise<void> {
  const actor = actorOf(ctx, agentId);
  await q.query(
    `insert into ward.audit_logs (org_id, actor_type, actor_id, action, entity_type, entity_id, details, ip)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
    [ctx.orgId, actor.type, actor.id, action, entity?.type ?? null, entity?.id ?? null, json(details), ctx.ip ?? null],
  );
}
