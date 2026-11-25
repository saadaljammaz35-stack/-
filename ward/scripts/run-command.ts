import './_env';
import { parseArgs } from 'node:util';
import { getDb, system, withOrg, type OrgContext } from '@/lib/db';
import { migrate } from '@/lib/db/migrate';
import { env } from '@/lib/env';
import { startWorkflow, TERMINAL, type WorkflowStatus } from '@/lib/orchestrator';
import { drainQueue } from '@/lib/queue/worker';

/**
 * Run one founder command headlessly (same orchestrator, queue and limits as the dashboard),
 * print the execution log as it happens, then the final report.
 *   npm run command -- --limit 1.5 "جهز الحلقة القادمة مع ضيف متخصص في ريادة الأعمال"
 */
const { values, positionals } = parseArgs({ allowPositionals: true, options: { limit: { type: 'string' } } });
const command = positionals.join(' ').trim();
if (command.length < 3) throw new Error('Usage: npm run command -- [--limit <usd>] "<command>"');

const db = await getDb();
await migrate(db);
const owner = await system(async (q) =>
  (await q.query<{ org_id: string; user_id: string }>(
    `select o.id as org_id, m.user_id from ward.organizations o
       join ward.organization_members m on m.org_id = o.id and m.role = 'owner'
      where o.slug = $1 limit 1`,
    [env().WARD_ORG_SLUG],
  ))[0],
);
if (!owner) throw new Error('No founder account: run `npm run founder:create` first.');
const ctx: OrgContext = { orgId: owner.org_id, userId: owner.user_id, role: 'owner' };

const id = await startWorkflow(ctx, { command, costLimitUsd: values.limit ? Number(values.limit) : undefined });
console.info(`run ${id}`);
let lastEvent = 0;
const started = Date.now();
for (;;) {
  await drainQueue({ maxMs: 60_000, tick: false });
  const { status, events } = await withOrg(ctx, async (q) => ({
    status: (await q.query<{ status: WorkflowStatus }>('select status from ward.workflows where id = $1', [id]))[0]!.status,
    events: await q.query<{ id: number; kind: string; step_key: string | null; message: string }>(
      'select id, kind, step_key, message from ward.workflow_events where workflow_id = $1 and id > $2 order by id',
      [id, lastEvent],
    ),
  }));
  for (const e of events) {
    lastEvent = Number(e.id);
    console.info(`  [${Math.round((Date.now() - started) / 1000)}s] ${e.kind}${e.step_key ? ` · ${e.step_key}` : ''}: ${e.message.slice(0, 160)}`);
  }
  if (TERMINAL.includes(status)) break;
  if (Date.now() - started > 30 * 60_000) throw new Error('timed out after 30 minutes');
  await new Promise((r) => setTimeout(r, 1500));
}

const summary = await withOrg(ctx, async (q) => ({
  wf: (await q.query<{ status: string; error: string | null; report: string | null; cost_usd: number; model_calls: number }>(
    'select status, error, report, cost_usd::float8, model_calls from ward.workflows where id = $1',
    [id],
  ))[0]!,
  approvals: await q.query<{ title: string; action_type: string; status: string }>('select title, action_type, status from ward.approvals where workflow_id = $1', [id]),
  usage: await q.query<{ model: string; calls: number; input: number; output: number; cost: number }>(
    `select model, count(*)::int as calls, sum(input_tokens)::int as input, sum(output_tokens)::int as output, sum(cost_usd)::float8 as cost
       from ward.model_usage where workflow_id = $1 and ok group by model`,
    [id],
  ),
}));
console.info(`\nstatus: ${summary.wf.status}${summary.wf.error ? ` — ${summary.wf.error}` : ''}`);
console.info(`cost: $${summary.wf.cost_usd.toFixed(4)} over ${summary.wf.model_calls} model calls`);
for (const u of summary.usage) console.info(`  ${u.model}: ${u.calls} calls, ${u.input} in / ${u.output} out tokens, $${u.cost.toFixed(4)}`);
for (const a of summary.approvals) console.info(`approval: [${a.action_type}] ${a.title} — ${a.status}`);
if (summary.wf.report) console.info(`\n${summary.wf.report}`);
await db.close();
