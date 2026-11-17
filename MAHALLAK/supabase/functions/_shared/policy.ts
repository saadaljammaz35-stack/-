import type { SupabaseClient } from './deps.ts';
import { HttpError } from './http.ts';

export type AiKind = 'recognize' | 'detect' | 'cutout' | 'query';

/**
 * AI credit included with each tier. Kept in sync with src/config/plans.ts.
 * By default the credit is a fixed allowance (QUOTA_PERIOD=lifetime), because a
 * one-time purchase cannot cover unlimited recurring cloud cost. With a cheaper
 * model configured, the owner can switch to QUOTA_PERIOD=month (docs/COST-MODEL.md).
 */
export const LIMITS: Record<'free' | 'full', Record<AiKind, number>> = {
  free: { recognize: 5, cutout: 5, detect: 1, query: 10 },
  full: { recognize: 80, cutout: 30, detect: 8, query: 80 },
};

/** Quota bucket: one lifetime bucket, or the first day of the current month. */
export function quotaPeriod(now = new Date()): string {
  if ((Deno.env.get('QUOTA_PERIOD') ?? 'lifetime') === 'month') {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  }
  return '1970-01-01';
}

/** The user's own consent, enforced server-side (the app also checks it). */
export async function requireAiConsent(admin: SupabaseClient, userId: string): Promise<void> {
  const { data, error } = await admin.from('user_settings').select('ai_consent').eq('user_id', userId).maybeSingle();
  if (error) throw new HttpError(500, 'settings_unavailable');
  if (!data?.ai_consent) throw new HttpError(403, 'consent_required');
}

/** Full access comes from a verified store purchase (RevenueCat webhook or REST check). */
export async function hasFullAccess(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await admin
    .from('entitlements')
    .select('active')
    .eq('user_id', userId)
    .eq('entitlement', 'full_access')
    .maybeSingle();
  if (data?.active) return true;
  const secret = Deno.env.get('REVENUECAT_SECRET_KEY');
  if (!secret) return false;
  try {
    const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (!res.ok) return false;
    const body = await res.json();
    const ent = body?.subscriber?.entitlements?.full_access;
    const active = Boolean(ent && (!ent.expires_date || Date.parse(ent.expires_date) > Date.now()));
    if (active) {
      await admin.from('entitlements').upsert({ user_id: userId, entitlement: 'full_access', product_id: ent.product_identifier ?? null, store: 'revenuecat', active: true, updated_at: new Date().toISOString() });
    }
    return active;
  } catch {
    return false;
  }
}

export async function consumeQuota(admin: SupabaseClient, userId: string, kind: AiKind): Promise<void> {
  const tier = (await hasFullAccess(admin, userId)) ? 'full' : 'free';
  const { data, error } = await admin.rpc('consume_ai_quota', { p_user: userId, p_kind: kind, p_limit: LIMITS[tier][kind], p_period: quotaPeriod() });
  if (error) throw new HttpError(500, 'quota_unavailable');
  if (data !== true) throw new HttpError(429, 'quota_exceeded');
}

export async function recordTokens(admin: SupabaseClient, userId: string, kind: AiKind, usage: { input_tokens?: number; output_tokens?: number } | undefined) {
  if (!usage) return;
  await admin.rpc('record_ai_tokens', { p_user: userId, p_kind: kind, p_in: usage.input_tokens ?? 0, p_out: usage.output_tokens ?? 0, p_period: quotaPeriod() });
}
