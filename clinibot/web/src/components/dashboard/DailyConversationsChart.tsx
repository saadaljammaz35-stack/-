import { useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";
import { CHART } from "./chartColors";
import { bandIndexAt, bandLeft, columnPath, columnWidth, labelIndices } from "./chartGeometry";
import { useElementWidth } from "./hooks";
import { niceTicks, type DailyPoint } from "./metrics";

const PLOT_HEIGHT = 176;
const TOP = 22; // room for the peak label
const X_AXIS = 30; // date labels under the baseline
const Y_AXIS = 36; // tick labels on the start side
const END_PAD = 12;
const HEIGHT = TOP + PLOT_HEIGHT + X_AXIS;

export interface DailyConversationsChartProps {
  points: readonly DailyPoint[];
  /** Holds the previous render dimmed while a new period loads. */
  busy?: boolean;
}

/**
 * Daily new conversations as thin columns (one series: no legend, the card
 * title names it). Hover or arrow keys show a day's value; the same numbers
 * are in the table under the chart. Time runs with the reading direction.
 */
export function DailyConversationsChart({ points, busy = false }: DailyConversationsChartProps) {
  const { t, dir, formatDate, formatNumber } = useI18n();
  const rtl = dir === "rtl";
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const descriptionId = useId();
  const count = points.length;
  const total = points.reduce((sum, point) => sum + point.count, 0);
  const max = points.reduce((highest, point) => Math.max(highest, point.count), 0);
  const ticks = useMemo(() => niceTicks(max), [max]);
  const top = ticks[ticks.length - 1] ?? 1;

  const plotLeft = rtl ? END_PAD : Y_AXIS;
  const plotWidth = Math.max(0, width - Y_AXIS - END_PAD);
  const band = count > 0 ? plotWidth / count : 0;
  const barWidth = columnWidth(band);
  const yOf = (value: number) => TOP + PLOT_HEIGHT * (1 - value / top);

  // The latest day with the highest count gets the only direct label.
  let peak = -1;
  points.forEach((point, index) => {
    if (point.count > 0 && point.count >= (points[peak]?.count ?? 0)) peak = index;
  });

  const peakPoint = peak >= 0 ? points[peak] : undefined;

  const shortDate = (day: string) => formatDate(day, { day: "numeric", month: "short" });
  const longDate = (day: string) =>
    formatDate(day, { weekday: "long", day: "numeric", month: "long" });
  const pointText = (point: DailyPoint) =>
    t("dashboard.chartPoint", { date: longDate(point.day), count: formatNumber(point.count) });

  function centerOf(index: number): number {
    return plotLeft + bandLeft(index, plotWidth, count, rtl) + band / 2;
  }

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left - plotLeft;
    if (x < -END_PAD || x > plotWidth + END_PAD) {
      setActive(null);
      return;
    }
    setActive(bandIndexAt(x, plotWidth, count, rtl));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (count === 0) return;
    const current = active ?? count - 1;
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const backward = rtl ? "ArrowRight" : "ArrowLeft";
    let next: number | null = null;
    if (event.key === forward) next = Math.min(count - 1, current + 1);
    else if (event.key === backward) next = Math.max(0, current - 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = count - 1;
    else if (event.key === "Escape") {
      setActive(null);
      return;
    }
    if (next === null) return;
    event.preventDefault();
    setActive(next);
  }

  const activePoint = active !== null ? points[active] : undefined;
  const tooltipLeft =
    active !== null ? Math.min(Math.max(centerOf(active), 64), Math.max(64, width - 64)) : 0;

  const empty = count === 0 || total === 0;

  return (
    // Always mounted, so its width is known whichever period is shown.
    <div
      ref={ref}
      className={cn("transition-opacity", busy && "opacity-55")}
      aria-busy={busy || undefined}
    >
      {empty ? (
        <div
          className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 px-4 text-center text-sm text-slate-600"
          style={{ height: HEIGHT }}
        >
          {t("dashboard.chartEmpty")}
        </div>
      ) : (
        <>
          <p id={descriptionId} className="sr-only">
            {t("dashboard.chartKeyboardHint")}
          </p>
          <div
            role="group"
            aria-label={t("dashboard.chartTitle")}
            aria-describedby={descriptionId}
            tabIndex={0}
            onKeyDown={onKeyDown}
            onFocus={() => setActive((value) => value ?? count - 1)}
            onBlur={() => setActive(null)}
            className="relative rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4"
            style={{ height: HEIGHT }}
          >
            {width > 0 && (
              <svg
                width={width}
                height={HEIGHT}
                aria-hidden="true"
                className="block touch-pan-y select-none"
                style={{ direction: "ltr" }}
                onPointerMove={onPointerMove}
                onPointerDown={onPointerMove}
                onPointerLeave={(event) => {
                  if (document.activeElement !== event.currentTarget.parentElement) setActive(null);
                }}
              >
                {/* Gridlines and tick labels (start side). */}
                {ticks.map((tick) => {
                  const y = yOf(tick);
                  return (
                    <g key={tick}>
                      <line
                        x1={plotLeft}
                        x2={plotLeft + plotWidth}
                        y1={y}
                        y2={y}
                        stroke={tick === 0 ? CHART.axis : CHART.grid}
                        strokeWidth={1}
                        shapeRendering="crispEdges"
                      />
                      <text
                        x={rtl ? plotLeft + plotWidth + 8 : plotLeft - 8}
                        y={y}
                        dy="0.32em"
                        textAnchor={rtl ? "start" : "end"}
                        className="fill-slate-500 text-[11px] tabular-nums"
                      >
                        {formatNumber(tick)}
                      </text>
                    </g>
                  );
                })}

                {/* Hover band: the whole column is the hit target. */}
                {active !== null && (
                  <rect
                    x={plotLeft + bandLeft(active, plotWidth, count, rtl)}
                    y={TOP}
                    width={band}
                    height={PLOT_HEIGHT}
                    fill={CHART.hoverBand}
                  />
                )}

                {points.map((point, index) => {
                  const height = PLOT_HEIGHT * (point.count / top);
                  const x = centerOf(index) - barWidth / 2;
                  const path = columnPath(x, yOf(point.count), barWidth, height);
                  if (!path) return null;
                  return (
                    <path
                      key={point.day}
                      d={path}
                      fill={index === active ? CHART.active : CHART.series1}
                    />
                  );
                })}

                {/* The one direct label: the busiest day. */}
                {peakPoint && (
                  <text
                    x={centerOf(peak)}
                    y={yOf(peakPoint.count) - 7}
                    textAnchor="middle"
                    className="fill-slate-900 text-[12px] font-bold"
                  >
                    {formatNumber(peakPoint.count)}
                  </text>
                )}

                {/* Date labels under the baseline. */}
                {labelIndices(count, plotWidth).map((index) => {
                  const point = points[index];
                  if (!point) return null;
                  return (
                    <text
                      key={point.day}
                      x={Math.min(Math.max(centerOf(index), 30), width - 30)}
                      y={TOP + PLOT_HEIGHT + 19}
                      textAnchor="middle"
                      direction={dir}
                      className="fill-slate-500 text-[11px]"
                    >
                      {shortDate(point.day)}
                    </text>
                  );
                })}
              </svg>
            )}

            {activePoint && (
              <div
                className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-xl bg-slate-900 px-3 py-2 text-center text-white shadow-overlay"
                style={{ left: tooltipLeft }}
              >
                <p className="text-base leading-tight font-extrabold">
                  {formatNumber(activePoint.count)}
                </p>
                <p className="text-xs whitespace-nowrap text-slate-200">
                  {longDate(activePoint.day)}
                </p>
              </div>
            )}
          </div>
          <p aria-live="polite" className="sr-only">
            {activePoint ? pointText(activePoint) : ""}
          </p>

          <details className="group mt-3">
            <summary className="inline-flex min-h-11 cursor-pointer items-center rounded-lg text-sm font-bold text-primary hover:underline">
              {t("dashboard.chartShowTable")}
            </summary>
            <div className="mt-2 max-h-80 overflow-y-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <caption className="sr-only">{t("dashboard.chartTitle")}</caption>
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-start font-bold text-slate-600">
                      {t("dashboard.chartDate")}
                    </th>
                    <th scope="col" className="px-3 py-2 text-end font-bold text-slate-600">
                      {t("dashboard.chartCount")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...points].reverse().map((point) => (
                    <tr key={point.day} className="border-t border-slate-100">
                      <td className="px-3 py-1.5 text-slate-700">{longDate(point.day)}</td>
                      <td className="px-3 py-1.5 text-end text-slate-900 tabular-nums">
                        {formatNumber(point.count)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
