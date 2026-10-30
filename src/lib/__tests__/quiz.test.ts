import { choices, completeVerse, meaningQuestions, nameClue, seeded, shuffle } from '../quiz';

describe('quiz', () => {
  it('is deterministic for a seed', () => {
    expect(shuffle([1, 2, 3, 4, 5], seeded(7))).toEqual(shuffle([1, 2, 3, 4, 5], seeded(7)));
  });

  it('offers the answer once among distinct choices', () => {
    const c = choices('الرحمن', ['الرحيم', 'الرحمن', 'الملك', 'الملك', 'القدوس'], 4, seeded(1));
    expect(c).toHaveLength(4);
    expect(c.filter((x) => x === 'الرحمن')).toHaveLength(1);
    expect(new Set(c).size).toBe(4);
  });

  it('hides the name in its clue', () => {
    const clue = nameClue('الغفور', 'الغفور: هو الذي تكثر منه المغفرة، والغفور يغفر الذنوب.');
    expect(clue).not.toMatch(/غفور/);
    expect(clue).toContain('…');
  });

  it('asks word meanings with three options', () => {
    const q = meaningQuestions([{ word: 'احتسابًا', meaning: 'طلبًا للثواب' }], ['تصديقًا', 'خوفًا', 'رجاءً', 'طلبًا للثواب'], seeded(3));
    expect(q[0].options).toContain('طلبًا للثواب');
    expect(q[0].options).toHaveLength(3);
  });

  it('hides the end of a verse', () => {
    const v = completeVerse('إِنَّ ٱللَّهَ مَعَ ٱلصَّٰبِرِينَ'.split(' '), ['عَلِيمٌ حَكِيمٌ', 'غَفُورٌ رَّحِيمٌ'], seeded(2));
    expect(v.shown).toBe('إِنَّ ٱللَّهَ');
    expect(v.answer).toBe('مَعَ ٱلصَّٰبِرِينَ');
    expect(v.options).toContain(v.answer);
  });
});
