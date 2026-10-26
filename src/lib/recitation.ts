// Following a recitation word by word: which timed word is sounding, and which written word
// on the mushaf page it falls on.
import type { PageLine } from '@/data/content';
import type { VerseTiming } from '@/data/remote';

/** The word being recited at `ms`; between two words the last one started stays lit. */
export function wordAt(timings: VerseTiming[], ayah: number | null, ms: number): number | null {
  const t = ayah == null ? undefined : timings.find((x) => x.ayah === ayah);
  if (!t || !t.words.length || ms < t.from || ms >= t.to) return null;
  let word: number | null = null;
  for (const [position, from] of t.words) {
    if (from > ms) break;
    word = position;
  }
  return word;
}

/**
 * The written word under the reciter. The timings number a few joined words separately
 * (e.g. «لَّوۡمَا» as «لَّوۡ مَا»), so take the last written word starting at or before it.
 */
export function recitedWord(lines: PageLine[], verseId: number, position: number): number | null {
  let best: number | null = null;
  for (const line of lines) {
    if (line.type !== 'ayah') continue;
    for (const [v, , isEnd, p] of line.words) {
      if (v === verseId && !isEnd && p <= position && (best == null || p > best)) best = p;
    }
  }
  return best;
}
