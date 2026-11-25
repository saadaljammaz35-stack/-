import { NextResponse } from 'next/server';
import { z } from 'zod';
import { timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';
import { getDb } from '@/lib/db';
import { migrate } from '@/lib/db/migrate';
import { seed } from '@/lib/seed';

export const maxDuration = 300;

const Body = z.object({
  founder_email: z.string().trim().toLowerCase().email().optional(),
  founder_password: z.string().min(12).max(200).optional(),
  founder_name: z.string().trim().min(1).max(120).optional(),
});

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
  // Founder credentials come from the request body (so they never need to live in the host's
  // environment) or, failing that, from WARD_FOUNDER_* variables. Existing accounts are untouched.
  const body = Body.safeParse(await req.json().catch(() => ({})));
  if (!body.success) return NextResponse.json({ error: 'validation_failed' }, { status: 400 });
  const b = body.data;
  const db = await getDb();
  const applied = await migrate(db);
  const founder = b.founder_email && b.founder_password
    ? { email: b.founder_email, password: b.founder_password, name: b.founder_name ?? e.WARD_FOUNDER_NAME }
    : e.WARD_FOUNDER_EMAIL && e.WARD_FOUNDER_PASSWORD ? { email: e.WARD_FOUNDER_EMAIL, password: e.WARD_FOUNDER_PASSWORD, name: e.WARD_FOUNDER_NAME } : null;
  const result = await seed({ orgSlug: e.WARD_ORG_SLUG, founder });
  return NextResponse.json({ applied, created: result.created.length, founder: Boolean(result.founderId) });
}
