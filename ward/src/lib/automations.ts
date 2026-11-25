import { num, system, withOrg, type OrgContext, type Queryable } from '@/lib/db';
import { nextRun } from '@/lib/cron';
import { enqueue } from '@/lib/queue';
import { notify } from '@/lib/notifications';
import { createDocument } from '@/lib/knowledge';
import { configuredProviders } from '@/lib/ai/gateway';
import { getSettings } from '@/lib/settings';
import { runAgent } from '@/lib/agents/runner';
import { startWorkflow } from '@/lib/orchestrator';

export const AUTOMATION_KINDS = [
  'morning_report', 'weekly_report', 'shoot_schedule_review', 'sponsor_rights_followup',
  'episode_ideas', 'expense_review', 'deadline_alerts', 'error_monitor',
] as const;
export type AutomationKind = (typeof AUTOMATION_KINDS)[number];

export const AUTOMATION_DEFAULTS: Record<AutomationKind, { cron: string; usesAi: boolean; maxCostUsd: number }> = {
  morning_report: { cron: '30 6 * * *', usesAi: true, maxCostUsd: 0.25 },
  weekly_report: { cron: '0 9 * * 0', usesAi: true, maxCostUsd: 0.5 },
  shoot_schedule_review: { cron: '0 8 * * *', usesAi: false, maxCostUsd: 0 },
  sponsor_rights_followup: { cron: '0 10 * * 1', usesAi: false, maxCostUsd: 0 },
  episode_ideas: { cron: '0 11 * * 3', usesAi: true, maxCostUsd: 0.8 },
  expense_review: { cron: '0 18 * * 4', usesAi: false, maxCostUsd: 0 },
  deadline_alerts: { cron: '5 * * * *', usesAi: false, maxCostUsd: 0 },
  error_monitor: { cron: '*/30 * * * *', usesAi: false, maxCostUsd: 0 },
};

/** Scheduler tick: enqueue every enabled automation that is due, exactly once per slot. */
export async function schedulerTick(now = new Date()): Promise<number> {
  return system(async (q) => {
    const due = await q.query<{ id: string; org_id: string; cron: string; timezone: string; next_run_at: Date | null }>(
      `select id, org_id, cron, timezone, next_run_at from ward.automations
        where enabled and (next_run_at is null or next_run_at <= $1) for update skip locked`,
      [now.toISOString()],
    );
    let queued = 0;
    for (const a of due) {
      const next = nextRun(a.cron, now, a.timezone);
      if (a.next_run_at) {
        const slot = new Date(a.next_run_at).toISOString();
        if (await enqueue(q, a.org_id, 'automation.run', { automationId: a.id, slot }, { idempotencyKey: `auto:${a.id}:${slot}`, maxAttempts: 2 })) queued++;
      }
      await q.query('update ward.automations set next_run_at = $2 where id = $1', [a.id, next.toISOString()]);
    }
    return queued;
  });
}

const day = (d: Date | string | null) => (d ? new Date(d).toISOString().slice(0, 10) : '—');

