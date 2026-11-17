import type { SupabaseClient } from './deps.ts';
import { HttpError } from './http.ts';

export type AiKind = 'recognize' | 'detect' | 'cutout' | 'query';

/**
 * Monthly fair-use limits. Kept in sync with src/config/plans.ts. The one-time
 * purchase covers these (see docs/COST-MODEL.md); free users get a small taste.
 */
export const LIMITS: Record<'free' | 'full', Record<AiKind, number>> = {
  free: { recognize: 5, cutout: 5, detect: 1, query: 30 },
  full: { recognize: 150, cutout: 150, detect: 20, query: 300 },
};

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
  const { data, error } = await admin.rpc('consume_ai_quota', { p_user: userId, p_kind: kind, p_limit: LIMITS[tier][kind] });
  if (error) throw new HttpError(500, 'quota_unavailable');
  if (data !== true) throw new HttpError(429, 'quota_exceeded');
}

export async function recordTokens(admin: SupabaseClient, userId: string, kind: AiKind, usage: { input_tokens?: number; output_tokens?: number } | undefined) {
  if (!usage) return;
  await admin.rpc('record_ai_tokens', { p_user: userId, p_kind: kind, p_in: usage.input_tokens ?? 0, p_out: usage.output_tokens ?? 0 });
}
