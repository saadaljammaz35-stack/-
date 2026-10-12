import type { ComponentType, ReactNode, SVGProps } from "react";
import { cn } from "@/lib/cn";
import { Skeleton } from "./Skeleton";

export interface StatTileProps {
  label: ReactNode;
  /** Already formatted (use formatNumber / formatSar from useI18n). */
  value: ReactNode;
  hint?: ReactNode;
  icon?: ComponentType<SVGProps<SVGSVGElement>>;
  loading?: boolean;
  className?: string;
}

/** A single metric. Values use Latin digits in both languages via formatNumber. */
export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  loading = false,
  className,
}: StatTileProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5",
        className,
      )}
      aria-busy={loading || undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        {Icon && (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Icon className="size-5" aria-hidden="true" />
          </span>
        )}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-8 w-24" />
      ) : (
        <p className="mt-1 text-[1.75rem] leading-tight font-extrabold text-slate-900 tabular-nums">
          {value}
        </p>
      )}
      {hint && !loading && <p className="mt-1 text-[0.8125rem] text-slate-500">{hint}</p>}
    </div>
  );
}
