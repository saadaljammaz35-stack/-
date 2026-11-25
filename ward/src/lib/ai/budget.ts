import { json, num, withOrg, type OrgContext, type Queryable } from '@/lib/db';
import { getSettings, type Settings } from '@/lib/settings';
import { CostLimitError } from '@/lib/ai/types';
import type { Attempt } from '@/lib/ai/gateway';

export class AgentsPausedError extends Error {
  constructor() {
    super('agents_paused: تم إيقاف جميع الوكلاء من زر الإيقاف.');
  }
}

export async function spendSince(q: Queryable, orgId: string, unit: 'day' | 'month'): Promise<number> {
  const rows = await q.query<{ total: number }>(
    `select coalesce(sum(cost_usd), 0)::float8 as total from ward.model_usage
      where org_id = $1 and created_at >= date_trunc('${unit === 'day' ? 'day' : 'month'}', now())`,
    [orgId],
  );
  return num(rows[0]?.total);
}

export interface BudgetScope {
  purpose: string;
  workflowId?: string | null;
  meetingId?: string | null;
  agentRunId?: string | null;
  agentId?: string | null;
  /** Extra ceiling for this call chain (e.g. an automation's max cost). */
  capUsd?: { scope: 'automation'; limit: number; spent: () => Promise<number> };
}

/**
 * Checked before EVERY model call: kill switch, organization daily/monthly limits,
 * the workflow or meeting ceiling, and the agent's own daily budget.
 */
export function makeGuard(ctx: OrgContext, scope: BudgetScope) {
  return async (estimateUsd: number): Promise<void> => {
    await withOrg(ctx, async (q) => {
      const s: Settings = await getSettings(q, ctx.orgId);
      if (s.agents_paused) throw new AgentsPausedError();

      const daily = await spendSince(q, ctx.orgId, 'day');
      if (daily + estimateUsd > s['limits.daily_usd']) throw new CostLimitError('daily', s['limits.daily_usd'], daily + estimateUsd);
      const monthly = await spendSince(q, ctx.orgId, 'month');
      if (monthly + estimateUsd > s['limits.monthly_usd']) throw new CostLimitError('monthly', s['limits.monthly_usd'], monthly + estimateUsd);

      if (scope.workflowId) {
        const w = (await q.query<{ cost_usd: number; cost_limit_usd: number; model_calls: number; max_model_calls: number; status: string }>(
          'select cost_usd::float8, cost_limit_usd::float8, model_calls, max_model_calls, status from ward.workflows where id = $1',
          [scope.workflowId],
        ))[0];
        if (!w) throw new Error('workflow_not_found');
        if (w.status === 'cancelled') throw new Error('workflow_cancelled');
        if (w.model_calls >= w.max_model_calls) throw new CostLimitError('workflow', num(w.cost_limit_usd), num(w.cost_usd));
        if (num(w.cost_usd) + estimateUsd > num(w.cost_limit_usd)) throw new CostLimitError('workflow', num(w.cost_limit_usd), num(w.cost_usd) + estimateUsd);
      }
      if (scope.meetingId) {
        const m = (await q.query<{ cost_usd: number; cost_limit_usd: number; status: string }>(
          'select cost_usd::float8, cost_limit_usd::float8, status from ward.meetings where id = $1',
          [scope.meetingId],
        ))[0];
        if (!m) throw new Error('meeting_not_found');
        if (m.status === 'cancelled') throw new Error('meeting_cancelled');
        if (num(m.cost_usd) + estimateUsd > num(m.cost_limit_usd)) throw new CostLimitError('meeting', num(m.cost_limit_usd), num(m.cost_usd) + estimateUsd);
      }
      if (scope.agentId) {
        const a = (await q.query<{ budget: number | null; spent: number }>(
          `select c.daily_budget_usd::float8 as budget,
                  coalesce((select sum(r.cost_usd) from ward.agent_runs r
                             where r.agent_id = c.agent_id and r.started_at >= date_trunc('day', now())), 0)::float8 as spent
             from ward.agent_configs c where c.agent_id = $1`,
          [scope.agentId],
        ))[0];
        if (a && a.budget !== null && num(a.spent) + estimateUsd > num(a.budget)) {
          throw new CostLimitError('agent_daily', num(a.budget), num(a.spent) + estimateUsd);
        }
      }
    });
    if (scope.capUsd) {
      const spent = await scope.capUsd.spent();
      if (spent + estimateUsd > scope.capUsd.limit) throw new CostLimitError('automation', scope.capUsd.limit, spent + estimateUsd);
    }
  };
}

/** Records every attempt (successful or not) in model_usage and rolls cost up to its owners. */
export function makeRecorder(ctx: OrgContext, scope: BudgetScope) {
  return async (a: Attempt): Promise<void> => {
    await withOrg(ctx, async (q) => {
      await q.query(
        `insert into ward.model_usage (org_id, agent_run_id, workflow_id, meeting_id, provider, model, purpose,
                                       input_tokens, output_tokens, cost_usd, price_is_estimate, latency_ms, ok, error)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          ctx.orgId, scope.agentRunId ?? null, scope.workflowId ?? null, scope.meetingId ?? null, a.provider, a.model,
          scope.purpose, a.usage.inputTokens, a.usage.outputTokens, a.costUsd, !a.priceVerified, a.latencyMs, a.ok, a.error ?? null,
        ],
      );
      if (scope.workflowId) {
        await q.query('update ward.workflows set cost_usd = cost_usd + $2, model_calls = model_calls + 1 where id = $1', [scope.workflowId, a.costUsd]);
      }
      if (scope.meetingId) await q.query('update ward.meetings set cost_usd = cost_usd + $2 where id = $1', [scope.meetingId, a.costUsd]);
      if (scope.agentRunId && a.ok) {
        await q.query(
          `update ward.agent_runs set input_tokens = input_tokens + $2, output_tokens = output_tokens + $3,
                  cost_usd = cost_usd + $4, provider = $5, model = $6 where id = $1`,
          [scope.agentRunId, a.usage.inputTokens, a.usage.outputTokens, a.costUsd, a.provider, a.model],
        );
      }
      if (!a.ok && scope.workflowId) {
        await q.query(
          `insert into ward.workflow_events (org_id, workflow_id, kind, message, data) values ($1,$2,'provider_error',$3,$4::jsonb)`,
          [ctx.orgId, scope.workflowId, `${a.provider}/${a.model}: ${a.error ?? 'error'}`.slice(0, 500), json({ latencyMs: a.latencyMs })],
        );
      }
    });
  };
}
