import { adminClient } from '../_shared/auth.ts';
import { HttpError, handler, json, readJson } from '../_shared/http.ts';

/**
 * RevenueCat -> Supabase entitlement sync. Configure the webhook in RevenueCat
 * with the Authorization header value stored in REVENUECAT_WEBHOOK_AUTH.
 * app_user_id is the Supabase user id (the app calls Purchases.logIn(userId)).
 */
const GRANT = new Set(['INITIAL_PURCHASE', 'NON_RENEWING_PURCHASE', 'UNCANCELLATION', 'TRANSFER', 'TEMPORARY_ENTITLEMENT_GRANT']);
const REVOKE = new Set(['EXPIRATION', 'REFUND_REVERSED_FALSE']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(
  handler(async (req) => {
    const expected = Deno.env.get('REVENUECAT_WEBHOOK_AUTH');
    if (!expected) throw new HttpError(501, 'not_configured');
    if (!safeEqual(req.headers.get('Authorization') ?? '', expected)) throw new HttpError(401, 'unauthorized');
    const body = await readJson<{ event?: { type?: string; app_user_id?: string; product_id?: string; store?: string; entitlement_ids?: string[]; cancel_reason?: string } }>(req, 64 * 1024);
    const ev = body.event;
    if (!ev?.type || !ev.app_user_id || !UUID.test(ev.app_user_id)) return json({ ignored: true });
    if (ev.entitlement_ids && !ev.entitlement_ids.includes('full_access')) return json({ ignored: true });
    const refunded = ev.type === 'CANCELLATION' && ev.cancel_reason === 'CUSTOMER_SUPPORT';
    const active = GRANT.has(ev.type) ? true : REVOKE.has(ev.type) || refunded ? false : null;
    if (active === null) return json({ ignored: true });
    const { error } = await adminClient()
      .from('entitlements')
      .upsert({ user_id: ev.app_user_id, entitlement: 'full_access', product_id: ev.product_id ?? null, store: ev.store ?? null, active, updated_at: new Date().toISOString() });
    if (error) throw new HttpError(500, 'write_failed');
    return json({ ok: true, active });
  }),
);
