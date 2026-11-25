'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';
import { formatMoney } from '@/lib/money';
import { studioImage } from '@/lib/studio-media';
import type { Category, CategoryKind, Product } from '@/lib/catalog-types';

/** One calm grid of everything on the menu, filtered with an Apple-style segmented control. */
export function StudioMenu({ categories, products }: { categories: Category[]; products: Product[] }) {
  const { t, locale } = useI18n();
  const s = t.studio;
  const Chevron = locale === 'ar' ? ChevronLeft : ChevronRight;
  const n = (r: { name_ar: string; name_en: string }) => (locale === 'ar' ? r.name_ar : r.name_en);
  const [filter, setFilter] = useState<CategoryKind | 'all'>('all');
  const catName = Object.fromEntries(categories.map((c) => [c.kind, n(c)])) as Record<CategoryKind, string>;
  const order = Object.fromEntries(categories.map((c, i) => [c.kind, i])) as Record<CategoryKind, number>;
  const shown = products
    .filter((p) => filter === 'all' || p.category_kind === filter)
    .sort((a, b) => (order[a.category_kind] ?? 9) - (order[b.category_kind] ?? 9) || a.sort_order - b.sort_order);
  const tabs: { key: CategoryKind | 'all'; label: string }[] = [{ key: 'all', label: s.all }, ...categories.map((c) => ({ key: c.kind, label: n(c) }))];

  return (
    <section id="menu" className="mt-24 scroll-mt-12 bg-cream-200 pb-20 pt-16 sm:pt-20" aria-labelledby="menu-title">
      <div className="mx-auto max-w-[1100px] px-5">
        <div className="text-center">
          <h2 id="menu-title" className="s-display text-[2.4rem] sm:text-[3.5rem]">{s.menuTitle}</h2>
          <p className="mt-2 text-[1.1rem] text-espresso-500">{s.menuSubtitle}</p>
        </div>
        <div className="sticky top-14 z-30 mt-8 flex justify-center">
          <div role="tablist" aria-label={t.menu.title} className="scrollbar-none flex max-w-full gap-1 overflow-x-auto rounded-full bg-white/80 p-1 shadow-[var(--shadow-soft)] backdrop-blur-xl">
            {tabs.map((tab) => (
              <button key={tab.key} type="button" role="tab" aria-selected={filter === tab.key} onClick={() => setFilter(tab.key)}
                className={`relative whitespace-nowrap rounded-full px-4 py-1.5 text-[14px] transition-colors duration-200 ${filter === tab.key ? 'text-white' : 'text-espresso-700 hover:text-espresso-800'}`}
                data-testid={`menu-tab-${tab.key}`}>
                {filter === tab.key && <motion.span layoutId="menu-tab" className="absolute inset-0 rounded-full bg-espresso-800" transition={{ type: 'spring', bounce: 0, duration: 0.35 }} />}
                <span className="relative">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
        {shown.length === 0 ? (
          <p className="mt-10 rounded-3xl bg-white p-6 text-center text-espresso-500">{t.home.emptyCategory}</p>
        ) : (
          <motion.div layout className="mt-10 flex flex-wrap justify-center gap-4">
            <AnimatePresence initial={false} mode="popLayout">
              {shown.map((p) => {
                const desc = locale === 'ar' ? p.description_ar : p.description_en;
                const card = (
                  <article className={`group flex h-full flex-col overflow-hidden rounded-[1.5rem] bg-white transition-shadow duration-300 ${p.available ? 'hover:shadow-[var(--shadow-lift)]' : 'opacity-55'}`} data-testid={`product-${p.slug}`}>
                    <div className="relative aspect-[4/3]">
                      <Image src={studioImage(p.slug, p.category_kind, p.image_url)} alt={n(p)} fill sizes="(min-width:1024px) 360px, (min-width:640px) 50vw, 100vw"
                        className="object-contain p-6 transition-transform duration-500 ease-[var(--ease-out-soft)] group-hover:scale-[1.04]" />
                      {p.is_featured && p.available && <span className="absolute top-4 start-5 text-[12px] font-semibold text-terracotta-500">{t.menu.popular}</span>}
                      {!p.available && <span className="absolute top-4 start-5 text-[12px] font-semibold text-danger-500">{t.menu.unavailable}</span>}
                    </div>
                    <div className="flex flex-1 flex-col px-6 pb-6">
                      <p className="text-[12px] text-espresso-500">{catName[p.category_kind]}</p>
                      <h3 className="text-[1.2rem] font-semibold">{n(p)}</h3>
                      {desc && <p className="mt-1 line-clamp-2 text-[14px] text-espresso-500">{desc}</p>}
                      <div className="mt-auto flex items-center justify-between pt-5">
                        <p className="num text-[15px]">{p.base_price > 0 ? <><span className="text-espresso-500">{t.menu.from} </span>{formatMoney(p.base_price, locale)}</> : t.menu.notPriced}</p>
                        {p.available && <span className="s-btn s-btn-sm">{p.builder === 'simple' ? s.order : s.build}</span>}
                      </div>
                    </div>
                  </article>
                );
                return (
                  <motion.div key={p.id} layout className="w-full sm:w-[calc(50%-0.5rem)] lg:w-[calc((100%-2rem)/3)]" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ type: 'spring', bounce: 0, duration: 0.35 }}>
                    {p.available ? <Link href={`/p/${p.slug}`} className="block h-full rounded-[1.5rem]">{card}</Link> : card}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
        <p className="mt-10 text-center"><Link href="/cart" className="s-link">{s.cart} <Chevron className="size-4" /></Link></p>
      </div>
    </section>
  );
}
