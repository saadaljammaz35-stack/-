// «ختمة السماع»: the verses heard in full, kept as merged ranges of verse ids (0–6235).

export const TOTAL_VERSES = 6236;

export type Ranges = [number, number][];

/** Adds a verse id, merging with neighbouring ranges. */
export function addVerse(ranges: Ranges, id: number): Ranges {
  if (id < 0 || id >= TOTAL_VERSES || hasVerse(ranges, id)) return ranges;
  const out: Ranges = [];
  let merged: [number, number] = [id, id];
  for (const r of ranges) {
    if (r[1] < merged[0] - 1) out.push(r);
    else if (r[0] > merged[1] + 1) {
      out.push(merged);
      merged = r;
    } else merged = [Math.min(r[0], merged[0]), Math.max(r[1], merged[1])];
  }
  out.push(merged);
  return out.sort((a, b) => a[0] - b[0]);
}

export function hasVerse(ranges: Ranges, id: number): boolean {
  return ranges.some(([a, b]) => id >= a && id <= b);
}

export function heardCount(ranges: Ranges): number {
  return ranges.reduce((n, [a, b]) => n + b - a + 1, 0);
}

/** The first verse not yet heard, or null when all are. */
export function firstUnheard(ranges: Ranges): number | null {
  let next = 0;
  for (const [a, b] of ranges) {
    if (a > next) return next;
    next = Math.max(next, b + 1);
  }
  return next < TOTAL_VERSES ? next : null;
}

/** Heard verses within [from, to]. */
export function heardBetween(ranges: Ranges, from: number, to: number): number {
  return ranges.reduce((n, [a, b]) => n + Math.max(0, Math.min(b, to) - Math.max(a, from) + 1), 0);
}
