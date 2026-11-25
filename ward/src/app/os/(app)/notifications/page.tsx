import { requirePage } from '@/lib/auth/page';
import { withOrg } from '@/lib/db';
import { getPrefs } from '@/lib/prefs';
import { formatDate, tr } from '@/lib/i18n';
import { Card, Empty, PageHeader } from '@/components/os/ui';

export default async function NotificationsPage() {
  const session = await requirePage();
  const { locale } = await getPrefs();
  const items = await withOrg(session, (q) => q.query<{ id: string; title: string; body: string; severity: string; link: string | null; read_at: Date | null; created_at: Date; kind: string }>(
    'select id, title, body, severity, link, read_at, created_at, kind from ward.notifications order by created_at desc limit 200'));
  return (
    <div className="stack">
      <PageHeader title={tr(locale, 'التنبيهات', 'Notifications')} actions={<form action="/api/os/notifications/read" method="post"><button className="btn btn-sm">{tr(locale, 'تعليم الكل كمقروء', 'Mark all read')}</button></form>} />
      <Card>
        {items.length ? <div className="list">{items.map((n) => (
          <a key={n.id} href={n.link ?? '#'} className="stack" style={{ gap: 2, opacity: n.read_at ? 0.6 : 1 }}>
            <span className="spread"><span style={{ fontWeight: 500 }}>{n.title}</span><span className={`badge ${n.severity === 'critical' ? 'bad' : n.severity === 'warning' ? 'warn' : ''}`}>{n.kind}</span></span>
            {n.body && <span className="small muted">{n.body}</span>}
            <span className="small faint">{formatDate(locale, n.created_at, true)}</span>
          </a>
        ))}</div> : <Empty>{tr(locale, 'لا توجد تنبيهات.', 'No notifications.')}</Empty>}
      </Card>
    </div>
  );
}
