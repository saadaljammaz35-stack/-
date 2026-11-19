import { currentUser } from '@/lib/supabase/server';
import { adminDb } from '@/lib/supabase/admin';
import { env } from '@/lib/env';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { errorResponse } from '@/lib/errors';

/**
 * Called right after a staff e-mail OTP sign-in. The database grants a staff role only when the
 * e-mail is verified AND it is either SUPER_ADMIN_EMAIL (owner) or has an open invitation.
 */
export async function POST() {
  try {
    await rateLimit('staff:bootstrap', await clientIp(), 30, 600);
    const user = await currentUser();
    if (!user) return Response.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
    const { data, error } = await adminDb().rpc('bootstrap_staff', { p_user: user.id, p_super_admin_email: env.superAdminEmail ?? null });
    if (error) throw error;
    return Response.json(data);
  } catch (e) {
    return errorResponse(e);
  }
}
