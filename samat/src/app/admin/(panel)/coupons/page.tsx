import { requireStaffPage } from '@/lib/auth/staff';
import { userDb } from '@/lib/supabase/server';
import { getLocale } from '@/lib/i18n/server';
import { adminDicts } from '@/lib/i18n/admin';
import { PageHeader } from '@/components/admin/ui';
import { CouponsManager, type CouponRow } from '@/components/admin/CouponsManager';

export default async function CouponsPage() {
  await requireStaffPage('coupons.manage', '/admin/coupons');
  const a = adminDicts[await getLocale()];
  const db = await userDb();
  const [{ data: rows }, { data: used }, { data: products }] = await Promise.all([
    db.from('coupons').select('*').order('created_at', { ascending: false }),
    db.from('coupon_redemptions').select('coupon_id').eq('status', 'confirmed'),
    db.from('products').select('id, name_ar, name_en').is('deleted_at', null).order('sort_order'),
  ]);
  const counts = new Map<string, number>();
  (used ?? []).forEach((u) => counts.set(u.coupon_id, (counts.get(u.coupon_id) ?? 0) + 1));
  return (
    <div>
      <PageHeader title={a.coupons.title} />
      <CouponsManager rows={(rows ?? []).map((r) => ({ ...r, used: counts.get(r.id) ?? 0 })) as CouponRow[]} products={products ?? []} />
    </div>
  );
}
