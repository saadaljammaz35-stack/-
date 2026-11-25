import 'server-only';
import { publicEnv } from '@/lib/env';

/** Rejects cross-site POSTs to route handlers (server actions already get this check from Next.js). */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return request.headers.get('sec-fetch-site') !== 'cross-site';
  try {
    const originHost = new URL(origin).host;
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
    return originHost === host || originHost === new URL(publicEnv.siteUrl).host;
  } catch {
    return false;
  }
}
