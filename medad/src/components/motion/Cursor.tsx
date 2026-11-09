'use client';

import { motion, useMotionValue, useSpring } from 'motion/react';
import { useEffect, useState } from 'react';
import { useFinePointer } from '@/lib/hooks';

/**
 * Desktop-only cursor companion. The system cursor is never hidden — this
 * ring simply follows it, grows over interactive elements and shows a short
 * label where an element sets `data-cursor="Label"`.
 */
export function Cursor() {
  const enabled = useFinePointer();
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const sx = useSpring(x, { stiffness: 520, damping: 40, mass: 0.5 });
  const sy = useSpring(y, { stiffness: 520, damping: 40, mass: 0.5 });
  const [state, setState] = useState<{ hover: boolean; label: string | null; visible: boolean }>({
    hover: false,
    label: null,
    visible: false,
  });

  useEffect(() => {
    if (!enabled) return;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      x.set(e.clientX);
      y.set(e.clientY);
      const el = e.target as Element | null;
      const labelled = el?.closest?.('[data-cursor]');
      const interactive = el?.closest?.('a, button, [role="button"], input, select, textarea, label');
      const label = labelled?.getAttribute('data-cursor') || null;
      setState((s) =>
        s.hover === Boolean(interactive || labelled) && s.label === label && s.visible
          ? s
          : { hover: Boolean(interactive || labelled), label, visible: true },
      );
    };
    const onLeave = () => setState((s) => ({ ...s, visible: false }));
    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, [enabled, x, y]);

  if (!enabled) return null;

  const size = state.label ? 84 : state.hover ? 44 : 22;
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 z-[90] hidden lg:block"
      style={{ x: sx, y: sy }}
    >
      <motion.div
        className="flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border font-latin text-[11px] font-semibold tracking-[0.14em] text-white uppercase"
        animate={{
          width: size,
          height: size,
          opacity: state.visible ? 1 : 0,
          borderColor: state.label ? 'rgba(157,184,255,0)' : 'rgba(157,184,255,0.55)',
          backgroundColor: state.label ? 'rgba(65,105,255,0.9)' : 'rgba(65,105,255,0)',
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      >
        {state.label ? <span className="px-2 text-center leading-tight">{state.label}</span> : null}
      </motion.div>
    </motion.div>
  );
}
