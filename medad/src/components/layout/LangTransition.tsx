'use client';

import { AnimatePresence, motion } from 'motion/react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Mark } from '@/components/brand/Logo';

const EVENT = 'medad:lang';
const FLAG = 'medad-lang-switch';

/** Ask the global overlay to switch language with a soft ink transition. */
export function switchLanguage(href: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: href }));
}

export function LangTransition() {
  const router = useRouter();
  const pathname = usePathname();
  const [phase, setPhase] = useState<'idle' | 'cover'>('idle');
  const pending = useRef<string | null>(null);

  useEffect(() => {
    // Arriving after a full reload mid-switch: the overlay simply fades out.
    try {
      if (sessionStorage.getItem(FLAG)) sessionStorage.removeItem(FLAG);
    } catch {}
    const onSwitch = (e: Event) => {
      const href = (e as CustomEvent<string>).detail;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduced) {
        router.push(href, { scroll: !href.includes('#') });
        return;
      }
      pending.current = href;
      setPhase('cover');
      try {
        sessionStorage.setItem(FLAG, '1');
      } catch {}
      window.setTimeout(() => router.push(href, { scroll: !href.includes('#') }), 520);
    };
    window.addEventListener(EVENT, onSwitch);
    return () => window.removeEventListener(EVENT, onSwitch);
  }, [router]);

  useEffect(() => {
    if (!pending.current) return;
    pending.current = null;
    const id = window.setTimeout(() => setPhase('idle'), 120);
    try {
      sessionStorage.removeItem(FLAG);
    } catch {}
    return () => window.clearTimeout(id);
  }, [pathname]);

  return (
    <AnimatePresence>
      {phase === 'cover' ? (
        <motion.div
          key="lang"
          aria-hidden="true"
          className="fixed inset-0 z-[95] grid place-items-center bg-obsidian/70 backdrop-blur-2xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } }}
          transition={{ duration: 0.45, ease: [0.65, 0, 0.35, 1] }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, filter: 'blur(8px)' }}
            animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
            exit={{ scale: 1.06, opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center gap-6"
          >
            <Mark className="h-14 w-auto text-white" />
            <motion.span
              className="block h-px w-36 origin-left bg-gradient-to-r from-electric to-icy"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.6, ease: [0.65, 0, 0.35, 1] }}
            />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
