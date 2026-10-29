// Between the adhan and the iqama: which prayer's window we are in, when the iqama comes, and
// which memorised verses to recite in it.
import type { FardId } from './prayer-log';

/** Minutes from the adhan to the iqama; the common practice in Saudi mosques. */
export const DEFAULT_IQAMA: Record<FardId, number> = { fajr: 25, dhuhr: 20, asr: 20, maghrib: 10, isha: 20 };

/** Prayers recited aloud, where the imam's recitation is heard (and memorised verses fit). */
export const JAHRI: FardId[] = ['fajr', 'maghrib', 'isha'];

export type BetweenState =
  | { phase: 'between'; prayer: FardId; adhanAt: Date; iqamaAt: Date }
  | { phase: 'waiting'; prayer: FardId; adhanAt: Date; iqamaAt: Date };

/**
 * `between` from the adhan until the iqama of the latest prayer; otherwise `waiting` for the
 * next prayer's adhan.
 */
export function betweenState(now: Date, previous: { id: FardId; at: Date } | null, next: { id: FardId; at: Date }, iqama: Record<FardId, number>): BetweenState {
  if (previous) {
    const iqamaAt = new Date(previous.at.getTime() + iqama[previous.id] * 60_000);
    if (now >= previous.at && now < iqamaAt) return { phase: 'between', prayer: previous.id, adhanAt: previous.at, iqamaAt };
  }
  return { phase: 'waiting', prayer: next.id, adhanAt: next.at, iqamaAt: new Date(next.at.getTime() + iqama[next.id] * 60_000) };
}

/** Consecutive verse ids grouped into [from, to] runs. */
export function contiguousRuns(ids: number[]): [number, number][] {
  const sorted = [...new Set(ids)].sort((a, b) => a - b);
  const runs: [number, number][] = [];
  for (const id of sorted) {
    const last = runs[runs.length - 1];
    if (last && id === last[1] + 1) last[1] = id;
    else runs.push([id, id]);
  }
  return runs;
}

/**
 * Due verses to recite in a two-rak'ah prayer: the first runs, each capped so a rak'ah stays
 * a natural length (longer at Fajr).
 */
export function prayerPortions(dueIds: number[], prayer: FardId): [number, number][] {
  const cap = prayer === 'fajr' ? 15 : 8;
  return contiguousRuns(dueIds)
    .slice(0, 2)
    .map(([from, to]) => [from, Math.min(to, from + cap - 1)] as [number, number]);
}
