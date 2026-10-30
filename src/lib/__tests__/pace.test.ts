import { addPaceSample, readingMinutes, secondsPerPage } from '../pace';

describe('reading pace', () => {
  it('ignores skimmed and abandoned pages', () => {
    expect(addPaceSample([], 5)).toEqual([]);
    expect(addPaceSample([], 2000)).toEqual([]);
    expect(addPaceSample([], 70.4)).toEqual([70]);
  });

  it('needs five readings, then uses the median', () => {
    let s: number[] = [];
    for (const x of [60, 80, 70, 500]) s = addPaceSample(s, x);
    expect(secondsPerPage(s)).toBeNull();
    s = addPaceSample(s, 90);
    expect(secondsPerPage(s)).toBe(80);
    s = addPaceSample(s, 65);
    expect(secondsPerPage(s)).toBe(75);
  });

  it('keeps the latest sixty', () => {
    let s: number[] = [];
    for (let i = 0; i < 70; i++) s = addPaceSample(s, 20 + i);
    expect(s).toHaveLength(60);
    expect(s[0]).toBe(30);
  });

  it('estimates minutes', () => {
    expect(readingMinutes(20, 75)).toBe(25);
    expect(readingMinutes(0.2, 60)).toBe(1);
  });
});
