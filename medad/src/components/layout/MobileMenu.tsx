'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { siteConfig } from '@/config/site';
import type { NavDict } from './Navbar';
import type { Locale } from '@/lib/i18n';
import { scroller } from '@/components/motion/SmoothScroll';
import { ButtonLink } from '@/components/ui/Button';
import { NAV_ITEMS, NavAnchor, type NavKey } from './NavAnchor';

const ease = [0.16, 1, 0.3, 1] as const;

export function MobileMenu({
  open,
  onClose,
  locale,
  t,
  isHome,
  active,
}: {
  open: boolean;
  onClose: () => void;
  locale: Locale;
  t: NavDict;
  isHome: boolean;
  active: NavKey | null;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    scroller.lock();
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>('a, button');
    first?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      // Keep focus inside the menu and its toggle button.
      const toggle = document.querySelector<HTMLElement>('[aria-controls="mobile-menu"]');
      const focusables = [
        ...(toggle ? [toggle] : []),
        ...panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
      ];
      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];
      if (!firstEl || !lastEl) return;
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const onResize = () => window.innerWidth >= 1024 && onClose();
    window.addEventListener('resize', onResize);
    return () => {
      scroller.unlock();
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          id="mobile-menu"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={t.a11y.primaryNav}
          className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-obsidian/80 px-[var(--gutter)] pt-28 pb-10 backdrop-blur-2xl lg:hidden"
          initial={{ clipPath: 'inset(0 0 100% 0)' }}
          animate={{ clipPath: 'inset(0 0 0% 0)' }}
          exit={{ clipPath: 'inset(0 0 100% 0)', transition: { duration: 0.55, ease: [0.83, 0, 0.17, 1] } }}
          transition={{ duration: 0.7, ease: [0.83, 0, 0.17, 1] }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-40 h-96 w-96 rounded-full bg-electric/25 blur-[120px] ltr:-right-24 rtl:-left-24"
          />
          <nav aria-label={t.a11y.primaryNav} className="relative flex-1">
            <ul className="flex flex-col">
              {NAV_ITEMS.map((item, i) => (
                <motion.li
                  key={item.key}
                  initial={{ opacity: 0, y: 28 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, ease, delay: 0.25 + i * 0.06 }}
                  className="border-b border-white/[0.07]"
                >
                  <NavAnchor
                    locale={locale}
                    hash={item.hash}
                    isHome={isHome}
                    onClick={onClose}
                    aria-current={active === item.key ? 'location' : undefined}
                    className="group flex items-baseline gap-4 py-4 text-[clamp(2rem,9vw,3rem)] leading-tight font-semibold"
                  >
                    <span className="font-latin text-xs font-semibold tracking-[0.2em] text-icy">
                      0{i + 1}
                    </span>
                    <span className={active === item.key ? 'ink-text' : 'text-white'}>{t.nav[item.key]}</span>
                  </NavAnchor>
                </motion.li>
              ))}
            </ul>
          </nav>
          <motion.div
            className="relative mt-10 flex flex-col gap-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease, delay: 0.55 }}
          >
            <ButtonLink
              href={isHome ? '#contact' : `/${locale}#contact`}
              size="lg"
              onClick={onClose}
              className="w-full"
            >
              {t.nav.cta}
            </ButtonLink>
            {siteConfig.email ? (
              <a href={`mailto:${siteConfig.email}`} className="font-latin text-sm text-cool hover:text-white" dir="ltr">
                {siteConfig.email}
              </a>
            ) : (
              <span className="font-latin text-xs tracking-[0.18em] text-mist uppercase" dir="ltr" lang="en">
                {t.tagline}
              </span>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
