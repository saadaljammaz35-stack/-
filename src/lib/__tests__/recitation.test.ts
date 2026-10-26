import layout from '../../../data/quran/layout.json';
import type { PageLine } from '@/data/content';
import type { VerseTiming } from '@/data/remote';
import { recitedWord, wordAt } from '../recitation';

// 112:1 as timed by Quran.com for Mishary al-Afasy (word positions 1–4).
const timings: VerseTiming[] = [
  { ayah: 1, from: 0, to: 2915, words: [[1, 0, 430], [2, 430, 700], [3, 700, 1680], [4, 1680, 2915]] },
  { ayah: 2, from: 2915, to: 5000, words: [] },
];

describe('wordAt', () => {
  it('follows the reciter through the verse', () => {
    expect(wordAt(timings, 1, 0)).toBe(1);
    expect(wordAt(timings, 1, 500)).toBe(2);
    expect(wordAt(timings, 1, 1700)).toBe(4);
  });

  it('keeps the last word lit through pauses and handles missing timings', () => {
    const paused: VerseTiming[] = [{ ayah: 1, from: 0, to: 3000, words: [[1, 0, 400], [2, 900, 1500]] }];
    expect(wordAt(paused, 1, 600)).toBe(1);
    expect(wordAt(timings, 2, 3000)).toBeNull();
    expect(wordAt(timings, null, 100)).toBeNull();
    expect(wordAt(timings, 1, 4000)).toBeNull();
  });
});

describe('recitedWord', () => {
  // 15:7 «لَّوۡمَا» is one written word but two timed words (positions 1 and 2).
  const lines: PageLine[] = [
    { type: 'ayah', words: [[1808, 'لَّوۡمَا', 0, 1], [1808, 'تَأۡتِينَا', 0, 3], [1808, 'بِٱلۡمَلَٰٓئِكَةِ', 0, 4]] },
    { type: 'ayah', words: [[1808, '٧', 1, 9], [1809, 'مَا', 0, 1]] },
  ];

  it('maps timed words onto written words', () => {
    expect(recitedWord(lines, 1808, 1)).toBe(1);
    expect(recitedWord(lines, 1808, 2)).toBe(1);
    expect(recitedWord(lines, 1808, 3)).toBe(3);
    expect(recitedWord(lines, 1808, 9)).toBe(4);
    expect(recitedWord(lines, 1809, 1)).toBe(1);
    expect(recitedWord(lines, 1810, 1)).toBeNull();
  });

  it('has a timing position on every mushaf word, increasing through each verse', () => {
    const last = new Map<number, number>();
    let words = 0;
    for (const page of layout as { t: string; w?: [number, string, number, number][] }[][]) {
      for (const line of page) {
        for (const [verse, , , position] of line.w ?? []) {
          expect(Number.isInteger(position)).toBe(true);
          expect(position).toBeGreaterThan(last.get(verse) ?? 0);
          last.set(verse, position);
          words++;
        }
      }
    }
    expect(last.size).toBe(6236);
    expect(words).toBeGreaterThan(80000);
  });
});
