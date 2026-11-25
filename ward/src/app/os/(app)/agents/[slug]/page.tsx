import { notFound } from 'next/navigation';
import { requirePage } from '@/lib/auth/page';
import { withOrg } from '@/lib/db';
import { getPrefs } from '@/lib/prefs';
import { can } from '@/lib/auth/permissions';
import { formatDate, tr, usd } from '@/lib/i18n';
import { AGENT_BY_SLUG, type AgentSlug } from '@/lib/agents/definitions';
import { SENSITIVE_TOOLS } from '@/lib/agents/tools';
import { PROVIDERS } from '@/lib/settings';
import { Card, Empty, Flash, PageHeader, StatusBadge } from '@/components/os/ui';
import { AgentChat } from '@/components/os/client';

export default async function AgentPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requirePage();
  const { locale } = await getPrefs();
  const { slug } = await params;
  const def = AGENT_BY_SLUG[slug as AgentSlug];
  if (!def) notFound();
  const d = await withOrg(session, async (q) => {
    const a = (await q.query<{ id: string; status: string; instructions: string; provider: string | null; model: string | null; economy_model: string | null; temperature: number; max_tool_iterations: number; max_output_tokens: number; daily_budget_usd: number | null; allowed_tools: string[] }>(
      `select a.id, a.status, a.instructions, c.provider, c.model, c.economy_model, c.temperature::float8, c.max_tool_iterations, c.max_output_tokens, c.daily_budget_usd::float8, c.allowed_tools
         from ward.ai_agents a join ward.agent_configs c on c.agent_id = a.id where a.slug = $1`, [slug]))[0]!;
    const memories = await q.query<{ id: string; kind: string; content: string; created_at: Date }>(`select id, kind, content, created_at from ward.agent_memories where agent_id = $1 order by created_at desc limit 30`, [a.id]);
    const runs = await q.query<{ id: string; purpose: string; status: string; workflow_id: string | null; meeting_id: string | null; cost_usd: number; iterations: number; model: string | null; started_at: Date; error: string | null }>(
      `select id, purpose, status, workflow_id, meeting_id, cost_usd::float8, iterations, model, started_at, error from ward.agent_runs where agent_id = $1 order by started_at desc limit 25`, [a.id]);
    const tools = await q.query<{ tool: string; status: string; created_at: Date }>(`select tool, status, created_at from ward.agent_tool_calls where agent_id = $1 order by created_at desc limit 25`, [a.id]);
    return { a, memories, runs, tools };
  });
  const editable = can(session.role, 'agents.configure');
  const { a } = d;
  return (
    <div className="stack">
      <Flash params={await searchParams} />
      <PageHeader title={def.name} subtitle={`${locale === 'ar' ? def.titleAr : def.titleEn} — ${def.description}`} actions={<StatusBadge status={a.status} locale={locale} />} />
      <div className="grid-2">
        <Card title={tr(locale, 'المسؤوليات', 'Responsibilities')}>
          <ul className="small" style={{ margin: 0, paddingInlineStart: 18 }}>{def.duties.map((x) => <li key={x}>{x}</li>)}</ul>
        </Card>
        {can(session.role, 'agents.run') && (
          <Card title={tr(locale, 'محادثة مباشرة (بدون أدوات)', 'Direct chat (no tools)')}>
            <AgentChat slug={slug} placeholder={tr(locale, 'اسأل الوكيل…', 'Ask the agent…')} send={tr(locale, 'إرسال', 'Send')} />
          </Card>
        )}
      </div>

      <Card title={tr(locale, 'الإعدادات والصلاحيات', 'Configuration & permissions')}>
        <form action={`/api/os/agents/${slug}`} method="post" className="stack">
          <input type="hidden" name="tools_form" value="1" />
          <fieldset disabled={!editable} className="stack" style={{ border: 0, padding: 0, margin: 0 }}>
            <div className="grid">
              <label className="field">{tr(locale, 'المزود المفضل', 'Preferred provider')}
                <select className="select" name="provider" defaultValue={a.provider ?? ''}>
                  <option value="">{tr(locale, 'حسب ترتيب الإعدادات', 'Settings order')}</option>
                  {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              <label className="field">{tr(locale, 'النموذج', 'Model')}<input className="input ltr" name="model" defaultValue={a.model ?? ''} placeholder="default" /></label>
              <label className="field">{tr(locale, 'النموذج الاقتصادي', 'Economy model')}<input className="input ltr" name="economy_model" defaultValue={a.economy_model ?? ''} placeholder="default" /></label>
              <label className="field">{tr(locale, 'الحرارة', 'Temperature')}<input className="input ltr" name="temperature" type="number" step="0.1" min="0" max="2" defaultValue={a.temperature} /></label>
              <label className="field">{tr(locale, 'أقصى خطوات أدوات', 'Max tool iterations')}<input className="input ltr" name="max_tool_iterations" type="number" min="1" max="12" defaultValue={a.max_tool_iterations} /></label>
              <label className="field">{tr(locale, 'أقصى طول للرد (tokens)', 'Max output tokens')}<input className="input ltr" name="max_output_tokens" type="number" min="256" max="32000" defaultValue={a.max_output_tokens} /></label>
              <label className="field">{tr(locale, 'ميزانية يومية (USD)', 'Daily budget (USD)')}<input className="input ltr" name="daily_budget_usd" type="number" step="0.01" min="0" defaultValue={a.daily_budget_usd ?? ''} placeholder="—" /></label>
              <label className="field">{tr(locale, 'الحالة', 'Status')}
                <select className="select" name="status" defaultValue={a.status === 'working' ? 'idle' : a.status}>
                  <option value="idle">{tr(locale, 'متاح', 'Available')}</option><option value="paused">{tr(locale, 'موقوف', 'Paused')}</option><option value="disabled">{tr(locale, 'معطل', 'Disabled')}</option>
                </select>
              </label>
            </div>
            <label className="field">{tr(locale, 'تعليمات إضافية من المؤسس', 'Founder instructions')}<textarea className="textarea" name="instructions" defaultValue={a.instructions} maxLength={8000} /></label>
            <div className="field">{tr(locale, 'الأدوات المسموحة (يمكن تقليصها فقط)', 'Allowed tools (can only be narrowed)')}
              <div className="row">
                {def.tools.map((tool) => (
                  <label key={tool} className="badge plain" style={{ cursor: 'pointer' }}>
                    <input type="checkbox" name="allowed_tools[]" value={tool} defaultChecked={a.allowed_tools.includes(tool)} />
                    <span className="mono">{tool}</span>{SENSITIVE_TOOLS.includes(tool) && <span title="approval">🔒</span>}
                  </label>
                ))}
              </div>
            </div>
            {editable && <div><button className="btn btn-primary">{tr(locale, 'حفظ', 'Save')}</button></div>}
          </fieldset>
        </form>
      </Card>

      <div className="grid-2">
        <Card title={tr(locale, 'الذاكرة', 'Memory')}>
          {d.memories.length ? (
            <div className="list">
              {d.memories.map((m) => (
                <div key={m.id} className="spread small">
                  <span>{m.content} <span className="faint">· {m.kind} · {formatDate(locale, m.created_at)}</span></span>
                  {editable && <form action={`/api/os/memories/${m.id}`} method="post"><button className="btn btn-sm btn-ghost">{tr(locale, 'حذف', 'Delete')}</button></form>}
                </div>
              ))}
            </div>
          ) : <Empty>{tr(locale, 'لا توجد ذاكرة بعد.', 'No memories yet.')}</Empty>}
        </Card>
        <Card title={tr(locale, 'سجل المهام', 'Task log')}>
          {d.runs.length ? (
            <div className="list">
              {d.runs.map((r) => (
                <a key={r.id} href={r.workflow_id ? `/os/runs/${r.workflow_id}` : r.meeting_id ? `/os/meetings/${r.meeting_id}` : '#'} className="spread small">
                  <span>{r.purpose} <span className="faint">· {r.iterations} it · {usd(r.cost_usd)} · {r.model ?? '—'} · {formatDate(locale, r.started_at, true)}</span>{r.error && <span style={{ color: 'var(--bad)' }}> · {r.error.slice(0, 80)}</span>}</span>
                  <StatusBadge status={r.status} locale={locale} />
                </a>
              ))}
            </div>
          ) : <Empty>{tr(locale, 'لم يعمل هذا الوكيل بعد.', 'This agent has not run yet.')}</Empty>}
          {d.tools.length > 0 && (
            <>
              <div className="card-title" style={{ marginTop: 16 }}>{tr(locale, 'آخر الأدوات', 'Recent tools')}</div>
              <div className="row">{d.tools.map((c, i) => <span key={i} className={`badge ${c.status === 'denied' ? 'bad' : c.status === 'approval_requested' ? 'warn' : ''}`}><span className="mono">{c.tool}</span></span>)}</div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
