'use client';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { Layer } from '@/lib/builder';

// Visual width of each burger layer relative to the stage (the buns are the widest element).
const WIDTH_BY_KIND: Record<string, number> = {
  'bun-bottom': 0.9, 'bun-top': 0.92, bread: 0.9, protein: 0.84, cheese: 0.9, vegetable: 0.88, pickle: 0.82, extra: 0.84, sauce: 0.84,
};

export interface StageLayer extends Layer {
  ingredientKind?: string;
  removable?: boolean;
  onTap?: () => void;
}

/**
 * Burger, side view. Each layer is a transparent PNG/WebP. Layers are anchored from the bottom; each
 * one raises the stack by its own thickness (layer.height × stage width), so adding a patty lifts
 * everything above it and the top bun always lands last.
 */
export function BurgerStage({ layers, label }: { layers: StageLayer[]; label: string }) {
  const reduce = useReducedMotion();
  let y = 0;
  const placed = layers.map((l) => {
    const bottom = y;
    // the top bun sits on the stack; everything else adds its thickness
    y += l.kind === 'bun-top' ? 0 : l.height;
    return { ...l, bottom };
  });
  const stackHeight = y + 0.42; // room for the dome of the top bun
  return (
    <div className="relative mx-auto w-full max-w-[520px]" role="img" aria-label={label}>
      <div className="relative w-full" style={{ paddingBottom: `${Math.max(stackHeight, 0.82) * 100}%` }}>
        {/* plate shadow */}
        <div className="absolute inset-x-[8%] bottom-[-2%] h-[9%] rounded-[50%] bg-espresso-900/25 blur-xl" />
        <AnimatePresence initial={false}>
          {placed.map((l, i) => {
            const w = WIDTH_BY_KIND[l.kind === 'ingredient' ? (l.ingredientKind ?? 'vegetable') : l.kind] ?? 0.86;
            return (
              <motion.button
                type="button"
                key={l.key}
                layout={!reduce}
                aria-label={l.label}
                tabIndex={-1}
                disabled={!l.removable}
                onClick={l.onTap}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: -90, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: 60, rotate: 8, scale: 0.9, transition: { duration: 0.28 } }}
                transition={{ type: 'spring', stiffness: 420, damping: 30, mass: 0.8 }}
                className={`absolute left-1/2 block -translate-x-1/2 ${l.removable ? 'cursor-pointer' : 'cursor-default'}`}
                style={{ bottom: `${(l.bottom / Math.max(stackHeight, 0.82)) * 100}%`, width: `${w * 100}%`, zIndex: i + 1 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={l.src} alt="" draggable={false} className="pointer-events-none block h-auto w-full select-none drop-shadow-[0_6px_6px_rgba(30,22,18,0.22)]" />
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Deterministic "hand-made" placement for shawarma fillings so they interleave instead of hiding each other.
const SPOTS = [
  { x: 0, y: 0, r: -4 }, { x: -7, y: -16, r: 6 }, { x: 6, y: 15, r: -8 }, { x: -5, y: 20, r: 3 },
  { x: 8, y: -18, r: 9 }, { x: -9, y: 6, r: -2 }, { x: 3, y: -24, r: 5 }, { x: 0, y: 10, r: -6 },
];

/** Shawarma, top view: the chosen open flatbread with fillings laid along the middle, sauces drizzled last. */
export function ShawarmaStage({ layers, label }: { layers: StageLayer[]; label: string }) {
  const reduce = useReducedMotion();
  const bread = layers.find((l) => l.kind === 'bread');
  const rest = layers.filter((l) => l.kind !== 'bread');
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[520px]" role="img" aria-label={label}>
      <div className="absolute inset-[6%] rounded-full bg-espresso-900/20 blur-2xl" />
      <AnimatePresence mode="popLayout" initial={false}>
        {bread && (
          <motion.img
            key={bread.src}
            src={bread.src}
            alt=""
            draggable={false}
            initial={reduce ? { opacity: 0 } : { opacity: 0, rotate: -25, scale: 0.9 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 1.04, transition: { duration: 0.25 } }}
            transition={{ type: 'spring', stiffness: 220, damping: 26 }}
            className="absolute inset-[3%] h-[94%] w-[94%] select-none object-contain drop-shadow-[0_14px_18px_rgba(30,22,18,0.25)]"
          />
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {rest.map((l, i) => {
          const s = SPOTS[i % SPOTS.length];
          const sauce = l.kind === 'sauce';
          return (
            <motion.button
              type="button"
              key={l.key}
              tabIndex={-1}
              aria-label={l.label}
              disabled={!l.removable}
              onClick={l.onTap}
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 1.25, y: -30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.22 } }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              className={`absolute left-1/2 top-1/2 block ${l.removable ? 'cursor-pointer' : 'cursor-default'}`}
              style={{
                width: sauce ? '64%' : i === 0 ? '70%' : '54%',
                marginLeft: sauce ? '-32%' : i === 0 ? '-35%' : '-27%',
                translate: `${s.x}% calc(-50% + ${s.y}%)`,
                rotate: `${s.r}deg`,
                zIndex: 10 + i,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={l.src} alt="" draggable={false} className="pointer-events-none block h-auto w-full select-none drop-shadow-[0_4px_4px_rgba(30,22,18,0.25)]" />
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
