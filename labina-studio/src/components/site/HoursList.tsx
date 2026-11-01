import { WEEKDAYS, WEEK_ORDER } from "@/lib/constants";
import { formatTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { WorkingHour } from "@/lib/types";

export function HoursList({ hours, className, light = false }: { hours: WorkingHour[]; className?: string; light?: boolean }) {
  const map = new Map(hours.map((h) => [h.weekday, h]));
  return (
    <ul className={cn("divide-y", light ? "divide-cream/10" : "divide-line", className)}>
      {WEEK_ORDER.map((d) => {
        const h = map.get(d);
        return (
          <li key={d} className="flex items-center justify-between py-2.5 text-sm">
            <span className={light ? "text-cream/80" : "text-ink"}>{WEEKDAYS[d]}</span>
            {h?.is_open ? (
              <span className={cn("font-semibold", light ? "text-cream" : "text-plum")}>
                {formatTime(h.open_time)} – {formatTime(h.close_time)}
              </span>
            ) : (
              <span className={light ? "text-cream/50" : "text-ink-soft"}>مغلق</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
