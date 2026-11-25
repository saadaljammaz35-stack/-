import type { Queryable } from '@/lib/db';

export interface NotificationInput {
  kind: string;
  severity?: 'info' | 'warning' | 'critical';
  title: string;
  body?: string;
  link?: string | null;
  /** Same key → one notification (used by the scheduler so alerts are not repeated). */
  dedupeKey?: string | null;
}

export async function notify(q: Queryable, orgId: string, n: NotificationInput): Promise<boolean> {
  const rows = await q.query(
    `insert into ward.notifications (org_id, kind, severity, title, body, link, dedupe_key)
     values ($1,$2,$3,$4,$5,$6,$7)
     on conflict (org_id, dedupe_key) do nothing returning id`,
    [orgId, n.kind, n.severity ?? 'info', n.title.slice(0, 300), (n.body ?? '').slice(0, 2000), n.link ?? null, n.dedupeKey ?? null],
  );
  return rows.length > 0;
}
