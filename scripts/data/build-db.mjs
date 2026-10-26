// Builds the SQLite database shipped inside the app (assets/db/content.db): Quran text and
// page layout, tafsir, adhkar, duas, names, HadeethEnc and cities. The large hadith books
// are downloaded and verified by the app itself (see scripts/data/hadith-books.mjs).
// Every reference (verse ranges, Hisn chapters, HadeethEnc categories) is resolved and
// checked here; the build fails instead of shipping a broken or mismatched reference.
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { normalizeArabic } from '../../src/lib/arabic.ts';
import { ROOT, assert, log, readJson, sha256 } from './lib.mjs';

const OUT = join(ROOT, 'assets/db');

function openFresh(name) {
  mkdirSync(OUT, { recursive: true });
  const file = join(OUT, name);
  if (existsSync(file)) rmSync(file);
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF; PRAGMA page_size = 4096;');
  return { db, file };
}

function insertMany(db, sql, rows) {
  const stmt = db.prepare(sql);
  db.exec('BEGIN');
  for (const r of rows) stmt.run(...r);
  db.exec('COMMIT');
}

/** Parses «2:285-286» into verse indexes using the surah/ayah → index map. */
function resolveRange(ref, verseIndex) {
  const [s, range] = ref.split(':');
  const [from, to = from] = range.split('-').map(Number);
  const ids = [];
  for (let a = from; a <= to; a++) {
    const id = verseIndex.get(`${s}:${a}`);
    assert(id !== undefined, `verse ${s}:${a} does not exist`);
    ids.push(id);
  }
  return ids;
}

