import { requireStaffPage } from '@/lib/auth/staff';
import { userDb } from '@/lib/supabase/server';
import { adminDb } from '@/lib/supabase/admin';
import { getLocale } from '@/lib/i18n/server';
import { adminDicts } from '@/lib/i18n/admin';
import { PageHeader } from '@/components/admin/ui';
import { LoyaltyManager } from '@/components/admin/LoyaltyManager';

export default async function LoyaltyPage() {
  await requireStaffPage('loyalty.manage', '/admin/loyalty');
  const a = adminDicts[await getLocale()];
  const db = await userDb();
  const [{ data: s }, { data: rewards }, { data: products }, { data: accts }] = await Promise.all([
    adminDb().from('store_settings').select('loyalty_enabled, loyalty_points_per_sar, loyalty_point_value_halalas, loyalty_min_redeem_points, loyalty_expiry_days').eq('id', 1).single(),
    db.from('loyalty_rewards').select('*').order('sort_order'),
    db.from('products').select('id, name_ar, name_en').is('deleted_at', null),
    db.from('loyalty_accounts').select('balance'),
  ]);
  return (
    <div>
      <PageHeader title={a.loyalty.title} />
      <LoyaltyManager settings={{ ...s!, loyalty_points_per_sar: Number(s!.loyalty_points_per_sar) }} rewards={rewards ?? []} products={products ?? []}
        members={{ count: accts?.length ?? 0, points: (accts ?? []).reduce((n, x) => n + x.balance, 0) }} />
    </div>
  );
}
