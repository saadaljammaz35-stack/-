// Fetches the bundled (offline) tafsirs from the Quran.com API: al-Muyassar (King Fahd
// Complex) and al-Sa'di. Other tafsirs are loaded on demand inside the app.
import { assert, fetchJson, log, mapLimit, readJson, writeJson } from './lib.mjs';

const API = 'https://api.quran.com/api/v4';
export const BUNDLED_TAFSIRS = [
  { id: 16, slug: 'muyassar', name: 'التفسير الميسر', author: 'نخبة من العلماء — مجمع الملك فهد' },
  { id: 91, slug: 'saadi', name: 'تيسير الكريم الرحمن (تفسير السعدي)', author: 'عبد الرحمن بن ناصر السعدي' },
];

/** Converts the API's light HTML into plain text with paragraph breaks. */
export function cleanTafsirHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h\d)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

async function fetchChapterTafsir(tafsirId, chapter) {
  const items = [];
  let page = 1;
  for (;;) {
    const body = await fetchJson(
      `${API}/tafsirs/${tafsirId}/by_chapter/${chapter}?per_page=50&page=${page}`,
    );
    items.push(...body.tafsirs);
    if (!body.pagination.next_page) break;
    page = body.pagination.next_page;
  }
  return items;
}

async function main() {
  const verses = readJson('quran/verses.json');
  const keys = verses.map((v) => `${v.s}:${v.a}`);
  for (const t of BUNDLED_TAFSIRS) {
    const chapters = Array.from({ length: 114 }, (_, i) => i + 1);
    const perChapter = await mapLimit(chapters, 4, (c) => fetchChapterTafsir(t.id, c));
    const byKey = new Map();
    for (const items of perChapter) {
      for (const it of items) byKey.set(it.verse_key, cleanTafsirHtml(it.text ?? ''));
    }
    // Some tafsirs comment on a group of verses once; the API then returns an empty text
    // for the following verses of the group. Record which verse carries the commentary.
    const entries = [];
    let lastWithText = null;
    let empty = 0;
    for (const key of keys) {
      const text = byKey.get(key) ?? '';
      if (text) {
        entries.push(text);
        lastWithText = key;
      } else {
        empty++;
        entries.push(lastWithText ? `@${lastWithText}` : '');
      }
    }
    assert(entries.length === 6236, `${t.slug}: wrong verse count`);
    assert(empty < 1500, `${t.slug}: too many verses without commentary (${empty})`);
    const r = writeJson(`tafsir/${t.slug}.json`, { ...t, source: `Quran.com API tafsir ${t.id}`, entries });
    log(t.slug, 'verses with own text:', 6236 - empty, 'bytes:', r.bytes);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
