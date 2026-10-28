// Read-only queries over the bundled content database.
import { normalizeArabic, toArabicDigits } from '@/lib/arabic';
import { civilKey, type CivilDate } from '@/lib/hijri';

import { getContentDb, likePattern } from './db';

// ---------- Quran ----------

export type Surah = {
  id: number;
  name: string;
  nameSimple: string;
  nameEn: string;
  revelation: 'meccan' | 'medinan';
  versesCount: number;
  pageStart: number;
  pageEnd: number;
  bismillahPre: boolean;
};

export type Verse = {
  id: number;
  surah: number;
  ayah: number;
  page: number;
  juz: number;
  hizb: number;
  rub: number;
  sajda: boolean;
  textQpc: string;
  textUthmani: string;
  textSimple: string;
};

/**
 * [verse id, word text, 1 if the token is the verse-end number, position of the word in its
 * verse as numbered by the reciters' word timings]
 */
export type LayoutWord = [number, string, 0 | 1, number];
export type PageLine =
  | { type: 'ayah'; words: LayoutWord[] }
  | { type: 'surah'; surah: number }
  | { type: 'basmala'; surah: number };

let surahCache: Surah[] | null = null;

export async function getSurahs(): Promise<Surah[]> {
  if (surahCache) return surahCache;
  const db = await getContentDb();
  const rows = await db.getAllAsync<{
    id: number;
    name: string;
    name_simple: string;
    name_en: string;
    revelation: 'meccan' | 'medinan';
    verses_count: number;
    page_start: number;
    page_end: number;
    bismillah_pre: number;
  }>('SELECT * FROM surahs ORDER BY id');
  surahCache = rows.map((r) => ({
    id: r.id,
    name: r.name,
    nameSimple: r.name_simple,
    nameEn: r.name_en,
    revelation: r.revelation,
    versesCount: r.verses_count,
    pageStart: r.page_start,
    pageEnd: r.page_end,
    bismillahPre: r.bismillah_pre === 1,
  }));
  return surahCache;
}

type VerseRow = {
  id: number;
  surah: number;
  ayah: number;
  page: number;
  juz: number;
  hizb: number;
  rub: number;
  sajda: number;
  text_qpc: string;
  text_uthmani: string;
  text_simple: string;
};

const toVerse = (r: VerseRow): Verse => ({
  id: r.id,
  surah: r.surah,
  ayah: r.ayah,
  page: r.page,
  juz: r.juz,
  hizb: r.hizb,
  rub: r.rub,
  sajda: r.sajda === 1,
  textQpc: r.text_qpc,
  textUthmani: r.text_uthmani,
  textSimple: r.text_simple,
});

const VERSE_COLS = 'id, surah, ayah, page, juz, hizb, rub, sajda, text_qpc, text_uthmani, text_simple';

export async function getVerse(id: number): Promise<Verse | null> {
  const db = await getContentDb();
  const r = await db.getFirstAsync<VerseRow>(`SELECT ${VERSE_COLS} FROM verses WHERE id = ?`, id);
  return r ? toVerse(r) : null;
}

export async function getVerseByKey(surah: number, ayah: number): Promise<Verse | null> {
  const db = await getContentDb();
  const r = await db.getFirstAsync<VerseRow>(
    `SELECT ${VERSE_COLS} FROM verses WHERE surah = ? AND ayah = ?`,
    surah,
    ayah,
  );
  return r ? toVerse(r) : null;
}

export async function getVerseRange(from: number, to: number): Promise<Verse[]> {
  const db = await getContentDb();
  const rows = await db.getAllAsync<VerseRow>(
    `SELECT ${VERSE_COLS} FROM verses WHERE id BETWEEN ? AND ? ORDER BY id`,
    from,
    to,
  );
  return rows.map(toVerse);
}

export async function getPageVerses(page: number): Promise<Verse[]> {
  const db = await getContentDb();
  const rows = await db.getAllAsync<VerseRow>(`SELECT ${VERSE_COLS} FROM verses WHERE page = ? ORDER BY id`, page);
  return rows.map(toVerse);
}

export async function getSurahVerses(surah: number): Promise<Verse[]> {
  const db = await getContentDb();
  const rows = await db.getAllAsync<VerseRow>(`SELECT ${VERSE_COLS} FROM verses WHERE surah = ? ORDER BY id`, surah);
  return rows.map(toVerse);
}

const pageCache = new Map<number, PageLine[]>();

