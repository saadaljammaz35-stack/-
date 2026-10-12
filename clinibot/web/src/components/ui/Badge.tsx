import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger" | "brand";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200",
  info: "bg-sky-50 text-sky-800 ring-sky-200",
  success: "bg-mint text-accent-strong ring-emerald-200",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-red-200",
  brand: "bg-primary-soft text-primary ring-navy-200",
};

const DOTS: Record<BadgeTone, string> = {
  neutral: "bg-slate-400",
  info: "bg-sky-500",
  success: "bg-accent",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  brand: "bg-primary",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** Small colored dot before the text (status badges). */
  dot?: boolean;
  icon?: ReactNode;
}

export function Badge({
  tone = "neutral",
  dot = false,
  icon,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap ring-1 ring-inset",
        TONES[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className={cn("size-1.5 rounded-full", DOTS[tone])} aria-hidden="true" />}
      {icon}
      {children}
    </span>
  );
}
