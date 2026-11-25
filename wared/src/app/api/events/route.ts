import { NextResponse } from 'next/server';
import { publicEnv } from '@/lib/env';
import { rateLimit } from '@/lib/security/rate-limit';
import { getRequestMeta } from '@/lib/security/request';
import { isSameOrigin } from '@/lib/security/origin';
import { getServiceClient } from '@/lib/supabase/admin';
import { analyticsEventSchema } from '@/lib/validation/public';

export const dynamic = 'force-dynamic';

function referrerHost(referrer: string | undefined): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).host.toLowerCase();
    return host && host !== new URL(publicEnv.siteUrl).host ? host.slice(0, 120) : null;
  } catch {
    return null;
  }
}

/** First-party analytics. Stores no IP address, no cookies and no user agent string. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new NextResponse(null, { status: 403 });
  const body = await request.json().catch(() => null);
  const parsed = analyticsEventSchema.safeParse(body);
  if (!parsed.success) return new NextResponse(null, { status: 400 });

  const meta = await getRequestMeta();
  if (meta.device === 'other' && parsed.data.type === 'page_view') return new NextResponse(null, { status: 204 });
  if (!(await rateLimit(`events:${meta.ipHash}`, 240, 60))) return new NextResponse(null, { status: 429 });

  const db = getServiceClient();
  if (!db) return new NextResponse(null, { status: 204 });
  const e = parsed.data;
  const { error } = await db.from('analytics_events').insert({
    event_type: e.type,
    path: e.path ?? null,
    locale: e.locale ?? null,
    episode_id: e.episodeId ?? null,
    article_id: e.articleId ?? null,
    clip_id: e.clipId ?? null,
    listener_id: meta.optOut ? null : (e.listenerId ?? null),
    value: e.value ?? null,
    referrer_host: referrerHost(e.referrer),
    device: meta.device,
    country: meta.country,
  });
  if (error) console.error('[events] insert failed', error.message);
  return new NextResponse(null, { status: 204 });
}
