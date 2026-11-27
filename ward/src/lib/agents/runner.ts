import type { ZodType } from 'zod';
import { json, withOrg, type OrgContext, type Queryable } from '@/lib/db';
import { getSettings, type ProviderId, type Settings } from '@/lib/settings';
import { complete, streamComplete } from '@/lib/ai/gateway';
import { makeGuard, makeRecorder, type BudgetScope } from '@/lib/ai/budget';
import type { ChatMessage } from '@/lib/ai/types';
import { AGENT_BY_SLUG, buildSystemPrompt, type AgentSlug } from '@/lib/agents/definitions';
import { executeTool, toolSpecs } from '@/lib/agents/tools';

export class RunCancelledError extends Error {
  constructor() {
    super('cancelled');
  }
}

export interface LoadedAgent {
  id: string;
  slug: AgentSlug;
  name: string;
  status: string;
  instructions: string;
  provider: ProviderId | null;
  model: string | null;
  economyModel: string | null;
  temperature: number;
  maxToolIterations: number;
  maxOutputTokens: number;
  allowedTools: string[];
  memories: string[];
}

export async function loadAgent(q: Queryable, slug: AgentSlug): Promise<LoadedAgent> {
  const row = (await q.query<{
    id: string; slug: AgentSlug; name: string; status: string; instructions: string; provider: ProviderId | null; model: string | null;
    economy_model: string | null; temperature: string | number; max_tool_iterations: number; max_output_tokens: number; allowed_tools: string[];
  }>(
    `select a.id, a.slug, a.name, a.status, a.instructions, c.provider, c.model, c.economy_model, c.temperature,
            c.max_tool_iterations, c.max_output_tokens, c.allowed_tools
       from ward.ai_agents a join ward.agent_configs c on c.agent_id = a.id where a.slug = $1`,
    [slug],
  ))[0];
  if (!row) throw new Error(`agent_not_found:${slug}`);
  const memories = await q.query<{ content: string }>(
    'select content from ward.agent_memories where agent_id = $1 order by created_at desc limit 8',
    [row.id],
  );
  // The allowlist in the database can only narrow the built-in definition, never widen it.
  const builtIn = AGENT_BY_SLUG[slug].tools;
  return {
    id: row.id, slug: row.slug, name: row.name, status: row.status, instructions: row.instructions,
    provider: row.provider, model: row.model, economyModel: row.economy_model, temperature: Number(row.temperature),
    maxToolIterations: row.max_tool_iterations, maxOutputTokens: row.max_output_tokens,
    allowedTools: (row.allowed_tools ?? []).filter((t) => builtIn.includes(t)),
    memories: memories.map((m) => m.content),
  };
}

export interface RunAgentInput {
  ctx: OrgContext;
  agent: AgentSlug;
  purpose: string;
  task: string;
  tier?: 'standard' | 'economy';
  useTools?: boolean;
  maxIterations?: number;
  workflowId?: string | null;
  stepId?: string | null;
  meetingId?: string | null;
  capUsd?: BudgetScope['capUsd'];
  isCancelled?: () => Promise<boolean>;
}

export interface RunAgentResult {
  runId: string;
  output: string;
  approvals: string[];
  iterations: number;
}

const HARD_MAX_ITERATIONS = 12;

/**
 * One agent working on one task: model ↔ tools loop with a hard iteration ceiling.
 * On the last allowed iteration tools are withdrawn so the agent must answer — the loop
 * cannot run forever, whatever the model does.
 */
