import type { ReactNode } from "react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";
import { usageLevel, usageRatio } from "./model";

export interface UsageMeterProps {
  label: string;
  used: number;
  /** Null when there is no limit on record. */
  limit: number | null;
  /** Shown under the bar (hint or warning). */
  children?: ReactNode;
  className?: string;
}

const BAR_COLORS = {
  ok: "bg-primary",
  high: "bg-amber-500",
  full: "bg-red-600",
} as const;

/**
 * "Used X of Y" with a bar. The bar is a progressbar for screen readers and
 * changes colour from 80% (amber) and at the limit (red); the text says the
 * same thing, so colour is never the only signal.
 */
export function UsageMeter({ label, used, limit, children, className }: UsageMeterProps) {
  const { t, formatNumber } = useI18n();
  const level = usageLevel(used, limit);
  const percent = Math.round(usageRatio(used, limit) * 100);
  const value =
    limit === null
      ? formatNumber(used)
      : t("billing.aiUsageValue", { used: formatNumber(used), limit: formatNumber(limit) });

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-bold text-slate-700">{label}</p>
        <p className="text-base font-extrabold text-slate-900 tabular-nums">{value}</p>
      </div>
      {limit !== null && (
        <div
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={limit}
          aria-valuenow={Math.min(used, limit)}
          aria-valuetext={value}
          className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100"
        >
          <div
            className={cn("h-full rounded-full transition-[width]", BAR_COLORS[level])}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
      {children}
    </div>
  );
}
