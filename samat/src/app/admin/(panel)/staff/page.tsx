import { requireStaffPage } from '@/lib/auth/staff';
import { userDb } from '@/lib/supabase/server';
import { getLocale } from '@/lib/i18n/server';
import { adminDicts } from '@/lib/i18n/admin';
import { PageHeader } from '@/components/admin/ui';
import { StaffManager } from '@/components/admin/StaffManager';

export default async function StaffPage() {
  const staff = await requireStaffPage('staff.manage', '/admin/staff');
  const a = adminDicts[await getLocale()];
  const db = await userDb();
  const [{ data: members }, { data: invites }, { data: perms }, { data: rolePerms }, { data: overrides }] = await Promise.all([
    db.from('staff_members').select('user_id, email, full_name, role_key, is_active, last_seen_at').order('created_at'),
    db.from('staff_invitations').select('id, email, role_key, created_at').is('accepted_at', null).is('revoked_at', null).order('created_at', { ascending: false }),
    db.from('permissions').select('key, description_ar, description_en').order('key'),
    db.from('role_permissions').select('role_key, permission_key'),
    db.from('staff_permission_overrides').select('user_id, permission_key, allow'),
  ]);
  return (
    <div>
      <PageHeader title={a.staff.title} />
      <StaffManager me={staff.userId} isOwner={staff.role === 'owner'} members={members ?? []} invites={invites ?? []} perms={perms ?? []} rolePerms={rolePerms ?? []} overrides={overrides ?? []} />
    </div>
  );
}
