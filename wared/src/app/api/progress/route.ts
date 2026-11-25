import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimit } from '@/lib/security/rate-limit';
import { getRequestMeta } from '@/lib/security/request';
import { isSameOrigin } from '@/lib/security/origin';
import { getServiceClient } from '@/lib/supabase/admin';
import { progressSchema } from '@/lib/validation/public';

export const dynamic = 'force-dynamic';

/** Listening progress keyed by an anonymous listener id generated in the browser. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = z.object({ listenerId: z.uuid(), episodeId: z.uuid() }).safeParse({
    listenerId: params.get('listenerId'),
    episodeId: params.get('episodeId'),
  });
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const db = getServiceClient();
  if (!db) return NextResponse.json({ position: null }, { headers: { 'Cache-Control': 'no-store' } });
  const { data } = await db
    .from('listening_progress')
    .select('position_seconds, completed')
    .eq('listener_id', parsed.data.listenerId)
    .eq('episode_id', parsed.data.episodeId)
    .maybeSingle();
  return NextResponse.json(
    { position: data?.position_seconds ?? null, completed: data?.completed ?? false },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new NextResponse(null, { status: 403 });
  const parsed = progressSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 400 });
  const meta = await getRequestMeta();
  if (meta.optOut) return new NextResponse(null, { status: 204 });
  if (!(await rateLimit(`progress:${meta.ipHash}`, 120, 60))) return new NextResponse(null, { status: 429 });
  const db = getServiceClient();
  if (!db) return new NextResponse(null, { status: 204 });
  const p = parsed.data;
  const { error } = await db.from('listening_progress').upsert(
    {
      listener_id: p.listenerId,
      episode_id: p.episodeId,
      position_seconds: Math.floor(p.position),
      duration_seconds: p.duration ? Math.floor(p.duration) : null,
      completed: p.completed ?? false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'listener_id,episode_id' },
  );
  if (error) console.error('[progress] upsert failed', error.message);
  return new NextResponse(null, { status: 204 });
}
