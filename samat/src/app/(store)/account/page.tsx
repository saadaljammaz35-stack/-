import Link from 'next/link';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Gift, Star } from 'lucide-react';
import { getDict } from '@/lib/i18n/server';
import { fill } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { adminDb } from '@/lib/supabase/admin';
import { getPublicSettings } from '@/lib/catalog';
import { PhoneLogin } from '@/components/account/PhoneLogin';
import { CompleteProfile } from '@/components/account/CompleteProfile';
import { FavoritesList, type Fav } from '@/components/account/FavoritesList';
import { BirthdayCard } from '@/components/account/BirthdayCard';
import { StampCard } from '@/components/account/StampCard';
import { phoneLoginAvailable } from '@/lib/auth/phone-otp';
import { currentCustomer } from '@/lib/auth/customer';
import { env } from '@/lib/env';
import { SignOut } from '@/components/account/SignOut';
import { ReorderButton } from '@/components/account/ReorderButton';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict();
  return { title: t.account.title, robots: { index: false } };
}

export default async function AccountPage() {
  const [{ t, locale }, user, settings] = await Promise.all([getDict(), currentCustomer(), getPublicSettings()]);
  if (!user) return <Suspense><PhoneLogin available={phoneLoginAvailable()} googleClientId={env.googleClientId ?? null} welcomePoints={settings.loyalty_enabled ? settings.loyalty_welcome_points : 0} /></Suspense>;
  const db = adminDb();
  const [{ data: orders }, { data: account }, { data: txns }, { data: rewards }, { data: favs }, { data: prof }] = await Promise.all([
    db.from('orders').select('id, order_number, tracking_token, status, total, created_at, points_earned, invoices(invoice_number), order_items(product_name_ar, product_name_en, quantity)')
      .eq('customer_id', user.id).not('status', 'in', '(pending_payment,expired,payment_failed)').order('created_at', { ascending: false }).limit(30),
    db.from('loyalty_accounts').select('balance, lifetime_earned').eq('customer_id', user.id).maybeSingle(),
    db.from('loyalty_transactions').select('id, type, points, created_at, expires_at').eq('customer_id', user.id).order('created_at', { ascending: false }).limit(30),
    db.from('loyalty_rewards').select('id, name_ar, name_en, description_ar, description_en, points_cost').eq('is_active', true).order('points_cost'),
    db.from('favorites').select('id, name, product:products(name_ar, name_en, image_url)').eq('customer_id', user.id).order('created_at', { ascending: false }),
    db.from('profiles').select('birthday, stamps').eq('id', user.id).maybeSingle(),
  ]);
  const favorites: Fav[] = (favs ?? []).map((f) => { const p = (Array.isArray(f.product) ? f.product[0] : f.product) as { name_ar: string; name_en: string; image_url: string | null } | null; return { id: f.id, name: f.name, product_name_ar: p?.name_ar ?? '', product_name_en: p?.name_en ?? '', image_url: p?.image_url ?? null }; });
  const who = user.phone ?? user.email ?? '';
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Riyadh' });

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{t.account.title}</h1>
          {user.name && <p className="mt-1 font-semibold">{user.name}</p>}
          <p className="num mt-1 text-espresso-600" dir="ltr">{who}</p>
        </div>
        <SignOut />
      </div>

      {(!user.name || !user.phone) && <CompleteProfile name={user.name} phone={user.phone} phoneLocked={false} />}
      {settings.loyalty_enabled && settings.loyalty_birthday_points > 0 && !prof?.birthday && <BirthdayCard points={settings.loyalty_birthday_points} />}

      <section className="relative overflow-hidden rounded-[2rem] bg-espresso-900 p-7 text-cream-100" data-testid="loyalty-card">
        <div className="absolute -end-10 -top-16 size-64 rounded-full bg-gold-400/25 blur-3xl" />
        <p className="eyebrow relative text-gold-400">{t.account.points}</p>
        {settings.loyalty_enabled ? (
          <div className="relative">
            <p className="num mt-2 text-5xl font-bold" data-testid="points-balance">{account?.balance ?? 0} <span className="text-lg font-medium text-cream-200/70">{t.account.pointsUnit}</span></p>
            {(() => {
              const bal = account?.balance ?? 0;
              const min = settings.loyalty_min_redeem_points;
              const pct = Math.min(100, Math.round((bal / Math.max(1, min)) * 100));
              return (
                <div className="mt-4" data-testid="points-progress">
                  <div className="h-2.5 overflow-hidden rounded-full bg-cream-100/15"><div className="h-full rounded-full bg-gold-400 transition-[width] duration-700" style={{ width: `${pct}%` }} /></div>
                  <p className="num mt-2 text-sm font-semibold text-gold-400">
                    {bal >= min
                      ? fill(t.account.ready, { value: formatMoney(bal * settings.loyalty_point_value_halalas, locale) })
                      : fill(t.account.toNext, { n: min - bal, value: formatMoney(min * settings.loyalty_point_value_halalas, locale) })}
                  </p>
                </div>
              );
            })()}
            <ul className="mt-4 space-y-1 text-sm text-cream-200/80">
              <li>{fill(t.account.howToEarn, { n: settings.loyalty_points_per_sar })}</li>
              <li>{fill(t.account.pointValue, { value: formatMoney(settings.loyalty_point_value_halalas, locale) })} · {fill(t.account.minRedeem, { n: settings.loyalty_min_redeem_points })}</li>
              {settings.loyalty_expiry_days && <li>{fill(t.account.expiry, { n: settings.loyalty_expiry_days })}</li>}
            </ul>
          </div>
        ) : <p className="relative mt-2 text-cream-200/80">{t.account.loyaltyOff}</p>}
      </section>

      {settings.loyalty_enabled && settings.loyalty_stamp_target > 0 && (
        <StampCard stamps={prof?.stamps ?? 0} target={settings.loyalty_stamp_target} reward={settings.loyalty_stamp_reward_points}
          title={t.account.stampTitle} text={fill(t.account.stampText, { n: Math.max(0, settings.loyalty_stamp_target - (prof?.stamps ?? 0)), points: settings.loyalty_stamp_reward_points })} />
      )}
      <FavoritesList items={favorites} />

      {settings.loyalty_enabled && (rewards ?? []).length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-bold">{t.account.rewards}</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {(rewards ?? []).map((r) => {
              const pct = Math.min(100, Math.round(((account?.balance ?? 0) / r.points_cost) * 100));
              return (
                <div key={r.id} className="glass rounded-3xl p-5">
                  <Gift className="size-5 text-terracotta-500" />
                  <p className="mt-2 font-bold">{locale === 'ar' ? r.name_ar : r.name_en}</p>
                  <p className="num text-sm text-espresso-500">{r.points_cost} {t.account.pointsUnit}</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-sand-300"><div className="h-full rounded-full bg-terracotta-500" style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-xl font-bold">{t.account.orders}</h2>
        {!orders?.length ? <p className="paper rounded-3xl p-6 text-espresso-600">{t.account.noOrders}</p> : (
          <ul className="space-y-3" data-testid="order-history">
            {orders.map((o) => {
              const inv = Array.isArray(o.invoices) ? o.invoices[0] : o.invoices;
              return (
                <li key={o.id} className="glass flex flex-wrap items-center justify-between gap-3 rounded-3xl p-4">
                  <div className="min-w-0">
                    <p className="font-bold"><span className="num">#{o.order_number}</span> · <span className="text-sm font-medium text-espresso-500">{date(o.created_at)}</span></p>
                    <p className="truncate text-sm text-espresso-600">{o.order_items.map((i) => `${i.quantity}× ${locale === 'ar' ? i.product_name_ar : i.product_name_en}`).join('، ')}</p>
                    <p className="num text-xs text-espresso-500">
                      {t.track.status[o.status as keyof typeof t.track.status]?.title}
                      {inv?.invoice_number ? ` · ${t.account.invoiceNo} ${inv.invoice_number}` : ''}
                      {o.points_earned ? ` · +${o.points_earned} ${t.account.pointsUnit}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="num font-semibold">{formatMoney(o.total, locale)}</span>
                    <Link href={`/t/${o.tracking_token}`} className="btn btn-sm btn-ghost">{t.track.title}</Link>
                    <ReorderButton orderId={o.id} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {settings.loyalty_enabled && (txns ?? []).length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-bold">{t.account.history}</h2>
          <ul className="paper divide-y hairline rounded-3xl px-5" data-testid="points-history">
            {(txns ?? []).map((x) => (
              <li key={x.id} className="flex items-center justify-between py-3 text-sm">
                <span className="flex items-center gap-2"><Star className="size-4 text-gold-500" /> {t.account.txn[x.type as keyof typeof t.account.txn]}</span>
                <span className="text-espresso-500">{date(x.created_at)}</span>
                <span className={`num font-bold ${x.points > 0 ? 'text-ok-500' : 'text-danger-500'}`} dir="ltr">{x.points > 0 ? '+' : ''}{x.points}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