export async function getPageLines(page: number): Promise<PageLine[]> {
  const cached = pageCache.get(page);
  if (cached) return cached;
  const db = await getContentDb();
  const rows = await db.getAllAsync<{ type: string; surah: number | null; words: string | null }>(
    'SELECT type, surah, words FROM page_lines WHERE page = ? ORDER BY line',
    page,
  );
  const lines = rows.map<PageLine>((r) =>
    r.type === 'ayah'
      ? { type: 'ayah', words: JSON.parse(r.words ?? '[]') as LayoutWord[] }
      : { type: r.type as 'surah' | 'basmala', surah: r.surah ?? 0 },
  );
  if (pageCache.size > 40) pageCache.delete(pageCache.keys().next().value as number);
  pageCache.set(page, lines);
  return lines;
}

export async function getMetaJson<T>(key: string): Promise<T> {
  const db = await getContentDb();
  const r = await db.getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key = ?', key);
  if (!r) throw new Error(`meta ${key} missing`);
  try {
    return JSON.parse(r.value) as T;
  } catch {
    return r.value as unknown as T;
  }
}

export type QuranHit = Verse & { surahName: string };

export async function searchQuran(query: string, limit = 200): Promise<QuranHit[]> {
  const q = normalizeArabic(query);
  if (q.length < 2) return [];
  const db = await getContentDb();
  const rows = await db.getAllAsync<VerseRow & { surah_name: string }>(
    `SELECT ${VERSE_COLS.split(', ').map((c) => `v.${c}`).join(', ')}, s.name AS surah_name
     FROM verses v JOIN surahs s ON s.id = v.surah
     WHERE v.text_search LIKE ? ESCAPE '\\' ORDER BY v.id LIMIT ?`,
    likePattern(q),
    limit,
  );
  return rows.map((r) => ({ ...toVerse(r), surahName: r.surah_name }));
}

/** Verse key «2:255» → numbers, or null when the input is not a key. */
export function parseVerseKey(input: string): { surah: number; ayah: number } | null {
  const m = input.trim().match(/^(\d{1,3})\s*[:：/]\s*(\d{1,3})$/);
  if (!m) return null;
  const surah = Number(m[1]);
  const ayah = Number(m[2]);
  return surah >= 1 && surah <= 114 && ayah >= 1 ? { surah, ayah } : null;
}

export type TafsirSource = { id: string; name: string; author: string; source: string };

export async function getBundledTafsirSources(): Promise<TafsirSource[]> {
  const db = await getContentDb();
  return db.getAllAsync<TafsirSource>('SELECT * FROM tafsir_sources');
}

/** Returns the commentary and, when it covers a group of verses, the verse that carries it. */
export async function getBundledTafsir(source: string, verseId: number): Promise<{ text: string; fromVerse: number } | null> {
  const db = await getContentDb();
  const r = await db.getFirstAsync<{ text: string | null; shared_with: number | null }>(
    'SELECT text, shared_with FROM tafsir WHERE source = ? AND verse_id = ?',
    source,
    verseId,
  );
  if (!r) return null;
  if (r.text) return { text: r.text, fromVerse: verseId };
  if (r.shared_with == null) return null;
  const shared = await db.getFirstAsync<{ text: string }>(
    'SELECT text FROM tafsir WHERE source = ? AND verse_id = ?',
    source,
    r.shared_with,
  );
  return shared ? { text: shared.text, fromVerse: r.shared_with } : null;
}

export async function getJuzStarts(): Promise<number[]> {
  return getMetaJson<number[]>('juz_starts');
}

export async function getHizbQuarterStarts(): Promise<number[]> {
  return getMetaJson<number[]>('hizb_quarter_starts');
}

// ---------- Asbab al-nuzul ----------

export type Asbab = { id: number; surah: number; fromAyah: number; toAyah: number; bookPage: number; text: string; footnotes: string[] };

/** Authentic reports on the occasion of revelation that cover a verse (al-Wadi'i). */
export async function getAsbab(verseId: number): Promise<Asbab[]> {
  const db = await getContentDb();
  const rows = await db.getAllAsync<{ id: number; surah: number; from_ayah: number; to_ayah: number; book_page: number; text: string; footnotes: string }>(
    'SELECT id, surah, from_ayah, to_ayah, book_page, text, footnotes FROM asbab WHERE from_id <= ? AND to_id >= ? ORDER BY id',
    verseId,
    verseId,
  );
  return rows.map((r) => ({ id: r.id, surah: r.surah, fromAyah: r.from_ayah, toAyah: r.to_ayah, bookPage: r.book_page, text: r.text, footnotes: JSON.parse(r.footnotes) as string[] }));
}

