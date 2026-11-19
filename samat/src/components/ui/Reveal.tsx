'use client';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

const useIso = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Fades content up as it scrolls into view. Progressive enhancement: content is visible by default
 * (no JS, crawlers, print); only elements that start below the fold are hidden before first paint.
 */
export function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'static' | 'hidden' | 'shown'>('static');
  useIso(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;
    setState('hidden');
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setState('shown');
        io.disconnect();
      }
    }, { rootMargin: '0px 0px -6% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`${state === 'static' ? '' : 'transition-[opacity,transform] duration-700 ease-[var(--ease-out-soft)]'} ${state === 'hidden' ? 'translate-y-5 opacity-0' : ''} ${className}`}
      style={state === 'shown' ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
