import { dueVerses, firstLetterHint, gradeCard, hifzStats, INTERVALS, TOP_BOX, type HifzCard } from '../hifz';
import { civilKey } from '../hijri';

const day = (d: number) => ({ year: 2026, month: 11, day: d });

describe('hifz schedule', () => {
  it('starts a verse and spaces its reviews out as it is recited well', () => {
    let c = gradeCard(undefined, 'good', day(1));
    expect(c).toMatchObject({ box: 1, reviews: 1, lapses: 0, since: '2026-11-01', due: '2026-11-02' });
    c = gradeCard(c, 'good', day(2));
    expect(c).toMatchObject({ box: 2, due: civilKey(day(2 + INTERVALS[2])) });
    c = gradeCard(c, 'good', day(5));
    expect(c).toMatchObject({ box: 3, due: '2026-11-12' });
  });

  it('brings a forgotten verse back tomorrow and counts the lapse', () => {
    const c: HifzCard = { box: 4, due: '2026-11-10', reviews: 6, lapses: 0, since: '2026-10-01' };
    expect(gradeCard(c, 'again', day(10))).toMatchObject({ box: 0, due: '2026-11-11', lapses: 1, reviews: 7, since: '2026-10-01' });
    // A first attempt that fails is not a lapse.
    expect(gradeCard(undefined, 'again', day(10))).toMatchObject({ box: 0, lapses: 0, due: '2026-11-11' });
  });

  it('keeps a hard verse in its box with a shorter gap, and caps the top box', () => {
    const c: HifzCard = { box: 4, due: '2026-11-10', reviews: 6, lapses: 0, since: '2026-10-01' };
    expect(gradeCard(c, 'hard', day(10))).toMatchObject({ box: 4, due: '2026-11-17' });
    const top: HifzCard = { ...c, box: TOP_BOX };
    expect(gradeCard(top, 'good', day(1)).box).toBe(TOP_BOX);
  });

  it('lists due verses in mushaf order and summarises progress', () => {
    const cards: Record<string, HifzCard> = {
      '12': { box: 2, due: '2026-11-05', reviews: 2, lapses: 0, since: '2026-11-01' },
      '3': { box: 5, due: '2026-11-04', reviews: 5, lapses: 0, since: '2026-10-01' },
      '7': { box: 0, due: '2026-11-09', reviews: 1, lapses: 1, since: '2026-11-01' },
    };
    expect(dueVerses(cards, day(5))).toEqual([3, 12]);
    expect(hifzStats(cards, day(5))).toEqual({ total: 3, memorised: 2, strong: 1, due: 2 });
  });
});

describe('first-letter hints', () => {
  it('keeps the letter, its vowels and its joining form', () => {
    expect(firstLetterHint('قُلۡ')).toBe('قُـ');
    expect(firstLetterHint('ٱلۡحَمۡدُ')).toBe('ٱ');
    expect(firstLetterHint('وَٱلۡعَصۡرِ')).toBe('وَ');
    expect(firstLetterHint('بِسۡمِ')).toBe('بِـ');
  });
});