/** Verse ids (within a page range) that have an occasion of revelation, for markers. */
export async function getAsbabVerseIds(fromId: number, toId: number): Promise<Set<number>> {
  const db = await getContentDb();
  const rows = await db.getAllAsync<{ from_id: number; to_id: number }>('SELECT from_id, to_id FROM asbab WHERE to_id >= ? AND from_id <= ?', fromId, toId);
  const ids = new Set<number>();
  for (const r of rows) for (let i = Math.max(r.from_id, fromId); i <= Math.min(r.to_id, toId); i++) ids.add(i);
  return ids;
}

// ---------- Adhkar, duas ----------

export type DhikrItem = {
  key: string;
  kind: 'hisn' | 'morning-evening' | 'quran' | 'enc' | 'surah';
  text: string;
  isQuran: boolean;
  repeat: number;
  repeatLabel: string | null;
  fadl: string | null;
  reference: string;
  footnotes: string[];
  audio: string | null;
  by: string | null;
  grade: string | null;
  explanation: string | null;
  surahId: number | null;
  chapterTitle: string | null;
  /** Hisn al-Muslim chapter of the item, when it comes from the book. */
  chapterId?: number;
  /** Quran items: the Uthmani text in standard Unicode for system fonts (widgets). */
  textPlain?: string;
};

export type Source =
  | { morningEvening: 'morning' | 'evening' }
  | { hisnChapter: number }
  | { quran: string; from: number; to: number; by: string | null }
  | { hadeethencCategory: number }
  | { surahShortcut: number };

export type Category = { id: string; title: string; icon?: string; sources: Source[] };

export async function getAdhkarCategories(): Promise<Category[]> {
  const db = await getContentDb();
  const rows = await db.getAllAsync<{ id: string; title: string; icon: string; sources: string }>(
    'SELECT id, title, icon, sources FROM adhkar_categories ORDER BY ord',
  );
  return rows.map((r) => ({ id: r.id, title: r.title, icon: r.icon, sources: JSON.parse(r.sources) as Source[] }));
}

export async function getDuaCategories(): Promise<Category[]> {
  const db = await getContentDb();
  const rows = await db.getAllAsync<{ id: string; title: string; entries: string }>(
    'SELECT id, title, entries FROM dua_categories ORDER BY ord',
  );
  return rows.map((r) => ({ id: r.id, title: r.title, sources: JSON.parse(r.entries) as Source[] }));
}

function quranText(verses: Verse[]): string {
  return verses.map((v) => `${v.textQpc} ${toArabicDigits(v.ayah)}`).join(' ');
}

/** With harakat, without the mushaf's pause and annotation marks, which system fonts lack. */
export function quranPlainText(verses: Pick<Verse, 'ayah' | 'textUthmani'>[]): string {
  return verses.map((v) => `${v.textUthmani.replace(/[\u06D6-\u06ED]/g, '')} \uFD3F${toArabicDigits(v.ayah)}\uFD3E`).join(' ');
}

async function quranItem(src: { quran: string; from: number; to: number; by: string | null }): Promise<DhikrItem> {
  const verses = await getVerseRange(src.from, src.to);
  const surahs = await getSurahs();
  const s = surahs[verses[0].surah - 1];
  const range = verses.length > 1 ? `${verses[0].ayah}–${verses[verses.length - 1].ayah}` : `${verses[0].ayah}`;
  return {
    key: `quran:${src.quran}`,
    kind: 'quran',
    text: quranText(verses),
    textPlain: quranPlainText(verses),
    isQuran: true,
    repeat: 1,
    repeatLabel: null,
    fadl: null,
    reference: `سورة ${s.name}: ${range}`,
    footnotes: [],
    audio: null,
    by: src.by,
    grade: null,
    explanation: null,
    surahId: null,
    chapterTitle: null,
  };
}

type HisnRow = { n: number; chapter_id: number; text: string; footnotes: string; repeat: number; audio: string | null; title: string };