async function snapshot(q: Queryable, sinceDays: number) {
  const one = async <T>(sql: string, params: unknown[] = []) => (await q.query<T>(sql, params))[0]!;
  const counts = await one<Record<string, number>>(
    `select (select count(*)::int from ward.workflows where status in ('queued','planning','running','reviewing')) as active_runs,
            (select count(*)::int from ward.workflows where status = 'completed' and finished_at > now() - make_interval(days => $1::int)) as completed_runs,
            (select count(*)::int from ward.approvals where status = 'pending') as pending_approvals,
            (select count(*)::int from ward.tasks where status <> 'done' and due_at < now()) as overdue_tasks,
            (select count(*)::int from ward.tasks where status <> 'done' and due_at between now() and now() + interval '1 day') as due_today,
            (select count(*)::int from ward.tasks where status = 'done' and completed_at > now() - make_interval(days => $1::int)) as done_tasks,
            (select count(*)::int from ward.sponsorship_deliverables where status = 'pending' and due_at < now()) as overdue_deliverables`,
    [sinceDays],
  );
  const spend = await one<{ today: number; month: number; period: number }>(
    `select coalesce(sum(cost_usd) filter (where created_at >= date_trunc('day', now())), 0)::float8 as today,
            coalesce(sum(cost_usd) filter (where created_at >= date_trunc('month', now())), 0)::float8 as month,
            coalesce(sum(cost_usd) filter (where created_at > now() - make_interval(days => $1::int)), 0)::float8 as period
       from ward.model_usage`,
    [sinceDays],
  );
  const shoots = await q.query<{ title: string; shoot_at: Date; guest_confirmed: boolean; status: string }>(
    `select title, shoot_at, guest_confirmed, status from ward.episodes where shoot_at between now() and now() + interval '7 days' order by shoot_at`,
  );
  const episodes = await q.query<{ title: string; status: string }>(`select title, status from ward.episodes order by created_at desc limit 10`);
  return { counts, spend, shoots, episodes };
}

function renderSnapshot(title: string, s: Awaited<ReturnType<typeof snapshot>>): string {
  return [
    `# ${title}`,
    `- أوامر قيد التنفيذ: ${s.counts.active_runs} — مكتملة في الفترة: ${s.counts.completed_runs}`,
    `- موافقات معلقة: ${s.counts.pending_approvals}`,
    `- مهام متأخرة: ${s.counts.overdue_tasks} — مستحقة خلال 24 ساعة: ${s.counts.due_today} — مُنجزة في الفترة: ${s.counts.done_tasks}`,
    `- حقوق رعاة متأخرة: ${s.counts.overdue_deliverables}`,
    `- تكلفة الذكاء الاصطناعي: اليوم $${num(s.spend.today).toFixed(3)} — الشهر $${num(s.spend.month).toFixed(3)}`,
    '',
    '## تصوير خلال 7 أيام',
    ...(s.shoots.length ? s.shoots.map((e) => `- ${e.title} — ${day(e.shoot_at)} — ${e.status}${e.guest_confirmed ? '' : ' — ⚠️ الضيف غير مؤكد'}`) : ['- لا يوجد']),
    '',
    '## الحلقات',
    ...(s.episodes.length ? s.episodes.map((e) => `- ${e.title}: ${e.status}`) : ['- لا يوجد']),
  ].join('\n');
}

async function report(ctx: OrgContext, automationId: string, kind: 'morning_report' | 'weekly_report', maxCostUsd: number, usesAi: boolean): Promise<string> {
  const weekly = kind === 'weekly_report';
  const title = weekly ? `التقرير الأسبوعي — ${day(new Date())}` : `التقرير الصباحي — ${day(new Date())}`;
  const snap = await withOrg(ctx, (q) => snapshot(q, weekly ? 7 : 1));
  let body = renderSnapshot(title, snap);
  let note = 'data_only';
  const paused = await withOrg(ctx, async (q) => (await getSettings(q, ctx.orgId)).agents_paused);
  if (usesAi && maxCostUsd > 0 && !paused && configuredProviders().length > 0) {
    const started = new Date().toISOString();
    try {
      const result = await runAgent({
        ctx, agent: 'chief', purpose: kind, useTools: false, tier: 'economy',
        task: `${body}\n\nاكتب للمؤسس ${weekly ? 'تقييمًا أسبوعيًا' : 'ملخصًا صباحيًا'} مختصرًا (≤ 150 كلمة) بأهم 3 أولويات اليوم/الأسبوع بناءً على الأرقام أعلاه فقط.`,
        capUsd: {
          scope: 'automation',
          limit: maxCostUsd,
          // Everything this automation run has spent so far (all attempts, all providers).
          spent: () =>
            withOrg(ctx, async (q) =>
              num((await q.query<{ s: number }>(
                `select coalesce(sum(cost_usd), 0)::float8 as s from ward.model_usage where purpose = $1 and created_at >= $2`,
                [kind, started],
              ))[0]?.s),
            ),
        },
      });
      body += `\n\n## قراءة المدير التنفيذي\n${result.output}`;
      note = 'with_ai_summary';
    } catch (err) {
      body += `\n\n_تعذر إضافة ملخص الذكاء الاصطناعي: ${err instanceof Error ? err.message.slice(0, 160) : 'error'}_`;
      note = 'ai_failed';
    }
  } else if (usesAi && configuredProviders().length === 0) {
    body += '\n\n_لا يوجد مزود ذكاء اصطناعي مُعد؛ التقرير مبني على البيانات فقط._';
  }
  await withOrg(ctx, async (q) => {
    await createDocument(q, ctx, { title, category: 'reports', content: body, source: 'system', verified: false });
    await notify(q, ctx.orgId, { kind, title, body: body.split('\n').slice(1, 4).join(' · '), link: '/os/knowledge?category=reports', dedupeKey: `${automationId}:${day(new Date())}` });
  });
  return note;
}

