import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { getSessionClient } from '@/lib/supabase/server';
import type { Permission, RoleKey } from './permissions';

export interface Staff {
  id: string;
  email: string;
  fullName: string;
  role: RoleKey;
  permissions: Permission[];
}

/**
 * Resolves the signed-in staff member for this request. getUser() verifies the session with Supabase Auth
 * (cookies alone are never trusted), then the role and permissions are read from the database.
 */
export const getStaff = cache(async (): Promise<{ staff: Staff | null; signedIn: boolean }> => {
  const db = await getSessionClient();
  if (!db) return { staff: null, signedIn: false };
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { staff: null, signedIn: false };
  const { data: profile } = await db
    .from('profiles')
    .select('id, email, full_name, role, is_active, roles(permissions)')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile || !profile.role || !profile.is_active) return { staff: null, signedIn: true };
  const roleRow = Array.isArray(profile.roles) ? profile.roles[0] : profile.roles;
  return {
    signedIn: true,
    staff: {
      id: profile.id as string,
      email: String(profile.email),
      fullName: String(profile.full_name ?? ''),
      role: profile.role as RoleKey,
      permissions: ((roleRow as { permissions?: string[] } | null)?.permissions ?? []) as Permission[],
    },
  };
});

export function can(staff: Staff, permission: Permission): boolean {
  return staff.permissions.includes(permission);
}

/** Guards an admin page or server action. Redirects instead of rendering anything the user may not see. */
export async function requireStaff(permission?: Permission): Promise<Staff> {
  const { staff, signedIn } = await getStaff();
  if (!signedIn) redirect('/admin/login');
  if (!staff) redirect('/admin/no-access');
  if (permission && !can(staff, permission)) redirect('/admin?denied=1');
  return staff;
}

/** Same check for server actions that return a result instead of redirecting. */
export async function staffFor(permission?: Permission): Promise<Staff | null> {
  const { staff } = await getStaff();
  if (!staff) return null;
  if (permission && !can(staff, permission)) return null;
  return staff;
}
