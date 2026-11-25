import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { withOrg } from '@/lib/db';
import { advanceWorkflow, cancelWorkflow, resumeWorkflow, startWorkflow, validatePlan, type Plan } from '@/lib/orchestrator';
import { decideApproval } from '@/lib/approvals';
import { drainQueue } from '@/lib/queue/worker';
import { addMember, hasToolResult, install, lastUser, q1, ScriptedProvider, setupDb, teardown, toolCall, type TestEnv } from './helpers';

const PLAN: Plan = {
  title: 'تجهيز الحلقة القادمة',
  analysis: 'نحتاج بحثًا عن الضيف وخطة إنتاج وحملة إعلان.',
  steps: [
    { key: 'research', agent: 'editorial', title: 'بحث الضيف والأسئلة', instructions: 'ابحث في الذاكرة عن الحلقة الأولى وجهز الأسئلة.', depends_on: [], complexity: 'standard' },
    { key: 'promo', agent: 'marketing', title: 'خطة إعلان', instructions: 'جهز منشور إعلان واطلب موافقة النشر.', depends_on: [], complexity: 'simple' },
    { key: 'shoot', agent: 'production', title: 'خطة التصوير', instructions: 'جهز جدول التصوير بناءً على البحث.', depends_on: ['research'], complexity: 'standard' },
  ],
};

const approved = { verdict: 'approved', summary: 'المخرجات سليمة', issues: [], risks: ['الضيف غير مؤكد'], unsupported_claims: [] };

function agentOf(system: string): string {
  return system.match(/أنت (WARD \w+)/)?.[1] ?? 'unknown';
}

