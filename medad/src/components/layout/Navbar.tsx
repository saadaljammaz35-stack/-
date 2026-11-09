'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Logo } from '@/components/brand/Logo';
import { Magnetic } from '@/components/motion/Magnetic';
import { ButtonLink } from '@/components/ui/Button';
import type { Dictionary } from '@/content/types';

export type NavDict = { nav: Dictionary['nav']; a11y: Dictionary['a11y']; tagline: string };
import type { Locale } from '@/lib/i18n';
import { LanguageSwitcher } from './LanguageSwitcher';
import { MobileMenu } from './MobileMenu';
import { NAV_ITEMS, NavAnchor, type NavKey } from './NavAnchor';

export function Navbar({ locale, t }: { locale: Locale; t: NavDict }) {
  const pathname = usePathname();
  const isHome = pathname === `/${locale}`;
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [spied, setActive] = useState<NavKey | null>('home');
  const active = isHome ? spied : null;
  const lastY = useRef(0);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Glass state + hide on scroll down, reveal on scroll up.
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 24);
      const delta = y - lastY.current;
      if (Math.abs(delta) > 6) setHidden(delta > 0 && y > window.innerHeight * 0.9);
      lastY.current = y;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Scroll-spy for the active section.
  useEffect(() => {
    if (!isHome) return;
    const ids = NAV_ITEMS.flatMap((i) => i.sections);
    const visible = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) visible.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0);
        let best: string | null = null;
        let bestRatio = 0;
        for (const [id, ratio] of visible) {
          if (ratio > bestRatio) {
            best = id;
            bestRatio = ratio;
          }
        }
        if (best) {
          const item = NAV_ITEMS.find((i) => i.sections.includes(best!));
          if (item) setActive(item.key);
        }
      },
      { rootMargin: '-35% 0px -55% 0px', threshold: [0, 0.01, 0.5, 1] },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [isHome]);

  const contactHref = isHome ? '#contact' : `/${locale}#contact`;

  return (
    <>
      <header
        data-nav
        className={`fixed inset-x-0 top-0 z-50 pt-3 transition-transform duration-700 ease-[var(--ease-out-expo)] sm:pt-4 ${
          hidden && !open ? '-translate-y-[130%]' : 'translate-y-0'
        }`}
      >
        <div className="container-medad">
          <nav
            aria-label={t.a11y.primaryNav}
            className={`relative flex h-14 items-center justify-between gap-4 rounded-full ps-4 pe-2 transition-[background-color,box-shadow,backdrop-filter] duration-700 sm:h-16 sm:ps-5 ${
              scrolled || open ? 'glass glass-rim' : 'bg-transparent'
            }`}
          >
            <NavAnchor
              locale={locale}
              hash="top"
              isHome={isHome}
              className="flex h-7 shrink-0 items-center text-white sm:h-8"
            >
              <span className="sr-only">{t.a11y.home}</span>
              <Logo locale={locale} className="h-full" />
            </NavAnchor>

            <ul className="hidden items-center gap-1 lg:flex">
              {NAV_ITEMS.map((item) => {
                const isActive = active === item.key;
                return (
                  <li key={item.key}>
                    <NavAnchor
                      locale={locale}
                      hash={item.hash}
                      isHome={isHome}
                      aria-current={isActive ? 'location' : undefined}
                      className={`relative block rounded-full px-4 py-2 text-[0.95rem] transition-colors duration-300 ${
                        isActive ? 'text-white' : 'text-cool hover:text-white'
                      }`}
                    >
                      {t.nav[item.key]}
                      {isActive ? (
                        <motion.span
                          layoutId="nav-active"
                          className="absolute inset-x-0 -bottom-0.5 mx-auto block size-1.5 rotate-45 bg-icy shadow-[0_0_10px_rgb(157_184_255)]"
                          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                        />
                      ) : null}
                    </NavAnchor>
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center gap-2">
              <LanguageSwitcher locale={locale} label={t.a11y.switchTo} />
              <Magnetic className="hidden sm:inline-flex" strength={0.25}>
                <ButtonLink href={contactHref} size="sm" className="h-10">
                  {t.nav.cta}
                </ButtonLink>
              </Magnetic>
              <button
                ref={toggleRef}
                type="button"
                aria-expanded={open}
                aria-controls="mobile-menu"
                aria-label={open ? t.a11y.menuClose : t.a11y.menuOpen}
                onClick={() => setOpen((v) => !v)}
                className="relative grid size-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] lg:hidden"
              >
                <span className="relative block h-3 w-5">
                  <span
                    className={`absolute inset-x-0 top-0 h-px bg-white transition-transform duration-500 ease-[var(--ease-out-expo)] ${
                      open ? 'translate-y-1.5 rotate-45' : ''
                    }`}
                  />
                  <span
                    className={`absolute bottom-0 h-px bg-white transition-all duration-500 ease-[var(--ease-out-expo)] ltr:right-0 rtl:left-0 ${
                      open ? 'w-full -translate-y-1.5 -rotate-45' : 'w-3'
                    }`}
                  />
                </span>
              </button>
            </div>
          </nav>
        </div>
      </header>
      <MobileMenu
        open={open}
        onClose={() => {
          setOpen(false);
          toggleRef.current?.focus();
        }}
        locale={locale}
        t={t}
        isHome={isHome}
        active={active}
      />
    </>
  );
}
