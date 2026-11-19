import { currentUser } from '@/lib/supabase/server';
import { adminDb } from '@/lib/supabase/admin';
import { env } from '@/lib/env';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { errorResponse } from '@/lib/errors';

/**
 * Called right after a staff e-mail OTP sign-in. The database grants a staff role only when the
 * e-mail is verified AND it is listed in SUPER_ADMIN_EMAIL (owner; comma separated) or has an open
 * invitation. Only the signed-in user's own e-mail is ever passed, and only when it is on that list.
 */
export async function POST() {
  try {
    await rateLimit('staff:bootstrap', await clientIp(), 30, 600);
    const user = await currentUser();
    if (!user) return Response.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
    const own = user.email?.trim().toLowerCase();
    const ownerEmail = own && env.superAdminEmails.includes(own) ? own : null;
    const { data, error } = await adminDb().rpc('bootstrap_staff', { p_user: user.id, p_super_admin_email: ownerEmail });
    if (error) throw error;
    return Response.json(data);
  } catch (e) {
    return errorResponse(e);
  }
}