describe('agent orchestrator', () => {
  let env: TestEnv;
  let episodeId: string;
  beforeEach(async () => {
    env = await setupDb();
    episodeId = (await q1<{ id: string }>(env.founder, `select id from ward.episodes limit 1`)).id;
  });
  afterEach(() => teardown(env));

  it('plans, runs independent steps in parallel, passes outputs downstream, reviews, reports and waits for approval', async () => {
    const provider = install(
      new ScriptedProvider('anthropic', (req) => {
        if (req.responseSchema?.name === 'workflow_plan') return { text: JSON.stringify(PLAN) };
        if (req.responseSchema?.name === 'quality_review') return { text: JSON.stringify(approved) };
        const agent = agentOf(req.system);
        if (agent === 'WARD Editorial' && req.tools && !hasToolResult(req, 'search_knowledge')) {
          return { toolCalls: [toolCall('search_knowledge', { query: 'الحلقة الأولى أكبر من عمره' })], delayMs: 40 };
        }
        if (agent === 'WARD Marketing' && req.tools && !hasToolResult(req, 'request_publish')) {
          return { toolCalls: [toolCall('request_publish', { platform: 'instagram', content_summary: 'إعلان الحلقة الأولى', episode_id: episodeId })], delayMs: 40 };
        }
        if (agent === 'WARD Editorial') return { text: 'RESEARCH-OUTPUT: أسئلة عن ريادة الأعمال بعمر صغير (المصدر: الحلقة الأولى: أكبر من عمره)', delayMs: 40 };
        if (agent === 'WARD Production') return { text: `SHOOT-PLAN based on input: ${lastUser(req).includes('RESEARCH-OUTPUT') ? 'yes' : 'no'}` };
        if (agent === 'WARD Marketing') return { text: 'PROMO: طُلبت موافقة النشر ولم يُنشر شيء.' };
        return { text: '# التقرير النهائي\nأُنجزت الخطة؛ النشر ينتظر موافقتك.' };
      }),
    );

    const id = await startWorkflow(env.founder, { command: 'جهز الحلقة القادمة مع ضيف متخصص في ريادة الأعمال' });
    expect((await q1<{ status: string }>(env.founder, 'select status from ward.workflows where id = $1', [id])).status).toBe('queued');

    const r = await drainQueue({ maxMs: 60_000, tick: false });
    expect(r.failed).toBe(0);

    const wf = await q1<{ status: string; report: string; plan: Plan; review: { verdict: string } }>(env.founder, 'select status, report, plan, review from ward.workflows where id = $1', [id]);
    expect(wf.status).toBe('awaiting_approval');
    expect(wf.plan.steps).toHaveLength(3);
    expect(wf.review.verdict).toBe('approved');
    expect(wf.report).toContain('التقرير النهائي');

    // research and promo had no dependencies → they ran concurrently.
    expect(provider.maxInFlight).toBeGreaterThanOrEqual(2);

    const steps = await withOrg(env.founder, (q) => q.query<{ key: string; status: string; output: string }>('select key, status, output from ward.workflow_steps where workflow_id = $1', [id]));
    expect(steps.every((s) => s.status === 'completed')).toBe(true);
    // The dependent step received its dependency's output.
    expect(steps.find((s) => s.key === 'shoot')!.output).toContain('based on input: yes');

    const events = await withOrg(env.founder, (q) => q.query<{ message: string }>(`select message from ward.workflow_events where workflow_id = $1 and kind = 'status' order by id`, [id]));
    expect(events.map((e) => e.message.split(':')[0])).toEqual(['queued', 'planning', 'reviewing', 'awaiting_approval']);

    // Publishing was requested, never executed.
    const approval = await q1<{ id: string; status: string; action_type: string }>(env.founder, `select id, status, action_type from ward.approvals where workflow_id = $1`, [id]);
    expect(approval).toMatchObject({ status: 'pending', action_type: 'publish_content' });
    const ep = await q1<{ status: string; approval_status: string; publish_links: unknown[] }>(env.founder, 'select status, approval_status, publish_links from ward.episodes where id = $1', [episodeId]);
    expect(ep).toMatchObject({ status: 'idea', approval_status: 'draft', publish_links: [] });
    const toolLog = await q1<{ status: string }>(env.founder, `select status from ward.agent_tool_calls where tool = 'request_publish'`);
    expect(toolLog.status).toBe('approval_requested');

    // Only the founder can decide.
    const editor = await addMember(env, 'editor@ward.test', 'editor');
    await expect(decideApproval(editor, approval.id, 'approve', null)).rejects.toThrow(/approvals.decide/);
    const admin = await addMember(env, 'admin@ward.test', 'admin');
    await expect(decideApproval(admin, approval.id, 'approve', null)).rejects.toThrow(/approvals.decide/);

    const decision = await decideApproval(env.founder, approval.id, 'approve', 'موافق');
    expect(decision.status).toBe('approved'); // approved, but publication itself is manual — nothing was published
    expect(decision.result).toMatchObject({ mode: 'manual' });
    await expect(decideApproval(env.founder, approval.id, 'approve', null)).rejects.toThrow(/already_decided/);

    const after = await q1<{ status: string }>(env.founder, 'select status from ward.workflows where id = $1', [id]);
    expect(after.status).toBe('completed');
    const epAfter = await q1<{ status: string; approval_status: string }>(env.founder, 'select status, approval_status from ward.episodes where id = $1', [episodeId]);
    expect(epAfter).toEqual({ status: 'idea', approval_status: 'approved' });

    // Usage and cost were recorded for every model call.
    const usage = await q1<{ calls: number; cost: number }>(env.founder, 'select count(*)::int as calls, sum(cost_usd)::float8 as cost from ward.model_usage where workflow_id = $1', [id]);
    expect(usage.calls).toBe(provider.calls.length);
    expect(usage.cost).toBeGreaterThan(0);
  });

  it('runs one review revision round at most, then reports', async () => {
    let reviews = 0;
    install(
      new ScriptedProvider('anthropic', (req) => {
        if (req.responseSchema?.name === 'workflow_plan') return { text: JSON.stringify({ ...PLAN, steps: [PLAN.steps[0]] }) };
        if (req.responseSchema?.name === 'quality_review') {
          reviews++;
          return { text: JSON.stringify({ ...approved, verdict: 'changes_requested', issues: [{ step_key: 'research', severity: 'high', problem: 'رقم بلا مصدر', fix: 'احذفه' }] }) };
        }
        return { text: lastUser(req).includes('ملاحظات وكيل الجودة') ? 'نسخة معدلة' : 'نسخة أولى فيها 10 مليون مشاهدة' };
      }),
    );
    const id = await startWorkflow(env.founder, { command: 'اكتب أسئلة الحلقة الأولى' });
    await drainQueue({ maxMs: 60_000, tick: false });
    const wf = await q1<{ status: string; review_round: number }>(env.founder, 'select status, review_round from ward.workflows where id = $1', [id]);
    expect(wf.status).toBe('completed');
    expect(wf.review_round).toBe(1);
    expect(reviews).toBe(2); // initial review + one re-review, never a third
    const step = await q1<{ output: string }>(env.founder, `select output from ward.workflow_steps where workflow_id = $1`, [id]);
    expect(step.output).toBe('نسخة معدلة');
  });

  it('retries a failing step, then fails the workflow; retry and cancel work', async () => {
    let failing = true;
    install(
      new ScriptedProvider('anthropic', (req) => {
        if (req.responseSchema?.name === 'workflow_plan') return { text: JSON.stringify({ ...PLAN, steps: [PLAN.steps[1]] }) };
        if (req.responseSchema?.name === 'quality_review') return { text: JSON.stringify(approved) };
        if (agentOf(req.system) === 'WARD Marketing' && failing) return { error: new Error('tool exploded') };
        return { text: 'done' };
      }),
    );
    const id = await startWorkflow(env.founder, { command: 'خطة تسويق' });
    await drainQueue({ maxMs: 60_000, tick: false });
    const failed = await q1<{ status: string; error: string }>(env.founder, 'select status, error from ward.workflows where id = $1', [id]);
    expect(failed.status).toBe('failed');
    const step = await q1<{ attempts: number; status: string }>(env.founder, 'select attempts, status from ward.workflow_steps where workflow_id = $1', [id]);
    expect(step).toEqual({ attempts: 2, status: 'failed' });

    failing = false;
    await resumeWorkflow(env.founder, id, { mode: 'retry' });
    await drainQueue({ maxMs: 60_000, tick: false });
    expect((await q1<{ status: string }>(env.founder, 'select status from ward.workflows where id = $1', [id])).status).toBe('completed');

    const second = await startWorkflow(env.founder, { command: 'أمر سيُلغى' });
    await cancelWorkflow(env.founder, second);
    await drainQueue({ maxMs: 10_000, tick: false });
    expect((await q1<{ status: string }>(env.founder, 'select status from ward.workflows where id = $1', [second])).status).toBe('cancelled');
    await expect(cancelWorkflow(env.founder, second)).rejects.toThrow(/not_cancellable/);
  });

  it('rejects invalid plans: unknown dependency, cycle, too many steps', () => {
    const base = PLAN.steps[0]!;
    expect(() => validatePlan({ ...PLAN, steps: [{ ...base, depends_on: ['ghost'] }] }, 8)).toThrow(/unknown step/);
    expect(() =>
      validatePlan({ ...PLAN, steps: [{ ...base, key: 'a', depends_on: ['b'] }, { ...base, key: 'b', depends_on: ['a'] }] }, 8),
    ).toThrow(/cycle/);
    expect(() => validatePlan(PLAN, 2)).toThrow(/exceeds/);
    expect(validatePlan(PLAN, 8)).toEqual(['research', 'promo', 'shoot']);
  });

  it('fails clearly when no AI provider is configured (no fabricated output)', async () => {
    const id = await startWorkflow(env.founder, { command: 'أي أمر' });
    await advanceWorkflow(env.orgId, id);
    const wf = await q1<{ status: string; error: string; report: string | null }>(env.founder, 'select status, error, report from ward.workflows where id = $1', [id]);
    expect(wf.status).toBe('failed');
    expect(wf.error).toMatch(/no_provider_configured/);
    expect(wf.report).toBeNull();
  });
});
