import { NextResponse } from 'next/server';
import { withOrg } from '@/lib/db';
import { notFound, route } from '@/lib/http';
import { requireApi } from '@/lib/auth/session';
import type { Params } from '@/lib/api';

/** Live status for the run page (polled while the run is active). */
export const GET = route<Params<'id'>>(async (req, ctx) => {
  const s = await requireApi(req, 'read');
  const { id } = await ctx.params;
  const data = await withOrg(s, async (q) => {
    const wf = (await q.query('select id, status, title, error, cost_usd::float8 as cost_usd, cost_limit_usd::float8 as cost_limit_usd, model_calls, updated_at from ward.workflows where id = $1', [id]))[0];
    if (!wf) throw notFound();
    const steps = await q.query(
      `select s.key, s.title, s.status, s.attempts, a.slug as agent from ward.workflow_steps s join ward.ai_agents a on a.id = s.agent_id where s.workflow_id = $1 order by s.position`,
      [id],
    );
    const events = await q.query('select id, kind, step_key, message, created_at from ward.workflow_events where workflow_id = $1 order by id desc limit 40', [id]);
    return { workflow: wf, steps, events };
  });
  return NextResponse.json(data);
});
