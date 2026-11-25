import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { withOrg } from '@/lib/db';
import { getSettings, setSetting } from '@/lib/settings';
import { startWorkflow, advanceWorkflow } from '@/lib/orchestrator';
import { runAgent } from '@/lib/agents/runner';
import { setAgentsPaused } from '@/lib/killswitch';
import { startMeeting, runMeeting } from '@/lib/meetings';
import { addMember, install, q1, ScriptedProvider, setPrice, setupDb, teardown, toolCall, type TestEnv } from './helpers';

const plan = {
  title: 'خطة', analysis: 'تحليل كافٍ للخطة',
  steps: [{ key: 'a', agent: 'editorial', title: 'خطوة', instructions: 'نفذ المهمة المطلوبة', depends_on: [], complexity: 'standard' }],
};

describe('spend limits', () => {
  let env: TestEnv;
  beforeEach(async () => {
    env = await setupDb();
  });
  afterEach(() => teardown(env));

  it('refuses a call whose worst-case estimate would exceed the workflow limit (before spending)', async () => {
    const p = install(new ScriptedProvider('anthropic', () => ({ text: JSON.stringify(plan) })));
    const id = await startWorkflow(env.founder, { command: 'أمر مكلف', costLimitUsd: 0.01 });
    await advanceWorkflow(env.orgId, id);
    const wf = await q1<{ status: string; error: string; cost_usd: number }>(env.founder, 'select status, error, cost_usd::float8 from ward.workflows where id = $1', [id]);
    expect(wf.status).toBe('failed');
    expect(wf.error).toMatch(/cost_limit_exceeded:workflow/);
    expect(p.calls).toHaveLength(0); // nothing was sent to the provider
    expect(wf.cost_usd).toBe(0);
  });

  it('stops a workflow once real spending reaches its limit', async () => {
    // Verified price: input free, output $50/M tokens. Each reply uses 2,000 output tokens
    // (under every request's max_tokens, as a real provider must) → $0.10 per call.
    // The guard checks the worst case (max_tokens) BEFORE each call, so spend never passes the limit.
    await setPrice(env, 'claude-sonnet-5-5', 0, 50);
    const p = install(
      new ScriptedProvider('anthropic', (req) => {
        expect(req.maxTokens).toBeGreaterThanOrEqual(2000);
        if (req.responseSchema?.name === 'workflow_plan') return { text: JSON.stringify(plan), inputTokens: 0, outputTokens: 2000 };
        return { toolCalls: [toolCall('search_knowledge', { query: 'وارد' })], inputTokens: 0, outputTokens: 2000 };
      }),
    );
    const id = await startWorkflow(env.founder, { command: 'أمر', costLimitUsd: 0.25 });
    await advanceWorkflow(env.orgId, id);
    const wf = await q1<{ status: string; error: string; cost_usd: number }>(env.founder, 'select status, error, cost_usd::float8 from ward.workflows where id = $1', [id]);
    expect(wf.status).toBe('failed');
    expect(wf.error).toMatch(/cost_limit_exceeded:workflow/);
    expect(wf.cost_usd).toBeLessThanOrEqual(0.25 + 1e-9);
    expect(p.calls.length).toBeLessThanOrEqual(3);
  });

  it('enforces the organization daily limit across workflows', async () => {
    await withOrg(env.founder, (q) => setSetting(q, env.orgId, 'limits.daily_usd', 0.001, env.founderId));
    const p = install(new ScriptedProvider('anthropic', () => ({ text: JSON.stringify(plan) })));
    const id = await startWorkflow(env.founder, { command: 'أمر' });
    await advanceWorkflow(env.orgId, id);
    expect((await q1<{ error: string }>(env.founder, 'select error from ward.workflows where id = $1', [id])).error).toMatch(/cost_limit_exceeded:daily/);
    expect(p.calls).toHaveLength(0);
  });

  it('enforces an agent’s own daily budget', async () => {
    await withOrg(env.founder, (q) => q.query(`update ward.agent_configs set daily_budget_usd = 0.0001 where agent_id = (select id from ward.ai_agents where slug = 'finance')`));
    install(new ScriptedProvider('anthropic', () => ({ text: 'x' })));
    await expect(runAgent({ ctx: env.founder, agent: 'finance', purpose: 'test', task: 'لخص الميزانية' })).rejects.toThrow(/cost_limit_exceeded:agent_daily/);
  });

  it('caps meeting cost', async () => {
    await withOrg(env.founder, (q) => setSetting(q, env.orgId, 'limits.meeting_usd', 0.01, env.founderId));
    const p = install(new ScriptedProvider('anthropic', () => ({ text: 'رأي' })));
    const id = await startMeeting(env.founder, { topic: 'خطة الإطلاق', agents: ['marketing', 'finance'], rounds: 2 });
    await runMeeting(env.orgId, id);
    const m = await q1<{ status: string; error: string; cost_usd: number }>(env.founder, 'select status, error, cost_usd::float8 from ward.meetings where id = $1', [id]);
    // The cheap economy turns fit under the cap; the next call's worst case would not, so it is never sent.
    expect(m.status).toBe('failed');
    expect(m.error).toMatch(/cost_limit_exceeded:meeting/);
    expect(m.cost_usd).toBeLessThanOrEqual(0.01);
    expect(p.calls.length).toBeLessThan(5); // 4 turns + synthesis would be 5
  });
});

