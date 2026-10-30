import { crownSurah, KIDS_SURAHS, kidStats, learnVerse, nextSurah, resetSurah, type Kid } from '../kids';

const kid: Kid = { id: 'a', name: 'سارة', color: '#000', createdAt: 0, surahs: {} };

describe('kids hifz', () => {
  it('starts with al-Fatihah then goes back from an-Nas to an-Naba', () => {
    expect(KIDS_SURAHS.slice(0, 4)).toEqual([1, 114, 113, 112]);
    expect(KIDS_SURAHS.at(-1)).toBe(78);
    expect(KIDS_SURAHS).toHaveLength(38);
  });

  it('gives one star per verse, once', () => {
    let k = learnVerse(kid, 112, 2);
    k = learnVerse(k, 112, 1);
    k = learnVerse(k, 112, 2);
    expect(k.surahs[112].learned).toEqual([1, 2]);
    expect(kidStats(k)).toEqual({ stars: 2, crowns: 0 });
  });

  it('crowns a surah heard in full and suggests the next', () => {
    let k = crownSurah(kid, 1, 7);
    expect(kidStats(k)).toEqual({ stars: 7, crowns: 1 });
    expect(nextSurah(k, { 1: 7, 114: 6 })).toBe(114);
    k = resetSurah(k, 1);
    expect(nextSurah(k, { 1: 7 })).toBe(1);
  });
});
