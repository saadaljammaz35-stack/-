'use client';

import { useEffect } from 'react';
import type Lenis from 'lenis';

let lenis: Lenis | null = null;

/** Lets overlays pause page scrolling, with or without Lenis. */
export const scroller = {
  lock() {
    lenis?.stop();
    document.documentElement.style.overflow = 'hidden';
  },
  unlock() {
    lenis?.start();
    document.documentElement.style.overflow = '';
  },
  to(target: HTMLElement | number, immediate = false) {
    const offset = -(document.querySelector<HTMLElement>('[data-nav]')?.offsetHeight ?? 72) - 16;
    if (lenis) {
      lenis.scrollTo(target, { offset: typeof target === 'number' ? 0 : offset, immediate });
      return;
    }
    const top =
      typeof target === 'number'
        ? target
        : target.getBoundingClientRect().top + window.scrollY + offset;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top, behavior: immediate || reduced ? 'auto' : 'smooth' });
  },
};

/**
 * Inertial smooth scrolling on desktop (wheel/trackpad) via Lenis; touch
 * devices keep native scrolling. In-page anchor links scroll smoothly to
 * their section and move keyboard focus there.
 */
export function SmoothScroll() {
  useEffect(() => {
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let cancelled = false;

    if (fine && !reduced) {
      import('lenis').then(({ default: LenisCtor }) => {
        if (cancelled) return;
        lenis = new LenisCtor({ autoRaf: true, lerp: 0.095, wheelMultiplier: 0.95 });
      });
    }

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href*="#"]');
      if (!(a instanceof HTMLAnchorElement)) return;
      const url = new URL(a.href, window.location.href);
      if (url.pathname !== window.location.pathname || url.origin !== window.location.origin) return;
      const id = decodeURIComponent(url.hash.slice(1));
      const target = id === 'top' ? document.body : document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      if (id === 'top') scroller.to(0);
      else scroller.to(target);
      history.pushState(null, '', url.hash);
      if (target !== document.body) {
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
    };
    document.addEventListener('click', onClick);

    // Arriving with a hash (e.g. from another page or a language switch).
    if (window.location.hash.length > 1) {
      const el = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
      if (el) requestAnimationFrame(() => scroller.to(el, true));
    }

    return () => {
      cancelled = true;
      document.removeEventListener('click', onClick);
      lenis?.destroy();
      lenis = null;
    };
  }, []);

  return null;
}