describe('no unbounded agent loops', () => {
  let env: TestEnv;
  beforeEach(async () => {
    env = await setupDb();
  });
  afterEach(() => teardown(env));

  it('forbids tool calls on the last iteration so an agent that keeps calling tools must stop', async () => {
    const p = install(
      new ScriptedProvider('anthropic', (req) =>
        req.toolChoice !== 'none' ? { toolCalls: [toolCall('search_knowledge', { query: 'مرة أخرى' })] } : { text: 'الإجابة النهائية بعد الحد' },
      ),
    );
    const r = await runAgent({ ctx: env.founder, agent: 'chief', purpose: 'test', task: 'ابحث بلا توقف' });
    expect(r.output).toBe('الإجابة النهائية بعد الحد');
    expect(r.iterations).toBe(6);
    expect(p.calls).toHaveLength(6);
    // Same tool list on every call (changing it would invalidate earlier thinking blocks)…
    expect(p.calls.every((c) => c.tools?.length === p.calls[0]!.tools!.length)).toBe(true);
    // …and only the last call forbids using them.
    expect(p.calls.map((c) => c.toolChoice ?? 'auto')).toEqual(['auto', 'auto', 'auto', 'auto', 'auto', 'none']);
    const tools = await q1<{ n: number }>(env.founder, `select count(*)::int as n from ward.agent_tool_calls where agent_run_id = $1`, [r.runId]);
    expect(tools.n).toBe(5);
  });

  it('terminates even if a model ignores the withdrawal and returns no answer', async () => {
    const p = install(new ScriptedProvider('anthropic', () => ({ toolCalls: [toolCall('search_knowledge', { query: 'x' })] })));
    await expect(runAgent({ ctx: env.founder, agent: 'chief', purpose: 'test', task: 'x', maxIterations: 3 })).rejects.toThrow(/agent_returned_no_output/);
    expect(p.calls).toHaveLength(3);
  });

  it('denies tools outside the agent’s allowlist and logs the denial', async () => {
    install(
      new ScriptedProvider('anthropic', (req) =>
        req.messages.some((m) => m.role === 'tool') ? { text: 'لا أستطيع' } : { toolCalls: [toolCall('request_spend', { amount: 500, purpose: 'معدات تصوير' })] },
      ),
    );
    // Review has no approval-request tools at all.
    const r = await runAgent({ ctx: env.founder, agent: 'review', purpose: 'test', task: 'اصرف 500' });
    const call = await q1<{ status: string }>(env.founder, 'select status from ward.agent_tool_calls where agent_run_id = $1', [r.runId]);
    expect(call.status).toBe('denied');
    const n = await q1<{ n: number }>(env.founder, 'select count(*)::int as n from ward.approvals');
    expect(n.n).toBe(0);
  });

  it('a finance request to spend creates a pending expense and approval, never a payment', async () => {
    install(
      new ScriptedProvider('anthropic', (req) =>
        req.messages.some((m) => m.role === 'tool') ? { text: 'طلبت الموافقة' } : { toolCalls: [toolCall('request_spend', { amount: 450, purpose: 'استئجار مايكروفونين', category: 'equipment' })] },
      ),
    );
    await runAgent({ ctx: env.founder, agent: 'finance', purpose: 'test', task: 'نحتاج مايكات' });
    const x = await q1<{ status: string; amount: number }>(env.founder, 'select status, amount::float8 from ward.expenses');
    expect(x).toEqual({ status: 'pending_approval', amount: 450 });
    const a = await q1<{ action_type: string; status: string; estimated_cost: number }>(env.founder, 'select action_type, status, estimated_cost::float8 from ward.approvals');
    expect(a).toEqual({ action_type: 'spend_money', status: 'pending', estimated_cost: 450 });
  });
});

describe('kill switch', () => {
  let env: TestEnv;
  beforeEach(async () => {
    env = await setupDb();
  });
  afterEach(() => teardown(env));

  it('cancels queued work, blocks new runs and model calls, and only admins/owner may use it', async () => {
    const p = install(new ScriptedProvider('anthropic', () => ({ text: JSON.stringify(plan) })));
    const id = await startWorkflow(env.founder, { command: 'أمر قبل الإيقاف' });
    const editor = await addMember(env, 'ed@ward.test', 'editor');
    await expect(setAgentsPaused(editor, true)).rejects.toThrow(/kill_switch/);

    const r = await setAgentsPaused(env.founder, true);
    expect(r.cancelledRuns).toBe(1);
    expect((await q1<{ status: string; error: string }>(env.founder, 'select status, error from ward.workflows where id = $1', [id]))).toEqual({ status: 'cancelled', error: 'kill_switch' });
    await expect(startWorkflow(env.founder, { command: 'أمر جديد' })).rejects.toThrow(/agents_paused/);
    await expect(runAgent({ ctx: env.founder, agent: 'chief', purpose: 'x', task: 'x' })).rejects.toThrow(/agents_paused/);
    expect(p.calls).toHaveLength(0);

    await setAgentsPaused(env.founder, false);
    expect((await withOrg(env.founder, (q) => getSettings(q, env.orgId))).agents_paused).toBe(false);
    await expect(startWorkflow(env.founder, { command: 'بعد الاستئناف' })).resolves.toBeTypeOf('string');
  });
});
