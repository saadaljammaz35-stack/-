import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/auth/page';
import { withOrg } from '@/lib/db';
import { getPrefs } from '@/lib/prefs';
import { can } from '@/lib/auth/permissions';
import { formatDate, label, tr, usd } from '@/lib/i18n';
import type { Synthesis } from '@/lib/meetings';
import { AgentMono, Card, Empty, PageHeader, StatusBadge } from '@/components/os/ui';
import { LiveRefresh } from '@/components/os/client';

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requirePage();
  const { locale } = await getPrefs();
  const { id } = await params;
  const d = await withOrg(session, async (q) => {
    const m = (await q.query<{ id: string; topic: string; status: string; rounds: number; summary: string | null; recommendations: string[]; disagreements: Synthesis['disagreements']; error: string | null; cost_usd: number; cost_limit_usd: number; created_at: Date }>(
      `select id, topic, status, rounds, summary, recommendations, disagreements, error, cost_usd::float8, cost_limit_usd::float8, created_at from ward.meetings where id = $1`, [id]))[0];
    if (!m) return null;
    const messages = await q.query<{ id: number; round: number; content: string; name: string }>(
      `select mm.id, mm.round, mm.content, a.name from ward.meeting_messages mm join ward.ai_agents a on a.id = mm.agent_id where mm.meeting_id = $1 order by mm.id`, [id]);
    const decisions = await q.query<{ id: string; title: string; details: string; status: string }>(`select id, title, details, status from ward.decisions where meeting_id = $1 order by created_at`, [id]);
    const tasks = await q.query<{ id: string; title: string; priority: string; status: string; owner: string | null; due_at: Date | null }>(
      `select t.id, t.title, t.priority, t.status, a.name as owner, t.due_at from ward.tasks t left join ward.ai_agents a on a.id = t.assignee_agent_id where t.meeting_id = $1 order by t.created_at`, [id]);
    return { m, messages, decisions, tasks };
  });
  if (!d) notFound();
  const { m } = d;
  const live = m.status === 'queued' || m.status === 'running';
  return (
    <div className="stack">
      <LiveRefresh active={live} />
      <PageHeader
        title={tr(locale, 'اجتماع', 'Meeting')}
        subtitle={m.topic}
        actions={<>
          <span className="small faint ltr">{usd(m.cost_usd)} / {usd(m.cost_limit_usd)}</span>
          <StatusBadge status={m.status} locale={locale} />
          {live && can(session.role, 'agents.run') && <form action={`/api/os/meetings/${m.id}/cancel`} method="post"><button className="btn btn-sm btn-danger">{tr(locale, 'إلغاء', 'Cancel')}</button></form>}
        </>}
      />
      {m.error && <div className="notice bad">{m.error}</div>}
      {m.summary && (
        <div className="grid-2">
          <Card title={tr(locale, 'الملخص', 'Summary')}><p className="prose">{m.summary}</p></Card>
          <Card title={tr(locale, 'التوصيات', 'Recommendations')}>
            {m.recommendations.length ? <ul style={{ margin: 0, paddingInlineStart: 18 }}>{m.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul> : <Empty>—</Empty>}
          </Card>
          <Card title={tr(locale, 'نقاط الاختلاف', 'Disagreements')}>
            {m.disagreements.length ? m.disagreements.map((x, i) => (
              <div key={i} className="stack" style={{ gap: 4, marginBottom: 12 }}>
                <strong style={{ fontWeight: 500 }}>{x.topic}</strong>
                {x.positions.map((p, j) => <span key={j} className="small muted">{p.agent}: {p.position}</span>)}
              </div>
            )) : <Empty>{tr(locale, 'لا اختلافات جوهرية.', 'No significant disagreements.')}</Empty>}
          </Card>
          <Card title={tr(locale, 'القرارات المقترحة (تحتاج اعتمادك)', 'Proposed decisions (need your sign-off)')}>
            {d.decisions.length ? (
              <div className="list">
                {d.decisions.map((x) => (
                  <div key={x.id} className="stack" style={{ gap: 6 }}>
                    <div className="spread"><span style={{ fontWeight: 500 }}>{x.title}</span><StatusBadge status={x.status} locale={locale} /></div>
                    <span className="small muted">{x.details}</span>
                    {x.status === 'proposed' && can(session.role, 'approvals.decide') && (
                      <div className="row">
                        <form action={`/api/os/decisions/${x.id}`} method="post"><input type="hidden" name="decision" value="approve" /><button className="btn btn-sm btn-primary">{tr(locale, 'اعتماد', 'Approve')}</button></form>
                        <form action={`/api/os/decisions/${x.id}`} method="post"><input type="hidden" name="decision" value="reject" /><button className="btn btn-sm">{tr(locale, 'رفض', 'Reject')}</button></form>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : <Empty>—</Empty>}
          </Card>
        </div>
      )}
      {d.tasks.length > 0 && (
        <Card title={tr(locale, 'المهام الناتجة', 'Resulting tasks')}>
          <div className="list">
            {d.tasks.map((t) => (
              <Link key={t.id} href={`/os/tasks/${t.id}`} className="spread">
                <span>{t.title} <span className="small faint">· {t.owner ?? '—'} · {label(locale, t.priority)}{t.due_at ? ` · ${formatDate(locale, t.due_at)}` : ''}</span></span>
                <StatusBadge status={t.status} locale={locale} />
              </Link>
            ))}
          </div>
        </Card>
      )}
      <Card title={tr(locale, 'المحضر', 'Transcript')}>
        {d.messages.length ? (
          <div className="list">
            {d.messages.map((x) => (
              <div key={x.id} className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                <AgentMono name={x.name} />
                <div className="stack" style={{ gap: 4 }}>
                  <span className="small"><strong style={{ fontWeight: 500 }}>{x.name}</strong> <span className="faint">· {tr(locale, 'جولة', 'round')} {x.round}</span></span>
                  <div className="prose small">{x.content}</div>
                </div>
              </div>
            ))}
          </div>
        ) : <Empty>{live ? tr(locale, 'الاجتماع قيد الانعقاد…', 'Meeting in progress…') : '—'}</Empty>}
      </Card>
    </div>
  );
}
