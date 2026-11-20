import type { Metadata } from 'next';
import { getDict } from '@/lib/i18n/server';
import { currentCustomer } from '@/lib/auth/customer';
import { adminDb } from '@/lib/supabase/admin';
import { getPublicSettings } from '@/lib/catalog';
import { CheckoutForm } from '@/components/cart/CheckoutForm';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict();
  return { title: t.checkout.title, robots: { index: false } };
}

export default async function CheckoutPage() {
  const [{ locale }, user, settings] = await Promise.all([getDict(), currentCustomer(), getPublicSettings()]);
  let customer = null;
  let balance = 0;
  let rewards: { id: string; name_ar: string; name_en: string; points_cost: number }[] = [];
  if (user) {
    const db = adminDb();
    const [{ data: account }, { data: rw }] = await Promise.all([
      db.from('loyalty_accounts').select('balance').eq('customer_id', user.id).maybeSingle(),
      db.from('loyalty_rewards').select('id, name_ar, name_en, points_cost').eq('is_active', true).order('points_cost'),
    ]);
    customer = { id: user.id, name: user.name, phone: user.phone, email: user.email };
    balance = account?.balance ?? 0;
    rewards = rw ?? [];
  }
  return (
    <CheckoutForm
      customer={customer}
      loyalty={{ enabled: settings.loyalty_enabled, balance, rewards, pointValue: settings.loyalty_point_value_halalas, minRedeem: settings.loyalty_min_redeem_points }}
      branch={{ name: locale === 'ar' ? settings.branch_name_ar : settings.branch_name_en, pickup: locale === 'ar' ? settings.pickup_instructions_ar : settings.pickup_instructions_en }}
    />
  );
}
