import { timingSafeEqual } from 'node:crypto';
import { adminDb } from '@/lib/supabase/admin';
import { env } from '@/lib/env';
import { getReceiptData } from '@/lib/printing/receipt-data';

function authorized(req: Request): boolean {
  const got = req.headers.get('authorization') ?? '';
  const want = `Bearer ${env.printBridgeToken ?? ''}`;
  return Boolean(env.printBridgeToken) && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

/** The LAN print bridge (scripts/print-bridge.ts) pulls queued jobs here and reports results. */
export async function GET(req: Request) {
  if (!authorized(req)) return new Response('unauthorized', { status: 401 });
  const db = adminDb();
  const { data: jobs } = await db.from('printer_jobs').select('id, order_id, kind, format').eq('status', 'queued').eq('target', 'lan').order('created_at').limit(5);
  const out = [];
  for (const j of jobs ?? []) {
    const { data: claimed } = await db.from('printer_jobs').update({ status: 'printing' }).eq('id', j.id).eq('status', 'queued').select('id');
    if (!claimed?.length) continue;
    out.push({ id: j.id, format: j.format, receipt: await getReceiptData(j.order_id, j.kind) });
  }
  return Response.json({ jobs: out });
}

export async function POST(req: Request) {
  if (!authorized(req)) return new Response('unauthorized', { status: 401 });
  const { id, ok, error } = (await req.json()) as { id: string; ok: boolean; error?: string };
  await adminDb().from('printer_jobs').update({ status: ok ? 'done' : 'failed', error: error?.slice(0, 300) ?? null, completed_at: new Date().toISOString() }).eq('id', id).eq('status', 'printing');
  return Response.json({ ok: true });
}
