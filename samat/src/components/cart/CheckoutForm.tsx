'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Gift, Lock, Store, Tag } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';
import { fill } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { normalizeSaudiPhone } from '@/lib/phone';
import { cart, useCart } from './cart-store';
import { cartToItems, useQuote } from './useQuote';

interface Reward { id: string; name_ar: string; name_en: string; points_cost: number }

export function CheckoutForm({ customer, loyalty, branch }: {
  customer: { id: string; name: string | null; phone: string | null; email: string | null } | null;
  loyalty: { enabled: boolean; balance: number; rewards: Reward[] };
  branch: { name: string; pickup: string | null };
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const lines = useCart();
  const [name, setName] = useState(customer?.name ?? '');
  const [phone, setPhone] = useState(customer?.phone ? `0${customer.phone.slice(4)}` : '');
  const [email, setEmail] = useState(customer?.email ?? '');
  const [notes, setNotes] = useState('');
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<string | undefined>();
  const [rewardId, setRewardId] = useState<string | undefined>();
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const idem = useRef<string | null>(null);

  const normalized = normalizeSaudiPhone(phone);
  const { quote, error, loading } = useQuote(lines, { coupon_code: coupon, reward_id: rewardId, phone: normalized ?? undefined });

  // One idempotency key per cart content: double taps / retries can never create two orders.
  const cartSig = useMemo(() => JSON.stringify(cartToItems(lines)), [lines]);
  useEffect(() => {
    const k = `samat_idem_${btoa(unescape(encodeURIComponent(cartSig))).slice(0, 48)}`;
    let v = sessionStorage.getItem(k);
    if (!v) { v = crypto.randomUUID().replace(/-/g, ''); sessionStorage.setItem(k, v); }
    idem.current = v;
  }, [cartSig]);

  // read the store itself: during hydration the rendered list is still the (empty) server snapshot
  useEffect(() => { if (!cart.get().length && !submitting) router.replace('/cart'); }, [lines.length, submitting, router]);

  const nameOk = name.trim().length >= 2;
  const phoneOk = Boolean(normalized);
  const emailOk = !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!nameOk || !phoneOk || !emailOk || !quote) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotency_key: idem.current, locale,
          customer: { name: name.trim(), phone: normalized, email: email.trim() || undefined },
          notes: notes.trim() || undefined, coupon_code: coupon, reward_id: rewardId,
          items: cartToItems(lines),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const code = json.error as string;
        const reason = json.detail?.reason as string | undefined;
        setSubmitError(code === 'coupon_invalid' && reason ? t.couponReasons[reason as keyof typeof t.couponReasons] ?? t.errors.coupon_invalid
          : code === 'loyalty_invalid' && reason ? t.loyaltyReasons[reason as keyof typeof t.loyaltyReasons] ?? t.errors.loyalty_invalid
          : t.errors[code as keyof typeof t.errors] ?? t.common.error);
        setSubmitting(false);
        return;
      }
      localStorage.setItem('samat_pending_order', json.tracking_token);
      router.push(json.payment_required ? `/pay/${json.tracking_token}` : `/t/${json.tracking_token}`);
    } catch {
      setSubmitError(t.common.offline);
      setSubmitting(false);
    }
  };

  const errMsg = error ? (t.errors[error.code as keyof typeof t.errors] ?? t.common.error) : null;
  const canSubmit = Boolean(quote && quote.can_order && !error && !submitting);

  return (
    <form onSubmit={submit} noValidate className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-8 sm:px-8 lg:grid-cols-[1fr_400px]" data-testid="checkout">
      <div className="space-y-5">
        <h1 className="text-3xl font-bold">{t.checkout.title}</h1>

        <section className="glass space-y-4 rounded-3xl p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">{t.checkout.yourDetails}</h2>
            {customer ? <span className="chip bg-ok-500/10 text-ok-500">{fill(t.checkout.signedInAs, { phone: customer.phone ?? '' })}</span>
              : loyalty.enabled && <Link href="/account?next=/checkout" className="text-sm font-semibold text-terracotta-500">{t.checkout.signInForPoints}</Link>}
          </div>
          <div>
            <label htmlFor="name" className="label">{t.checkout.name}</label>
            <input id="name" className="field" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.checkout.namePlaceholder}
              aria-invalid={touched && !nameOk} data-testid="name" />
            {touched && !nameOk && <p className="mt-1 text-sm text-danger-500">{t.checkout.invalidName}</p>}
          </div>
          <div>
            <label htmlFor="phone" className="label">{t.checkout.phone}</label>
            <input id="phone" className="field num" dir="ltr" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder={t.checkout.phonePlaceholder} aria-invalid={touched && !phoneOk} readOnly={Boolean(customer?.phone)} data-testid="phone" />
            {touched && !phoneOk && <p className="mt-1 text-sm text-danger-500">{t.checkout.invalidPhone}</p>}
          </div>
          <div>
            <label htmlFor="email" className="label">{t.checkout.email} <span className="font-normal text-espresso-500">({t.common.optional})</span></label>
            <input id="email" className="field" dir="ltr" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
              aria-invalid={touched && !emailOk} data-testid="email" />
            <p className="mt-1 text-xs text-espresso-500">{touched && !emailOk ? <span className="text-danger-500">{t.checkout.invalidEmail}</span> : t.checkout.emailHint}</p>
          </div>
          {!customer && <p className="text-xs text-espresso-500">{t.checkout.guestNote}</p>}
        </section>

        <section className="glass rounded-3xl p-5">
          <h2 className="flex items-center gap-2 font-bold"><Store className="size-5" /> {t.checkout.pickupTitle} — {branch.name}</h2>
          <p className="mt-2 text-sm text-espresso-600">{branch.pickup || t.checkout.pickupText}</p>
          <label htmlFor="notes" className="label mt-4">{t.checkout.notes} <span className="font-normal text-espresso-500">({t.common.optional})</span></label>
          <textarea id="notes" className="field min-h-20" maxLength={300} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </section>

        <section className="glass space-y-4 rounded-3xl p-5">
          <div>
            <label htmlFor="coupon" className="label flex items-center gap-1.5"><Tag className="size-4" /> {t.checkout.coupon}</label>
            <div className="flex gap-2">
              <input id="coupon" className="field num uppercase" dir="ltr" value={couponInput} onChange={(e) => setCouponInput(e.target.value)}
                placeholder={t.checkout.couponPlaceholder} maxLength={32} data-testid="coupon" />
              <button type="button" className="btn btn-ghost" onClick={() => setCoupon(couponInput.trim() || undefined)} data-testid="apply-coupon">{t.checkout.apply}</button>
            </div>
            {coupon && quote?.coupon_error && <p className="mt-1 text-sm text-danger-500" data-testid="coupon-error">{t.couponReasons[quote.coupon_error as keyof typeof t.couponReasons] ?? t.errors.coupon_invalid}</p>}
            {coupon && quote && !quote.coupon_error && quote.coupon_discount > 0 && <p className="mt-1 text-sm text-ok-500" data-testid="coupon-ok">{t.checkout.couponApplied}</p>}
          </div>
          {customer && loyalty.enabled && (
            <div>
              <label htmlFor="reward" className="label flex items-center gap-1.5"><Gift className="size-4" /> {t.checkout.redeemPoints}
                <span className="num font-normal text-espresso-500">· {fill(t.checkout.pointsBalance, { n: loyalty.balance })}</span></label>
              <select id="reward" className="field" value={rewardId ?? ''} onChange={(e) => setRewardId(e.target.value || undefined)} data-testid="reward">
                <option value="">{t.checkout.noReward}</option>
                {loyalty.rewards.map((r) => (
                  <option key={r.id} value={r.id} disabled={r.points_cost > loyalty.balance}>
                    {(locale === 'ar' ? r.name_ar : r.name_en)} — {r.points_cost} {t.account.pointsUnit}
                  </option>
                ))}
              </select>
              {rewardId && quote?.loyalty_error && <p className="mt-1 text-sm text-danger-500">{t.loyaltyReasons[quote.loyalty_error as keyof typeof t.loyaltyReasons]}</p>}
            </div>
          )}
        </section>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="paper rounded-[1.75rem] p-5">
          <h2 className="text-lg font-bold">{t.checkout.summary}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {lines.map((l, i) => (
              <li key={l.key} className="flex justify-between gap-3">
                <span>{l.quantity}× {locale === 'ar' ? l.nameAr : l.nameEn}</span>
                <span className="num shrink-0">{formatMoney(quote?.lines[i]?.line_total ?? l.unitPrice * l.quantity, locale)}</span>
              </li>
            ))}
          </ul>
          {quote && (
            <dl className="mt-4 space-y-2 border-t hairline pt-4 text-sm" data-testid="totals">
              <div className="flex justify-between"><dt>{t.common.subtotal}</dt><dd className="num">{formatMoney(quote.subtotal, locale)}</dd></div>
              {quote.coupon_discount > 0 && <div className="flex justify-between text-ok-500"><dt>{t.checkout.discount}{quote.coupon ? ` (${locale === 'ar' ? quote.coupon.title_ar : quote.coupon.title_en})` : ''}</dt><dd className="num">− {formatMoney(quote.coupon_discount, locale)}</dd></div>}
              {quote.points_discount > 0 && <div className="flex justify-between text-ok-500"><dt>{t.checkout.pointsDiscount}</dt><dd className="num">− {formatMoney(quote.points_discount, locale)}</dd></div>}
              {quote.vat_rate_bps > 0 && (
                <div className="flex justify-between text-espresso-500"><dt>{fill(t.checkout.vat, { rate: quote.vat_rate_bps / 100 })}{quote.prices_include_vat ? ` — ${t.checkout.vatIncluded}` : ''}</dt><dd className="num">{formatMoney(quote.vat_amount, locale)}</dd></div>
              )}
              <div className="flex justify-between border-t hairline pt-3 text-lg font-bold"><dt>{t.common.total}</dt><dd className="num" data-testid="checkout-total">{formatMoney(quote.total, locale)}</dd></div>
            </dl>
          )}
          {loading && <p className="mt-2 text-xs text-espresso-500">{t.cart.checking}</p>}
          {errMsg && <p role="alert" className="mt-3 rounded-xl bg-danger-500/10 p-3 text-sm text-danger-500">{errMsg}</p>}
          {quote && !quote.store.can_order && <p role="alert" className="mt-3 rounded-xl bg-warn-500/15 p-3 text-sm">{t.checkout.storeUnavailable}</p>}
          {submitError && <p role="alert" className="mt-3 rounded-xl bg-danger-500/10 p-3 text-sm text-danger-500" data-testid="submit-error">{submitError}</p>}
          <button type="submit" className="btn btn-lg btn-accent mt-5 w-full" disabled={!canSubmit} data-testid="place-order">
            <Lock className="size-4" />
            {submitting ? t.common.loading : quote && quote.total > 0 ? fill(t.checkout.payNow, { amount: formatMoney(quote.total, locale) }) : t.checkout.placeOrder}
          </button>
          <p className="mt-3 text-xs leading-relaxed text-espresso-500">{t.checkout.terms}</p>
        </div>
      </aside>
    </form>
  );
}
