import { requirePage } from '@/lib/auth/page';
import { withOrg } from '@/lib/db';
import { getPrefs } from '@/lib/prefs';
import { dict, formatDate, tr } from '@/lib/i18n';
import { Card, Empty, PageHeader } from '@/components/os/ui';

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requirePage('audit.read');
  const { locale } = await getPrefs();
  const t = dict(locale);
  const { actor } = await searchParams;
  const rows = await withOrg(session, (q) => q.query<{ id: number; actor_type: string; actor: string | null; action: string; entity_type: string | null; entity_id: string | null; details: Record<string, unknown>; ip: string | null; created_at: Date }>(
    `select l.id, l.actor_type, coalesce(u.name, a.name, l.actor_id) as actor, l.action, l.entity_type, l.entity_id, l.details, l.ip, l.created_at
       from ward.audit_logs l
       left join ward.users u on l.actor_type = 'user' and u.id::text = l.actor_id
       left join ward.ai_agents a on l.actor_type = 'agent' and a.id::text = l.actor_id
      where ($1::text is null or l.actor_type = $1) order by l.id desc limit 300`, [actor ?? null]));
  return (
    <div className="stack">
      <PageHeader title={t.nav.audit} subtitle={tr(locale, 'سجل غير قابل للتعديل من التطبيق.', 'Append-only from the application.')}
        actions={<div className="row">{['', 'user', 'agent', 'system'].map((a) => <a key={a} className={`badge plain ${actor === a || (!actor && !a) ? 'warn' : ''}`} href={a ? `/os/audit?actor=${a}` : '/os/audit'}>{a || t.common.all}</a>)}</div>} />
      <Card>
        {rows.length ? <div className="table-wrap"><table className="table"><tbody>{rows.map((r) => (
          <tr key={r.id}>
            <td className="small faint">{formatDate(locale, r.created_at, true)}</td>
            <td className="small">{r.actor ?? r.actor_type}<span className="faint"> · {r.actor_type}</span></td>
            <td className="mono">{r.action}</td>
            <td className="small faint">{r.entity_type}{r.entity_id ? `:${r.entity_id.slice(0, 8)}` : ''}</td>
            <td className="mono small faint" style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis' }}>{JSON.stringify(r.details).slice(0, 160)}</td>
          </tr>
        ))}</tbody></table></div> : <Empty>—</Empty>}
      </Card>
    </div>
  );
}
