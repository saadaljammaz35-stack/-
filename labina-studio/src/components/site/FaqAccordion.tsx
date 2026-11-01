"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus } from "lucide-react";
import { EASE } from "@/components/ui/Motion";
import { cn } from "@/lib/cn";
import type { Faq } from "@/lib/types";

export function FaqAccordion({ items, defaultOpen = 0 }: { items: Faq[]; defaultOpen?: number | null }) {
  const [open, setOpen] = useState<number | null>(defaultOpen);
  const baseId = useId();

  return (
    <ul className="space-y-3">
      {items.map((faq, i) => {
        const isOpen = open === i;
        const panelId = `${baseId}-panel-${i}`;
        const buttonId = `${baseId}-btn-${i}`;
        return (
          <li key={faq.id} className={cn("overflow-hidden rounded-3xl transition-colors duration-300", isOpen ? "bg-paper shadow-soft" : "bg-paper/60")}>
            <h3>
              <button
                id={buttonId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-5 py-5 text-start md:px-7"
              >
                <span className="font-display text-lg font-semibold text-plum md:text-xl">{faq.question}</span>
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-xl transition-all duration-300",
                    isOpen ? "rotate-45 bg-coral text-ink" : "bg-cream text-plum",
                  )}
                >
                  <Plus className="size-4" aria-hidden />
                </span>
              </button>
            </h3>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.4, ease: EASE }}
                >
                  <p className="whitespace-pre-line px-5 pb-6 leading-8 text-ink-soft md:px-7">{faq.answer}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        );
      })}
    </ul>
  );
}
