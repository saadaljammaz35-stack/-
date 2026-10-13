/** Pure geometry for the daily column chart (kept separate so it can be tested). */

export const MAX_BAR = 24;
export const BAR_GAP = 2;
export const CORNER = 4;

/**
 * A column with a rounded data end (top) and a square baseline. Returns ""
 * for a zero-height column.
 */
export function columnPath(x: number, y: number, width: number, height: number): string {
  if (height <= 0 || width <= 0) return "";
  const r = Math.min(CORNER, width / 2, height);
  const bottom = y + height;
  const right = x + width;
  return [
    `M${x},${bottom}`,
    `V${y + r}`,
    `Q${x},${y} ${x + r},${y}`,
    `H${right - r}`,
    `Q${right},${y} ${right},${y + r}`,
    `V${bottom}`,
    "Z",
  ].join(" ");
}

/** Column width inside a band: never wider than 24px, always a 2px gap, at least 1px. */
export function columnWidth(band: number): number {
  return Math.max(1, Math.min(MAX_BAR, band - BAR_GAP));
}

/**
 * Indices of the x-axis labels: evenly spread, first and last included,
 * at most one label per `minSpacing` pixels.
 */
export function labelIndices(count: number, plotWidth: number, minSpacing = 76): number[] {
  if (count <= 0) return [];
  if (count === 1) return [0];
  const fit = Math.max(2, Math.floor(plotWidth / minSpacing) + 1);
  const labels = Math.min(count, fit);
  const indices = new Set<number>();
  for (let j = 0; j < labels; j += 1) indices.add(Math.round((j * (count - 1)) / (labels - 1)));
  return [...indices].sort((a, b) => a - b);
}

/**
 * Which band a pointer x (in px from the plot's left edge) falls in. Time runs
 * right-to-left in RTL, so index 0 (the oldest day) is on the right there.
 */
export function bandIndexAt(x: number, plotWidth: number, count: number, rtl: boolean): number {
  if (count <= 0 || plotWidth <= 0) return -1;
  const band = plotWidth / count;
  const fromStart = rtl ? plotWidth - x : x;
  return Math.min(count - 1, Math.max(0, Math.floor(fromStart / band)));
}

/** Left edge (px from the plot's left) of band `index`. */
export function bandLeft(index: number, plotWidth: number, count: number, rtl: boolean): number {
  const band = plotWidth / count;
  return rtl ? plotWidth - (index + 1) * band : index * band;
}