export async function runAgent(input: RunAgentInput): Promise<RunAgentResult> {
  const agentCtx: OrgContext = { ...input.ctx, role: 'agent' };
  const { agent, settings, runId } = await withOrg(input.ctx, async (q) => {
    const agent = await loadAgent(q, input.agent);
    if (agent.status === 'disabled' || agent.status === 'paused') throw new Error(`agent_unavailable:${agent.slug}:${agent.status}`);
    const settings: Settings = await getSettings(q, input.ctx.orgId);
    const run = await q.query<{ id: string }>(
      `insert into ward.agent_runs (org_id, agent_id, workflow_id, step_id, meeting_id, purpose) values ($1,$2,$3,$4,$5,$6) returning id`,
      [input.ctx.orgId, agent.id, input.workflowId ?? null, input.stepId ?? null, input.meetingId ?? null, input.purpose],
    );
    await q.query(`update ward.ai_agents set status = 'working' where id = $1 and status = 'idle'`, [agent.id]);
    return { agent, settings, runId: run[0]!.id };
  });

  const system = buildSystemPrompt(AGENT_BY_SLUG[agent.slug], { instructions: agent.instructions, memories: agent.memories, voice: settings['agents.voice'] });
  const useTools = input.useTools !== false && agent.allowedTools.length > 0;
  const specs = useTools ? toolSpecs(agent.allowedTools) : [];
  const maxIterations = Math.min(input.maxIterations ?? agent.maxToolIterations, agent.maxToolIterations, HARD_MAX_ITERATIONS);
  const scope: BudgetScope = {
    purpose: input.purpose, workflowId: input.workflowId, meetingId: input.meetingId, agentRunId: runId, agentId: agent.id, capUsd: input.capUsd,
  };
  const guard = makeGuard(input.ctx, scope);
  const record = makeRecorder(input.ctx, scope);
  const toolEnv = { ctx: agentCtx, agentId: agent.id, agentSlug: agent.slug, agentRunId: runId, workflowId: input.workflowId ?? null };

  const messages: ChatMessage[] = [{ role: 'user', content: input.task }];
  const log = (role: string, content: string, extra: { toolCalls?: unknown; toolCallId?: string } = {}) =>
    withOrg(input.ctx, (q) =>
      q.query(
        `insert into ward.agent_messages (org_id, agent_run_id, role, content, tool_calls, tool_call_id) values ($1,$2,$3,$4,$5::jsonb,$6)`,
        [input.ctx.orgId, runId, role, content.slice(0, 60_000), extra.toolCalls ? json(extra.toolCalls) : null, extra.toolCallId ?? null],
      ),
    );

  const approvals: string[] = [];
  let iterations = 0;
  try {
    await log('system', system);
    await log('user', input.task);
    let output: string | null = null;
    for (let i = 0; i < maxIterations; i++) {
      if (input.isCancelled && (await input.isCancelled())) throw new RunCancelledError();
      const last = i === maxIterations - 1;
      if (last && useTools && i > 0) {
        const nudge = 'وصلت إلى الحد الأقصى لخطوات الأدوات. اكتب الإجابة النهائية الآن دون استدعاء أي أداة، واذكر ما لم يكتمل.';
        messages.push({ role: 'user', content: nudge });
        await log('user', nudge);
      }
      iterations = i + 1;
      const result = await complete({
        settings,
        tier: input.tier ?? 'standard',
        prefer: { provider: agent.provider, model: agent.model, economyModel: agent.economyModel },
        request: {
          system,
          messages,
          // The tool list stays identical across the loop (changing it invalidates earlier
          // thinking blocks); on the last iteration the model is told not to call any.
          tools: useTools ? specs : undefined,
          toolChoice: useTools && last ? 'none' : undefined,
          maxTokens: agent.maxOutputTokens,
          temperature: agent.temperature,
        },
        guard,
        record,
      });
      messages.push({ role: 'assistant', content: result.text, toolCalls: result.toolCalls, raw: result.raw });
      await log('assistant', result.text, { toolCalls: result.toolCalls.length ? result.toolCalls : undefined });

      if (result.toolCalls.length === 0 || last) {
        output = result.text.trim();
        break;
      }
      for (const call of result.toolCalls.slice(0, 6)) {
        const outcome = await executeTool(toolEnv, agent.allowedTools, call.name, call.args);
        if (outcome.approvalId) approvals.push(outcome.approvalId);
        const content = JSON.stringify(outcome.result ?? null).slice(0, 8000);
        messages.push({ role: 'tool', toolCallId: call.id, name: call.name, content });
        await log('tool', content, { toolCallId: call.id });
      }
    }
    if (!output) throw new Error('agent_returned_no_output');

    await withOrg(input.ctx, async (q) => {
      await q.query(`update ward.agent_runs set status = 'completed', iterations = $2, finished_at = now() where id = $1`, [runId, iterations]);
      await q.query(`update ward.ai_agents set status = 'idle' where id = $1 and status = 'working'`, [agent.id]);
    });
    return { runId, output, approvals, iterations };
  } catch (err) {
    const cancelled = err instanceof RunCancelledError;
    await withOrg(input.ctx, async (q) => {
      await q.query(`update ward.agent_runs set status = $2, error = $3, iterations = $4, finished_at = now() where id = $1`, [
        runId, cancelled ? 'cancelled' : 'failed', err instanceof Error ? err.message.slice(0, 1000) : String(err), iterations,
      ]);
      await q.query(`update ward.ai_agents set status = 'idle' where id = $1 and status = 'working'`, [agent.id]);
    });
    throw err;
  }
}

