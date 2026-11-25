import { json, system, type Queryable } from '@/lib/db';

export type JobKind = 'workflow.advance' | 'meeting.run' | 'automation.run' | 'knowledge.index';

export interface Job {
  id: number;
  org_id: string;
  kind: JobKind;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
}

/**
 * Durable queue in Postgres. Jobs survive restarts and serverless timeouts: a job whose
 * worker died is reclaimed once its lock is older than LOCK_TIMEOUT. Nothing depends on
 * a browser tab staying open.
 */
export const LOCK_TIMEOUT_MINUTES = 6;

export async function enqueue(
  q: Queryable,
  orgId: string,
  kind: JobKind,
  payload: Record<string, unknown>,
  opts: { runAt?: Date; idempotencyKey?: string; maxAttempts?: number } = {},
): Promise<number | null> {
  const rows = await q.query<{ id: number }>(
    `insert into ward.jobs (org_id, kind, payload, run_at, idempotency_key, max_attempts)
     values ($1,$2,$3::jsonb, coalesce($4::timestamptz, now()), $5, $6)
     on conflict (idempotency_key) do nothing returning id`,
    [orgId, kind, json(payload), opts.runAt?.toISOString() ?? null, opts.idempotencyKey ?? null, opts.maxAttempts ?? 5],
  );
  return rows[0] ? Number(rows[0].id) : null;
}

export async function claimJobs(workerId: string, limit: number): Promise<Job[]> {
  return system(async (q) => {
    const rows = await q.query<Job>(
      `update ward.jobs set status = 'running', locked_at = now(), locked_by = $1, attempts = attempts + 1
        where id in (
          select id from ward.jobs
           where (status = 'queued' and run_at <= now())
              or (status = 'running' and locked_at < now() - make_interval(mins => $3::int))
           order by run_at
           limit $2
           for update skip locked)
        returning id, org_id, kind, payload, attempts, max_attempts`,
      [workerId, limit, LOCK_TIMEOUT_MINUTES],
    );
    return rows.map((r) => ({ ...r, id: Number(r.id) }));
  });
}

export async function finishJob(id: number): Promise<void> {
  await system((q) => q.query(`update ward.jobs set status = 'done', finished_at = now(), locked_at = null where id = $1`, [id]));
}

export async function failJob(job: Job, error: string, retryable = true): Promise<void> {
  await system((q) =>
    q.query(
      `update ward.jobs set
          status = case when $3 and attempts < max_attempts then 'queued' else 'dead' end,
          run_at = now() + make_interval(secs => least(600, 15 * power(2, attempts))::int),
          last_error = $2, locked_at = null,
          finished_at = case when $3 and attempts < max_attempts then null else now() end
        where id = $1`,
      [job.id, error.slice(0, 2000), retryable],
    ),
  );
}

export async function cancelJobsFor(q: Queryable, key: 'workflowId' | 'meetingId', id: string): Promise<void> {
  await q.query(`update ward.jobs set status = 'cancelled', finished_at = now() where status = 'queued' and payload->>$1 = $2`, [key, id]);
}
