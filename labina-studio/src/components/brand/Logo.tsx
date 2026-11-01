import { cn } from "@/lib/cn";

/** Block layout of the brand mark (from the reference artwork), viewBox 600 × 539 */
export const MARK_BLOCKS = [
  { x: 12, y: 0, w: 110, h: 110, fill: "var(--color-coral)", key: "a" },
  { x: 12, y: 130, w: 110, h: 110, fill: "var(--color-coral)", key: "b" },
  { x: 0, y: 264, w: 135, h: 275, fill: "var(--color-teal)", key: "c" },
  { x: 166, y: 0, w: 111, h: 110, fill: "var(--color-coral)", key: "d" },
  { x: 155, y: 143, w: 135, h: 396, fill: "var(--color-lavender)", key: "e" },
  { x: 310, y: 0, w: 135, h: 397, fill: "var(--color-sun)", key: "f" },
  { x: 323, y: 430, w: 110, h: 109, fill: "var(--color-coral)", key: "g" },
  { x: 464, y: 0, w: 136, h: 539, fill: "var(--color-plum)", key: "h" },
] as const;

export function LogoMark({ className, light = false, title }: { className?: string; light?: boolean; title?: string }) {
  return (
    <svg
      viewBox="0 0 600 539"
      className={cn("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {MARK_BLOCKS.map((b) => (
        <rect
          key={b.key}
          x={b.x}
          y={b.y}
          width={b.w}
          height={b.h}
          rx={18}
          fill={light && b.key === "h" ? "var(--color-cream)" : b.fill}
        />
      ))}
    </svg>
  );
}

export function Logo({ className, light = false, compact = false }: { className?: string; light?: boolean; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="h-8 w-9" light={light} />
      <span className="flex flex-col leading-none">
        <span className={cn("font-display text-2xl font-bold", light ? "text-cream" : "text-plum")}>لَبِنة</span>
        {!compact && (
          <span className={cn("mt-1 text-[0.68rem] font-medium tracking-wide", light ? "text-cream/70" : "text-ink-soft")}>
            استوديو الطفولة
          </span>
        )}
      </span>
    </span>
  );
}
