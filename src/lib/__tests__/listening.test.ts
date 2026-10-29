import { addVerse, firstUnheard, hasVerse, heardBetween, heardCount, TOTAL_VERSES, type Ranges } from '../listening';

describe('listening khatma ranges', () => {
  it('merges neighbouring verses into ranges', () => {
    let r: Ranges = [];
    for (const id of [5, 6, 7, 10, 9, 8, 0]) r = addVerse(r, id);
    expect(r).toEqual([
      [0, 0],
      [5, 10],
    ]);
    expect(heardCount(r)).toBe(7);
    expect(hasVerse(r, 8)).toBe(true);
    expect(hasVerse(r, 4)).toBe(false);
    expect(addVerse(r, 7)).toBe(r);
  });

  it('finds the first verse not heard and counts within a surah', () => {
    let r: Ranges = [];
    expect(firstUnheard(r)).toBe(0);
    for (let i = 0; i < 7; i++) r = addVerse(r, i);
    expect(firstUnheard(r)).toBe(7);
    expect(heardBetween(r, 0, 6)).toBe(7);
    expect(heardBetween(r, 5, 300)).toBe(2);
    const all: Ranges = [[0, TOTAL_VERSES - 1]];
    expect(firstUnheard(all)).toBeNull();
    expect(addVerse(all, TOTAL_VERSES)).toBe(all);
  });
});