async function checks(ctx: OrgContext, kind: AutomationKind): Promise<string> {
  return withOrg(ctx, async (q) => {
    let n = 0;
    const push = async (dedupeKey: string, title: string, body: string, link: string, severity: 'info' | 'warning' | 'critical' = 'warning') => {
      if (await notify(q, ctx.orgId, { kind, severity, title, body, link, dedupeKey })) n++;
    };
    if (kind === 'shoot_schedule_review') {
      const rows = await q.query<{ id: string; title: string; shoot_at: Date; guest_confirmed: boolean; status: string; is_minor: boolean | null; guardian_consent: boolean | null }>(
        `select e.id, e.title, e.shoot_at, e.guest_confirmed, e.status, g.is_minor, g.guardian_consent
           from ward.episodes e left join ward.guests g on g.id = e.guest_id
          where e.shoot_at between now() and now() + interval '7 days'`,
      );
      for (const e of rows) {
        const problems = [
          !e.guest_confirmed && 'الضيف غير مؤكد من المؤسس',
          ['idea', 'research', 'preparation', 'guest_confirmation'].includes(e.status) && `الحالة ما زالت ${e.status}`,
          e.is_minor && !e.guardian_consent && 'الضيف قاصر ولا توجد موافقة ولي أمر مسجلة',
        ].filter(Boolean) as string[];
        if (problems.length) await push(`shoot:${e.id}:${day(e.shoot_at)}`, `مراجعة تصوير: ${e.title} (${day(e.shoot_at)})`, problems.join(' · '), `/os/episodes/${e.id}`);
      }
    } else if (kind === 'sponsor_rights_followup') {
      const rows = await q.query<{ id: string; title: string; due_at: Date; name: string; overdue: boolean }>(
        `select d.id, d.title, d.due_at, s.name, d.due_at < now() as overdue from ward.sponsorship_deliverables d join ward.sponsors s on s.id = d.sponsor_id
          where d.status = 'pending' and d.due_at < now() + interval '7 days'`,
      );
      for (const d of rows) await push(`deliv:${d.id}:${d.overdue ? 'over' : 'soon'}`, `${d.overdue ? 'متأخر' : 'قريب'}: حق راعٍ لـ ${d.name}`, `${d.title} — ${day(d.due_at)}`, '/os/sponsors', d.overdue ? 'critical' : 'warning');
    } else if (kind === 'expense_review') {
      const pending = await q.query<{ id: string; description: string; amount: string }>(`select id, description, amount from ward.expenses where status = 'pending_approval' and created_at < now() - interval '3 days'`);
      for (const x of pending) await push(`exp:${x.id}:stale`, 'مصروف ينتظر الموافقة منذ أكثر من 3 أيام', `${x.description} — ${num(x.amount)} SAR`, '/os/approvals');
      const over = await q.query<{ id: string; name: string; amount: string; spent: string }>(
        `select b.id, b.name, b.amount, coalesce(sum(x.amount), 0) as spent from ward.budgets b
           left join ward.expenses x on x.budget_id = b.id and x.status in ('approved','paid')
          where current_date between b.period_start and b.period_end group by b.id having coalesce(sum(x.amount), 0) > b.amount`,
      );
      for (const b of over) await push(`budget:${b.id}:${day(new Date())}`, `تجاوز ميزانية: ${b.name}`, `${num(b.spent)} من ${num(b.amount)} SAR`, '/os/finance', 'critical');
    } else if (kind === 'deadline_alerts') {
      const rows = await q.query<{ id: string; title: string; due_at: Date; overdue: boolean }>(
        `select id, title, due_at, due_at < now() as overdue from ward.tasks where status <> 'done' and due_at < now() + interval '24 hours'`,
      );
      for (const t of rows) await push(`task:${t.id}:${t.overdue ? 'over' : 'due'}`, `${t.overdue ? 'مهمة متأخرة' : 'مهمة مستحقة خلال 24 ساعة'}: ${t.title}`, day(t.due_at), '/os/tasks', t.overdue ? 'critical' : 'warning');
    } else if (kind === 'error_monitor') {
      const r = (await q.query<{ wf: number; mt: number; jobs: number; provider: number }>(
        `select (select count(*)::int from ward.workflows where status = 'failed' and updated_at > now() - interval '1 hour') as wf,
                (select count(*)::int from ward.meetings where status = 'failed' and finished_at > now() - interval '1 hour') as mt,
                (select count(*)::int from ward.jobs where status = 'dead' and finished_at > now() - interval '1 hour') as jobs,
                (select count(*)::int from ward.model_usage where not ok and created_at > now() - interval '1 hour') as provider`,
      ))[0]!;
      if (r.wf + r.mt + r.jobs + r.provider > 0) {
        const hour = new Date().toISOString().slice(0, 13);
        await push(`errors:${hour}`, 'أخطاء تشغيل خلال الساعة الأخيرة', `أوامر فاشلة ${r.wf} · اجتماعات ${r.mt} · مهام خلفية ${r.jobs} · أخطاء مزودين ${r.provider}`, '/os/runs', 'critical');
      }
    }
    return `${n} notifications`;
  });
}

