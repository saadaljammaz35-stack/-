import Link from 'next/link';
import { requirePage } from '@/lib/auth/page';
import { withOrg } from '@/lib/db';
import { getPrefs } from '@/lib/prefs';
import { can } from '@/lib/auth/permissions';
import { dict, formatDate, label, money, tr } from '@/lib/i18n';
import { Card, Empty, Flash, PageHeader, StatusBadge } from '@/components/os/ui';

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await requirePage();
  const { locale } = await getPrefs();
  const t = dict(locale);
  const d = await withOrg(session, async (q) => ({
    pending: await q.query<{ id: string; action_type: string; title: string; summary: string; target: string; payload: Record<string, unknown>; estimated_cost: number | null; currency: string; agent: string | null; requester: string | null; workflow_id: string | null; created_at: Date }>(
      `select ap.id, ap.action_type, ap.title, ap.summary, ap.target, ap.payload, ap.estimated_cost::float8, ap.currency, a.name as agent, u.name as requester, ap.workflow_id, ap.created_at
         from ward.approvals ap left join ward.ai_agents a on a.id = ap.requested_by_agent_id left join ward.users u on u.id = ap.requested_by_user_id
        where ap.status = 'pending' order by ap.created_at`),
    history: await q.query<{ id: string; action_type: string; title: string; status: string; decided_at: Date | null; decision_note: string | null; execution_result: Record<string, unknown> | null }>(
      `select id, action_type, title, status, decided_at, decision_note, execution_result from ward.approvals where status <> 'pending' order by decided_at desc nulls last limit 50`),
    decisions: await q.query<{ id: string; title: string; details: string; status: string; source: string; created_at: Date }>(`select id, title, details, status, source, created_at from ward.decisions order by created_at desc limit 50`),
  }));
  const founder = can(session.role, 'approvals.decide');
  return (
    <div className="stack">
      <Flash params={await searchParams} />
      <PageHeader title={t.nav.approvals} subtitle={tr(locale, 'لا ينفذ أي وكيل هذه الإجراءات بنفسه: النشر، المراسلة الخارجية، الاتفاقيات، الصرف، حذف البيانات المهمة، تعديل الموقع، مشاركة الملفات الخاصة، تغيير الصلاحيات.', 'No agent performs these on its own: publishing, external messages, agreements, spending, deleting important data, changing the live site, sharing private files, changing permissions.')} />
      {!founder && <div className="notice">{tr(locale, 'القرار هنا للمؤسس فقط.', 'Only the founder decides here.')}</div>}
      {d.pending.length ? d.pending.map((a) => (
        <section key={a.id} id={a.id} className="card stack fade-in" style={{ gap: 12 }}>
          <div className="spread">
            <strong style={{ fontSize: 17, fontWeight: 600 }}>{a.title}</strong>
            <span className="badge warn">{label(locale, a.action_type)}</span>
          </div>
          <div className="grid small">
            <span><span className="faint">{tr(locale, 'الجهة المستهدفة', 'Target')}: </span>{a.target || '—'}</span>
            <span><span className="faint">{tr(locale, 'التكلفة', 'Cost')}: </span>{a.estimated_cost != null ? money(a.estimated_cost, a.currency) : tr(locale, 'لا توجد', 'none')}</span>
            <span><span className="faint">{tr(locale, 'الطالب', 'Requested by')}: </span>{a.agent ?? a.requester ?? '—'}</span>
            <span><span className="faint">{tr(locale, 'التاريخ', 'Date')}: </span>{formatDate(locale, a.created_at, true)}</span>
          </div>
          <div className="prose small">{a.summary}</div>
          <details className="disclosure"><summary>{tr(locale, 'تفاصيل الإجراء الكاملة', 'Full action details')}</summary><pre className="mono" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{JSON.stringify(a.payload, null, 2)}</pre></details>
          {a.workflow_id && <Link className="small muted" href={`/os/runs/${a.workflow_id}`}>{tr(locale, 'أمر التشغيل المرتبط', 'Related run')} ←</Link>}
          {founder && (
            <form action={`/api/os/approvals/${a.id}`} method="post" className="row">
              <input className="input" style={{ flex: 1 }} name="note" placeholder={tr(locale, 'ملاحظة (اختياري)', 'Note (optional)')} maxLength={2000} />
              <button className="btn btn-primary" name="decision" value="approve">{t.common.approve}</button>
              <button className="btn btn-danger" name="decision" value="reject">{t.common.reject}</button>
            </form>
          )}
        </section>
      )) : <Card><Empty>{tr(locale, 'لا توجد طلبات معلقة.', 'Nothing awaiting approval.')}</Empty></Card>}

      <Card id="decisions" title={tr(locale, 'قرارات المؤسس', 'Founder decisions')}>
        {founder && (
          <form action="/api/os/decisions" method="post" className="stack" style={{ marginBottom: 14 }}>
            <input className="input" name="title" required minLength={3} maxLength={300} placeholder={tr(locale, 'سجّل قرارًا (يصبح جزءًا من الذاكرة الموثقة)', 'Record a decision (becomes verified memory)')} />
            <textarea className="textarea" name="details" placeholder={tr(locale, 'التفاصيل', 'Details')} />
            <div><button className="btn btn-sm">{tr(locale, 'تسجيل', 'Record')}</button></div>
          </form>
        )}
        {d.decisions.length ? <div className="list">{d.decisions.map((x) => (
          <div key={x.id} className="spread small">
            <span><strong style={{ fontWeight: 500 }}>{x.title}</strong> <span className="faint">· {x.source} · {formatDate(locale, x.created_at)}</span></span>
            <span className="row"><StatusBadge status={x.status} locale={locale} />
              {founder && x.status === 'proposed' && <>
                <form action={`/api/os/decisions/${x.id}`} method="post"><input type="hidden" name="decision" value="approve" /><button className="btn btn-sm">{t.common.approve}</button></form>
                <form action={`/api/os/decisions/${x.id}`} method="post"><input type="hidden" name="decision" value="reject" /><button className="btn btn-sm btn-ghost">{t.common.reject}</button></form>
              </>}
            </span>
          </div>
        ))}</div> : <Empty>—</Empty>}
      </Card>

      <Card title={tr(locale, 'السجل', 'History')}>
        {d.history.length ? <div className="list">{d.history.map((h) => (
          <div key={h.id} className="stack small" style={{ gap: 2 }}>
            <span className="spread"><span>{h.title} <span className="faint">· {label(locale, h.action_type)}</span></span><StatusBadge status={h.status} locale={locale} /></span>
            {h.execution_result && typeof h.execution_result.note === 'string' && <span className="muted">{h.execution_result.note}</span>}
            {h.decision_note && <span className="faint">“{h.decision_note}”</span>}
          </div>
        ))}</div> : <Empty>—</Empty>}
      </Card>
    </div>
  );
}
