// Hadith collections from the open «hadith-api» dataset, pinned to one commit. The large
// books are downloaded by the app on demand; this module prepares everything the app
// needs to verify and import them (URL, SHA-256, size, Arabic book titles, Sahih Muslim's
// Abd al-Baqi numbering) and proves each file passes the same checks the app runs.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { failedReferenceChecks, processEdition } from '../../src/lib/hadith-import.ts';
import { DATA_DIR, assert, fetchBuffer, log, sha256 } from './lib.mjs';

export const HADITH_API =
  'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@df57907be35291c91ad6a6691180e22ca9920784';
// Fallback mirror of the same commit, used by the app when the CDN is unreachable.
export const HADITH_API_MIRROR =
  'https://raw.githubusercontent.com/fawazahmed0/hadith-api/df57907be35291c91ad6a6691180e22ca9920784';
const HADITH_JSON =
  'https://raw.githubusercontent.com/AhmedBaset/hadith-json/70b83d6d21995bb32f8d7271cd75501be5a922a7/db/by_book';

export const BOOKS = [
  { id: 'bukhari', name: 'صحيح البخاري', author: 'الإمام محمد بن إسماعيل البخاري (ت ٢٥٦هـ)', lastNumber: 7563, titles: 'the_9_books/bukhari' },
  { id: 'muslim', name: 'صحيح مسلم', author: 'الإمام مسلم بن الحجاج النيسابوري (ت ٢٦١هـ)', lastNumber: 7563, titles: 'the_9_books/muslim' },
  { id: 'abudawud', name: 'سنن أبي داود', author: 'أبو داود سليمان بن الأشعث السجستاني (ت ٢٧٥هـ)', lastNumber: 5274, titles: 'the_9_books/abudawud' },
  { id: 'tirmidhi', name: 'جامع الترمذي', author: 'أبو عيسى محمد بن عيسى الترمذي (ت ٢٧٩هـ)', lastNumber: 3956, titles: 'the_9_books/tirmidhi' },
  { id: 'nasai', name: 'سنن النسائي (المجتبى)', author: 'أحمد بن شعيب النسائي (ت ٣٠٣هـ)', lastNumber: 5758, titles: 'the_9_books/nasai' },
  { id: 'ibnmajah', name: 'سنن ابن ماجه', author: 'محمد بن يزيد ابن ماجه القزويني (ت ٢٧٣هـ)', lastNumber: 4341, titles: 'the_9_books/ibnmajah' },
  { id: 'malik', name: 'موطأ الإمام مالك', author: 'الإمام مالك بن أنس (ت ١٧٩هـ) — رواية يحيى الليثي', lastNumber: 1858, titles: 'the_9_books/malik' },
  { id: 'nawawi', name: 'الأربعون النووية', author: 'يحيى بن شرف النووي (ت ٦٧٦هـ)', lastNumber: 42, titles: null, bundled: true },
  { id: 'qudsi', name: 'أربعون حديثًا قدسيًا', author: 'أحاديث قدسية مجموعة من كتب السنة', lastNumber: 40, titles: null, bundled: true },
];

const SINGLE_SECTION_TITLES = { nawawi: 'الأربعون النووية', qudsi: 'الأحاديث القدسية' };

function similarity(a, b) {
  const x = a.toLowerCase().replace(/[^a-z ]/g, '').split(/\s+/).filter(Boolean);
  const y = new Set(b.toLowerCase().replace(/[^a-z ]/g, '').split(/\s+/).filter(Boolean));
  const hits = x.filter((w) => y.has(w)).length;
  return hits / Math.max(1, Math.max(x.length, y.size));
}

const json = async (url) => JSON.parse((await fetchBuffer(url)).toString('utf8'));

