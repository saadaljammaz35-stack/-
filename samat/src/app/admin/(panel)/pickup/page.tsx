import { requireStaffPage } from '@/lib/auth/staff';
import { getLocale } from '@/lib/i18n/server';
import { adminDicts } from '@/lib/i18n/admin';
import { PageHeader } from '@/components/admin/ui';
import { PickupVerifier } from '@/components/admin/PickupVerifier';

export default async function PickupPage() {
  await requireStaffPage('pickup.verify', '/admin/pickup');
  const a = adminDicts[await getLocale()];
  return (
    <div>
      <PageHeader title={a.pickup.title} subtitle={a.pickup.text} />
      <PickupVerifier />
    </div>
  );
}
