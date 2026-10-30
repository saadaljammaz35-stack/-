// «وقت قراءتك»: how long the user takes for a mushaf page, learned from the time each page stays
// open, to estimate a surah, a juz or the day's portion at their own pace.

/** A page left sooner was skimmed; one left open longer was put down. Neither is a reading. */
export const PACE_MIN_SECONDS = 15;
export const PACE_MAX_SECONDS = 600;
const KEEP = 60;
const MIN_SAMPLES = 5;

export function addPaceSample(samples: number[], seconds: number): number[] {
  if (!(seconds >= PACE_MIN_SECONDS && seconds <= PACE_MAX_SECONDS)) return samples;
  return [...samples, Math.round(seconds)].slice(-KEEP);
}

/** Median seconds per page, or null until there are enough readings. */
export function secondsPerPage(samples: number[]): number | null {
  if (samples.length < MIN_SAMPLES) return null;
  const s = [...samples].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Whole minutes (at least one) to read `pages` pages. */
export function readingMinutes(pages: number, spp: number): number {
  return Math.max(1, Math.round((pages * spp) / 60));
}
