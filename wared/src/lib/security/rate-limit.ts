import 'server-only';
import { getServiceClient } from '@/lib/supabase/admin';

const memory = new Map<string, { count: number; resetAt: number }>();

function memoryHit(key: string, limit: number, windowSeconds: number): boolean {
  const now = Date.now();
  const entry = memory.get(key);
  if (!entry || entry.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    if (memory.size > 10_000) {
      for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
    }
    return true;
  }
  entry.count += 1;
  return entry.count <= limit;
}

/**
 * Returns true when the request is allowed. Uses the database-backed limiter (shared across serverless
 * instances) when the service role is configured, and an in-memory limiter otherwise.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const db = getServiceClient();
  if (db) {
    const { data, error } = await db.rpc('hit_rate_limit', { p_key: key, p_limit: limit, p_window_seconds: windowSeconds });
    if (!error) return data === true;
    console.error('[rate-limit] falling back to memory limiter', error.message);
  }
  return memoryHit(key, limit, windowSeconds);
}

export function __resetMemoryLimiter() {
  memory.clear();
}
