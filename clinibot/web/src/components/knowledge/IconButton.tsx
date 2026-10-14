import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Accessible name (the button has no visible text). */
  label: string;
  icon: ReactNode;
  tone?: "neutral" | "danger";
}

/** 44×44 icon-only button with an accessible name. */
export function IconButton({
  label,
  icon,
  tone = "neutral",
  className,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40",
        tone === "danger"
          ? "text-red-600 hover:bg-red-50 focus-visible:outline-red-600"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-primary",
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  );
}
