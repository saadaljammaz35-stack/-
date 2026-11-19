import { timingSafeEqual } from 'node:crypto';
import { adminDb } from '@/lib/supabase/admin';
import { env } from '@/lib/env';
import { retryFailedNotifications } from '@/lib/notify';
import { checkLowStock } from '@/lib/orders/service';

// Housekeeping for hosts without pg_cron (Vercel Cron calls this with "Authorization: Bearer CRON_SECRET").
export async function GET(req: Request) {
  const auth = req.headers.get('authorization') ?? '';
  const expected = `Bearer ${env.cronSecret ?? ''}`;
  if (!env.cronSecret || auth.length !== expected.length || !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) {
    return new Response('unauthorized', { status: 401 });
  }
  const db = adminDb();
  const [expired, points] = await Promise.all([db.rpc('expire_unpaid_orders'), db.rpc('loyalty_expire_points')]);
  const resent = await retryFailedNotifications();
  await checkLowStock();
  return Response.json({ expired_orders: expired.data, expired_points: points.data, notifications_resent: resent });
}
