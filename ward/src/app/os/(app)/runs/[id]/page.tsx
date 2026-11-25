import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/auth/page';
import { withOrg } from '@/lib/db';
import { getPrefs } from '@/lib/prefs';
import { can } from '@/lib/auth/permissions';
import { formatDate, label, tr, usd } from '@/lib/i18n';
import type { Plan, Review } from '@/lib/orchestrator';
import { Card, Empty, Flash, PageHeader, StatusBadge } from '@/components/os/ui';
import { LiveRefresh } from '@/components/os/client';
import s from '../../../os.module.css';

export default async function RunPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requirePage();
  const { locale } = await getPrefs();
  const { id } = await params;
  const d = await withOrg(session, async (q) => {
    const wf = (await q.query<{ id: string; command: string; title: string | null; status: string; plan: Plan | null; review: Review | null; report: string | null; error: string | null; cost_usd: number; cost_limit_usd: number; model_calls: number; max_model_calls: number; created_at: Date; finished_at: Date | null }>(
      `select id, command, title, status, plan, review, report, error, cost_usd::float8, cost_limit_usd::float8, model_calls, max_model_calls, created_at, finished_at from ward.workflows where id = $1`, [id],
    ))[0];
    if (!wf) return null;
    const steps = await q.query<{ id: string; key: string; title: string; instructions: string; status: string; output: string | null; error: string | null; attempts: number; depends_on: string[]; complexity: string; agent: string; agent_name: string }>(
      `select s.id, s.key, s.title, s.instructions, s.status, s.output, s.error, s.attempts, s.depends_on, s.complexity, a.slug as agent, a.name as agent_name
         from ward.workflow_steps s join ward.ai_agents a on a.id = s.agent_id where s.workflow_id = $1 order by s.position`, [id]);
    const events = await q.query<{ id: number; kind: string; step_key: string | null; message: string; created_at: Date }>(`select id, kind, step_key, message, created_at from ward.workflow_events where workflow_id = $1 order by id`, [id]);
    const approvals = await q.query<{ id: string; title: string; action_type: string; status: string }>(`select id, title, action_type, status from ward.approvals where workflow_id = $1 order by created_at`, [id]);
    const tools = await q.query<{ tool: string; status: string; agent: string; created_at: Date }>(
      `select c.tool, c.status, a.name as agent, c.created_at from ward.agent_tool_calls c join ward.agent_runs r on r.id = c.agent_run_id join ward.ai_agents a on a.id = c.agent_id where r.workflow_id = $1 order by c.created_at`, [id]);
    return { wf, steps, events, approvals, tools };
  });
  if (!d) notFound();
  const { wf } = d;
  const live = ['queued', 'planning', 'running', 'reviewing'].includes(wf.status);
  const canRun = can(session.role, 'agents.run');
  return (
    <div className="stack">
      <LiveRefresh active={live} />
      <Flash params={await searchParams} />
      <PageHeader
        title={wf.title ?? tr(locale, 'أمر تشغيل', 'Run')}
        subtitle={wf.command}
        actions={
          <>
            <StatusBadge status={wf.status} locale={locale} />
            {canRun && live && (
              <form action={`/api/os/workflows/${wf.id}/cancel`} method="post"><button className="btn btn-sm btn-danger">{tr(locale, 'إلغاء', 'Cancel')}</button></form>
            )}
            {canRun && wf.status === 'failed' && (
              <form action={`/api/os/workflows/${wf.id}/retry`} method="post" className="row">
                <input className="input ltr" style={{ width: 90, minHeight: 30 }} name="cost_limit_usd" type="number" step="0.1" min="0.1" max="100" placeholder={String(wf.cost_limit_usd)} />
                <button className="btn btn-sm">{tr(locale, 'إعادة المحاولة', 'Retry')}</button>
              </form>
            )}
            {canRun && (wf.status === 'cancelled' || wf.status === 'failed') && (
              <form action={`/api/os/workflows/${wf.id}/resume`} method="post"><button className="btn btn-sm">{tr(locale, 'استئناف', 'Resume')}</button></form>
            )}
          </>
        }
      />
      <div className="row small muted">
        <span className="ltr">{usd(wf.cost_usd)} / {usd(wf.cost_limit_usd)}</span>·
        <span>{wf.model_calls}/{wf.max_model_calls} {tr(locale, 'استدعاء نموذج', 'model calls')}</span>·
        <span>{formatDate(locale, wf.created_at, true)}</span>
      </div>
      {wf.error && <div className="notice bad">{wf.error}</div>}

      {wf.report && (
        <Card title={tr(locale, 'التقرير النهائي', 'Final report')}>
          <div className="prose">{wf.report}</div>
        </Card>
      )}
      {d.approvals.length > 0 && (
        <Card title={tr(locale, 'طلبات الموافقة', 'Approval requests')} action={<Link href="/os/approvals" className="small muted">{tr(locale, 'مركز الموافقات', 'Approvals')} ←</Link>}>
          <div className="list">
            {d.approvals.map((a) => (
              <Link key={a.id} href={`/os/approvals#${a.id}`} className="spread"><span>{a.title} <span className="small faint">· {label(locale, a.action_type)}</span></span><StatusBadge status={a.status} locale={locale} /></Link>
            ))}
          </div>
        </Card>
      )}

      <div className="grid-2">
        <Card title={tr(locale, 'الخطة والخطوات', 'Plan & steps')}>
          {wf.plan && <p className="small muted" style={{ marginBottom: 12 }}>{wf.plan.analysis}</p>}
          {d.steps.length ? (
            <div className="list">
              {d.steps.map((st) => (
                <details key={st.id} className="disclosure">
                  <summary className="spread">
                    <span style={{ color: 'var(--ink)' }}>{st.title}<span className="small faint"> · {st.agent_name}{st.depends_on.length ? ` · ← ${st.depends_on.join(', ')}` : ''}{st.complexity === 'simple' ? ` · ${tr(locale, 'اقتصادي', 'economy')}` : ''}</span></span>
                    <StatusBadge status={st.status} locale={locale} />
                  </summary>
                  <p className="small muted" style={{ marginBottom: 8 }}>{st.instructions}</p>
                  {st.output && <div className="prose small">{st.output}</div>}
                  {st.error && <div className="notice bad small">{st.error} ({st.attempts})</div>}
                </details>
              ))}
            </div>
          ) : <Empty>{tr(locale, 'لم تُنشأ الخطة بعد.', 'No plan yet.')}</Empty>}
        </Card>

        <Card title={tr(locale, 'سجل التنفيذ', 'Execution log')}>
          <div className={s.timeline}>
            {d.events.map((e) => (
              <div key={e.id} className={s.event}>
                <span className={s.eventDot} />
                <div>
                  <div className="small"><strong style={{ fontWeight: 500 }}>{e.kind}</strong>{e.step_key ? ` · ${e.step_key}` : ''} <span className="faint">{formatDate(locale, e.created_at, true)}</span></div>
                  <div className="small muted">{e.message}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {wf.review && (
        <Card title={tr(locale, 'مراجعة الجودة', 'Quality review')} action={<StatusBadge status={wf.review.verdict === 'approved' ? 'approved' : 'pending'} locale={locale} />}>
          <p className="prose small">{wf.review.summary}</p>
          {wf.review.issues.length > 0 && <ul className="small">{wf.review.issues.map((i, n) => <li key={n}>[{i.step_key} · {i.severity}] {i.problem}</li>)}</ul>}
          {wf.review.risks.length > 0 && <p className="small muted">{tr(locale, 'مخاطر: ', 'Risks: ')}{wf.review.risks.join(' · ')}</p>}
          {wf.review.unsupported_claims.length > 0 && <p className="small" style={{ color: 'var(--bad)' }}>{tr(locale, 'ادعاءات بلا مصدر: ', 'Unsupported claims: ')}{wf.review.unsupported_claims.join(' · ')}</p>}
        </Card>
      )}

      {d.tools.length > 0 && (
        <Card title={tr(locale, 'استدعاءات الأدوات', 'Tool calls')}>
          <div className="table-wrap"><table className="table"><tbody>
            {d.tools.map((c, i) => (
              <tr key={i}><td className="mono">{c.tool}</td><td className="small">{c.agent}</td><td><StatusBadge status={c.status === 'ok' ? 'ok' : c.status === 'denied' ? 'error' : 'pending'} locale={locale} /> <span className="small faint">{c.status}</span></td><td className="small faint">{formatDate(locale, c.created_at, true)}</td></tr>
            ))}
          </tbody></table></div>
        </Card>
      )}
    </div>
  );
}
