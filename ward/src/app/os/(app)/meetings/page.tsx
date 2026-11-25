import Link from 'next/link';
import { requirePage } from '@/lib/auth/page';
import { withOrg } from '@/lib/db';
import { getPrefs } from '@/lib/prefs';
import { can } from '@/lib/auth/permissions';
import { dict, formatDate, tr, usd } from '@/lib/i18n';
import { AGENTS } from '@/lib/agents/definitions';
import { Card, Empty, Flash, PageHeader, StatusBadge } from '@/components/os/ui';
import { LiveRefresh } from '@/components/os/client';

export default async function MeetingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requirePage();
  const { locale } = await getPrefs();
  const t = dict(locale);
  const meetings = await withOrg(session, (q) =>
    q.query<{ id: string; topic: string; status: string; rounds: number; n: number; cost_usd: number; created_at: Date }>(
      `select id, topic, status, rounds, cardinality(agent_ids) as n, cost_usd::float8, created_at from ward.meetings order by created_at desc limit 50`,
    ),
  );
  return (
    <div className="stack">
      <LiveRefresh active={meetings.some((m) => m.status === 'queued' || m.status === 'running')} />
      <Flash params={await searchParams} />
      <PageHeader title={t.nav.meetings} subtitle={tr(locale, 'حدد الموضوع والوكلاء وعدد الجولات. كل وكيل يتحدث من تخصصه ويرد على زملائه، ثم يصدر الملخص والتوصيات ونقاط الاختلاف والقرارات المقترحة والمهام.', 'Pick a topic, agents and rounds. Each agent speaks from its specialty and responds to the others; you get a summary, recommendations, disagreements, proposed decisions and owned tasks.')} />
      {can(session.role, 'agents.run') && (
        <Card title={tr(locale, 'اجتماع جديد', 'New meeting')}>
          <form action="/api/os/meetings" method="post" className="stack">
            <label className="field">{tr(locale, 'الموضوع', 'Topic')}<textarea className="textarea" name="topic" required minLength={3} maxLength={2000} placeholder={tr(locale, 'مثال: خطة إطلاق الحلقة الأولى', 'e.g. Launch plan for episode one')} /></label>
            <div className="field">{tr(locale, 'المشاركون (2–9)', 'Participants (2–9)')}
              <div className="row">
                {AGENTS.map((a) => (
                  <label key={a.slug} className="badge plain" style={{ cursor: 'pointer' }}>
                    <input type="checkbox" name="agents[]" value={a.slug} defaultChecked={['chief', 'editorial', 'marketing', 'review'].includes(a.slug)} />
                    {locale === 'ar' ? a.titleAr : a.titleEn}
                  </label>
                ))}
              </div>
            </div>
            <div className="row">
              <label className="field" style={{ width: 160 }}>{tr(locale, 'عدد الجولات', 'Rounds')}
                <select className="select" name="rounds" defaultValue="2"><option>1</option><option>2</option><option>3</option></select>
              </label>
              <button className="btn btn-primary" style={{ alignSelf: 'end' }}>{tr(locale, 'ابدأ الاجتماع', 'Start meeting')}</button>
            </div>
          </form>
        </Card>
      )}
      <Card title={tr(locale, 'الاجتماعات', 'Meetings')}>
        {meetings.length ? (
          <div className="list">
            {meetings.map((m) => (
              <Link key={m.id} href={`/os/meetings/${m.id}`} className="spread">
                <span><span style={{ fontWeight: 500 }}>{m.topic.slice(0, 120)}</span><span className="small faint"> · {m.n} {tr(locale, 'وكلاء', 'agents')} · {m.rounds} {tr(locale, 'جولات', 'rounds')} · {usd(m.cost_usd)} · {formatDate(locale, m.created_at)}</span></span>
                <StatusBadge status={m.status} locale={locale} />
              </Link>
            ))}
          </div>
        ) : <Empty>{tr(locale, 'لا توجد اجتماعات بعد.', 'No meetings yet.')}</Empty>}
      </Card>
    </div>
  );
}
