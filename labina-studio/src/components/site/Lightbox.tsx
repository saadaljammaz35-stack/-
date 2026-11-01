"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { CATEGORY_LABEL } from "@/lib/constants";
import type { GalleryItem } from "@/lib/types";

type Props = {
  items: GalleryItem[];
  index: number | null;
  onChange: (index: number | null) => void;
};

/** Full-screen viewer: arrows, swipe, Escape, focus kept inside */
export function Lightbox({ items, index, onChange }: Props) {
  const open = index !== null && items[index] !== undefined;
  const closeRef = useRef<HTMLButtonElement>(null);
  const item = open ? items[index!] : null;

  const next = useCallback(() => index !== null && onChange((index + 1) % items.length), [index, items.length, onChange]);
  const prev = useCallback(() => index !== null && onChange((index - 1 + items.length) % items.length), [index, items.length, onChange]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onChange(null);
      // RTL: the left arrow moves forward
      if (e.key === "ArrowLeft") next();
      if (e.key === "ArrowRight") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open, next, prev, onChange]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < -60) next();
    else if (info.offset.x > 60) prev();
  };

  return (
    <AnimatePresence>
      {open && item && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={item.title || "عرض الصورة"}
          className="fixed inset-0 z-[100] flex flex-col bg-plum/95 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(e) => e.target === e.currentTarget && onChange(null)}
        >
          <div className="flex items-center justify-between gap-4 px-4 py-4 text-cream md:px-8">
            <p className="text-sm text-cream/70" aria-live="polite">
              {index! + 1} / {items.length}
            </p>
            <button
              ref={closeRef}
              type="button"
              onClick={() => onChange(null)}
              className="grid size-11 place-items-center rounded-2xl bg-cream/10 transition-colors hover:bg-cream/20"
              aria-label="إغلاق"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="relative flex-1" onClick={(e) => e.target === e.currentTarget && onChange(null)}>
            <AnimatePresence initial={false} mode="popLayout">
              <motion.div
                key={item.id}
                className="absolute inset-x-4 inset-y-0 md:inset-x-24"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.35 }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.4}
                onDragEnd={onDragEnd}
              >
                <Image
                  src={item.image_url}
                  alt={item.alt || item.title || "صورة من معرض لَبِنة"}
                  fill
                  sizes="100vw"
                  quality={80}
                  className="pointer-events-none select-none object-contain"
                  draggable={false}
                />
              </motion.div>
            </AnimatePresence>

            {items.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={prev}
                  className="absolute right-3 top-1/2 hidden size-12 -translate-y-1/2 place-items-center rounded-2xl bg-cream/10 text-cream transition-colors hover:bg-cream/25 md:grid"
                  aria-label="الصورة السابقة"
                >
                  <ChevronRight className="size-6" />
                </button>
                <button
                  type="button"
                  onClick={next}
                  className="absolute left-3 top-1/2 hidden size-12 -translate-y-1/2 place-items-center rounded-2xl bg-cream/10 text-cream transition-colors hover:bg-cream/25 md:grid"
                  aria-label="الصورة التالية"
                >
                  <ChevronLeft className="size-6" />
                </button>
              </>
            )}
          </div>

          <div className="px-4 pb-6 pt-4 text-center text-cream md:pb-8">
            {item.title && <p className="font-display text-lg font-semibold">{item.title}</p>}
            <p className="mt-1 text-sm text-cream/65">{CATEGORY_LABEL[item.category]}</p>
            {items.length > 1 && <p className="mt-2 text-xs text-cream/45 md:hidden">اسحب يميناً أو يساراً للتنقل</p>}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
