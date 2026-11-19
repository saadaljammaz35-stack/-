'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Lock, Minus, Plus, RotateCcw, ShoppingBag, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';
import { fill } from '@/lib/i18n';
import { formatMoney } from '@/lib/money';
import {
  breadChoices, burgerLayers, defaultSelection, describeSelection, ingredientQty, ingredientUnitPrice,
  isIngredientAvailable, isSauceAvailable, layerIngredients, priceSelection, sauceQty, sauceUnitPrice, shawarmaLayers, validateSelection,
} from '@/lib/builder';
import type { Availability, Product, ProductIngredient, Selection, StoreState } from '@/lib/catalog-types';
import { cart } from '@/components/cart/cart-store';
import { BurgerStage, ShawarmaStage, type StageLayer } from './Stage';
import { AnimatedPrice } from '@/components/ui/AnimatedPrice';

function Stepper({ value, min, max, onChange, label, testId }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string; testId?: string }) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-cream-200/80 p-1" role="group" aria-label={label} data-testid={testId}>
      <button type="button" className="grid size-8 place-items-center rounded-full bg-white shadow-sm transition active:scale-90 disabled:opacity-30"
        onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={`− ${label}`}>
        <Minus className="size-4" />
      </button>
      <span className="num w-6 text-center text-sm font-bold" aria-live="polite">{value}</span>
      <button type="button" className="grid size-8 place-items-center rounded-full bg-espresso-800 text-cream-100 shadow-sm transition active:scale-90 disabled:opacity-30"
        onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`+ ${label}`}>
        <Plus className="size-4" />
      </button>
    </div>
  );
}

