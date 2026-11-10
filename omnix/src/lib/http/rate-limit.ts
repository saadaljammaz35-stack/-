import "server-only";
import { withAnon } from "@/lib/db/pool";
import { AppError } from "./errors";

export interface RateLimitRule {
  name: string;
  limit: number;
  windowSec: number;
}

/**
 * Sliding-window approximation over two fixed windows, stored in PostgreSQL
 * so every instance shares the count:
 *   estimate = previous * (1 - elapsedFraction) + current
 * This avoids the classic fixed-window boundary burst (2x the limit in a
 * moment straddling two windows).
 */
export async function enforceRateLimit(rule: RateLimitRule, subject: string): Promise<{ remaining: number }> {
  const now = Date.now();
  const windowMs = rule.windowSec * 1000;
  const currentStart = Math.floor(now / windowMs) * windowMs;
  const prevStart = currentStart - windowMs;
  const key = `${rule.name}:${subject}`.slice(0, 200);
  const { current, previous } = await withAnon(async (db) => {
    const cur = await db.query<{ hits: number }>(
      `INSERT INTO rate_limit_buckets (bucket_key, window_start, hits) VALUES ($1, to_timestamp($2 / 1000.0), 1)
       ON CONFLICT (bucket_key, window_start) DO UPDATE SET hits = rate_limit_buckets.hits + 1
       RETURNING hits`,
      [key, currentStart],
    );
    const prev = await db.query<{ hits: number }>(
      "SELECT hits FROM rate_limit_buckets WHERE bucket_key = $1 AND window_start = to_timestamp($2 / 1000.0)",
      [key, prevStart],
    );
    if (Math.random() < 0.01) {
      await db.query("DELETE FROM rate_limit_buckets WHERE window_start < now() - interval '1 day'");
    }
    return { current: cur.rows[0]!.hits, previous: prev.rows[0]?.hits ?? 0 };
  });
  const elapsed = (now - currentStart) / windowMs;
  const estimate = previous * (1 - elapsed) + current;
  if (estimate > rule.limit) {
    const retryAfter = Math.max(1, Math.ceil((currentStart + windowMs - now) / 1000));
    throw new AppError("RATE_LIMITED", "Too many requests", { headers: { "Retry-After": String(retryAfter) } });
  }
  return { remaining: Math.max(0, Math.floor(rule.limit - estimate)) };
}
