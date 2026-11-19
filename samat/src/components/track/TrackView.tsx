'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChefHat, CircleDashed, MapPin, PackageCheck, Receipt, RefreshCw, ShoppingBag, Sparkles, XCircle } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';
import { fill } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import { browserDb } from '@/lib/supabase/browser';
import { cart } from '@/components/cart/cart-store';
import { ReorderButton } from '@/components/account/ReorderButton';

export interface TrackedOrder {
  id: string;
  order_number: number;
  pickup_code: string;
  status: string;
  payment_status: string;
  customer_name: string;
  subtotal: number;
  discount_total: number;
  vat_amount: number;
  vat_rate_bps: number;
  total: number;
  reject_reason: string | null;
  cancel_reason: string | null;
  estimated_ready_at: string | null;
  created_at: string;
  ready_at: string | null;
  delivered_at: string | null;
  points_earned: number;
  invoice_number: string | null;
  items: { id: string; product_name_ar: string; product_name_en: string; quantity: number; line_total: number; bread_name_ar: string | null; bread_name_en: string | null; notes: string | null;
    customizations: { kind: string; action: string; quantity: number; name_ar: string; name_en: string }[] }[];
}

const FLOW = ['awaiting_approval', 'accepted', 'preparing', 'ready', 'delivered'] as const;

