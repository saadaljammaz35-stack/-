"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Expand } from "lucide-react";
import { Lightbox } from "./Lightbox";
import { EASE } from "@/components/ui/Motion";
import { CATEGORY_LABEL, GALLERY_CATEGORIES, SHAPE_RATIO } from "@/lib/constants";
import { cn } from "@/lib/cn";
import type { GalleryCategory, GalleryItem } from "@/lib/types";

const TINTS = ["bg-coral-soft", "bg-sun-soft", "bg-lavender-soft", "bg-teal-soft"];

export function GalleryGrid({ items, filters = true, initialCategory = "all" }: { items: GalleryItem[]; filters?: boolean; initialCategory?: GalleryCategory | "all" }) {
  const [category, setCategory] = useState<GalleryCategory | "all">(initialCategory);
  const [index, setIndex] = useState<number | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const it of items) c[it.category] = (c[it.category] ?? 0) + 1;
    return c;
  }, [items]);

  const visible = useMemo(() => (category === "all" ? items : items.filter((i) => i.category === category)), [items, category]);
  const tabs = [{ value: "all" as const, label: "الكل" }, ...GALLERY_CATEGORIES.filter((c) => counts[c.value])];

  return (
    <div>
      {filters && tabs.length > 2 && (
        <div className="no-scrollbar -mx-4 mb-8 overflow-x-auto px-4 md:mx-0 md:px-0" role="tablist" aria-label="تصنيفات المعرض">
          <div className="flex w-max gap-2">
            {tabs.map((t) => {
              const active = category === t.value;
              return (
                <button
                  key={t.value}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  onClick={() => setCategory(t.value)}
                  className={cn(
                    "relative h-11 rounded-2xl px-5 text-sm font-semibold transition-colors",
                    active ? "text-cream" : "bg-paper text-ink-soft hover:text-plum",
                  )}
                >
                  {active && <motion.span layoutId="gallery-tab" className="absolute inset-0 rounded-2xl bg-plum" transition={{ type: "spring", stiffness: 380, damping: 32 }} />}
                  <span className="relative">
                    {t.label}
                    <span className={cn("ms-2 text-xs", active ? "text-cream/70" : "text-ink-soft/70")}>
                      {t.value === "all" ? items.length : counts[t.value]}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.ul
          key={category}
          className="columns-2 gap-3 md:columns-3 md:gap-4 lg:columns-4"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.4, ease: EASE }}
        >
          {visible.map((item, i) => (
            <li key={item.id} className="mb-3 break-inside-avoid md:mb-4">
              <button
                type="button"
                onClick={() => setIndex(i)}
                className={cn("group relative block w-full overflow-hidden rounded-[1.25rem] md:rounded-[1.5rem]", TINTS[i % TINTS.length])}
                style={{ aspectRatio: SHAPE_RATIO[item.shape] }}
                aria-label={`عرض الصورة: ${item.title || item.alt || CATEGORY_LABEL[item.category]}`}
              >
                <Image
                  src={item.image_url}
                  alt={item.alt || item.title || `صورة من جلسات ${CATEGORY_LABEL[item.category]}`}
                  fill
                  sizes="(min-width: 1024px) 24vw, (min-width: 768px) 32vw, 48vw"
                  quality={70}
                  className="object-cover transition-transform duration-700 ease-[var(--ease-soft)] group-hover:scale-[1.04]"
                />
                <span className="absolute inset-0 bg-gradient-to-t from-plum/60 via-plum/0 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <span className="absolute bottom-3 right-3 left-3 flex translate-y-2 items-center justify-between gap-2 text-start text-cream opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                  <span className="truncate text-sm font-semibold">{item.title || CATEGORY_LABEL[item.category]}</span>
                  <Expand className="size-4 shrink-0" aria-hidden />
                </span>
              </button>
            </li>
          ))}
        </motion.ul>
      </AnimatePresence>

      <Lightbox items={visible} index={index} onChange={setIndex} />
    </div>
  );
}
