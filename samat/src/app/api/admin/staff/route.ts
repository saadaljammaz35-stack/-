import { z } from 'zod';
import { requireStaff } from '@/lib/auth/staff';
import { userDb } from '@/lib/supabase/server';
import { AppError, errorResponse, fromDbError } from '@/lib/errors';
import { sendEmail } from '@/lib/notify/channels';
import { env } from '@/lib/env';

const role = z.enum(['admin', 'orders_manager', 'kitchen']);
const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('invite'), email: z.string().email().max(120), full_name: z.string().max(80).optional(), role_key: role }),
  z.object({ action: z.literal('revoke'), id: z.string().uuid() }),
  z.object({ action: z.literal('update'), user_id: z.string().uuid(), role_key: role.or(z.literal('owner')).optional(), is_active: z.boolean().optional(), full_name: z.string().max(80).optional() }),
  z.object({ action: z.literal('delete'), user_id: z.string().uuid() }),
  z.object({ action: z.literal('override'), user_id: z.string().uuid(), permission_key: z.string().max(40), allow: z.boolean().nullable() }),
]);

/** Staff management — staff.manage; the database additionally protects owners and the last owner. */
export async function POST(req: Request) {
  try {
    const me = await requireStaff('staff.manage');
    const b = Body.safeParse(await req.json());
    if (!b.success) throw new AppError('invalid_request');
    const db = await userDb();
    const d = b.data;
    let error;
    if (d.action === 'invite') {
      ({ error } = await db.from('staff_invitations').insert({ email: d.email.toLowerCase(), full_name: d.full_name ?? null, role_key: d.role_key, invited_by: me.userId }));
      if (!error) {
        const link = `${env.siteUrl}/admin/login`;
        await sendEmail(d.email, 'دعوة للانضمام إلى فريق سماط — SAMAT staff invitation',
          `<div dir="rtl" style="font-family:Tahoma,Arial">تمت دعوتك للانضمام إلى لوحة إدارة سماط.<br>ادخل من هنا ببريدك: <a href="${link}">${link}</a><hr><div dir="ltr">You have been invited to the SAMAT staff panel. Sign in with this e-mail at <a href="${link}">${link}</a></div></div>`,
          `SAMAT staff invitation — sign in at ${link}`);
      }
    } else if (d.action === 'revoke') {
      ({ error } = await db.from('staff_invitations').update({ revoked_at: new Date().toISOString() }).eq('id', d.id));
    } else if (d.action === 'update') {
      const { user_id, ...patch } = d;
      if (user_id === me.userId && (patch.is_active === false || (patch.role_key && patch.role_key !== me.role))) throw new AppError('forbidden', 403);
      ({ error } = await db.from('staff_members').update(patch).eq('user_id', user_id));
    } else if (d.action === 'delete') {
      if (d.user_id === me.userId) throw new AppError('forbidden', 403);
      ({ error } = await db.from('staff_members').delete().eq('user_id', d.user_id));
    } else {
      ({ error } = d.allow === null
        ? await db.from('staff_permission_overrides').delete().eq('user_id', d.user_id).eq('permission_key', d.permission_key)
        : await db.from('staff_permission_overrides').upsert({ user_id: d.user_id, permission_key: d.permission_key, allow: d.allow }));
    }
    if (error) throw fromDbError(error);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