function hisnItem(r: HisnRow): DhikrItem {
  const footnotes = JSON.parse(r.footnotes) as string[];
  return {
    key: `hisn:${r.n}`,
    kind: 'hisn',
    text: r.text,
    isQuran: false,
    repeat: r.repeat || 1,
    repeatLabel: null,
    fadl: null,
    reference: footnotes[footnotes.length - 1] ?? '',
    footnotes,
    audio: r.audio,
    by: null,
    grade: null,
    explanation: null,
    surahId: null,
    chapterTitle: r.title,
    chapterId: r.chapter_id,
  };
}

export async function getHisnChapterItems(chapterId: number): Promise<DhikrItem[]> {
  const db = await getContentDb();
  const rows = await db.getAllAsync<HisnRow>(
    `SELECT i.*, c.title FROM hisn_items i JOIN hisn_chapters c ON c.id = i.chapter_id
     WHERE i.chapter_id = ? ORDER BY i.n`,
    chapterId,
  );
  return rows.map(hisnItem);
}

export async function getHisnChapters(): Promise<{ id: number; title: string; count: number }[]> {
  const db = await getContentDb();
  return db.getAllAsync(
    `SELECT c.id, c.title, COUNT(i.n) AS count FROM hisn_chapters c
     LEFT JOIN hisn_items i ON i.chapter_id = c.id GROUP BY c.id ORDER BY c.id`,
  );
}

export async function getHisnItem(n: number): Promise<DhikrItem | null> {
  const db = await getContentDb();
  const r = await db.getFirstAsync<HisnRow>(
    'SELECT i.*, c.title FROM hisn_items i JOIN hisn_chapters c ON c.id = i.chapter_id WHERE i.n = ?',
    n,
  );
  return r ? hisnItem(r) : null;
}

type MorningEveningRow = {
  id: number;
  text: string;
  count: number;
  count_label: string;
  fadl: string | null;
  source: string;
  audio: string | null;
};

export async function searchHisn(query: string, limit = 60): Promise<DhikrItem[]> {
  const q = normalizeArabic(query);
  if (q.length < 2) return [];
  const db = await getContentDb();
  const rows = await db.getAllAsync<HisnRow>(
    `SELECT i.n, i.chapter_id, i.text, i.footnotes, i.repeat, i.audio, c.title FROM hisn_items i
     JOIN hisn_chapters c ON c.id = i.chapter_id
     WHERE i.text_search LIKE ? ESCAPE '\\' OR c.title LIKE ? ESCAPE '\\' ORDER BY i.n LIMIT ?`,
    likePattern(q),
    likePattern(query.trim()),
    limit,
  );
  return rows.map(hisnItem);
}

async function morningEveningItems(which: 'morning' | 'evening'): Promise<DhikrItem[]> {
  const db = await getContentDb();
  const rows = await db.getAllAsync<MorningEveningRow>(
    'SELECT * FROM morning_evening WHERE when_flag IN (0, ?) ORDER BY id',
    which === 'morning' ? 1 : 2,
  );
  return rows.map(morningEveningItem);
}

function morningEveningItem(r: MorningEveningRow): DhikrItem {
  return {
    key: `me:${r.id}`,
    kind: 'morning-evening',
    text: r.text,
    isQuran: false,
    repeat: r.count || 1,
    repeatLabel: r.count_label,
    fadl: r.fadl,
    reference: r.source,
    footnotes: [],
    audio: r.audio,
    by: null,
    grade: null,
    explanation: null,
    surahId: null,
    chapterTitle: null,
  };
}

export type EncHadith = {
  id: number;
  title: string;
  text: string;
  attribution: string;
  grade: string;
  explanation: string;
  hints: string[];
  meanings: { word: string; meaning: string }[];
  reference: string;
};

type EncRow = {
  id: number;
  title: string;
  text: string;
  attribution: string;
  grade: string;
  explanation: string;
  hints: string;
  meanings: string;
  reference: string;
};

const toEnc = (r: EncRow): EncHadith => ({
  ...r,
  hints: JSON.parse(r.hints) as string[],
  meanings: JSON.parse(r.meanings) as { word: string; meaning: string }[],
});

function encItem(h: EncHadith): DhikrItem {
  return {
    key: `enc:${h.id}`,
    kind: 'enc',
    text: h.text,
    isQuran: false,
    repeat: 1,
    repeatLabel: null,
    fadl: null,
    reference: h.attribution,
    footnotes: [],
    audio: null,
    by: null,
    grade: h.grade,
    explanation: h.explanation,
    surahId: null,
    chapterTitle: null,
  };
}

