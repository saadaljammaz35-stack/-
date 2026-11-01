import { Quote, Star } from "lucide-react";
import { Stagger, StaggerItem } from "@/components/ui/Motion";
import { cn } from "@/lib/cn";
import type { Testimonial } from "@/lib/types";

const CARD_STYLES = ["bg-paper", "bg-lavender-soft", "bg-sun-soft", "bg-teal-soft"];

export function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("flex gap-0.5", className)} role="img" aria-label={`التقييم ${rating} من 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn("size-4", n <= rating ? "fill-sun text-sun" : "text-ink-soft/25")} aria-hidden />
      ))}
    </span>
  );
}

export function Testimonials({ items }: { items: Testimonial[] }) {
  return (
    <Stagger className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 lg:grid-cols-3">
      {items.map((t, i) => (
        <StaggerItem
          key={t.id}
          className={cn(
            "flex w-[85%] shrink-0 snap-center flex-col rounded-[1.75rem] p-6 shadow-soft sm:w-[60%] md:w-auto md:p-8",
            CARD_STYLES[i % CARD_STYLES.length],
            i % 3 === 1 && "lg:translate-y-8",
          )}
        >
          <Quote className="size-8 text-coral" aria-hidden />
          <blockquote className="mt-4 flex-1 text-lg leading-8 text-ink">«{t.content}»</blockquote>
          <div className="mt-6 flex items-end justify-between gap-3 border-t border-line pt-5">
            <div>
              <p className="font-display font-semibold text-plum">{t.author_name}</p>
              {t.author_label && <p className="mt-0.5 text-sm text-ink-soft">{t.author_label}</p>}
            </div>
            <Stars rating={t.rating} />
          </div>
        </StaggerItem>
      ))}
    </Stagger>
  );
}
