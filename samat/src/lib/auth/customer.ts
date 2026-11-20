import 'server-only';
import { randomBytes } from 'node:crypto';
import { adminDb } from '@/lib/supabase/admin';
import { currentUser, userDb } from '@/lib/supabase/server';
import { env } from '@/lib/env';
import { AppError } from '@/lib/errors';
import { verifyGoogleIdToken } from './google-token';

export interface Customer { id: string; phone: string | null; email: string | null; name: string | null }

/**
 * The signed-in customer: a phone account (SMS code) or a Google account. Staff e-mail accounts
 * are not customers. Google accounts are marked in app_metadata, which only the server can set.
 */
export async function currentCustomer(): Promise<Customer | null> {
  const user = await currentUser();
  if (!user) return null;
  const google = user.app_metadata?.samat_provider === 'google';
  if (!user.phone && !google) return null;
  const { data: p } = await adminDb().from('profiles').select('full_name, email, phone').eq('id', user.id).maybeSingle();
  return {
    id: user.id,
    phone: user.phone ? `+${user.phone.replace(/^\+/, '')}` : (p?.phone ?? null),
    email: p?.email ?? null,
    name: p?.full_name ?? null,
  };
}

export const googleSignInAvailable = () => Boolean(env.googleClientId);

/** Signs a customer in with a Google ID token (from the Google button) and opens a session. */
export async function googleSignIn(credential: string, locale: 'ar' | 'en'): Promise<{ userId: string }> {
  if (!env.googleAudience) throw new AppError('google_unavailable', 503);
  const g = await verifyGoogleIdToken(credential, env.googleAudience).catch(() => { throw new AppError('google_invalid'); });
  const db = adminDb();
  // internal sign-in identifier, unique per Google account; the real e-mail is kept in the profile
  const loginEmail = `g${g.sub}@google.samat.invalid`;
  const password = randomBytes(32).toString('base64url'); // fresh every sign-in, never stored
  const { data: uid, error: e1 } = await db.rpc('auth_user_id_by_email', { p_email: loginEmail });
  if (e1) throw e1;
  const res = uid
    ? await db.auth.admin.updateUserById(uid as string, { password, email_confirm: true })
    : await db.auth.admin.createUser({ email: loginEmail, password, email_confirm: true, app_metadata: { samat_provider: 'google' }, user_metadata: { full_name: g.name } });
  if (res.error) throw res.error;
  const session = await userDb();
  const { data, error } = await session.auth.signInWithPassword({ email: loginEmail, password });
  if (error || !data.user) throw error ?? new AppError('unknown', 500);
  await db.from('profiles').upsert({ id: data.user.id, full_name: g.name, email: g.email, locale }, { onConflict: 'id', ignoreDuplicates: true });
  await db.from('loyalty_accounts').upsert({ customer_id: data.user.id }, { onConflict: 'customer_id', ignoreDuplicates: true });
  return { userId: data.user.id };
}
