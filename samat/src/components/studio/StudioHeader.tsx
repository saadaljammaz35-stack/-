'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ShoppingBag, UserRound } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';
import { useCartCount } from '@/components/cart/cart-store';
import { Logo } from '@/components/brand/Logo';
import type { StoreState } from '@/lib/catalog-types';

/** Apple-style global bar: thin, translucent, content scrolls underneath; a hairline appears only once it overlaps content. */
export function StudioHeader({ state, demoBanner, preview }: { state: StoreState; demoBanner?: string | null; preview: boolean }) {
  const { t, locale, setLocale, switching } = useI18n();
  const count = useCartCount();
  const [scrolled, setScrolled] = useState(false);
  const [bump, setBump] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => {
    if (!count) return;
    setBump(true);
    const id = setTimeout(() => setBump(false), 450);
    return () => clearTimeout(id);
  }, [count]);

  const open = state.can_order;
  return (
    <>
      {preview && (
        <div className="bg-espresso-800 px-4 py-2 text-center text-[13px] text-white/85" data-testid="design-preview">
          {t.studio.preview} · <a href="/?design=old" className="font-medium text-white underline underline-offset-2">{t.studio.backToClassic}</a>
        </div>
      )}
      {demoBanner && <div className="bg-cream-200 px-4 py-1.5 text-center text-[12px] text-espresso-500" data-testid="demo-banner">{demoBanner}</div>}
      <header className={`s-nav sticky top-0 z-40 pt-[env(safe-area-inset-top)] transition-[box-shadow] duration-300 ${scrolled ? 'shadow-[0_1px_0_rgb(0_0_0/0.08)]' : ''}`}>
        <div className="mx-auto flex h-12 max-w-[1024px] items-center gap-6 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-1.5 text-espresso-800" aria-label="SAMAT — home">
            <Logo variant="icon" height={24} />
            <Logo variant="wordmark" height={19} />
          </Link>
          <nav className="hidden flex-1 items-center justify-center gap-7 text-[13px] text-espresso-800/80 md:flex" aria-label={t.studio.navMenu}>
            <Link href="/#menu" className="hover:text-espresso-800">{t.studio.navMenu}</Link>
            <Link href="/p/samat-burger" className="hover:text-espresso-800">{t.studio.heroLink}</Link>
            <Link href="/#packaging" className="hover:text-espresso-800">{t.studio.navPackaging}</Link>
            <Link href="/#branch" className="hover:text-espresso-800">{t.studio.navBranch}</Link>
          </nav>
          <div className="ms-auto flex items-center gap-1 md:ms-0">
            <span className="me-2 hidden items-center gap-1.5 text-[12px] text-espresso-500 lg:inline-flex" data-testid="store-status">
              <span className={`size-1.5 rounded-full ${open ? (state.busy_mode ? 'bg-warn-500' : 'bg-ok-500') : 'bg-danger-500'}`} />
              {!state.accepting_orders ? t.store.paused : !state.open_now ? t.store.closed : state.busy_mode || state.reason === 'capacity' ? t.store.busy : t.store.open}
            </span>
            <button type="button" onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')} disabled={switching}
              className="grid h-9 min-w-9 place-items-center rounded-full px-2 text-[13px] font-medium text-espresso-800/80 hover:bg-black/5 hover:text-espresso-800"
              aria-label={t.common.language} data-testid="lang-toggle">
              {locale === 'ar' ? 'EN' : 'ع'}
            </button>
            <Link href="/account" className="grid size-9 place-items-center rounded-full text-espresso-800/80 hover:bg-black/5 hover:text-espresso-800" aria-label={t.nav.account}>
              <UserRound className="size-[19px]" strokeWidth={1.75} />
            </Link>
            <Link href="/cart" className="relative grid size-9 place-items-center rounded-full text-espresso-800/80 hover:bg-black/5 hover:text-espresso-800"
              aria-label={`${t.nav.cart} (${count})`} data-testid="cart-button">
              <ShoppingBag className="size-[19px]" strokeWidth={1.75} />
              {count > 0 && (
                <span className={`num absolute -top-0.5 -end-0.5 grid min-w-[18px] place-items-center rounded-full bg-terracotta-500 px-1 text-[11px] font-semibold leading-[18px] text-white ${bump ? 'animate-pop' : ''}`} data-testid="cart-count">
                  {count}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}
