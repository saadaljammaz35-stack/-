import { query, type Db } from "./db";

export async function audit(
  actorId: string | null,
  action: string,
  target: { type: string; id: string } | null,
  metadata: Record<string, unknown> = {},
  ip: string | null = null,
  db?: Db,
): Promise<void> {
  await query(
    `INSERT INTO audit_log (actor_id, action, target_type, target_id, metadata, ip) VALUES ($1, $2, $3, $4, $5, $6)`,
    [actorId, action, target?.type ?? null, target?.id ?? null, JSON.stringify(metadata), ip],
    db,
  );
}
