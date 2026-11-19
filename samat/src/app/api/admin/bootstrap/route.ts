import { currentUser } from '@/lib/supabase/server';
import { bootstrapStaffUser } from '@/lib/auth/bootstrap';
import { clientIp, rateLimit } from '@/lib/rate-limit';
import { errorResponse } from '@/lib/errors';

/** Called right after a staff e-mail code sign-in (see bootstrapStaffUser for the rules). */
export async function POST() {
  try {
    await rateLimit('staff:bootstrap', await clientIp(), 30, 600);
    const user = await currentUser();
    if (!user) return Response.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
    return Response.json(await bootstrapStaffUser(user));
  } catch (e) {
    return errorResponse(e);
  }
}
