import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';
import { drainQueue } from '@/lib/queue/worker';

export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = env().CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Durable-job pump for serverless hosts (e.g. Vercel Cron): scheduler tick + queue drain. */
async function handler(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const result = await drainQueue({ maxMs: 240_000 });
  return NextResponse.json(result);
}
export const GET = handler;
export const POST = handler;
