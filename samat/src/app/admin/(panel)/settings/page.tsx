import { requireStaffPage } from '@/lib/auth/staff';
import { userDb } from '@/lib/supabase/server';
import { getLocale } from '@/lib/i18n/server';
import { adminDicts } from '@/lib/i18n/admin';
import { PageHeader } from '@/components/admin/ui';
import { SettingsForm } from '@/components/admin/SettingsForm';

export default async function SettingsPage() {
  await requireStaffPage('settings.manage', '/admin/settings');
  const a = adminDicts[await getLocale()];
  const { data } = await (await userDb()).from('store_settings').select('*').eq('id', 1).single();
  const initial = { ...data, latitude: data?.latitude ?? '', longitude: data?.longitude ?? '', payment_methods: { creditcard: false, applepay: false, stcpay: false, bank_transfer: false, ...(data?.payment_methods ?? {}) } };
  return (
    <div>
      <PageHeader title={a.settings.title} />
      <SettingsForm initial={initial} />
    </div>
  );
}
