import { z } from 'zod';
import { adminDb } from '@/lib/supabase/admin';
import { getStaff } from '@/lib/auth/staff';
import { pushConfigured } from '@/lib/notify/push';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { AppError, errorResponse } from '@/lib/errors';

const Sub = z.object({ endpoint: z.string().url().startsWith('https://').max(1000), keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(8).max(100) }) });
const Body = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('order'), token: z.string().min(20).max(60), subscription: Sub }),
  z.object({ kind: z.literal('staff'), subscription: Sub }),
]);

/** Saves a browser's push subscription: for one order (from its tracking link) or a staff device. */
export async function POST(req: Request) {
  try {
    await rateLimit('push:subscribe', await clientIp(), 20, 600);
    if (!pushConfigured()) throw new AppError('push_unavailable', 503);
    const b = Body.safeParse(await req.json());
    if (!b.success) throw new AppError('invalid_request');
    const db = adminDb();
    const s = b.data.subscription;
    let row: Record<string, unknown>;
    if (b.data.kind === 'order') {
      const { data: o } = await db.from('orders').select('id').eq('tracking_token', b.data.token).maybeSingle();
      if (!o) throw new AppError('order_not_found', 404);
      row = { endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth, kind: 'order', order_id: o.id, user_id: null };
    } else {
      const staff = await getStaff();
      if (!staff) throw new AppError('unauthorized', 401);
      row = { endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth, kind: 'staff', order_id: null, user_id: staff.userId };
    }
    const { error } = await db.from('push_subscriptions').upsert(row, { onConflict: 'endpoint' });
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
