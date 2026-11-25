import Link from 'next/link';
import { requirePage } from '@/lib/auth/page';
import { num, withOrg } from '@/lib/db';
import { getPrefs } from '@/lib/prefs';
import { getSettings } from '@/lib/settings';
import { configuredProviders } from '@/lib/ai/gateway';
import { dict, formatDate, label, money, tr, usd } from '@/lib/i18n';
import { can } from '@/lib/auth/permissions';
import { AgentMono, Card, Empty, PageHeader, Stat, StatsRow, StatusBadge } from '@/components/os/ui';
import { CommandBox, LiveRefresh } from '@/components/os/client';
import s from '../os.module.css';

export default async function Dashboard() {
  const session = await requirePage();
  const { locale } = await getPrefs();
  const t = dict(locale);
  const d = await withOrg(session, async (q) => {
    const settings = await getSettings(q, session.orgId);
    const agents = await q.query<{ slug: string; name: string; title_ar: string; title_en: string; status: string; runs: number; cost: number }>(
      `select a.slug, a.name, a.title_ar, a.title_en, a.status,
              (select count(*)::int from ward.agent_runs r where r.agent_id = a.id and r.started_at >= date_trunc('day', now())) as runs,
              (select coalesce(sum(r.cost_usd),0)::float8 from ward.agent_runs r where r.agent_id = a.id and r.started_at >= date_trunc('day', now())) as cost
         from ward.ai_agents a order by a.created_at`,
    );
    const active = await q.query<{ id: string; title: string | null; command: string; status: string; created_at: Date }>(
      `select id, title, command, status, created_at from ward.workflows where status in ('queued','planning','running','reviewing','awaiting_approval') order by created_at desc limit 6`,
    );
    const done = await q.query<{ id: string; title: string | null; command: string; status: string; finished_at: Date; cost_usd: number }>(
      `select id, title, command, status, finished_at, cost_usd::float8 from ward.workflows where status in ('completed','failed','cancelled') order by finished_at desc nulls last limit 5`,
    );
    const approvals = await q.query<{ id: string; title: string; action_type: string; target: string; estimated_cost: number | null; currency: string }>(
      `select id, title, action_type, target, estimated_cost::float8, currency from ward.approvals where status = 'pending' order by created_at desc limit 5`,
    );
    const episodes = await q.query<{ id: string; title: string; status: string; guest_confirmed: boolean; guest: string | null; shoot_at: Date | null }>(
      `select e.id, e.title, e.status, e.guest_confirmed, g.name as guest, e.shoot_at from ward.episodes e left join ward.guests g on g.id = e.guest_id
        where e.status <> 'published' order by e.shoot_at nulls last, e.created_at limit 6`,
    );
    const shoots = episodes.filter((e) => e.shoot_at);
    const sponsors = await q.query<{ status: string; n: number }>(`select status, count(*)::int as n from ward.sponsors group by status order by n desc`);
    const money1 = (await q.query<{ budget: number; spent: number; pending: number; cash: number }>(
      `select (select coalesce(sum(amount),0)::float8 from ward.budgets where period_start <= (date_trunc('month', now()) + interval '1 month - 1 day')::date and period_end >= date_trunc('month', now())::date) as budget,
              (select coalesce(sum(amount),0)::float8 from ward.expenses where status in ('approved','paid') and incurred_on >= date_trunc('month', now())) as spent,
              (select coalesce(sum(amount),0)::float8 from ward.expenses where status = 'pending_approval') as pending,
              (select coalesce(sum(amount),0)::float8 from ward.revenues where is_cash and status = 'received' and received_on >= date_trunc('month', now())) as cash`,
    ))[0]!;
    const ai = (await q.query<{ today: number; month: number; calls: number; estimated: number }>(
      `select coalesce(sum(cost_usd) filter (where created_at >= date_trunc('day', now())),0)::float8 as today,
              coalesce(sum(cost_usd),0)::float8 as month, count(*)::int as calls,
              count(*) filter (where price_is_estimate)::int as estimated
         from ward.model_usage where created_at >= date_trunc('month', now())`,
    ))[0]!;
    const perf = (await q.query<{ completed: number; failed: number; tasks_done: number; tasks_open: number }>(
      `select (select count(*)::int from ward.workflows where status = 'completed' and finished_at > now() - interval '30 days') as completed,
              (select count(*)::int from ward.workflows where status = 'failed' and updated_at > now() - interval '30 days') as failed,
              (select count(*)::int from ward.tasks where status = 'done' and completed_at > now() - interval '30 days') as tasks_done,
              (select count(*)::int from ward.tasks where status <> 'done') as tasks_open`,
    ))[0]!;
    const reports = await q.query<{ id: string; title: string; created_at: Date }>(`select id, title, created_at from ward.knowledge_documents where category = 'reports' order by created_at desc limit 3`);
    const alerts = await q.query<{ id: string; title: string; severity: string; link: string | null; created_at: Date }>(
      `select id, title, severity, link, created_at from ward.notifications where read_at is null order by created_at desc limit 6`,
    );
    return { settings, agents, active, done, approvals, episodes, shoots, sponsors, money: money1, ai, perf, reports, alerts };
  });
  const providers = configuredProviders();
  const live = d.active.some((w) => w.status !== 'awaiting_approval');

  return (
    <div className="stack">
      <LiveRefresh active={live} intervalMs={4000} />
      <PageHeader
        title={t.dash.greeting}
        subtitle={tr(locale, `أهلًا ${session.name}. كل شيء وارد — هذا ما يحدث في وارد الآن.`, `Welcome, ${session.name}. Here is what is happening at WARD now.`)}
      />
      {d.settings.agents_paused && <div className="notice bad">{t.dash.paused}</div>}
      {providers.length === 0 && <div className="notice">{t.dash.noProvider}</div>}
      {can(session.role, 'agents.run') && (
        <CommandBox
          placeholder={t.dash.commandPlaceholder}
          send={t.dash.send}
          limitLabel={t.dash.limit}
          defaultLimit={d.settings['limits.workflow_usd']}
          disabled={d.settings.agents_paused || providers.length === 0}
          disabledNote={d.settings.agents_paused ? t.dash.paused : tr(locale, 'أضف مفتاح مزود أولًا', 'Configure a provider first')}
        />
      )}

      <StatsRow>
        <Stat value={d.active.length} label={t.dash.current} />
        <Stat value={d.approvals.length} label={t.dash.approvals} />
        <Stat value={usd(d.ai.today)} label={tr(locale, 'تكلفة الذكاء اليوم', 'AI spend today')} />
        <Stat value={money(d.money.spent)} label={tr(locale, 'المصروف هذا الشهر', 'Spent this month')} />
        <Stat value={d.perf.tasks_open} label={tr(locale, 'مهام مفتوحة', 'Open tasks')} />
      </StatsRow>

      <Card title={t.dash.agentsState} action={<Link className="small muted" href="/os/agents">{tr(locale, 'الفريق', 'Team')} ←</Link>}>
        <div className={s.agentGrid}>
          {d.agents.map((a) => (
            <Link key={a.slug} href={`/os/agents/${a.slug}`} className={s.agentChip} title={label(locale, a.status)}>
              <AgentMono name={a.name} />
              <span style={{ display: 'grid', minWidth: 0, flex: 1 }}>
                <span style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{locale === 'ar' ? a.title_ar : a.title_en}</span>
                <span className="small faint">{a.runs} {tr(locale, 'اليوم', 'today')} · {usd(a.cost)}</span>
              </span>
              <span className={s.statusDot} data-status={a.status} aria-label={label(locale, a.status)} />
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid-2">
        <Card title={t.dash.current} action={<Link className="small muted" href="/os/runs">{t.nav.runs} ←</Link>}>
          {d.active.length ? (
            <div className="list">
              {d.active.map((w) => (
                <Link key={w.id} href={`/os/runs/${w.id}`} className="spread">
                  <span style={{ minWidth: 0 }}>{w.title ?? w.command.slice(0, 90)}</span>
                  <StatusBadge status={w.status} locale={locale} />
                </Link>
              ))}
            </div>
          ) : (
            <Empty>{tr(locale, 'لا يوجد تشغيل حالي.', 'Nothing running.')}</Empty>
          )}
          {d.done.length > 0 && (
            <>
              <div className="card-title" style={{ marginTop: 18 }}>{t.dash.completed}</div>
              <div className="list">
                {d.done.map((w) => (
                  <Link key={w.id} href={`/os/runs/${w.id}`} className="spread small">
                    <span className="muted">{w.title ?? w.command.slice(0, 80)}</span>
                    <span className="row"><span className="faint">{usd(w.cost_usd)}</span><StatusBadge status={w.status} locale={locale} /></span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </Card>

        <Card title={t.dash.approvals} action={<Link className="small muted" href="/os/approvals">{t.nav.approvals} ←</Link>}>
          {d.approvals.length ? (
            <div className="list">
              {d.approvals.map((a) => (
                <Link key={a.id} href={`/os/approvals#${a.id}`} className="stack" style={{ gap: 4 }}>
                  <span className="spread"><span>{a.title}</span><span className="badge warn">{label(locale, a.action_type)}</span></span>
                  <span className="small faint">{a.target}{a.estimated_cost != null ? ` · ${money(a.estimated_cost, a.currency)}` : ''}</span>
                </Link>
              ))}
            </div>
          ) : (
            <Empty>{tr(locale, 'لا توجد موافقات معلقة.', 'No pending approvals.')}</Empty>
          )}
        </Card>

        <Card title={t.dash.episodes} action={<Link className="small muted" href="/os/episodes">{t.nav.episodes} ←</Link>}>
          {d.episodes.length ? (
            <div className="list">
              {d.episodes.map((e) => (
                <Link key={e.id} href={`/os/episodes/${e.id}`} className="spread">
                  <span style={{ display: 'grid' }}>
                    <span style={{ fontWeight: 500 }}>{e.title}</span>
                    <span className="small faint">
                      {e.guest ?? tr(locale, 'بدون ضيف', 'No guest')} · {e.guest_confirmed ? tr(locale, 'مؤكد', 'confirmed') : tr(locale, 'غير مؤكد', 'unconfirmed')}
                    </span>
                  </span>
                  <StatusBadge status={e.status} locale={locale} />
                </Link>
              ))}
            </div>
          ) : (
            <Empty>{t.common.none}</Empty>
          )}
        </Card>

        <Card title={t.dash.shoots}>
          {d.shoots.length ? (
            <div className="list">
              {d.shoots.map((e) => (
                <div key={e.id} className="spread">
                  <span>{e.title}</span>
                  <span className="small muted">{formatDate(locale, e.shoot_at, true)}</span>
                </div>
              ))}
            </div>
          ) : (
            <Empty>{tr(locale, 'لا يوجد موعد تصوير محدد بعد.', 'No shoot dates set yet.')}</Empty>
          )}
        </Card>

        <Card title={t.dash.sponsors} action={<Link className="small muted" href="/os/sponsors">{t.nav.sponsors} ←</Link>}>
          <div className="row">
            {d.sponsors.map((x) => (
              <span key={x.status} className={`badge ${x.status === 'pending_verification' ? 'warn' : ''}`}>
                {label(locale, x.status)} · {x.n}
              </span>
            ))}
          </div>
          <p className="small faint" style={{ marginTop: 12 }}>
            {tr(locale, 'لا تُعرض أي قيمة أو شراكة كمؤكدة قبل توثيقها.', 'No value or partnership is shown as confirmed before it is documented.')}
          </p>
        </Card>

        <Card title={t.dash.budget} action={<Link className="small muted" href="/os/finance">{t.nav.finance} ←</Link>}>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
            <Stat value={money(d.money.budget)} label={tr(locale, 'الميزانية', 'Budget')} />
            <Stat value={money(d.money.spent)} label={tr(locale, 'المصروف', 'Spent')} />
            <Stat value={money(d.money.pending)} label={tr(locale, 'بانتظار الموافقة', 'Pending')} />
            <Stat value={money(d.money.cash)} label={tr(locale, 'نقد مستلم', 'Cash received')} />
          </div>
          {num(d.money.budget) === 0 && <p className="small faint" style={{ marginTop: 10 }}>{tr(locale, 'لم تُسجل ميزانية بعد.', 'No budget recorded yet.')}</p>}
        </Card>

        <Card title={t.dash.ai}>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
            <Stat value={usd(d.ai.today)} label={tr(locale, 'اليوم', 'Today')} />
            <Stat value={usd(d.ai.month)} label={tr(locale, 'هذا الشهر', 'This month')} />
            <Stat value={d.ai.calls} label={tr(locale, 'استدعاءات', 'Calls')} />
          </div>
          <p className="small faint" style={{ marginTop: 10 }}>
            {tr(locale, `الحد اليومي ${usd(d.settings['limits.daily_usd'])} · الشهري ${usd(d.settings['limits.monthly_usd'])}`, `Daily cap ${usd(d.settings['limits.daily_usd'])} · monthly ${usd(d.settings['limits.monthly_usd'])}`)}
            {d.ai.estimated > 0 && tr(locale, ' · بعض الأسعار تقديرية — حدّثها من الإعدادات', ' · some prices are estimates — set them in Settings')}
          </p>
        </Card>

        <Card title={t.dash.performance}>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
            <Stat value={d.perf.completed} label={tr(locale, 'أوامر مكتملة (30 يومًا)', 'Runs completed (30d)')} />
            <Stat value={d.perf.failed} label={tr(locale, 'أوامر فاشلة', 'Runs failed')} />
            <Stat value={d.perf.tasks_done} label={tr(locale, 'مهام منجزة', 'Tasks done')} />
          </div>
          {d.reports.length > 0 && (
            <div className="list" style={{ marginTop: 12 }}>
              {d.reports.map((r) => (
                <Link key={r.id} href={`/os/knowledge/${r.id}`} className="spread small">
                  <span>{r.title}</span>
                  <span className="faint">{formatDate(locale, r.created_at)}</span>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card title={t.dash.alerts} action={<Link className="small muted" href="/os/notifications">{tr(locale, 'الكل', 'All')} ←</Link>}>
          {d.alerts.length ? (
            <div className="list">
              {d.alerts.map((n) => (
                <a key={n.id} href={n.link ?? '/os/notifications'} className="spread small">
                  <span>{n.title}</span>
                  <span className={`badge ${n.severity === 'critical' ? 'bad' : n.severity === 'warning' ? 'warn' : ''}`}>{formatDate(locale, n.created_at)}</span>
                </a>
              ))}
            </div>
          ) : (
            <Empty>{tr(locale, 'لا توجد تنبيهات جديدة.', 'No new alerts.')}</Empty>
          )}
        </Card>
      </div>
    </div>
  );
}
