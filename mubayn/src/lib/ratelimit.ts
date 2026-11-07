import { one } from "./db";
import { tooMany } from "./errors";

/**
 * Fixed-window rate limiting stored in PostgreSQL, so it holds across every
 * serverless instance (an in-memory limiter would reset per instance).
 */
export async function rateLimit(bucket: string, limit: number, windowSeconds: number): Promise<void> {
  const row = await one<{ hits: number; window_start: Date }>(
    `INSERT INTO rate_limits (bucket, window_start, hits)
     VALUES ($1, to_timestamp(floor(extract(epoch from now()) / $2) * $2), 1)
     ON CONFLICT (bucket, window_start) DO UPDATE SET hits = rate_limits.hits + 1
     RETURNING hits, window_start`,
    [bucket, windowSeconds],
  );
  if (row && row.hits > limit) {
    const retryAfter = Math.max(1, Math.ceil((row.window_start.getTime() + windowSeconds * 1000 - Date.now()) / 1000));
    throw tooMany(retryAfter);
  }
}

/** Housekeeping, called by the cron runner. */
export async function pruneRateLimits(): Promise<void> {
  await one(`DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'`);
}