export async function getEncByCategory(categoryId: number, limit = 500, offset = 0): Promise<EncHadith[]> {
  const db = await getContentDb();
  const rows = await db.getAllAsync<EncRow>(
    `SELECT h.id, h.title, h.text, h.attribution, h.grade, h.explanation, h.hints, h.meanings, h.reference
     FROM hadeethenc h JOIN hadeethenc_map m ON m.hadith_id = h.id
     WHERE m.category_id = ? ORDER BY h.id LIMIT ? OFFSET ?`,
    categoryId,
    limit,
    offset,
  );
  return rows.map(toEnc);
}

export async function resolveSources(sources: Source[]): Promise<DhikrItem[]> {
  const out: DhikrItem[] = [];
  for (const s of sources) {
    if ('morningEvening' in s) out.push(...(await morningEveningItems(s.morningEvening)));
    else if ('hisnChapter' in s) out.push(...(await getHisnChapterItems(s.hisnChapter)));
    else if ('quran' in s) out.push(await quranItem(s));
    else if ('hadeethencCategory' in s) out.push(...(await getEncByCategory(s.hadeethencCategory)).map(encItem));
    else if ('surahShortcut' in s) {
      const surah = (await getSurahs())[s.surahShortcut - 1];
      out.push({
        key: `surah:${surah.id}`,
        kind: 'surah',
        text: `سورة ${surah.name}`,
        isQuran: false,
        repeat: 1,
        repeatLabel: null,
        fadl: null,
        reference: `${surah.versesCount} آية — من صفحة ${surah.pageStart}`,
        footnotes: [],
        audio: null,
        by: null,
        grade: null,
        explanation: null,
        surahId: surah.id,
        chapterTitle: null,
      });
    }
  }
  return out;
}

/** Loads a single dhikr / dua by its stable key (used for favourites). */
export async function getDhikrByKey(key: string): Promise<DhikrItem | null> {
  const [kind, ...restParts] = key.split(':');
  const rest = restParts.join(':');
  if (kind === 'hisn') return getHisnItem(Number(rest));
  if (kind === 'enc') {
    const h = await getEncHadith(Number(rest));
    return h ? encItem(h) : null;
  }
  if (kind === 'me') {
    const db = await getContentDb();
    const r = await db.getFirstAsync<MorningEveningRow>('SELECT * FROM morning_evening WHERE id = ?', Number(rest));
    return r ? morningEveningItem(r) : null;
  }
  if (kind === 'surah') return (await resolveSources([{ surahShortcut: Number(rest) }]))[0] ?? null;
  if (kind === 'quran') {
    const m = /^(\d+):(\d+)(?:-(\d+))?$/.exec(rest);
    if (!m) return null;
    const from = await getVerseByKey(Number(m[1]), Number(m[2]));
    const to = m[3] ? await getVerseByKey(Number(m[1]), Number(m[3])) : from;
    if (!from || !to) return null;
    return quranItem({ quran: rest, from: from.id, to: to.id, by: null });
  }
  return null;
}

// ---------- HadeethEnc ----------

export type EncCategory = { id: number; title: string; parent: number | null; count: number };

export async function getEncCategories(parent: number | null): Promise<EncCategory[]> {
  const db = await getContentDb();
  return parent == null
    ? db.getAllAsync<EncCategory>('SELECT * FROM hadeethenc_categories WHERE parent IS NULL ORDER BY id')
    : db.getAllAsync<EncCategory>('SELECT * FROM hadeethenc_categories WHERE parent = ? ORDER BY id', parent);
}

export async function getEncCategory(id: number): Promise<EncCategory | null> {
  const db = await getContentDb();
  return db.getFirstAsync<EncCategory>('SELECT * FROM hadeethenc_categories WHERE id = ?', id);
}

export async function getEncHadith(id: number): Promise<EncHadith | null> {
  const db = await getContentDb();
  const r = await db.getFirstAsync<EncRow>(
    'SELECT id, title, text, attribution, grade, explanation, hints, meanings, reference FROM hadeethenc WHERE id = ?',
    id,
  );
  return r ? toEnc(r) : null;
}

export async function searchEnc(query: string, limit = 100): Promise<EncHadith[]> {
  const q = normalizeArabic(query);
  if (q.length < 2) return [];
  const db = await getContentDb();
  const rows = await db.getAllAsync<EncRow>(
    `SELECT id, title, text, attribution, grade, explanation, hints, meanings, reference FROM hadeethenc
     WHERE text_search LIKE ? ESCAPE '\\' ORDER BY id LIMIT ?`,
    likePattern(q),
    limit,
  );
  return rows.map(toEnc);
}

