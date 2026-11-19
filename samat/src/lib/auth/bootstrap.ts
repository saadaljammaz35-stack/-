import 'server-only';
import type { User } from '@supabase/supabase-js';
import { adminDb } from '@/lib/supabase/admin';
import { env } from '@/lib/env';

export type BootstrapResult = { ok: boolean; role?: string; reason?: string | null; bootstrapped?: boolean; invited?: boolean };

/**
 * Grants a staff role after an e-mail sign-in. The database only does so when the e-mail is
 * verified AND it is listed in SUPER_ADMIN_EMAIL (owner; comma separated) or has an open
 * invitation. Only the signed-in user's own e-mail is ever passed, and only when it is on that list.
 */
export async function bootstrapStaffUser(user: User): Promise<BootstrapResult> {
  const own = user.email?.trim().toLowerCase();
  const ownerEmail = own && env.superAdminEmails.includes(own) ? own : null;
  const { data, error } = await adminDb().rpc('bootstrap_staff', { p_user: user.id, p_super_admin_email: ownerEmail });
  if (error) throw error;
  return data as BootstrapResult;
}
