import 'server-only';
import webpush from 'web-push';
import { adminDb } from '@/lib/supabase/admin';
import { env } from '@/lib/env';

/** Browser notifications (Web Push, VAPID). Without keys nothing is sent and nothing is claimed. */
export const pushConfigured = () => Boolean(env.vapidPublic && env.vapidPrivate);

export interface PushPayload { title: string; body: string; url: string; tag?: string }

/** Sends to a customer's order subscriptions, or to active staff devices. Dead subscriptions are removed. */
export async function sendPush(to: { orderId: string } | { staff: true }, payload: PushPayload): Promise<number> {
  if (!pushConfigured()) return 0;
  webpush.setVapidDetails(env.siteUrl.startsWith('https://') ? env.siteUrl : 'mailto:no-reply@samat.invalid', env.vapidPublic!, env.vapidPrivate!);
  const db = adminDb();
  let subs: { id: string; endpoint: string; p256dh: string; auth: string; user_id: string | null }[] = [];
  if ('orderId' in to) {
    subs = (await db.from('push_subscriptions').select('id, endpoint, p256dh, auth, user_id').eq('order_id', to.orderId)).data ?? [];
  } else {
    const all = (await db.from('push_subscriptions').select('id, endpoint, p256dh, auth, user_id').eq('kind', 'staff')).data ?? [];
    const { data: active } = await db.from('staff_members').select('user_id').eq('is_active', true);
    const ok = new Set((active ?? []).map((s) => s.user_id));
    subs = all.filter((s) => s.user_id && ok.has(s.user_id));
  }
  let sent = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 3600, urgency: 'high' });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await db.from('push_subscriptions').delete().eq('id', s.id);
      else console.error('[push]', code ?? (e as Error).message);
    }
  }));
  return sent;
}
