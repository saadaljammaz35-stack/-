import { BUNDLED_LEXICON } from '../lexicon';
import {
  getCompiledLexicon,
  getLexiconVersion,
  mergeLexicons,
  refreshLexicon,
  resetLexiconForTests,
  validateLexicon,
} from '../lexiconProvider';
import { editDistance, fuzzyEquals, normalizeArabic, stemCandidates } from '../normalize';
import { compileLexicon, parseQuery } from '../parser';

const lex = compileLexicon(BUNDLED_LEXICON);

describe('normalizeArabic', () => {
  it('unifies letter variants, removes diacritics and punctuation', () => {
    expect(normalizeArabic('مَحَلّك')).toBe('محلك');
    expect(normalizeArabic('أين الإبريق؟')).toBe('اين الابريق');
    expect(normalizeArabic('ساعة مكسورة')).toBe('ساعه مكسوره');
    expect(normalizeArabic('على مستشفى')).toBe('علي مستشفي');
  });
  it('converts Eastern Arabic digits and collapses elongated speech', () => {
    expect(normalizeArabic('الدرج ٢')).toBe('الدرج 2');
    expect(normalizeArabic('ويييين')).toBe('وين');
  });
  it('lower-cases Latin text', () => {
    expect(normalizeArabic('AirPods PRO')).toBe('airpods pro');
  });
});

describe('stemCandidates', () => {
  it('strips possessive suffixes and proclitics', () => {
    expect(stemCandidates('سماعتي')).toContain('سماعه');
    expect(stemCandidates('مفاتيحي')).toContain('مفاتيح');
    expect(stemCandidates('بالدرج')).toContain('درج');
    expect(stemCandidates('عالرف')).toContain('رف');
  });
});

describe('fuzzy matching', () => {
  it('computes transpositions as one edit', () => {
    expect(editDistance('شاحن', 'شحان')).toBe(1);
  });
  it('never treats short Arabic roots one letter apart as equal', () => {
    expect(fuzzyEquals('بنك', 'بني')).toBe(false);
    expect(fuzzyEquals('بوك', 'بنك')).toBe(false);
  });
  it('tolerates a typo in longer words', () => {
    expect(fuzzyEquals('البلايستيشن', 'البلاستيشن')).toBe(true);
  });
});

describe('parseQuery – examples from the product brief', () => {
  const cases: [string, string, Partial<ReturnType<typeof parseQuery>>][] = [
    ['وين حطيت سماعتي؟', 'find_item', { itemConcepts: ['earphones'] }],
    ['فين خليت الشاحن؟', 'find_item', { itemConcepts: ['charger'] }],
    ['وين داري المفتاح؟', 'find_item', { itemConcepts: ['keys'] }],
    ['أبي الثوب اللي صورته أمس', 'find_item', { itemConcepts: ['thobe'], time: 'yesterday' }],
    ['وش الأشياء اللي حطيتها بالدرج؟', 'list_location', { placeConcepts: ['drawer'] }],
    ['وين أغراض السفر؟', 'find_item', { tagConcepts: ['travel'] }],
  ];
  it.each(cases)('%s', (text, intent, expected) => {
    const q = parseQuery(text, lex);
    expect(q.intent).toBe(intent);
    expect(q).toMatchObject(expected);
    expect(q.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it('understands the white charger color', () => {
    expect(parseQuery('وين حطيت الشاحن الأبيض؟', lex).colors).toEqual(['white']);
  });

  it('reads "مفتاح حق السيارة" as the car key', () => {
    expect(parseQuery('وين المفتاح حق السيارة', lex).itemConcepts).toContain('car_key');
  });

  it('detects dialect hints without requiring them', () => {
    expect(parseQuery('فينو الشاحن', lex).dialectHints).toContain('hijazi');
    expect(parseQuery('اشتي البوك', lex).dialectHints).toContain('janoubi');
    expect(parseQuery('وين الشاحن', lex).dialectHints).toEqual([]);
  });

  it('marks gibberish as unknown with low confidence', () => {
    const q = parseQuery('اممم', lex);
    expect(q.intent === 'unknown' || q.confidence < 0.45).toBe(true);
  });

  it('recognizes small talk instead of searching', () => {
    expect(parseQuery('السلام عليكم', lex).intent).toBe('smalltalk');
    expect(parseQuery('كم الساعة؟', lex).intent).toBe('smalltalk');
  });
});

describe('remote lexicon updates', () => {
  afterEach(() => resetLexiconForTests());

  it('rejects malformed payloads', () => {
    expect(validateLexicon(null)).toBeNull();
    expect(validateLexicon({ version: 'x' })).toBeNull();
    expect(validateLexicon({ version: 2, markers: { find: [1, 2] } })).toBeNull();
    expect(validateLexicon({ version: 2, markers: {}, items: [{ id: 'x', terms: ['a'] }] })).toBeNull();
  });

  it('extends terms without removing bundled understanding', () => {
    const merged = mergeLexicons(BUNDLED_LEXICON, {
      version: 2,
      items: [{ id: 'earphones', category: 'electronics', terms: ['سماعه الجيم'] }, { id: 'stapler', category: 'tools', terms: ['دباسه'] }],
    } as never);
    const earphones = merged.items.find((i) => i.id === 'earphones')!;
    expect(earphones.terms).toContain('ايربودز');
    expect(earphones.terms).toContain('سماعه الجيم');
    expect(merged.items.some((i) => i.id === 'stapler')).toBe(true);
  });

  it('applies a newer cached/remote lexicon and keeps working offline', async () => {
    const store: { v: unknown } = { v: null };
    const cache = { read: async () => store.v, write: async (v: unknown) => void (store.v = v) };
    const remote = { version: 5, markers: {}, items: [{ id: 'stapler', category: 'tools', terms: ['دباسه'] }] };
    const version = await refreshLexicon({ fetchLatest: async () => remote }, cache);
    expect(version).toBe(5);
    expect(parseQuery('وين الدباسة', getCompiledLexicon()).itemConcepts).toEqual(['stapler']);
    expect(store.v).toEqual(remote);

    resetLexiconForTests();
    const offline = await refreshLexicon(
      {
        fetchLatest: async () => {
          throw new Error('network');
        },
      },
      cache,
    );
    expect(offline).toBe(5);
    expect(getLexiconVersion()).toBe(5);
  });

  it('ignores remote versions that are not newer', async () => {
    const cache = { read: async () => null, write: async () => undefined };
    await refreshLexicon({ fetchLatest: async () => ({ version: 1, markers: {} }) }, cache);
    expect(getLexiconVersion()).toBe(BUNDLED_LEXICON.version);
  });
});
