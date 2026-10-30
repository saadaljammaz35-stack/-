// Questions built only from the app's own sources: the names of Allah with al-Khattabi's
// explanations, the word meanings of HadeethEnc, and the text of the mushaf.
import { normalizeArabic } from './arabic';

/** A small deterministic generator (mulberry32), so a day's quiz stays the same. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(list: readonly T[], rand: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** The answer and up to `n - 1` other distinct choices from the pool, in random order. */
export function choices(answer: string, pool: readonly string[], n: number, rand: () => number): string[] {
  const key = (s: string) => normalizeArabic(s).trim();
  const seen = new Set([key(answer)]);
  const others: string[] = [];
  for (const x of shuffle(pool, rand)) {
    if (others.length >= n - 1) break;
    if (!x.trim() || seen.has(key(x))) continue;
    seen.add(key(x));
    others.push(x);
  }
  return shuffle([answer, ...others], rand);
}

/** Consonant skeleton of a word, for spotting forms of the same root (الحفيظ ~ الحافظ ~ حفظ). */
const skeleton = (w: string) => normalizeArabic(w).replace(/^(وال|بال|فال|كال|لل|ال)/, '').replace(/[اويىه]/g, '');

/** The explanation with the name and words from its root hidden, to ask which name it explains. */
export function nameClue(name: string, explanation: string, max = 200): string {
  const root = skeleton(name);
  const words = explanation
    .split(/\s+/)
    .map((w) => (root.length >= 3 && skeleton(w).includes(root) ? '…' : w));
  const clue = words.join(' ');
  return clue.length > max ? `${clue.slice(0, max).replace(/\s+\S*$/, '')} …` : clue;
}

export type MeaningEntry = { word: string; meaning: string };

/** «ما معنى …؟»: one question per entry, wrong options from the other meanings. */
export function meaningQuestions(entries: MeaningEntry[], pool: string[], rand: () => number, n = 3) {
  return shuffle(entries, rand)
    .filter((e) => e.word.trim() && e.meaning.trim())
    .slice(0, n)
    .map((e) => ({ word: e.word.trim(), answer: e.meaning.trim(), options: choices(e.meaning.trim(), pool, 3, rand) }));
}

/** «أكمل الآية»: the verse without its last words, and the missing words among endings of other verses. */
export function completeVerse(words: string[], otherEndings: string[], rand: () => number) {
  const hide = words.length > 8 ? 3 : 2;
  const answer = words.slice(-hide).join(' ');
  return { shown: words.slice(0, -hide).join(' '), answer, options: choices(answer, otherEndings, 3, rand) };
}