export function Builder({ product, availability, state, fallbackImage }: {
  product: Product; availability: Availability; state: StoreState; fallbackImage: string;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const editKey = params.get('edit');
  const n = (r: { name_ar: string; name_en: string }) => (locale === 'ar' ? r.name_ar : r.name_en);

  const [sel, setSel] = useState<Selection>(() => defaultSelection(product, availability));
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedEdit = useRef(false);

  // editing a line that is already in the cart
  useEffect(() => {
    if (!editKey || loadedEdit.current) return;
    loadedEdit.current = true;
    const line = cart.get().find((l) => l.key === editKey && l.productId === product.id);
    if (line) {
      setSel(line.selection);
      setQty(line.quantity);
    }
  }, [editKey, product.id]);

  const price = useMemo(() => priceSelection(product, sel, qty), [product, sel, qty]);
  const summary = useMemo(() => describeSelection(product, sel, locale), [product, sel, locale]);
  const breads = breadChoices(product);
  const layered = layerIngredients(product);
  const bun = layered.find((pi) => pi.role === 'base' && pi.ingredient.kind === 'bread');
  const fillings = layered.filter((pi) => pi !== bun);
  const included = fillings.filter((pi) => pi.role !== 'extra');
  const extras = fillings.filter((pi) => pi.role === 'extra');

  const setIng = (pi: ProductIngredient, q: number) => {
    const min = pi.role === 'base' ? 1 : 0;
    const v = Math.max(min, Math.min(pi.max_qty, q));
    setSel((s) => ({ ...s, ingredients: { ...s.ingredients, [pi.ingredient_id]: v } }));
  };
  const toggleIng = (pi: ProductIngredient) => {
    if (pi.role === 'base') return; // essentials (the bun, the main protein) cannot be removed
    if (!isIngredientAvailable(pi, availability)) return;
    const q = ingredientQty(pi, sel);
    setIng(pi, q > 0 ? 0 : Math.max(pi.default_qty, 1));
  };

  const stageLayers: StageLayer[] = useMemo(() => {
    const base = product.builder === 'shawarma' ? shawarmaLayers(product, sel, locale) : burgerLayers(product, sel, locale);
    return base.map((l) => {
      const id = l.key.replace(/-\d+$/, '');
      const pi = layered.find((x) => x.ingredient_id === id);
      const ps = product.sauces.find((x) => `sauce-${x.sauce_id}` === l.key);
      return {
        ...l,
        ingredientKind: pi?.ingredient.kind,
        removable: Boolean((pi && pi.role !== 'base') || ps),
        onTap: pi && pi.role !== 'base' ? () => setIng(pi, ingredientQty(pi, sel) - 1)
          : ps ? () => setSel((s) => ({ ...s, sauces: { ...s.sauces, [ps.sauce_id]: 0 } })) : undefined,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, sel, locale]);

  const addToCart = () => {
    const errs = validateSelection(product, sel);
    if (errs.length) {
      setError(t.errors[errs[0] as keyof typeof t.errors] ?? t.common.error);
      return;
    }
    setError(null);
    const line = {
      productId: product.id,
      slug: product.slug,
      quantity: qty,
      selection: sel,
      nameAr: product.name_ar,
      nameEn: product.name_en,
      imageUrl: product.image_url ?? fallbackImage,
      unitPrice: price.unit,
      summaryAr: describeSelection(product, sel, 'ar'),
      summaryEn: describeSelection(product, sel, 'en'),
    };
    if (editKey && cart.get().some((l) => l.key === editKey)) {
      cart.replace(editKey, line);
      router.push('/cart');
      return;
    }
    cart.add(line);
    setAdded(true);
    setTimeout(() => setAdded(false), 2200);
  };

  const title = product.builder === 'burger' ? t.builder.burgerTitle : product.builder === 'shawarma' ? t.builder.shawarmaTitle : n(product);

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 pb-40 pt-4 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:gap-10 lg:pb-16" data-testid="builder">
      {/* -------------------------------------------------- stage */}
      <section className="min-w-0 lg:sticky lg:top-24 lg:self-start">
        <div className="relative overflow-hidden rounded-[2rem] bg-espresso-900 px-4 pb-6 pt-10 shadow-lift sm:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_75%,rgba(201,166,107,0.38),transparent_70%)]" />
          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(to_top,rgba(176,138,94,0.35),transparent)]" />
          <div className="relative">
            <p className="eyebrow text-center text-gold-400">{n(product)}</p>
            <h1 className="mt-1 text-center text-2xl font-bold text-cream-100 sm:text-3xl">{title}</h1>
            <div className="mt-6" data-testid="stage">
              {product.builder === 'burger' && <BurgerStage layers={stageLayers} label={summary.join(', ') || n(product)} />}
              {product.builder === 'shawarma' && <ShawarmaStage layers={stageLayers} label={summary.join(', ') || n(product)} />}
              {product.builder === 'simple' && (
                <div className="relative mx-auto aspect-square w-full max-w-[420px]">
                  <Image src={product.image_url ?? fallbackImage} alt={n(product)} fill priority sizes="420px" className="object-contain drop-shadow-[0_24px_24px_rgba(0,0,0,0.45)]" />
                </div>
              )}
            </div>
            {product.builder !== 'simple' && <p className="mt-4 text-center text-xs text-cream-200/60">{t.builder.layersHint}</p>}
          </div>
        </div>
        <div className="mt-3 flex min-h-8 flex-wrap justify-center gap-1.5" aria-live="polite" data-testid="summary">
          <AnimatePresence initial={false}>
            {summary.map((s) => (
              <motion.span key={s} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
                className={`chip ${s.startsWith(t.builder.without) ? 'bg-terracotta-500/10 text-terracotta-600' : 'bg-espresso-800/5 text-espresso-700'}`}>
                {s}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      </section>

      {/* -------------------------------------------------- controls */}
      <section className="min-w-0 space-y-5 [&_fieldset]:scroll-mt-28 [&_fieldset]:scroll-mb-36">
        {!state.can_order && (
          <p role="status" className="rounded-2xl bg-warn-500/15 px-4 py-3 text-sm font-medium text-espresso-800">
            {state.reason === 'paused' ? t.store.pausedDefault : state.reason === 'closed' ? t.store.closedDefault : t.store.capacity}
          </p>
        )}
        <div className="hidden lg:block">
          <h2 className="text-3xl font-bold">{n(product)}</h2>
          {(locale === 'ar' ? product.description_ar : product.description_en) && (
            <p className="mt-2 text-espresso-600">{locale === 'ar' ? product.description_ar : product.description_en}</p>
          )}
        </div>

        {/* bread */}
        {breads.length > 0 && (
          <fieldset className="glass rounded-3xl p-4" data-testid="bread-choice">
            <legend className="sr-only">{t.builder.bread}</legend>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold">{t.builder.bread}</h3>
              <span className="chip bg-espresso-800/5 text-espresso-600"><Lock className="size-3" /> {t.common.required}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {breads.map((b) => {
                const ok = isIngredientAvailable(b, availability);
                const active = sel.breadId === b.ingredient_id;
                const p = ingredientUnitPrice(b);
                return (
                  <label key={b.ingredient_id} className={`relative flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 p-3 transition ${active ? 'border-espresso-800 bg-white shadow-soft' : 'border-transparent bg-cream-100/70'} ${ok ? '' : 'pointer-events-none opacity-40'}`}>
                    <input type="radio" name="bread" className="sr-only" checked={active} disabled={!ok}
                      onChange={() => setSel((s) => ({ ...s, breadId: b.ingredient_id }))} data-testid={`bread-${b.ingredient.slug}`} />
                    {b.ingredient.thumb_url && <Image src={b.ingredient.thumb_url} alt="" width={84} height={84} className="size-16 object-contain" />}
                    <span className="text-sm font-semibold">{n(b.ingredient)}</span>
                    {p > 0 && <span className="num text-xs text-espresso-500">+{formatMoney(p, locale)}</span>}
                    {!ok && <span className="text-xs text-danger-500">{t.builder.unavailable}</span>}
                    {active && <Check className="absolute top-2 end-2 size-4" />}
                  </label>
                );
              })}
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-espresso-500"><Lock className="size-3" /> {t.builder.breadLocked}</p>
          </fieldset>
        )}

        {/* the bun: always there, never removable */}
        {bun && (
          <div className="glass flex items-center gap-3 rounded-3xl p-4" data-testid="bun-locked">
            {bun.ingredient.thumb_url && <Image src={bun.ingredient.thumb_url} alt="" width={64} height={64} className="size-12 object-contain" />}
            <div className="flex-1">
              <p className="font-semibold">{n(bun.ingredient)}</p>
              <p className="text-xs text-espresso-500">{t.builder.breadLocked}</p>
            </div>
            <span className="chip bg-espresso-800 text-cream-100"><Lock className="size-3" /> {t.builder.base}</span>
          </div>
        )}

        {included.length > 0 && (
          <IngredientGroup title={t.builder.ingredients} items={included} sel={sel} availability={availability}
            onToggle={toggleIng} onQty={setIng} />
        )}
        {extras.length > 0 && (
          <IngredientGroup title={t.builder.extras} items={extras} sel={sel} availability={availability}
            onToggle={toggleIng} onQty={setIng} />
        )}

        {/* sauces */}
        {product.sauces.length > 0 && (
          <div className="glass rounded-3xl p-4" data-testid="sauces">
            <h3 className="mb-3 font-bold">{t.builder.sauces}</h3>
            <ul className="space-y-2">
              {product.sauces.map((ps) => {
                const q = sauceQty(ps, sel);
                const ok = isSauceAvailable(ps, availability);
                const unit = sauceUnitPrice(ps);
                return (
                  <li key={ps.sauce_id} className={`scroll-mt-28 scroll-mb-36 flex items-center gap-3 rounded-2xl bg-cream-100/70 p-2.5 ${ok ? '' : 'opacity-40'}`} data-testid={`sauce-${ps.sauce.slug}`}>
                    <span className="size-9 shrink-0 rounded-full ring-4 ring-white" style={{ background: ps.sauce.color ?? '#ccc' }} />
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{n(ps.sauce)}</p>
                      <p className="num text-xs text-espresso-500">
                        {!ok ? t.builder.unavailable : ps.included_qty > 0 ? `${ps.included_qty}× ${t.common.free}${unit ? ` · +${formatMoney(unit, locale)}` : ''}` : unit ? `+${formatMoney(unit, locale)}` : t.common.free}
                      </p>
                    </div>
                    {ok && (q === 0 ? (
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => setSel((s) => ({ ...s, sauces: { ...s.sauces, [ps.sauce_id]: 1 } }))} aria-label={`${t.common.add} ${n(ps.sauce)}`}>
                        <Plus className="size-4" /> {t.common.add}
                      </button>
                    ) : (
                      <Stepper value={q} min={0} max={ps.max_qty} label={n(ps.sauce)}
                        onChange={(v) => setSel((s) => ({ ...s, sauces: { ...s.sauces, [ps.sauce_id]: v } }))} />
                    ))}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* option groups (e.g. sizes defined by the restaurant) */}
        {product.option_groups.map((g) => (
          <fieldset key={g.id} className="glass rounded-3xl p-4" data-testid={`group-${g.id}`}>
            <legend className="sr-only">{n(g)}</legend>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold">{n(g)}</h3>
              <span className="text-xs text-espresso-500">{g.selection === 'single' ? t.builder.selectOne : fill(t.builder.selectUpTo, { n: g.max_select })}{g.is_required ? ` · ${t.common.required}` : ''}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {g.options.map((o) => {
                const ok = o.is_active && (availability.options[o.id] ?? true);
                const on = sel.options.includes(o.id);
                return (
                  <button type="button" key={o.id} disabled={!ok}
                    className={`rounded-2xl border-2 p-3 text-start transition ${on ? 'border-espresso-800 bg-white shadow-soft' : 'border-transparent bg-cream-100/70'} disabled:opacity-40`}
                    onClick={() => setSel((s) => {
                      const others = s.options.filter((id) => !g.options.some((x) => x.id === id));
                      const mine = s.options.filter((id) => g.options.some((x) => x.id === id));
                      const next = g.selection === 'single' ? (on && !g.is_required ? [] : [o.id])
                        : on ? mine.filter((x) => x !== o.id) : mine.length < g.max_select ? [...mine, o.id] : mine;
                      return { ...s, options: [...others, ...next] };
                    })}
                    aria-pressed={on}>
                    <span className="block text-sm font-semibold">{n(o)}</span>
                    <span className="num text-xs text-espresso-500">{o.price_delta ? `+${formatMoney(o.price_delta, locale)}` : '—'}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}

        <div className="glass rounded-3xl p-4">
          <label htmlFor="notes" className="label">{t.builder.notes} <span className="font-normal text-espresso-500">({t.common.optional})</span></label>
          <textarea id="notes" className="field min-h-20" maxLength={200} placeholder={t.builder.notesPlaceholder}
            value={sel.notes} onChange={(e) => setSel((s) => ({ ...s, notes: e.target.value }))} />
        </div>

        <button type="button" className="btn btn-sm btn-ghost" onClick={() => { setSel(defaultSelection(product, availability)); setQty(1); }}>
          <RotateCcw className="size-4" /> {t.builder.reset}
        </button>
      </section>

      {/* -------------------------------------------------- sticky add bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] lg:static lg:col-span-2 lg:px-0 lg:pb-0">
        <div className="glass mx-auto flex max-w-3xl items-center gap-3 rounded-[1.6rem] p-2.5 shadow-lift">
          <Stepper value={qty} min={1} max={20} onChange={setQty} label={t.common.quantity} testId="qty" />
          <div className="ms-1 hidden flex-col sm:flex">
            <span className="text-xs text-espresso-500">{t.builder.liveTotal}</span>
            <AnimatedPrice value={price.line} locale={locale} className="text-lg font-bold" />
          </div>
          <button type="button" className="btn btn-lg btn-primary ms-auto flex-1 sm:flex-none" onClick={addToCart} disabled={!product.available} data-testid="add-to-cart">
              <ShoppingBag className="size-5" />
              <span>{editKey ? t.builder.updateCart : t.builder.addToCart}</span>
              <span className="num opacity-80 sm:hidden">· <AnimatedPrice value={price.line} locale={locale} /></span>
            </button>
        </div>
        {error && <p role="alert" className="mx-auto mt-2 max-w-3xl rounded-2xl bg-danger-500 px-4 py-2 text-sm text-white">{error}</p>}
      </div>

      <AnimatePresence>
        {added && (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed inset-x-3 bottom-28 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-espresso-900 px-4 py-3 text-cream-100 shadow-lift lg:bottom-8" role="status" data-testid="added-toast">
            <span className="grid size-8 place-items-center rounded-full bg-ok-500"><Check className="size-4" /></span>
            <span className="flex-1 font-semibold">{t.builder.addedToCart}</span>
            <Link href="/cart" className="btn btn-sm btn-cream">{t.cart.continue}</Link>
            <button type="button" aria-label={t.common.close} onClick={() => setAdded(false)}><X className="size-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function IngredientGroup({ title, items, sel, availability, onToggle, onQty }: {
  title: string; items: ProductIngredient[]; sel: Selection; availability: Availability;
  onToggle: (pi: ProductIngredient) => void; onQty: (pi: ProductIngredient, q: number) => void;
}) {
  const { t, locale } = useI18n();
  return (
    <div className="glass rounded-3xl p-4">
      <h3 className="mb-3 font-bold">{title}</h3>
      <ul className="grid grid-cols-1 gap-2">
        {items.map((pi) => {
          const q = ingredientQty(pi, sel);
          const ok = isIngredientAvailable(pi, availability);
          const unit = ingredientUnitPrice(pi);
          const on = q > 0;
          const name = locale === 'ar' ? pi.ingredient.name_ar : pi.ingredient.name_en;
          return (
            <li key={pi.ingredient_id} data-testid={`ing-${pi.ingredient.slug}`} data-qty={q}
              className={`scroll-mt-28 scroll-mb-36 flex items-center gap-2.5 rounded-2xl p-2 transition ${on ? 'bg-white shadow-soft' : 'bg-cream-100/60'} ${ok ? '' : 'opacity-45'}`}>
              <button type="button" onClick={() => onToggle(pi)} disabled={!ok || pi.role === 'base'}
                className="relative size-12 shrink-0 rounded-xl bg-cream-200/80" aria-pressed={on}
                aria-label={on ? `${t.builder.remove} ${name}` : `${t.common.add} ${name}`}>
                {pi.ingredient.thumb_url && <Image src={pi.ingredient.thumb_url} alt="" fill sizes="48px" className={`object-contain p-1 transition ${on ? '' : 'grayscale opacity-50'}`} />}
                {pi.role === 'base' && <Lock className="absolute -top-1 -end-1 size-4 rounded-full bg-espresso-800 p-0.5 text-cream-100" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-semibold ${on ? '' : 'text-espresso-500 line-through decoration-terracotta-500/60'}`}>{name}</p>
                <p className="num text-xs text-espresso-500">
                  {!ok ? t.builder.unavailable : pi.role === 'base' ? t.builder.base : unit ? `+${formatMoney(unit, locale)}` : t.common.free}
                </p>
              </div>
              {ok && (pi.max_qty > 1 && on ? (
                <div className="scale-90"><StepperInline pi={pi} q={q} onQty={onQty} /></div>
              ) : pi.role !== 'base' ? (
                <button type="button" onClick={() => onToggle(pi)} className={`grid size-9 place-items-center rounded-full transition active:scale-90 ${on ? 'bg-terracotta-500/10 text-terracotta-600' : 'bg-espresso-800 text-cream-100'}`}
                  aria-label={on ? `${t.builder.remove} ${name}` : `${t.common.add} ${name}`} data-testid={`toggle-${pi.ingredient.slug}`}>
                  {on ? <X className="size-4" /> : <Plus className="size-4" />}
                </button>
              ) : null)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StepperInline({ pi, q, onQty }: { pi: ProductIngredient; q: number; onQty: (pi: ProductIngredient, q: number) => void }) {
  const { locale } = useI18n();
  return (
    <Stepper value={q} min={pi.role === 'base' ? 1 : 0} max={pi.max_qty} onChange={(v) => onQty(pi, v)}
      label={locale === 'ar' ? pi.ingredient.name_ar : pi.ingredient.name_en} testId={`step-${pi.ingredient.slug}`} />
  );
}