export async function runAutomation(orgId: string, automationId: string): Promise<void> {
  const ctx: OrgContext = { orgId, userId: null, role: 'system' };
  const a = (await withOrg(ctx, (q) =>
    q.query<{ id: string; kind: AutomationKind; enabled: boolean; uses_ai: boolean; max_cost_usd: string }>(
      'select id, kind, enabled, uses_ai, max_cost_usd from ward.automations where id = $1',
      [automationId],
    ),
  ))[0];
  if (!a || !a.enabled) return;
  let status = 'ok';
  let error: string | null = null;
  try {
    if (a.kind === 'morning_report' || a.kind === 'weekly_report') status = await report(ctx, a.id, a.kind, num(a.max_cost_usd), a.uses_ai);
    else if (a.kind === 'episode_ideas') {
      if (!a.uses_ai || num(a.max_cost_usd) <= 0 || configuredProviders().length === 0) status = 'skipped_no_ai';
      else {
        const id = await startWorkflow(ctx, {
          source: 'automation',
          automationId: a.id,
          costLimitUsd: num(a.max_cost_usd),
          command: 'اقترح 5 أفكار حلقات جديدة لوارد تناسب شخصيتها والجمهور المستهدف، مع ضيف مقترح لكل فكرة (كمقترح فقط) وسبب مختصر. لا تكرر الحلقات الحالية.',
        });
        status = `workflow:${id}`;
      }
    } else status = await checks(ctx, a.kind);
  } catch (err) {
    status = 'error';
    error = err instanceof Error ? err.message.slice(0, 500) : String(err);
  }
  await withOrg(ctx, (q) =>
    q.query('update ward.automations set last_run_at = now(), last_status = $2, last_error = $3 where id = $1', [a.id, status, error]),
  );
}
