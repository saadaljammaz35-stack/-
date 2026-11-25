import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';
import { getDb } from '@/lib/db';
import { migrate } from '@/lib/db/migrate';
import { seed } from '@/lib/seed';

export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = env().CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * One-shot bootstrap for hosts where the database is only reachable from the app itself
 * (e.g. Vercel + Neon/Supabase): applies pending migrations and the idempotent seed.
 * Protected by CRON_SECRET; safe to call again (it only does what is missing).
 */
export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const e = env();
  const db = await getDb();
  const applied = await migrate(db);
  const founder = e.WARD_FOUNDER_EMAIL && e.WARD_FOUNDER_PASSWORD ? { email: e.WARD_FOUNDER_EMAIL, password: e.WARD_FOUNDER_PASSWORD, name: e.WARD_FOUNDER_NAME } : null;
  const result = await seed({ orgSlug: e.WARD_ORG_SLUG, founder });
  return NextResponse.json({ applied, created: result.created.length, founder: Boolean(result.founderId) });
}
