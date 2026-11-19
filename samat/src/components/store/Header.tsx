'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ShoppingBag, UserRound } from 'lucide-react';
import { useI18n } from '@/lib/i18n/client';
import { useCartCount } from '@/components/cart/cart-store';
import { Logo } from '@/components/brand/Logo';
import type { StoreState } from '@/lib/catalog-types';

export function StatusPill({ state, tone = 'light' }: { state: StoreState; tone?: 'light' | 'dark' }) {
  const { t } = useI18n();
  const label = !state.accepting_orders ? t.store.paused : !state.open_now ? t.store.closed : state.reason === 'capacity' ? t.store.busy : state.busy_mode ? t.store.busy : t.store.open;
  const color = state.can_order ? (state.busy_mode ? 'bg-warn-500' : 'bg-ok-500') : 'bg-danger-500';
  return (
    <span className={`chip ${tone === 'dark' ? 'glass-dark text-cream-100' : 'glass text-espresso-800'}`} data-testid="store-status">
      <span className={`relative inline-block size-2 rounded-full ${color}`}>
        {state.can_order && <span className={`absolute inset-0 rounded-full ${color} animate-ping opacity-60`} />}
      </span>
      {label}
    </span>
  );
}

export function Header({ state, demoBanner }: { state: StoreState; demoBanner?: string | null }) {
  const { t, locale, setLocale, switching } = useI18n();
  const overDark = usePathname() === '/';
  const count = useCartCount();
  const [scrolled, setScrolled] = useState(false);
  const [bump, setBump] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
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

  return (
    <header className="fixed inset-x-0 top-0 z-40">
      {demoBanner && <div className="bg-gold-400 px-4 py-1 text-center text-[11px] font-semibold text-espresso-900 sm:text-xs" data-testid="demo-banner">{demoBanner}</div>}
      <div className="px-3 pt-[max(env(safe-area-inset-top),0.6rem)] sm:px-6">
      <div className={`mx-auto flex max-w-6xl items-center gap-3 rounded-full px-3 py-2 transition-all duration-500 sm:px-4 ${scrolled ? 'glass shadow-lift text-espresso-800' : overDark ? 'glass-dark text-cream-100 [&_.btn-ghost]:border-cream-100/25' : 'text-espresso-800'}`}>
        <Link href="/" className="flex items-center gap-2" aria-label="SAMAT — home">
          <Logo variant="icon" height={34} />
          <Logo variant="wordmark" height={30} className="hidden sm:inline-block" />
        </Link>
        <div className="hidden md:block"><StatusPill state={state} /></div>
        <nav className="ms-auto flex items-center gap-1.5 sm:gap-2">
          <Link href="/#menu" className="btn btn-sm btn-ghost hidden sm:inline-flex">{t.nav.menu}</Link>
          <button
            type="button"
            onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
            className="btn btn-sm btn-ghost min-w-11 px-3"
            aria-label={t.common.language}
            disabled={switching}
            data-testid="lang-toggle"
          >
            {locale === 'ar' ? 'EN' : 'ع'}
          </button>
          <Link href="/account" className="btn btn-sm btn-ghost px-2.5" aria-label={t.nav.account}>
            <UserRound className="size-5" />
          </Link>
          <Link href="/cart" className={`btn btn-sm relative px-3.5 ${overDark && !scrolled ? 'btn-cream' : 'btn-primary'}`} aria-label={`${t.nav.cart} (${count})`} data-testid="cart-button">
            <ShoppingBag className="size-5" />
            <span className="num hidden sm:inline">{t.nav.cart}</span>
            {count > 0 && (
              <span className={`num absolute -top-1.5 -end-1.5 grid min-w-6 place-items-center rounded-full bg-terracotta-500 px-1.5 text-xs font-bold text-white ring-2 ring-cream-200 ${bump ? 'animate-pop' : ''}`} data-testid="cart-count">
                {count}
              </span>
            )}
          </Link>
        </nav>
      </div>
      </div>
    </header>
  );
}
