'use client';

import { useState } from 'react';

export interface BarDatum {
  label: string; // ISO day, e.g. 2026-11-25
  value: number;
}

function niceMax(max: number): number {
  if (max <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s * 4 >= max) ?? magnitude * 10;
  return step * 4;
}

const fmt = new Intl.NumberFormat('ar-SA-u-nu-latn');
const day = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/**
 * Single-series column chart (one measure per chart: two measures of different scale get two charts, never a
 * second axis). Thin columns with a rounded data end, hairline grid, hover/focus tooltip and a table view.
 */
export function BarChart({ title, data }: { title: string; data: BarDatum[] }) {
  const [active, setActive] = useState<number | null>(null);
  const W = 640;
  const H = 180;
  const pad = { top: 12, right: 8, bottom: 24, left: 40 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const slot = innerW / Math.max(1, data.length);
  const barW = Math.max(2, Math.min(24, slot - 2));
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;
  const ticks = [0, max / 2, max];
  const total = data.reduce((a, d) => a + d.value, 0);
  const current = active !== null ? data[active] : undefined;

  return (
    <figure className="rounded-2xl border border-line p-5">
      <figcaption className="mb-4 flex items-baseline justify-between gap-4">
        <span className="font-bold">{title}</span>
        <span className="text-sm text-muted" aria-live="polite">
          {current ? `${day.format(new Date(current.label))}: ${fmt.format(current.value)}` : `المجموع: ${fmt.format(total)}`}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ direction: 'ltr' }} role="img" aria-label={`${title}، المجموع ${fmt.format(total)}`} onMouseLeave={() => setActive(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
            <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)">
              {t >= 10000 ? `${Math.round(t / 1000)}K` : fmt.format(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.left + i * slot + (slot - barW) / 2;
          const top = y(d.value);
          const h = pad.top + innerH - top;
          const r = Math.min(4, h, barW / 2);
          const path =
            h <= 0
              ? ''
              : `M${x},${pad.top + innerH} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${pad.top + innerH} Z`;
          return (
            <g key={d.label} onMouseEnter={() => setActive(i)}>
              <rect x={pad.left + i * slot} y={pad.top} width={slot} height={innerH} fill="transparent" />
              {path && <path d={path} fill={active === i ? 'var(--sand)' : 'var(--fg)'} />}
            </g>
          );
        })}
        {[0, Math.floor((data.length - 1) / 2), data.length - 1]
          .filter((i, idx, arr) => data[i] && arr.indexOf(i) === idx)
          .map((i) => (
            <text key={i} x={pad.left + i * slot + slot / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--muted)">
              {day.format(new Date(data[i]!.label))}
            </text>
          ))}
      </svg>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-muted">عرض كجدول</summary>
        <table className="mt-3 w-full text-start">
          <thead>
            <tr className="text-muted">
              <th className="py-1 text-start font-normal">اليوم</th>
              <th className="py-1 text-start font-normal">{title}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label} className="border-t border-line">
                <td className="py-1">{day.format(new Date(d.label))}</td>
                <td className="py-1 tabular-nums">{fmt.format(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
