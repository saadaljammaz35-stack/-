import { useRef, type KeyboardEvent } from "react";
import { useI18n, type MessageKey } from "@/i18n";
import { cn } from "@/lib/cn";
import { PERIODS, type Period } from "./metrics";

// Arabic number agreement differs per number ("7 أيام" but "30 يوماً"), so one key each.
const LABELS: Record<Period, MessageKey> = {
  7: "dashboard.period7",
  30: "dashboard.period30",
  90: "dashboard.period90",
};

/** Segmented 7 / 30 / 90 days control: a radio group with arrow-key navigation. */
export function PeriodSelector({
  value,
  onChange,
}: {
  value: Period;
  onChange: (period: Period) => void;
}) {
  const { t, dir } = useI18n();
  const groupRef = useRef<HTMLDivElement>(null);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = PERIODS.indexOf(value);
    const forward = dir === "rtl" ? "ArrowLeft" : "ArrowRight";
    const backward = dir === "rtl" ? "ArrowRight" : "ArrowLeft";
    let next: number;
    if (event.key === forward || event.key === "ArrowDown") next = (index + 1) % PERIODS.length;
    else if (event.key === backward || event.key === "ArrowUp")
      next = (index - 1 + PERIODS.length) % PERIODS.length;
    else return;
    event.preventDefault();
    const period = PERIODS[next];
    if (period === undefined) return;
    onChange(period);
    groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
  }

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={t("dashboard.periodLabel")}
      onKeyDown={onKeyDown}
      className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-xs"
    >
      {PERIODS.map((period) => {
        const selected = period === value;
        return (
          <button
            key={period}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(period)}
            className={cn(
              "min-h-11 rounded-lg px-3.5 text-sm font-bold whitespace-nowrap transition-colors",
              selected
                ? "bg-primary text-white"
                : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
            )}
          >
            {t(LABELS[period])}
          </button>
        );
      })}
    </div>
  );
}
