'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, ArrowLeft, ArrowRight, Minus, Pencil, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';
import { formatMoney } from '@/lib/money';
import { cart, useCart, useHydrated } from './cart-store';
import { useQuote } from './useQuote';

export function CartView() {
  const { t, locale } = useI18n();
  const lines = useCart();
  const hydrated = useHydrated();
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    const m = sessionStorage.getItem('samat_reorder_msg');
    if (m) { setNotice(m); sessionStorage.removeItem('samat_reorder_msg'); }
  }, []);
  const { quote, error, loading } = useQuote(lines);
  const Arrow = locale === 'ar' ? ArrowLeft : ArrowRight;

  // keep the stored preview prices in line with the server
  useEffect(() => {
    if (!quote) return;
    const prices: Record<string, number> = {};
    quote.lines.forEach((ql, i) => { if (lines[i] && lines[i].unitPrice !== ql.unit_price) prices[lines[i].key] = ql.unit_price; });
    if (Object.keys(prices).length) cart.setUnitPrices(prices);
  }, [quote, lines]);

  if (!hydrated) return <div className="mx-auto h-64 max-w-6xl animate-pulse px-4 py-8 sm:px-8"><div className="h-full rounded-3xl bg-sand-300/40" /></div>;
  if (!lines.length) {
    return (
      <div className="mx-auto max-w-md px-5 py-24 text-center" data-testid="cart-empty">
        <div className="mx-auto grid size-20 place-items-center rounded-full bg-espresso-800 text-cream-100"><ShoppingBag className="size-9" /></div>
        <h1 className="mt-6 text-3xl font-bold">{t.cart.empty}</h1>
        <p className="mt-2 text-espresso-600">{t.cart.emptyText}</p>
        <Link href="/#menu" className="btn btn-lg btn-primary mt-8">{t.cart.browse}</Link>
      </div>
    );
  }

  const badLine = error?.line ? error.line - 1 : -1;
  const errMsg = error ? (t.errors[error.code as keyof typeof t.errors] ?? t.common.error) : null;

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-4 py-8 sm:px-8 lg:grid-cols-[1fr_380px]">
      <section>
        <h1 className="text-3xl font-bold">{t.cart.title}</h1>
        {notice && <p role="status" className="mt-4 rounded-2xl bg-gold-400/20 px-4 py-3 text-sm" data-testid="reorder-notice">{notice}</p>}
        <ul className="mt-6 space-y-3" data-testid="cart-lines">
          <AnimatePresence initial={false}>
            {lines.map((l, i) => (
              <motion.li key={l.key} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 40 }}
                className={`glass flex gap-3 rounded-3xl p-3 sm:gap-4 sm:p-4 ${i === badLine ? 'ring-2 ring-danger-500' : ''}`} data-testid="cart-line">
                <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl bg-sand-300/60 sm:size-24">
                  {l.imageUrl && <Image src={l.imageUrl} alt="" fill sizes="96px" className="object-contain p-1.5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-bold">{locale === 'ar' ? l.nameAr : l.nameEn}</h2>
                    <p className="num shrink-0 font-semibold">{formatMoney((quote?.lines[i]?.line_total) ?? l.unitPrice * l.quantity, locale)}</p>
                  </div>
                  {(locale === 'ar' ? l.summaryAr : l.summaryEn).length > 0 && (
                    <p className="mt-1 text-sm text-espresso-600">{(locale === 'ar' ? l.summaryAr : l.summaryEn).join(' · ')}</p>
                  )}
                  {l.selection.notes && <p className="mt-1 text-xs italic text-espresso-500">“{l.selection.notes}”</p>}
                  {i === badLine && <p className="mt-1 flex items-center gap-1 text-sm text-danger-500"><AlertTriangle className="size-4" /> {errMsg}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 rounded-full bg-cream-200/80 p-1">
                      <button type="button" className="grid size-8 place-items-center rounded-full bg-white" onClick={() => cart.setQuantity(l.key, l.quantity - 1)} aria-label={`− ${t.common.quantity}`}><Minus className="size-4" /></button>
                      <span className="num w-6 text-center text-sm font-bold" data-testid="line-qty">{l.quantity}</span>
                      <button type="button" className="grid size-8 place-items-center rounded-full bg-espresso-800 text-cream-100" onClick={() => cart.setQuantity(l.key, l.quantity + 1)} aria-label={`+ ${t.common.quantity}`}><Plus className="size-4" /></button>
                    </div>
                    <Link href={`/p/${l.slug}?edit=${l.key}`} className="btn btn-sm btn-ghost"><Pencil className="size-3.5" /> {t.cart.edit}</Link>
                    <button type="button" className="btn btn-sm btn-ghost text-danger-500" onClick={() => cart.remove(l.key)} data-testid="remove-line"><Trash2 className="size-3.5" /> {t.cart.remove}</button>
                  </div>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        <Link href="/#menu" className="btn btn-ghost mt-5">+ {t.cart.addMore}</Link>
      </section>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="paper rounded-[1.75rem] p-5" data-testid="cart-summary">
          <h2 className="text-lg font-bold">{t.checkout.summary}</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><dt>{t.common.subtotal}</dt><dd className="num">{quote ? formatMoney(quote.subtotal, locale) : '—'}</dd></div>
            {quote && quote.coupon_discount > 0 && (
              <div className="flex justify-between text-ok-500"><dt>{locale === 'ar' ? quote.coupon?.title_ar : quote.coupon?.title_en}</dt><dd className="num">− {formatMoney(quote.coupon_discount, locale)}</dd></div>
            )}
            <div className="flex justify-between border-t hairline pt-3 text-base font-bold"><dt>{t.common.total}</dt>
              <dd className="num" data-testid="cart-total">{quote ? formatMoney(quote.total, locale) : '—'}</dd></div>
            {quote?.prices_include_vat && quote.vat_amount > 0 && <p className="text-xs text-espresso-500">{t.cart.vatIncluded} ({formatMoney(quote.vat_amount, locale)})</p>}
          </dl>
          {loading && <p className="mt-3 text-xs text-espresso-500" aria-live="polite">{t.cart.checking}</p>}
          {error && badLine < 0 && <p role="alert" className="mt-3 rounded-xl bg-danger-500/10 p-3 text-sm text-danger-500">{errMsg}</p>}
          {quote && quote.unavailable.length > 0 && (
            <p role="alert" className="mt-3 rounded-xl bg-danger-500/10 p-3 text-sm text-danger-500">
              {t.errors.out_of_stock}: {quote.unavailable.map((u) => (locale === 'ar' ? u.name_ar : u.name_en)).join('، ')}
            </p>
          )}
          <Link href="/checkout" aria-disabled={!quote || !!error || quote.unavailable.length > 0}
            className={`btn btn-lg btn-primary mt-5 w-full ${!quote || error || quote.unavailable.length ? 'pointer-events-none opacity-40' : ''}`} data-testid="go-checkout">
            {t.cart.continue} <Arrow className="size-5" />
          </Link>
        </div>
      </aside>
    </div>
  );
}
