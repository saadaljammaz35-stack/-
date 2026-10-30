// Memorisation (hifz): each memorised verse is a card on a spaced-review schedule. A verse
// recited well comes back after longer and longer gaps; a slip brings it back the next day.
import { addCivilDays, civilKey, type CivilDate } from './hijri';

export type HifzGrade = 'again' | 'hard' | 'good';

export type HifzCard = {
  /** 0 = still learning; each good recital moves it up one box. */
  box: number;
  /** Civil date key (YYYY-MM-DD) of the next review. */
  due: string;
  reviews: number;
  lapses: number;
  /** Civil date key of the first time it was recited. */
  since: string;
  /** Civil date key of the latest recital. */
  last?: string;
};

/** Days until the next review for a verse in each box (box 1 onwards). */
export const INTERVALS = [1, 1, 3, 7, 14, 30, 60, 120];
export const TOP_BOX = INTERVALS.length - 1;

export function gradeCard(card: HifzCard | undefined, grade: HifzGrade, today: CivilDate): HifzCard {
  const key = civilKey(today);
  const base: HifzCard = { ...(card ?? { box: 0, due: key, reviews: 0, lapses: 0, since: key }), last: key };
  const reviews = base.reviews + 1;
  if (grade === 'again') {
    // Back to learning; it is due again tomorrow.
    return { ...base, box: 0, reviews, lapses: base.lapses + (card ? 1 : 0), due: civilKey(addCivilDays(today, 1)) };
  }
  if (grade === 'hard') {
    const box = Math.max(1, base.box);
    return { ...base, box, reviews, due: civilKey(addCivilDays(today, Math.max(1, Math.floor(INTERVALS[box] / 2)))) };
  }
  const box = Math.min(TOP_BOX, base.box + 1);
  return { ...base, box, reviews, due: civilKey(addCivilDays(today, INTERVALS[box])) };
}

/** Verse ids due today or overdue, in mushaf order. */
export function dueVerses(cards: Record<string, HifzCard>, today: CivilDate): number[] {
  const key = civilKey(today);
  return Object.entries(cards)
    .filter(([, c]) => c.due <= key)
    .map(([id]) => Number(id))
    .sort((a, b) => a - b);
}

/** Keys of any cards due today or overdue, most overdue first (for adhkar learned by heart). */
export function dueKeys(cards: Record<string, HifzCard>, today: CivilDate): string[] {
  const key = civilKey(today);
  return Object.entries(cards)
    .filter(([, c]) => c.due <= key)
    .sort((a, b) => (a[1].due < b[1].due ? -1 : a[1].due > b[1].due ? 1 : 0))
    .map(([k]) => k);
}

/** How firmly a verse is held: due today, still weak, growing, or strong (survived two weeks). */
export type HifzStrength = 'due' | 'weak' | 'growing' | 'strong';

export function hifzStrength(card: HifzCard, today: CivilDate): HifzStrength {
  if (card.due <= civilKey(today)) return 'due';
  if (card.box >= 4) return 'strong';
  return card.box >= 2 ? 'growing' : 'weak';
}

/** The strength of every memorised verse, keyed by verse id. */
export function strengthMap(cards: Record<string, HifzCard>, today: CivilDate): Record<number, HifzStrength> {
  const out: Record<number, HifzStrength> = {};
  for (const [id, card] of Object.entries(cards)) out[Number(id)] = hifzStrength(card, today);
  return out;
}

export type HifzStats = { total: number; memorised: number; strong: number; due: number };

/** `memorised`: recited well at least once; `strong`: has survived a review two weeks out. */
export function hifzStats(cards: Record<string, HifzCard>, today: CivilDate): HifzStats {
  const list = Object.values(cards);
  return {
    total: list.length,
    memorised: list.filter((c) => c.box >= 1).length,
    strong: list.filter((c) => c.box >= 4).length,
    due: dueVerses(cards, today).length,
  };
}

const NON_JOINING = new Set('اأإآٱدذرزوؤةىءۥۦ');

/**
 * The first letter of a written word (with its vowel marks) as a memory hint, followed by a
 * tatweel when the letter joins to the next so it keeps its initial form: «ٱلۡحَمۡدُ» → «ٱ»,
 * «قُلۡ» → «قُـ».
 */
export function firstLetterHint(word: string): string {
  const m = word.match(/^\p{L}\p{M}*/u);
  if (!m) return word.slice(0, 1);
  const letter = m[0];
  return NON_JOINING.has(letter[0]) || letter.length === word.length ? letter : `${letter}ـ`;
}
