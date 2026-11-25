import { system } from '@/lib/db';
import { HttpError } from '@/lib/http';

export interface RateResult {
  allowed: boolean;
  count: number;
  retryAfterSec: number;
}

/**
 * Fixed-window limiter stored in Postgres, so the limit holds across serverless
 * instances and restarts (an in-memory map would reset on every cold start).
 */
export async function hit(key: string, limit: number, windowSec: number): Promise<RateResult> {
  const row = await system(async (q) => {
    const rows = await q.query<{ count: number; age: number }>(
      `insert into ward.rate_limits (key, window_start, count) values ($1, now(), 1)
       on conflict (key) do update set
         count = case when ward.rate_limits.window_start < now() - make_interval(secs => $2::int) then 1
                      else ward.rate_limits.count + 1 end,
         window_start = case when ward.rate_limits.window_start < now() - make_interval(secs => $2::int) then now()
                      else ward.rate_limits.window_start end
       returning count, extract(epoch from now() - window_start)::int as age`,
      [key, windowSec],
    );
    return rows[0]!;
  });
  const count = Number(row.count);
  return { allowed: count <= limit, count, retryAfterSec: Math.max(1, windowSec - Number(row.age)) };
}

export async function enforce(key: string, limit: number, windowSec: number): Promise<void> {
  const r = await hit(key, limit, windowSec);
  if (!r.allowed) throw new HttpError(429, 'rate_limited', `Too many requests. Retry in ${r.retryAfterSec}s.`);
}

export async function resetLimit(key: string): Promise<void> {
  await system((q) => q.query('delete from ward.rate_limits where key = $1', [key]));
}

export const LIMITS = {
  loginPerIp: { limit: 20, windowSec: 15 * 60 },
  loginPerEmail: { limit: 5, windowSec: 15 * 60 },
  mutationPerUser: { limit: 240, windowSec: 60 },
  aiPerUser: { limit: 30, windowSec: 60 * 60 },
  uploadPerUser: { limit: 40, windowSec: 60 * 60 },
} as const;
