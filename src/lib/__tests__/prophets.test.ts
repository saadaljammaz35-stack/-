import { PROPHETS, prophetPatterns } from '../prophets';

describe('prophets in the Quran', () => {
  it('lists the twenty-five named prophets', () => {
    expect(PROPHETS).toHaveLength(25);
    expect(PROPHETS[0].ar).toBe('آدم');
    expect(PROPHETS.at(-1)?.ar).toContain('محمد');
  });
  it('matches ambiguous names only by phrase', () => {
    const salih = PROPHETS.find((p) => p.ar === 'صالح')!;
    expect(prophetPatterns(salih).every((x) => !x.startsWith('% '))).toBe(true);
    const musa = PROPHETS.find((p) => p.ar === 'موسى')!;
    expect(prophetPatterns(musa)).toContain('% وموسى %');
  });
});