export function TrackView({ token, initial, qrSvg, branch }: {
  token: string; initial: TrackedOrder; qrSvg: string | null;
  branch: { name: string; address: string | null; mapsUrl: string | null };
}) {
  const { t, locale } = useI18n();
  const [o, setO] = useState(initial);
  const [live, setLive] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/track/${token}`, { cache: 'no-store' });
      if (res.ok) setO(await res.json());
    } catch { /* offline: keep last state */ }
  }, [token]);

  // Realtime nudge (PII-free board) + polling fallback for weak connections.
  useEffect(() => {
    const db = browserDb();
    const ch = db.channel(`order-${o.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_board', filter: `order_id=eq.${o.id}` }, () => refresh())
      .subscribe((status) => setLive(status === 'SUBSCRIBED'));
    const active = !['delivered', 'rejected', 'cancelled', 'expired', 'payment_failed'].includes(o.status);
    const poll = active ? setInterval(refresh, live ? 20000 : 6000) : undefined;
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => { db.removeChannel(ch); if (poll) clearInterval(poll); window.removeEventListener('focus', onFocus); };
  }, [o.id, o.status, live, refresh]);

  // once the order is paid and with the restaurant, the cart it came from is done
  useEffect(() => {
    if (o.status !== 'pending_payment' && localStorage.getItem('samat_pending_order') === token) {
      cart.clear();
      localStorage.removeItem('samat_pending_order');
    }
  }, [o.status, token]);

  const copy = (o.status === 'awaiting_approval' && o.payment_status === 'pending_verification')
    ? t.track.status.pending_verification
    : t.track.status[o.status as keyof typeof t.track.status] ?? { title: o.status, text: '' };
  const stepIndex = FLOW.indexOf(o.status as (typeof FLOW)[number]);
  const failed = ['rejected', 'cancelled', 'expired', 'payment_failed'].includes(o.status);
  const showCode = stepIndex >= 0 && o.status !== 'delivered';
  const n = (r: { name_ar: string; name_en: string }) => (locale === 'ar' ? r.name_ar : r.name_en);
  const time = (iso: string) => new Date(iso).toLocaleTimeString(locale === 'ar' ? 'ar-SA' : 'en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' });
  const stepIcons = [CircleDashed, Check, ChefHat, Sparkles, PackageCheck];
  const stepLabels = [t.track.steps.received, t.track.steps.accepted, t.track.steps.preparing, t.track.steps.ready, t.track.steps.delivered];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6" data-testid="track" data-status={o.status}>
      <section className={`relative overflow-hidden rounded-[2rem] p-6 text-cream-100 shadow-lift sm:p-8 ${failed ? 'bg-espresso-700' : o.status === 'ready' ? 'bg-terracotta-500' : 'bg-espresso-900'}`}>
        <div className="absolute -end-16 -top-16 size-64 rounded-full bg-gold-400/20 blur-3xl" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow text-gold-400">{t.track.orderNumber} <span className="num">#{o.order_number}</span></p>
            <AnimatePresence mode="wait">
              <motion.div key={o.status} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
                <h1 className="mt-2 text-3xl font-bold sm:text-4xl" data-testid="status-title">{copy.title}</h1>
                <p className="mt-2 max-w-md text-cream-200/85">{copy.text}</p>
              </motion.div>
            </AnimatePresence>
            {o.estimated_ready_at && ['accepted', 'preparing'].includes(o.status) && (
              <p className="num mt-3 text-sm text-cream-200/80">{fill(t.track.eta, { time: time(o.estimated_ready_at) })}</p>
            )}
          </div>
          <span className={`chip shrink-0 ${live ? 'bg-ok-500/25' : 'bg-cream-100/10'}`}><span className={`size-2 rounded-full ${live ? 'bg-ok-500 animate-pulse' : 'bg-cream-300'}`} /> {t.track.live}</span>
        </div>

        {!failed && o.status !== 'pending_payment' && (
          <ol className="relative mt-8 grid grid-cols-5 gap-1" aria-label={t.track.title}>
            {FLOW.map((s, i) => {
              const Icon = stepIcons[i];
              const done = i <= stepIndex;
              return (
                <li key={s} className="flex flex-col items-center gap-2 text-center">
                  <span className={`grid size-10 place-items-center rounded-full transition-all duration-500 ${done ? 'bg-cream-100 text-espresso-900' : 'bg-cream-100/10 text-cream-200/50'} ${i === stepIndex && s !== 'delivered' ? 'animate-pulse-ring' : ''}`}>
                    <Icon className="size-5" />
                  </span>
                  <span className={`text-[11px] font-semibold sm:text-xs ${done ? '' : 'text-cream-200/50'}`}>{stepLabels[i]}</span>
                </li>
              );
            })}
          </ol>
        )}
        {o.status === 'pending_payment' && <Link href={`/pay/${token}`} className="btn btn-cream relative mt-6">{t.track.payNow}</Link>}
      </section>

      {o.status === 'rejected' && (
        <div className="mt-4 rounded-3xl bg-danger-500/10 p-5" data-testid="rejected">
          <p className="flex items-center gap-2 font-bold text-danger-500"><XCircle className="size-5" /> {copy.title}</p>
          {o.reject_reason && <p className="mt-2 text-sm"><strong>{t.track.reason}:</strong> {o.reject_reason}</p>}
        </div>
      )}
      {['refund_pending', 'refunded', 'voided'].includes(o.payment_status) && (
        <p className="mt-4 rounded-2xl bg-warn-500/10 p-4 text-sm" data-testid="refund-status">
          {o.payment_status === 'refund_pending' ? t.track.refundPending : t.track.refunded}
        </p>
      )}

      {showCode && (
        <section className="paper mt-5 grid items-center gap-6 rounded-[2rem] p-6 sm:grid-cols-[auto_1fr]" data-testid="pickup">
          {qrSvg && <div className="mx-auto size-44 rounded-2xl bg-white p-3 shadow-soft [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />}
          <div className="text-center sm:text-start">
            <p className="text-sm text-espresso-500">{t.track.pickupCode}</p>
            <p className="num mt-1 text-4xl font-bold tracking-[0.25em]" dir="ltr" data-testid="pickup-code">{o.pickup_code}</p>
            <p className="mt-2 text-sm text-espresso-600">{t.track.showAtCounter}</p>
          </div>
        </section>
      )}

      {o.status === 'delivered' && o.points_earned > 0 && (
        <p className="mt-4 rounded-2xl bg-ok-500/10 p-4 text-sm font-semibold text-ok-500">{fill(t.track.pointsEarned, { n: o.points_earned })}</p>
      )}

      <section className="glass mt-5 rounded-[2rem] p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">{t.track.items}</h2>
          <button type="button" onClick={refresh} className="btn btn-sm btn-ghost"><RefreshCw className="size-3.5" /> {t.track.refresh}</button>
        </div>
        <ul className="mt-4 divide-y hairline">
          {o.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-4 py-3">
              <div>
                <p className="font-semibold">{i.quantity}× {locale === 'ar' ? i.product_name_ar : i.product_name_en}</p>
                <p className="text-sm text-espresso-600">
                  {[locale === 'ar' ? i.bread_name_ar : i.bread_name_en,
                    ...i.customizations.filter((c) => c.kind !== 'bread' && c.action !== 'included').map((c) =>
                      c.action === 'removed' ? `${t.builder.without} ${n(c)}` : c.action === 'selected' ? n(c) : `+ ${n(c)}${c.quantity > 1 ? ` ×${c.quantity}` : ''}`)]
                    .filter(Boolean).join(' · ')}
                </p>
                {i.notes && <p className="text-xs italic text-espresso-500">“{i.notes}”</p>}
              </div>
              <p className="num shrink-0 font-semibold">{formatMoney(i.line_total, locale)}</p>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1 border-t hairline pt-3 text-sm">
          {o.discount_total > 0 && <div className="flex justify-between text-ok-500"><dt>{t.checkout.discount}</dt><dd className="num">− {formatMoney(o.discount_total, locale)}</dd></div>}
          {o.vat_rate_bps > 0 && <div className="flex justify-between text-espresso-500"><dt>{fill(t.checkout.vat, { rate: o.vat_rate_bps / 100 })}</dt><dd className="num">{formatMoney(o.vat_amount, locale)}</dd></div>}
          <div className="flex justify-between text-lg font-bold"><dt>{t.common.total}</dt><dd className="num">{formatMoney(o.total, locale)}</dd></div>
        </dl>
        <div className="mt-5 flex flex-wrap gap-2">
          {o.invoice_number && <Link href={`/t/${token}/invoice`} className="btn btn-sm btn-ghost"><Receipt className="size-4" /> {t.track.invoice} {o.invoice_number}</Link>}
          {['delivered', 'rejected', 'cancelled', 'expired', 'payment_failed'].includes(o.status) && <ReorderButton token={token} />}
          <Link href="/#menu" className="btn btn-sm btn-ghost"><ShoppingBag className="size-4" /> {t.nav.menu}</Link>
        </div>
      </section>

      <section className="paper mt-5 flex flex-wrap items-center justify-between gap-4 rounded-[2rem] p-6">
        <div>
          <p className="eyebrow text-terracotta-500">{t.track.branch}</p>
          <p className="mt-1 font-bold">{branch.name}</p>
          {branch.address && <p className="text-sm text-espresso-600">{branch.address}</p>}
        </div>
        {branch.mapsUrl && <a href={branch.mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary"><MapPin className="size-4" /> {t.track.directions}</a>}
      </section>
    </div>
  );
}
