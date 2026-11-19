import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { userDb } from '@/lib/supabase/server';
import { adminDb } from '@/lib/supabase/admin';
import { AppError } from '@/lib/errors';

export type Permission =
  | 'dashboard.view' | 'reports.view' | 'orders.view' | 'orders.manage' | 'orders.view_pii'
  | 'kitchen.view' | 'kitchen.update' | 'pickup.verify' | 'menu.manage' | 'inventory.manage'
  | 'coupons.manage' | 'loyalty.manage' | 'settings.manage' | 'busy.manage' | 'staff.manage'
  | 'invoices.print' | 'invoices.reprint' | 'audit.view' | 'notifications.view' | 'ai.use';

export interface StaffSession {
  userId: string;
  email: string;
  role: 'owner' | 'admin' | 'orders_manager' | 'kitchen';
  fullName: string | null;
  permissions: Set<Permission>;
}

/** The signed-in, active staff member (permissions resolved by the database), or null. */
export const getStaff = cache(async (): Promise<StaffSession | null> => {
  const db = await userDb();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return null;
  const [{ data: member }, { data: perms }] = await Promise.all([
    adminDb().from('staff_members').select('role_key, full_name, email, is_active').eq('user_id', auth.user.id).maybeSingle(),
    db.rpc('my_permissions'),
  ]);
  if (!member || !member.is_active) return null;
  return {
    userId: auth.user.id,
    email: member.email,
    role: member.role_key,
    fullName: member.full_name,
    permissions: new Set((perms ?? []) as Permission[]),
  };
});

/** For pages: redirect to the login screen / show 403 when the permission is missing. */
export async function requireStaffPage(perm?: Permission, next = '/admin'): Promise<StaffSession> {
  const s = await getStaff();
  if (!s) redirect(`/admin/login?next=${encodeURIComponent(next)}`);
  if (perm && !s.permissions.has(perm)) redirect('/admin/forbidden');
  return s;
}

/** For API routes / server actions: throws 401/403 AppError. */
export async function requireStaff(perm?: Permission | Permission[]): Promise<StaffSession> {
  const s = await getStaff();
  if (!s) throw new AppError('unauthorized', 401);
  const needed = perm ? (Array.isArray(perm) ? perm : [perm]) : [];
  if (needed.length && !needed.some((p) => s.permissions.has(p))) throw new AppError('forbidden', 403);
  return s;
}
