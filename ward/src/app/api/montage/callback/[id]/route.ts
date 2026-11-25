import { NextResponse } from 'next/server';
import { system } from '@/lib/db';
import { scheduleQueue, type Params } from '@/lib/api';
import { acceptResult, callbackTokenMatches } from '@/lib/media/montage';
import type { RunnerResult } from '@/lib/media/exec';

export const maxDuration = 60;

/**
 * The media runner (in a Vercel Sandbox) posts its result here when it finishes, so the
 * montage moves on even if nobody has the page open. Authenticated by a one-time random
 * token per run (only its hash is stored); anything else gets the same 404.
 */
export async function POST(req: Request, ctx: Params<'id'>) {
  const { id } = await ctx.params;
  const token = new URL(req.url).searchParams.get('t');
  if (!/^[0-9a-f-]{36}$/.test(id) || !token) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const row = (await system((q) => q.query<{ org_id: string; hash: string | null }>(`select org_id, runner->>'callbackHash' as hash from ward.montage_projects where id = $1`, [id])))[0];
  if (!row || !callbackTokenMatches(row.hash ?? undefined, token)) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > 4_000_000) return NextResponse.json({ error: 'too_large' }, { status: 413 });
  let result: RunnerResult;
  try {
    result = (await req.json()) as RunnerResult;
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }
  if (!result || typeof result !== 'object') return NextResponse.json({ error: 'bad_result' }, { status: 400 });
  const accepted = await acceptResult(row.org_id, id, result);
  scheduleQueue();
  return NextResponse.json({ ok: true, accepted });
}
