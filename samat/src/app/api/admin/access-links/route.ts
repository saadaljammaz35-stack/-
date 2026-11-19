import { z } from 'zod';
import { requireStaff } from '@/lib/auth/staff';
import { issueAccessLink } from '@/lib/auth/access-links';
import { adminDb } from '@/lib/supabase/admin';
import { env } from '@/lib/env';
import { AppError, errorResponse } from '@/lib/errors';

const Body = z.object({ email: z.string().email().max(120) });

/**
 * A single-use "set your password" link for a staff member, to share with them directly.
 * staff.manage required. Links for owners and admins can only be created by an owner, so nobody
 * can take over an account above their own.
 */
export async function POST(req: Request) {
  try {
    const me = await requireStaff('staff.manage');
    const b = Body.safeParse(await req.json());
    if (!b.success) throw new AppError('invalid_request');
    const email = b.data.email.trim().toLowerCase();
    const db = adminDb();
    const [{ data: member }, { data: invite }] = await Promise.all([
      db.from('staff_members').select('role_key, is_active').ilike('email', email).maybeSingle(),
      db.from('staff_invitations').select('role_key').ilike('email', email).is('accepted_at', null).is('revoked_at', null)
        .gt('expires_at', new Date().toISOString()).maybeSingle(),
    ]);
    const ownerEmail = env.superAdminEmails.includes(email);
    const role = member?.role_key ?? (ownerEmail ? 'owner' : invite?.role_key);
    if (!role) throw new AppError('not_staff', 404);
    if ((role === 'owner' || role === 'admin') && me.role !== 'owner') throw new AppError('forbidden', 403);
    const link = await issueAccessLink(email, me.userId, member ? 'reset' : 'setup');
    return Response.json({ ok: true, ...link });
  } catch (e) {
    return errorResponse(e);
  }
}
