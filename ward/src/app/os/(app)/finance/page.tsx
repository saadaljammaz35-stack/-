import { requirePage } from '@/lib/auth/page';
import { withOrg } from '@/lib/db';
import { getPrefs } from '@/lib/prefs';
import { can } from '@/lib/auth/permissions';
import { dict, formatDate, label, money, tr, usd } from '@/lib/i18n';
import { Card, Empty, Flash, PageHeader, Stat, StatsRow, StatusBadge } from '@/components/os/ui';

export default async function FinancePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requirePage();
  const { locale } = await getPrefs();
  const t = dict(locale);
  const d = await withOrg(session, async (q) => ({
    totals: (await q.query<{ budget: number; spent: number; pending: number; cash_received: number; cash_expected: number; in_kind: number }>(
      `select (select coalesce(sum(amount),0)::float8 from ward.budgets where current_date between period_start and period_end) as budget,
              (select coalesce(sum(amount),0)::float8 from ward.expenses where status in ('approved','paid') and incurred_on >= date_trunc('month', now())) as spent,
              (select coalesce(sum(amount),0)::float8 from ward.expenses where status = 'pending_approval') as pending,
              (select coalesce(sum(amount),0)::float8 from ward.revenues where is_cash and status = 'received') as cash_received,
              (select coalesce(sum(amount),0)::float8 from ward.revenues where is_cash and status = 'expected') as cash_expected,
              (select coalesce(sum(amount),0)::float8 from ward.revenues where not is_cash) as in_kind`))[0]!,
    budgets: await q.query<{ id: string; name: string; category: string; period_start: Date; period_end: Date; amount: number; spent: number }>(
      `select b.id, b.name, b.category, b.period_start, b.period_end, b.amount::float8,
              coalesce((select sum(x.amount) from ward.expenses x where x.budget_id = b.id and x.status in ('approved','paid')),0)::float8 as spent
         from ward.budgets b order by b.period_start desc`),
    expenses: await q.query<{ id: string; description: string; amount: number; currency: string; category: string; status: string; incurred_on: Date; episode: string | null; agent: string | null }>(
      `select x.id, x.description, x.amount::float8, x.currency, x.category, x.status, x.incurred_on, e.title as episode, a.name as agent
         from ward.expenses x left join ward.episodes e on e.id = x.episode_id left join ward.ai_agents a on a.id = x.created_by_agent_id order by x.created_at desc limit 100`),
    revenues: await q.query<{ id: string; source: string; amount: number; is_cash: boolean; status: string; description: string; sponsor: string | null }>(
      `select r.id, r.source, r.amount::float8, r.is_cash, r.status, r.description, s.name as sponsor from ward.revenues r left join ward.sponsors s on s.id = r.sponsor_id order by r.created_at desc limit 100`),
    ai: await q.query<{ provider: string; model: string; calls: number; input: number; output: number; cost: number; estimated: boolean }>(
      `select provider, model, count(*)::int as calls, sum(input_tokens)::int as input, sum(output_tokens)::int as output, sum(cost_usd)::float8 as cost, bool_or(price_is_estimate) as estimated
         from ward.model_usage where created_at >= date_trunc('month', now()) group by provider, model order by cost desc`),
    byAgent: await q.query<{ name: string; cost: number }>(`select a.name, coalesce(sum(r.cost_usd),0)::float8 as cost from ward.ai_agents a left join ward.agent_runs r on r.agent_id = a.id and r.started_at >= date_trunc('month', now()) group by a.id order by cost desc`),
    episodes: await q.query<{ id: string; title: string; estimated: number | null; spent: number }>(
      `select e.id, e.title, e.estimated_cost::float8 as estimated, coalesce(sum(x.amount),0)::float8 as spent from ward.episodes e left join ward.expenses x on x.episode_id = e.id and x.status in ('approved','paid') group by e.id order by e.created_at`),
    sponsors: await q.query<{ id: string; name: string }>(`select id, name from ward.sponsors order by name`),
    episodeList: await q.query<{ id: string; title: string }>(`select id, title from ward.episodes order by created_at`),
  }));
  const write = can(session.role, 'finance.write');
  const founder = can(session.role, 'approvals.decide');
  return (
    <div className="stack">
      <Flash params={await searchParams} />
      <PageHeader title={t.nav.finance} subtitle={tr(locale, 'أرقام مسجلة فقط. الرعاية العينية لا تُحسب دخلًا نقديًا. أي صرف يقترحه وكيل يمر عبر مركز الموافقات.', 'Recorded figures only. In-kind sponsorship is never counted as cash. Any spend proposed by an agent goes through approvals.')} />
      <StatsRow>
        <Stat value={money(d.totals.budget)} label={tr(locale, 'الميزانيات الحالية', 'Current budgets')} />
        <Stat value={money(d.totals.spent)} label={tr(locale, 'مصروف هذا الشهر', 'Spent this month')} />
        <Stat value={money(d.totals.pending)} label={tr(locale, 'بانتظار الموافقة', 'Pending approval')} />
        <Stat value={money(d.totals.cash_received)} label={tr(locale, 'نقد مستلم', 'Cash received')} />
        <Stat value={money(d.totals.cash_expected)} label={tr(locale, 'نقد متوقع', 'Cash expected')} />
        <Stat value={money(d.totals.in_kind)} label={tr(locale, 'قيمة عينية', 'In-kind value')} />
      </StatsRow>
      {write && (
        <div className="grid">
          <Card title={tr(locale, 'ميزانية', 'Budget')}>
            <form action="/api/os/finance/budgets" method="post" className="stack">
              <input className="input" name="name" required placeholder={tr(locale, 'الاسم', 'Name')} />
              <div className="row"><input className="input ltr" style={{ flex: 1 }} type="date" name="period_start" required /><input className="input ltr" style={{ flex: 1 }} type="date" name="period_end" required /></div>
              <input className="input ltr" type="number" min="0" name="amount" required placeholder="SAR" />
              <select className="select" name="episode_id" defaultValue=""><option value="">{tr(locale, 'عامة', 'General')}</option>{d.episodeList.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}</select>
              <button className="btn btn-sm">{t.common.add}</button>
            </form>
          </Card>
          <Card title={tr(locale, 'مصروف (قرار بشري)', 'Expense (human entry)')}>
            <form action="/api/os/finance/expenses" method="post" className="stack">
              <input className="input" name="description" required placeholder={tr(locale, 'الوصف', 'Description')} />
              <div className="row"><input className="input ltr" style={{ flex: 1 }} type="number" min="0.01" step="0.01" name="amount" required placeholder="SAR" /><input className="input ltr" style={{ flex: 1 }} type="date" name="incurred_on" /></div>
              <select className="select" name="budget_id" defaultValue=""><option value="">{tr(locale, 'بدون ميزانية', 'No budget')}</option>{d.budgets.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
              <select className="select" name="episode_id" defaultValue=""><option value="">{tr(locale, 'بدون حلقة', 'No episode')}</option>{d.episodeList.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}</select>
              <button className="btn btn-sm">{t.common.add}</button>
            </form>
          </Card>
          <Card title={tr(locale, 'إيراد', 'Revenue')}>
            <form action="/api/os/finance/revenues" method="post" className="stack">
              <select className="select" name="source" defaultValue="sponsorship">{['sponsorship', 'ads', 'services', 'other'].map((s) => <option key={s}>{s}</option>)}</select>
              <input className="input ltr" type="number" min="0.01" step="0.01" name="amount" required placeholder="SAR" />
              <select className="select" name="status" defaultValue="expected"><option value="expected">{label(locale, 'expected')}</option><option value="received">{label(locale, 'received')}</option></select>
              <label className="row small"><input type="checkbox" name="is_cash" defaultChecked />{tr(locale, 'نقدي (ألغِ التحديد للرعاية العينية)', 'Cash (uncheck for in-kind)')}</label>
              <select className="select" name="sponsor_id" defaultValue=""><option value="">—</option>{d.sponsors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              <input className="input" name="description" placeholder={tr(locale, 'الوصف', 'Description')} />
              <button className="btn btn-sm">{t.common.add}</button>
            </form>
          </Card>
        </div>
      )}
      <div className="grid-2">
        <Card title={tr(locale, 'الميزانيات', 'Budgets')}>
          {d.budgets.length ? <div className="list">{d.budgets.map((b) => (
            <div key={b.id} className="stack" style={{ gap: 6 }}>
              <span className="spread small"><span>{b.name} <span className="faint">· {formatDate(locale, b.period_start)} – {formatDate(locale, b.period_end)}</span></span><span>{money(b.spent)} / {money(b.amount)}</span></span>
              <div style={{ height: 6, borderRadius: 6, background: 'var(--line)' }}><div style={{ height: 6, borderRadius: 6, width: `${Math.min(100, b.amount ? (b.spent / b.amount) * 100 : 0)}%`, background: b.spent > b.amount ? 'var(--bad)' : 'var(--accent)' }} /></div>
            </div>
          ))}</div> : <Empty>{tr(locale, 'لا توجد ميزانيات مسجلة.', 'No budgets recorded.')}</Empty>}
        </Card>
        <Card title={tr(locale, 'تكلفة الحلقات', 'Episode costs')}>
          {d.episodes.length ? <div className="list">{d.episodes.map((e) => <div key={e.id} className="spread small"><span>{e.title}</span><span>{money(e.spent)}{e.estimated != null ? ` / ${money(e.estimated)}` : ''}</span></div>)}</div> : <Empty>—</Empty>}
        </Card>
        <Card title={tr(locale, 'تكاليف الذكاء الاصطناعي (هذا الشهر)', 'AI costs (this month)')}>
          {d.ai.length ? <div className="table-wrap"><table className="table"><tbody>{d.ai.map((r) => (
            <tr key={`${r.provider}:${r.model}`}><td className="mono">{r.provider}:{r.model}</td><td className="small">{r.calls}</td><td className="small ltr">{r.input.toLocaleString()} / {r.output.toLocaleString()}</td><td className="small ltr">{usd(r.cost)}{r.estimated ? ' *' : ''}</td></tr>
          ))}</tbody></table></div> : <Empty>{tr(locale, 'لا استهلاك بعد.', 'No usage yet.')}</Empty>}
          <div className="row small faint" style={{ marginTop: 10 }}>{d.byAgent.filter((a) => a.cost > 0).map((a) => <span key={a.name}>{a.name}: {usd(a.cost)}</span>)}</div>
          {d.ai.some((r) => r.estimated) && <p className="small faint">* {tr(locale, 'سعر تقديري — حدّده في الإعدادات.', 'estimated price — set it in Settings.')}</p>}
        </Card>
        <Card title={tr(locale, 'الإيرادات', 'Revenue')}>
          {d.revenues.length ? <div className="list">{d.revenues.map((r) => <div key={r.id} className="spread small"><span>{r.sponsor ?? r.source} <span className="faint">· {r.is_cash ? tr(locale, 'نقدي', 'cash') : tr(locale, 'عيني', 'in-kind')} · {r.description}</span></span><span className="row">{money(r.amount)}<StatusBadge status={r.status} locale={locale} /></span></div>)}</div> : <Empty>—</Empty>}
        </Card>
      </div>
      <Card title={tr(locale, 'المصاريف', 'Expenses')}>
        {d.expenses.length ? <div className="table-wrap"><table className="table"><tbody>{d.expenses.map((x) => (
          <tr key={x.id}>
            <td>{x.description}<span className="small faint">{x.episode ? ` · ${x.episode}` : ''}{x.agent ? ` · ${x.agent}` : ''}</span></td>
            <td className="small ltr">{money(x.amount, x.currency)}</td>
            <td className="small">{formatDate(locale, x.incurred_on)}</td>
            <td><StatusBadge status={x.status} locale={locale} /></td>
            <td>{founder && x.status === 'approved' && <form action={`/api/os/expenses/${x.id}/paid`} method="post"><button className="btn btn-sm">{tr(locale, 'تم الدفع', 'Mark paid')}</button></form>}</td>
          </tr>
        ))}</tbody></table></div> : <Empty>{tr(locale, 'لا مصاريف مسجلة.', 'No expenses recorded.')}</Empty>}
      </Card>
    </div>
  );
}
