"use client";

import { cn } from "@/lib/cn";

export function Switch({ checked, onChange, label, disabled, id }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean; id?: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-300 disabled:opacity-50",
        checked ? "bg-teal" : "bg-cream-2",
      )}
    >
      <span
        className={cn(
          "absolute size-5 rounded-full bg-paper shadow transition-[right] duration-300 ease-[var(--ease-soft)]",
          checked ? "right-6" : "right-1",
        )}
      />
    </button>
  );
}
