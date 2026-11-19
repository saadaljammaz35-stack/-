'use client';
import { useEffect, useRef, useState } from 'react';
import { formatMoney, type Locale } from '@/lib/money';

/** Price that counts smoothly to its new value (respects reduced motion). */
export function AnimatedPrice({ value, locale, className = '' }: { value: number; locale: Locale; className?: string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setShown(value); from.current = value; return; }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / 380);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(a + (value - a) * eased));
      if (k < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span className={`num ${className}`} data-testid="live-price" data-value={value}>{formatMoney(shown, locale)}</span>;
}