function buildContent() {
  const { db, file } = openFresh('content.db');
  db.exec(`
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE surahs (id INTEGER PRIMARY KEY, name TEXT, name_simple TEXT, name_en TEXT, revelation TEXT,
      revelation_order INTEGER, verses_count INTEGER, page_start INTEGER, page_end INTEGER, bismillah_pre INTEGER);
    CREATE TABLE verses (id INTEGER PRIMARY KEY, surah INTEGER, ayah INTEGER, page INTEGER, juz INTEGER,
      hizb INTEGER, rub INTEGER, sajda INTEGER, text_qpc TEXT, text_uthmani TEXT, text_simple TEXT, text_search TEXT);
    CREATE INDEX verses_surah ON verses(surah, ayah);
    CREATE INDEX verses_page ON verses(page);
    CREATE TABLE page_lines (page INTEGER, line INTEGER, type TEXT, surah INTEGER, words TEXT, PRIMARY KEY (page, line));
    CREATE TABLE tafsir_sources (id TEXT PRIMARY KEY, name TEXT, author TEXT, source TEXT);
    CREATE TABLE tafsir (source TEXT, verse_id INTEGER, text TEXT, shared_with INTEGER, PRIMARY KEY (source, verse_id));
    CREATE TABLE hisn_chapters (id INTEGER PRIMARY KEY, title TEXT);
    CREATE TABLE hisn_items (n INTEGER PRIMARY KEY, chapter_id INTEGER, text TEXT, footnotes TEXT, repeat INTEGER, audio TEXT, text_search TEXT);
    CREATE INDEX hisn_items_chapter ON hisn_items(chapter_id);
    CREATE TABLE morning_evening (id INTEGER PRIMARY KEY, text TEXT, count INTEGER, count_label TEXT, fadl TEXT,
      source TEXT, when_flag INTEGER, audio TEXT);
    CREATE TABLE adhkar_categories (id TEXT PRIMARY KEY, ord INTEGER, title TEXT, icon TEXT, sources TEXT);
    CREATE TABLE dua_categories (id TEXT PRIMARY KEY, ord INTEGER, title TEXT, entries TEXT);
    CREATE TABLE daily_ayat (id INTEGER PRIMARY KEY, ref TEXT, from_id INTEGER, to_id INTEGER);
    CREATE TABLE asbab (id INTEGER PRIMARY KEY, surah INTEGER, from_ayah INTEGER, to_ayah INTEGER, from_id INTEGER,
      to_id INTEGER, book_page INTEGER, text TEXT, footnotes TEXT);
    CREATE INDEX asbab_range ON asbab(from_id, to_id);
    CREATE TABLE names (n INTEGER PRIMARY KEY, name TEXT, explanation TEXT, khattabi_number TEXT);
    CREATE TABLE hadeethenc (id INTEGER PRIMARY KEY, title TEXT, text TEXT, attribution TEXT, grade TEXT,
      explanation TEXT, hints TEXT, meanings TEXT, reference TEXT, text_search TEXT);
    CREATE TABLE hadeethenc_categories (id INTEGER PRIMARY KEY, title TEXT, parent INTEGER, count INTEGER);
    CREATE TABLE hadeethenc_map (hadith_id INTEGER, category_id INTEGER, PRIMARY KEY (category_id, hadith_id));
    CREATE TABLE cities (id INTEGER PRIMARY KEY, name TEXT, name_en TEXT, country TEXT, country_name TEXT,
      lat REAL, lng REAL, timezone TEXT, population INTEGER, search TEXT);
  `);

  // Quran
  const surahs = readJson('quran/surahs.json');
  const verses = readJson('quran/verses.json');
  const layout = readJson('quran/layout.json');
  const quranMeta = readJson('quran/meta.json');
  insertMany(
    db,
    'INSERT INTO surahs VALUES (?,?,?,?,?,?,?,?,?,?)',
    surahs.map((s) => [s.id, s.name, s.nameSimple, s.nameEn, s.revelation, s.revelationOrder, s.versesCount, s.pages[0], s.pages[1], s.bismillahPre ? 1 : 0]),
  );
  insertMany(
    db,
    'INSERT INTO verses VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    verses.map((v, i) => [i, v.s, v.a, v.p, v.j, v.h, v.r, v.sj, v.qpc, v.uth, v.simple, normalizeArabic(v.simple)]),
  );
  const lineRows = [];
  layout.forEach((lines, pi) =>
    lines.forEach((l, li) => lineRows.push([pi + 1, li + 1, l.t, l.s ?? null, l.w ? JSON.stringify(l.w) : null])),
  );
  insertMany(db, 'INSERT INTO page_lines VALUES (?,?,?,?,?)', lineRows);
  const verseIndex = new Map(verses.map((v, i) => [`${v.s}:${v.a}`, i]));
  const verseSearch = verses.map((v) => normalizeArabic(v.simple));

  // Tafsir
  for (const slug of ['muyassar', 'saadi']) {
    const t = readJson(`tafsir/${slug}.json`);
    db.prepare('INSERT INTO tafsir_sources VALUES (?,?,?,?)').run(slug, t.name, t.author, t.source);
    insertMany(
      db,
      'INSERT INTO tafsir VALUES (?,?,?,?)',
      t.entries.map((text, i) =>
        text.startsWith('@') ? [slug, i, null, verseIndex.get(text.slice(1))] : [slug, i, text, null],
      ),
    );
  }

  // Adhkar
  const hisn = readJson('adhkar/hisn.json');
  insertMany(db, 'INSERT INTO hisn_chapters VALUES (?,?)', hisn.chapters.map((c) => [c.id, c.title]));
  insertMany(
    db,
    'INSERT INTO hisn_items VALUES (?,?,?,?,?,?,?)',
    hisn.chapters.flatMap((c) =>
      c.items.map((it) => [it.n, c.id, it.text, JSON.stringify(it.footnotes), it.repeat ?? 1, it.audio ?? null, normalizeArabic(it.text)]),
    ),
  );
  const chapterIds = new Set(hisn.chapters.map((c) => c.id));
  const me = readJson('adhkar/morning-evening.json');
  insertMany(
    db,
    'INSERT INTO morning_evening VALUES (?,?,?,?,?,?,?,?)',
    me.items.map((m) => [m.order, m.text, m.count, m.countLabel, m.fadl, m.source, m.when, m.audio]),
  );

  // HadeethEnc
  const he = readJson('hadith/hadeethenc.json');
  const heCount = new Map();
  for (const h of he.hadiths) for (const c of h.categories) heCount.set(c, (heCount.get(c) ?? 0) + 1);
  insertMany(
    db,
    'INSERT INTO hadeethenc_categories VALUES (?,?,?,?)',
    he.categories.map((c) => [c.id, c.title, c.parent, heCount.get(c.id) ?? 0]),
  );
  insertMany(
    db,
    'INSERT INTO hadeethenc VALUES (?,?,?,?,?,?,?,?,?,?)',
    he.hadiths.map((h) => [h.id, h.title, h.text, h.attribution, h.grade, h.explanation, JSON.stringify(h.hints), JSON.stringify(h.meanings), h.reference, normalizeArabic(h.text)]),
  );
  insertMany(
    db,
    'INSERT OR IGNORE INTO hadeethenc_map VALUES (?,?)',
    he.hadiths.flatMap((h) => h.categories.map((c) => [h.id, c])),
  );

  // Section references (adhkar categories and duas) — resolve and verify every source.
  const checkSource = (src, where) => {
    if (src.quran) {
      const ids = resolveRange(src.quran, verseIndex);
      const text = ids.map((id) => verseSearch[id]).join(' ');
      assert(text.includes(normalizeArabic(src.check)), `${where}: ${src.quran} does not contain «${src.check}»`);
      return { quran: src.quran, from: ids[0], to: ids[ids.length - 1], by: src.by ?? null };
    }
    if (src.hisnChapter) {
      assert(chapterIds.has(src.hisnChapter), `${where}: Hisn chapter ${src.hisnChapter} missing`);
      return src;
    }
    if (src.hadeethencCategory) {
      assert((heCount.get(src.hadeethencCategory) ?? 0) > 0, `${where}: HadeethEnc category ${src.hadeethencCategory} empty`);
      return src;
    }
    if (src.morningEvening || src.surahShortcut) return src;
    throw new Error(`${where}: unknown source ${JSON.stringify(src)}`);
  };
  const adhkarCats = readJson('adhkar/categories.json').categories;
  insertMany(
    db,
    'INSERT INTO adhkar_categories VALUES (?,?,?,?,?)',
    adhkarCats.map((c, i) => [c.id, i, c.title, c.icon, JSON.stringify(c.sources.map((s) => checkSource(s, c.id)))]),
  );
  const duaCats = readJson('duas/catalog.json').categories;
  insertMany(
    db,
    'INSERT INTO dua_categories VALUES (?,?,?,?)',
    duaCats.map((c, i) => [c.id, i, c.title, JSON.stringify(c.entries.map((s) => checkSource(s, c.id)))]),
  );
  const dailyAyat = readJson('daily/ayat.json').ayat;
  insertMany(
    db,
    'INSERT INTO daily_ayat VALUES (?,?,?,?)',
    dailyAyat.map((a, i) => {
      const r = checkSource(a, `daily ${a.quran}`);
      return [i, r.quran, r.from, r.to];
    }),
  );
  log('adhkar categories', adhkarCats.length, 'dua categories', duaCats.length, 'daily ayat', dailyAyat.length, '— all references verified');

  // Asbab al-nuzul (al-Wadi'i), tied to verse ids
  const asbab = readJson('quran/asbab.json');
  insertMany(
    db,
    'INSERT INTO asbab VALUES (?,?,?,?,?,?,?,?,?)',
    asbab.entries.map((e, i) => {
      const from = verseIndex.get(`${e.surah}:${e.from}`);
      const to = verseIndex.get(`${e.surah}:${e.to}`);
      assert(from !== undefined && to !== undefined && to >= from, `asbab entry ${i}: bad range ${e.surah}:${e.from}-${e.to}`);
      return [i, e.surah, e.from, e.to, from, to, e.page, e.text, JSON.stringify(e.footnotes)];
    }),
  );
  log('asbab al-nuzul', asbab.entries.length);

  // Names of Allah
  const names = readJson('names/asma-ul-husna.json');
  insertMany(
    db,
    'INSERT INTO names VALUES (?,?,?,?)',
    names.names.map((n) => [n.n, n.name, n.explanation, n.khattabiNumber]),
  );

  // Cities
  const cities = readJson('cities/cities.json');
  insertMany(
    db,
    'INSERT INTO cities VALUES (?,?,?,?,?,?,?,?,?,?)',
    cities.cities.map((c) => [c.id, c.name, c.nameEn, c.country, c.countryName, c.lat, c.lng, c.timezone, c.population, `${normalizeArabic(c.name)} ${c.nameEn.toLowerCase()} ${normalizeArabic(c.countryName)}`]),
  );

  const metaRows = [
    ['quran_source', quranMeta.source],
    ['quran_cross_check', quranMeta.crossCheck],
    ['juz_starts', JSON.stringify(quranMeta.juzStarts)],
    ['hizb_quarter_starts', JSON.stringify(quranMeta.hizbQuarterStarts)],
    ['hisn', JSON.stringify({ title: hisn.title, author: hisn.author, edition: hisn.edition, source: hisn.source, audioSource: hisn.audioSource })],
    ['morning_evening_source', me.source],
    ['hadeethenc', JSON.stringify({ source: he.source, license: he.license })],
    ['names', JSON.stringify({ listSource: names.listSource, explanationSource: names.explanationSource })],
    ['cities_source', cities.source],
    ['asbab', JSON.stringify(asbab.source)],
  ];
  insertMany(db, 'INSERT INTO meta VALUES (?,?)', metaRows);
  db.exec('VACUUM');
  db.close();
  return file;
}

function main() {
  const files = [buildContent()];
  const manifest = {};
  for (const f of files) {
    const { size } = statSync(f);
    const name = f.split('/').pop();
    // The app re-imports the database whenever its content fingerprint changes.
    manifest[name] = { size, version: sha256(readFileSync(f)).slice(0, 12) };
    log(name, (size / 1e6).toFixed(1), 'MB');
  }
  writeFileSync(
    join(ROOT, 'src/data/db-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}

main();
