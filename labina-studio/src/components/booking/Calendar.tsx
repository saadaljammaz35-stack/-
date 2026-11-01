"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { WEEKDAYS, WEEK_ORDER } from "@/lib/constants";
import { formatDate } from "@/lib/format";

const SHORT_DAYS = ["ح", "ن", "ث", "ر", "خ", "ج", "س"];

const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

type Props = {
  value: string | null;
  onChange: (date: string) => void;
  minDate: string;
  maxDate: string;
  isDisabled: (date: string) => boolean;
};

/** Month calendar, week starting Saturday, keyboard friendly */
export function Calendar({ value, onChange, minDate, maxDate, isDisabled }: Props) {
  const start = value ?? minDate;
  const [cursor, setCursor] = useState(() => ({ y: Number(start.slice(0, 4)), m: Number(start.slice(5, 7)) - 1 }));

  const minKey = Number(minDate.slice(0, 4)) * 12 + Number(minDate.slice(5, 7)) - 1;
  const maxKey = Number(maxDate.slice(0, 4)) * 12 + Number(maxDate.slice(5, 7)) - 1;
  const curKey = cursor.y * 12 + cursor.m;

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(cursor.y, cursor.m, 1)).getUTCDay();
    const offset = WEEK_ORDER.indexOf(first);
    const days = new Date(Date.UTC(cursor.y, cursor.m + 1, 0)).getUTCDate();
    const out: (string | null)[] = Array.from({ length: offset }, () => null);
    for (let d = 1; d <= days; d++) out.push(iso(cursor.y, cursor.m, d));
    while (out.length % 7) out.push(null);
    return out;
  }, [cursor]);

  const move = (delta: number) => {
    const k = Math.min(maxKey, Math.max(minKey, curKey + delta));
    setCursor({ y: Math.floor(k / 12), m: k % 12 });
  };

  return (
    <div className="select-none">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => move(-1)}
          disabled={curKey <= minKey}
          className="grid size-10 place-items-center rounded-xl bg-cream text-plum transition hover:bg-cream-2 disabled:opacity-30"
          aria-label="الشهر السابق"
        >
          <ChevronRight className="size-5" />
        </button>
        <p className="font-display text-lg font-semibold text-plum" aria-live="polite">
          {MONTHS[cursor.m]} {cursor.y}
        </p>
        <button
          type="button"
          onClick={() => move(1)}
          disabled={curKey >= maxKey}
          className="grid size-10 place-items-center rounded-xl bg-cream text-plum transition hover:bg-cream-2 disabled:opacity-30"
          aria-label="الشهر التالي"
        >
          <ChevronLeft className="size-5" />
        </button>
      </div>

      <div role="grid" aria-label="اختر اليوم" className="grid grid-cols-7 gap-1.5 text-center">
        {WEEK_ORDER.map((d) => (
          <div key={d} role="columnheader" className="pb-1 text-[0.7rem] font-semibold text-ink-soft sm:text-xs">
            <span className="sm:hidden" aria-hidden>{SHORT_DAYS[d]}</span>
            <span className="sr-only sm:hidden">{WEEKDAYS[d]}</span>
            <span className="hidden sm:inline">{WEEKDAYS[d]}</span>
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={`e${i}`} />;
          const disabled = date < minDate || date > maxDate || isDisabled(date);
          const selected = date === value;
          return (
            <button
              key={date}
              type="button"
              role="gridcell"
              disabled={disabled}
              aria-selected={selected}
              aria-label={formatDate(date)}
              onClick={() => onChange(date)}
              className={cn(
                "aspect-square rounded-xl text-sm font-semibold transition-all duration-200 sm:text-base",
                selected
                  ? "scale-105 bg-plum text-cream shadow-soft"
                  : disabled
                    ? "cursor-not-allowed text-ink-soft/35 line-through decoration-ink-soft/20"
                    : "bg-cream text-ink hover:-translate-y-0.5 hover:bg-sun-soft",
              )}
            >
              {Number(date.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
