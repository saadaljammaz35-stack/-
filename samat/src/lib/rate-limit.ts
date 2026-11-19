import 'server-only';
import { headers } from 'next/headers';
import { adminDb } from '@/lib/supabase/admin';
import { AppError } from '@/lib/errors';
import { createHash } from 'node:crypto';

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? 'local').trim();
}

/**
 * Fixed-window limiter stored in Postgres so it holds across serverless instances.
 * Keys are hashed so raw IPs / phone numbers are not stored.
 */
export async function rateLimit(bucket: string, id: string, max: number, windowSeconds: number): Promise<void> {
  const key = `${bucket}:${createHash('sha256').update(id).digest('hex').slice(0, 32)}`;
  const { data, error } = await adminDb().rpc('rate_limit_hit', { p_key: key, p_window_seconds: windowSeconds, p_max: max });
  if (error) {
    console.error('[rate-limit]', error.message);
    return; // fail open on infrastructure errors, never on logic
  }
  if (data === false) throw new AppError('rate_limited', 429);
}
