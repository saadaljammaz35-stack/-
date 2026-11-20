import { timingSafeEqual } from 'node:crypto';
import { adminDb } from '@/lib/supabase/admin';
import { env } from '@/lib/env';
import { retryFailedNotifications } from '@/lib/notify';
import { checkLowStock } from '@/lib/orders/service';
import { sendPush } from '@/lib/notify/push';
import { formatMoney } from '@/lib/money';

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
  // birthday gifts (idempotent per year) and yesterday's report (Riyadh day)
  const birthdays = await db.rpc('loyalty_birthday_run');
  const yesterday = new Date(Date.now() + 3 * 3600_000 - 864e5).toISOString().slice(0, 10);
  const { data: rep } = await db.rpc('build_daily_report', { p_day: yesterday });
  const r = rep as { orders: number; sales: number; new_customers: number } | null;
  const pushed = r ? await sendPush({ staff: true }, {
    title: `تقرير أمس — ${r.orders} طلب`,
    body: `المبيعات ${formatMoney(r.sales, 'ar')} · عملاء جدد ${r.new_customers}`,
    url: '/admin', tag: `report-${yesterday}`,
  }).catch(() => 0) : 0;
  return Response.json({ expired_orders: expired.data, expired_points: points.data, notifications_resent: resent, birthday_gifts: birthdays.data, report_day: yesterday, report_pushed: pushed });
}
