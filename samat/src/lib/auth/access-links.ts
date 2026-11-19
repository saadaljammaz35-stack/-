import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { adminDb } from '@/lib/supabase/admin';
import { env } from '@/lib/env';
import { AppError } from '@/lib/errors';

export const ACCESS_LINK_HOURS = 72;
export const MIN_PASSWORD = 10;

export const hashAccessToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** Creates a single-use link for `email` and returns its URL (the token itself is never stored). */
export async function issueAccessLink(email: string, createdBy: string | null, purpose: 'setup' | 'reset'): Promise<{ url: string; expiresAt: string }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + ACCESS_LINK_HOURS * 3600_000).toISOString();
  const { error } = await adminDb().from('staff_access_links').insert({
    email: email.trim().toLowerCase(), token_hash: hashAccessToken(token), purpose, created_by: createdBy, expires_at: expiresAt,
  });
  if (error) throw error;
  return { url: `${env.siteUrl}/admin/setup?token=${token}`, expiresAt };
}

/**
 * Redeems a link: sets the password of the account for its e-mail (creating the account if needed).
 * Possession of the link is what proves the e-mail, so the account is marked verified.
 */
export async function redeemAccessLink(token: string, password: string): Promise<{ email: string }> {
  if (password.length < MIN_PASSWORD) throw new AppError('weak_password');
  const db = adminDb();
  const tokenHash = hashAccessToken(token);
  const { data: email, error } = await db.rpc('consume_staff_access_link', { p_token_hash: tokenHash });
  if (error) throw error;
  if (!email) throw new AppError('link_invalid');
  try {
    const { data: uid, error: e1 } = await db.rpc('auth_user_id_by_email', { p_email: email });
    if (e1) throw e1;
    const res = uid
      ? await db.auth.admin.updateUserById(uid as string, { password, email_confirm: true })
      : await db.auth.admin.createUser({ email: email as string, password, email_confirm: true });
    if (res.error) {
      if (/password/i.test(res.error.message)) throw new AppError('weak_password');
      throw res.error;
    }
    return { email: email as string };
  } catch (e) {
    await db.rpc('restore_staff_access_link', { p_token_hash: tokenHash });
    throw e;
  }
}
