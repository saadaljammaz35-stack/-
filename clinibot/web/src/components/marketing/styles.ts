import { cn } from "@/lib/cn";

export type MkButtonTone = "cta" | "navy" | "quiet" | "ghost" | "on-dark";
export type MkButtonSize = "md" | "lg";

const SIZES: Record<MkButtonSize, string> = {
  md: "min-h-11 px-4 text-[0.9375rem]",
  lg: "min-h-12 px-6 text-base",
};

/**
 * Buttons and button-looking links on the public site. Colour and motion come
 * from marketing.css (`mk-btn--*`): hover is an opacity wash, press is a tiny
 * scale, so only transform and opacity ever animate.
 */
export function mkButton(
  tone: MkButtonTone = "navy",
  size: MkButtonSize = "md",
  className?: string,
): string {
  return cn(
    "mk-btn inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-bold whitespace-nowrap select-none",
    `mk-btn--${tone}`,
    SIZES[size],
    className,
  );
}

/** Text link inside running text. */
export const inlineLink = "mk-link font-bold text-primary";

/** Page container (marketing.css): 16px gutters on phones, safe-area aware. */
export const container = "mk-container";
