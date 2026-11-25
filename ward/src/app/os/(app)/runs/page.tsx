import Link from 'next/link';
import { requirePage } from '@/lib/auth/page';
import { withOrg } from '@/lib/db';
import { getPrefs } from '@/lib/prefs';
import { getSettings } from '@/lib/settings';
import { configuredProviders } from '@/lib/ai/gateway';
import { can } from '@/lib/auth/permissions';
import { dict, formatDate, label, tr, usd } from '@/lib/i18n';
import { WORKFLOW_STATUSES } from '@/lib/orchestrator';
import { Card, Empty, PageHeader, StatusBadge } from '@/components/os/ui';
import { CommandBox, LiveRefresh } from '@/components/os/client';

export default async function RunsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requirePage();
  const { locale } = await getPrefs();
  const t = dict(locale);
  const { status } = await searchParams;
  const filter = WORKFLOW_STATUSES.includes(status as never) ? status! : null;
  const { runs, settings } = await withOrg(session, async (q) => ({
    settings: await getSettings(q, session.orgId),
    runs: await q.query<{ id: string; title: string | null; command: string; status: string; source: string; cost_usd: number; cost_limit_usd: number; created_at: Date; steps: number }>(
      `select w.id, w.title, w.command, w.status, w.source, w.cost_usd::float8, w.cost_limit_usd::float8, w.created_at,
              (select count(*)::int from ward.workflow_steps s where s.workflow_id = w.id) as steps
         from ward.workflows w where ($1::text is null or w.status = $1) order by w.created_at desc limit 100`,
      [filter],
    ),
  }));
  const live = runs.some((r) => ['queued', 'planning', 'running', 'reviewing'].includes(r.status));
  return (
    <div className="stack">
      <LiveRefresh active={live} />
      <PageHeader title={t.nav.runs} subtitle={tr(locale, 'كل أمر يمر بـ: تخطيط ← تنفيذ متوازٍ ← مراجعة الجودة ← تقرير ← موافقتك عند الحاجة.', 'Every command goes: plan → parallel execution → quality review → report → your approval when needed.')} />
      {can(session.role, 'agents.run') && (
        <CommandBox placeholder={t.dash.commandPlaceholder} send={t.dash.send} limitLabel={t.dash.limit} defaultLimit={settings['limits.workflow_usd']}
          disabled={settings.agents_paused || configuredProviders().length === 0} disabledNote={settings.agents_paused ? t.dash.paused : t.dash.noProvider} />
      )}
      <div className="row">
        <Link href="/os/runs" className={`badge plain ${!filter ? 'warn' : ''}`}>{t.common.all}</Link>
        {WORKFLOW_STATUSES.map((s) => (
          <Link key={s} href={`/os/runs?status=${s}`} className={`badge plain ${filter === s ? 'warn' : ''}`}>{label(locale, s)}</Link>
        ))}
      </div>
      <Card>
        {runs.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{tr(locale, 'الأمر', 'Command')}</th><th>{t.common.status}</th><th>{tr(locale, 'الخطوات', 'Steps')}</th><th>{tr(locale, 'التكلفة', 'Cost')}</th><th>{tr(locale, 'التاريخ', 'Date')}</th></tr></thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td><Link href={`/os/runs/${r.id}`} style={{ fontWeight: 500 }}>{r.title ?? r.command.slice(0, 100)}</Link>{r.source !== 'founder' && <span className="small faint"> · {r.source}</span>}</td>
                    <td><StatusBadge status={r.status} locale={locale} /></td>
                    <td>{r.steps}</td>
                    <td className="small ltr">{usd(r.cost_usd)} / {usd(r.cost_limit_usd)}</td>
                    <td className="small muted">{formatDate(locale, r.created_at, true)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>{tr(locale, 'لا توجد أوامر بعد.', 'No runs yet.')}</Empty>}
      </Card>
    </div>
  );
}