/** Fetches, verifies and describes every book. Writes data/hadith/{books,muslim-numbers}.json. */
export async function prepareHadithBooks() {
  const info = await json(`${HADITH_API}/info.min.json`);
  const en = await json(`${HADITH_API}/editions/eng-muslim.min.json`);
  const muslimNumbers = Object.fromEntries(
    en.hadiths.map((h) => [String(h.hadithnumber), h.arabicnumber ? Number(h.arabicnumber) : null]),
  );
  const described = [];
  for (const meta of BOOKS) {
    const url = `${HADITH_API}/editions/ara-${meta.id}.min.json`;
    const buf = await fetchBuffer(url);
    const raw = JSON.parse(buf.toString('utf8'));
    const { rows, skippedEmpty } = processEdition(raw, meta.id === 'muslim' ? muslimNumbers : undefined);

    const present = new Set(raw.hadiths.map((h) => Math.floor(h.hadithnumber)));
    for (let n = 1; n <= meta.lastNumber; n++) assert(present.has(n), `${meta.id}: number ${n} missing`);
    assert(Math.floor(Math.max(...rows.map((r) => r.n))) === meta.lastNumber, `${meta.id}: last number`);
    assert(skippedEmpty / raw.hadiths.length < 0.03, `${meta.id}: too many empty entries`);
    const failures = failedReferenceChecks(meta.id, rows);
    assert(failures.length === 0, failures.join('; '));

    let arabicTitles = [];
    if (meta.titles) arabicTitles = (await json(`${HADITH_JSON}/${meta.titles}.json`)).chapters;
    const names = info[meta.id].metadata.sections;
    const details = info[meta.id].metadata.section_details;
    const counts = new Map();
    for (const r of rows) counts.set(r.section, (counts.get(r.section) ?? 0) + 1);
    const sections = Object.keys(names)
      .map(Number)
      .filter((id) => counts.get(id))
      .map((id) => {
        const titleEn = names[id] || '';
        let best = null;
        for (const t of arabicTitles) {
          const score = similarity(titleEn, t.english);
          if (!best || score > best.score) best = { score, title: t.arabic };
        }
        const title =
          SINGLE_SECTION_TITLES[meta.id] ??
          (best && best.score >= 0.6 ? best.title : id === 0 ? 'المقدمة' : titleEn);
        return { id, title, titleEn, first: details[id]?.hadithnumber_first ?? 0, count: counts.get(id) };
      });
    described.push({
      id: meta.id,
      name: meta.name,
      author: meta.author,
      bundled: Boolean(meta.bundled),
      url,
      mirror: url.replace(HADITH_API, HADITH_API_MIRROR),
      sha256: sha256(buf),
      bytes: buf.length,
      count: rows.length,
      lastNumber: meta.lastNumber,
      sections,
    });
    if (meta.bundled) {
      mkdirSync(join(DATA_DIR, 'hadith/bundled'), { recursive: true });
      writeFileSync(join(DATA_DIR, `hadith/bundled/${meta.id}.json`), buf);
    }
    log(meta.id, 'hadiths', rows.length, 'merged numbers', skippedEmpty, 'sections', sections.length, 'checks ok');
  }
  writeFileSync(
    join(DATA_DIR, 'hadith/books.json'),
    JSON.stringify({ source: 'https://github.com/fawazahmed0/hadith-api', commit: 'df57907be35291c91ad6a6691180e22ca9920784', books: described }, null, 1),
  );
  writeFileSync(join(DATA_DIR, 'hadith/muslim-numbers.json'), JSON.stringify(muslimNumbers));
  return described;
}

/** Re-downloads (or reads cache) and checks hashes against the committed books.json. */
export async function verifyHadithBooks() {
  const file = join(DATA_DIR, 'hadith/books.json');
  assert(existsSync(file), 'run npm run data:fetch first');
  const { books } = JSON.parse(readFileSync(file, 'utf8'));
  for (const b of books) {
    const buf = await fetchBuffer(b.url);
    assert(sha256(buf) === b.sha256, `${b.id}: checksum changed`);
  }
  return books.length;
}