/** Direct conversation with one agent (no tools), streamed token by token to the founder. */
export async function* streamAgentChat(ctx: OrgContext, slug: AgentSlug, history: ChatMessage[]): AsyncGenerator<string> {
  const { agent, settings } = await withOrg(ctx, async (q) => ({ agent: await loadAgent(q, slug), settings: await getSettings(q, ctx.orgId) }));
  const scope: BudgetScope = { purpose: 'chat', agentId: agent.id };
  const system = buildSystemPrompt(AGENT_BY_SLUG[agent.slug], { instructions: agent.instructions, memories: agent.memories, voice: settings['agents.voice'] });
  for await (const ev of streamComplete({
    settings,
    tier: 'standard',
    prefer: { provider: agent.provider, model: agent.model, economyModel: agent.economyModel },
    request: { system, messages: history.slice(-20), maxTokens: agent.maxOutputTokens, temperature: agent.temperature },
    guard: makeGuard(ctx, scope),
    record: makeRecorder(ctx, scope),
  })) {
    if (ev.type === 'text') yield ev.delta;
  }
}

/**
 * A single structured call made "as" an agent (planning, review, meeting synthesis).
 * Logged as an agent run like any other, validated against a schema, no tools.
 */
export async function runAgentStructured<T>(input: {
  ctx: OrgContext;
  agent: AgentSlug;
  purpose: string;
  task: string;
  name: string;
  schema: ZodType<T>;
  tier?: 'standard' | 'economy';
  workflowId?: string | null;
  meetingId?: string | null;
  capUsd?: BudgetScope['capUsd'];
  maxTokens?: number;
}): Promise<{ data: T; runId: string }> {
  const { completeJson } = await import('@/lib/ai/gateway');
  const { agent, settings, runId } = await withOrg(input.ctx, async (q) => {
    const agent = await loadAgent(q, input.agent);
    if (agent.status === 'disabled' || agent.status === 'paused') throw new Error(`agent_unavailable:${agent.slug}:${agent.status}`);
    const settings = await getSettings(q, input.ctx.orgId);
    const run = await q.query<{ id: string }>(
      `insert into ward.agent_runs (org_id, agent_id, workflow_id, meeting_id, purpose) values ($1,$2,$3,$4,$5) returning id`,
      [input.ctx.orgId, agent.id, input.workflowId ?? null, input.meetingId ?? null, input.purpose],
    );
    return { agent, settings, runId: run[0]!.id };
  });
  const scope: BudgetScope = { purpose: input.purpose, workflowId: input.workflowId, meetingId: input.meetingId, agentRunId: runId, agentId: agent.id, capUsd: input.capUsd };
  const system = buildSystemPrompt(AGENT_BY_SLUG[agent.slug], { instructions: agent.instructions, memories: agent.memories, voice: settings['agents.voice'] });
  try {
    const { data, result } = await completeJson({
      settings,
      tier: input.tier ?? 'standard',
      prefer: { provider: agent.provider, model: agent.model, economyModel: agent.economyModel },
      request: { system, messages: [{ role: 'user', content: input.task }], maxTokens: input.maxTokens ?? Math.max(agent.maxOutputTokens, 3000), temperature: Math.min(agent.temperature, 0.4) },
      guard: makeGuard(input.ctx, scope),
      record: makeRecorder(input.ctx, scope),
      name: input.name,
      schema: input.schema,
    });
    await withOrg(input.ctx, async (q) => {
      await q.query(
        `insert into ward.agent_messages (org_id, agent_run_id, role, content) values ($1,$2,'user',$3), ($1,$2,'assistant',$4)`,
        [input.ctx.orgId, runId, input.task.slice(0, 60_000), result.text.slice(0, 60_000)],
      );
      await q.query(`update ward.agent_runs set status = 'completed', iterations = 1, finished_at = now() where id = $1`, [runId]);
    });
    return { data, runId };
  } catch (err) {
    await withOrg(input.ctx, (q) =>
      q.query(`update ward.agent_runs set status = 'failed', error = $2, finished_at = now() where id = $1`, [runId, err instanceof Error ? err.message.slice(0, 1000) : String(err)]),
    );
    throw err;
  }
}
