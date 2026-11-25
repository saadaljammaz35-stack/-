import { AccountForm } from '@/components/admin/AccountForm';
import { AdminHeader } from '@/components/admin/ui';
import { requireStaff } from '@/lib/admin/auth';
import { ROLE_LABELS } from '@/lib/admin/permissions';

export const metadata = { title: 'حسابي' };

export default async function AccountPage() {
  const staff = await requireStaff();
  return (
    <>
      <AdminHeader title="حسابي" description={`${staff.email} · ${ROLE_LABELS[staff.role]}`} />
      <AccountForm fullName={staff.fullName} />
    </>
  );
}