// ---------- Names of Allah ----------

export type NameOfAllah = { n: number; name: string; explanation: string; khattabiNumber: string };

export async function getNames(): Promise<NameOfAllah[]> {
  const db = await getContentDb();
  const rows = await db.getAllAsync<{ n: number; name: string; explanation: string; khattabi_number: string }>(
    'SELECT * FROM names ORDER BY n',
  );
  return rows.map((r) => ({ n: r.n, name: r.name, explanation: r.explanation, khattabiNumber: r.khattabi_number }));
}

// ---------- Cities ----------

export type City = {
  id: number;
  name: string;
  name_en: string;
  country: string;
  country_name: string;
  lat: number;
  lng: number;
  timezone: string;
};

export async function searchCities(query: string, limit = 40): Promise<City[]> {
  const db = await getContentDb();
  const q = query.trim();
  if (!q) {
    return db.getAllAsync<City>(
      `SELECT id, name, name_en, country, country_name, lat, lng, timezone FROM cities
       WHERE country IN ('SA','AE','KW','QA','BH','OM','EG','JO') ORDER BY country = 'SA' DESC, population DESC LIMIT ?`,
      limit,
    );
  }
  const pattern = likePattern(`${normalizeArabic(q)}`);
  const latin = likePattern(q.toLowerCase());
  return db.getAllAsync<City>(
    `SELECT id, name, name_en, country, country_name, lat, lng, timezone FROM cities
     WHERE search LIKE ? ESCAPE '\\' OR search LIKE ? ESCAPE '\\' ORDER BY population DESC LIMIT ?`,
    pattern,
    latin,
    limit,
  );
}

// ---------- Daily content ----------

/** Stable pseudo-random index for a date (FNV-1a), so everyone sees the same item on a day. */
export function dailyIndex(date: CivilDate, salt: string, size: number): number {
  let h = 0x811c9dc5;
  const s = `${civilKey(date)}:${salt}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % Math.max(1, size);
}

export async function getDailyAyah(date: CivilDate): Promise<DhikrItem> {
  const db = await getContentDb();
  const all = await db.getAllAsync<{ ref: string; from_id: number; to_id: number }>('SELECT ref, from_id, to_id FROM daily_ayat ORDER BY id');
  const pick = all[dailyIndex(date, 'ayah', all.length)];
  return quranItem({ quran: pick.ref, from: pick.from_id, to: pick.to_id, by: null });
}

export async function getDailyHadith(date: CivilDate): Promise<EncHadith> {
  const db = await getContentDb();
  // Hadiths from «الفضائل والآداب» (root category 5) and all its sub-categories.
  const ids = await db.getAllAsync<{ id: number }>(
    `WITH RECURSIVE tree(id) AS (SELECT 5 UNION ALL SELECT c.id FROM hadeethenc_categories c JOIN tree t ON c.parent = t.id)
     SELECT DISTINCT m.hadith_id AS id FROM hadeethenc_map m JOIN tree t ON t.id = m.category_id
     JOIN hadeethenc h ON h.id = m.hadith_id WHERE length(h.text) < 600 ORDER BY m.hadith_id`,
  );
  const pick = ids[dailyIndex(date, 'hadith', ids.length)];
  return (await getEncHadith(pick.id)) as EncHadith;
}

export async function getDailyDua(date: CivilDate): Promise<DhikrItem> {
  const cats = await getDuaCategories();
  const pool = cats
    .filter((c) => c.id === 'quran' || c.id === 'prophets')
    .flatMap((c) => c.sources)
    .filter((s): s is Extract<Source, { quran: string }> => 'quran' in s);
  const pick = pool[dailyIndex(date, 'dua', pool.length)];
  return quranItem(pick);
}

/** First mushaf page of each juz (index 0 = juz 1). */
let juzPagesCache: number[] | null = null;
export async function getJuzStartPages(): Promise<number[]> {
  if (juzPagesCache) return juzPagesCache;
  const db = await getContentDb();
  const rows = await db.getAllAsync<{ juz: number; page: number }>('SELECT juz, MIN(page) AS page FROM verses GROUP BY juz ORDER BY juz');
  juzPagesCache = rows.map((r) => r.page);
  return juzPagesCache;
}
