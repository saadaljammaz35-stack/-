// Builds «أسباب النزول» from «الصحيح المسند من أسباب النزول» by Muqbil ibn Hadi al-Wadi'i
// (d. 1422H), which collects only reports the author judged authentic, each with its isnad and
// the author's grading notes. Entries are reproduced verbatim; each one is tied to its verses by
// locating the quoted Quran text in the mushaf, so no verse reference is entered by hand.
import { fromArabicDigits, normalizeArabic } from '../../src/lib/arabic.ts';
import { assert, fetchJson, log, readJson, writeJson } from './lib.mjs';

const BOOK_ID = 11547;
const BOOK_URL = `https://files.turath.io/books-v3/${BOOK_ID}.json`;
const FOOTNOTE_SPLIT = /\n_{5,}\n/;

// The book's surah headings that differ from the mushaf names.
const SURAH_ALIASES = { ابراهيم: 'إبراهيم', اللهب: 'المسد' };

const words = (s) => normalizeArabic(s).split(/\s+/).filter(Boolean);

// Quotes in the book sometimes drop a leading و/ف or spell «أولو» as «أولوا».
const bare = (w) => w.replace(/^[وف](?=..)/, '').replace(/وا$/, 'و');
const same = (a, b) => a === b || bare(a) === bare(b);

function surahIndex(surahs) {
  const map = new Map(surahs.map((s) => [normalizeArabic(s.name), s.id]));
  return (heading) => {
    const name = heading.replace(/^سورة\s+/, '').trim();
    return map.get(normalizeArabic(SURAH_ALIASES[name] ?? name));
  };
}

/** Normalised words of a surah with the verse each word belongs to. */
function surahWords(verses, surah) {
  const out = [];
  for (const v of verses.filter((x) => x.s === surah)) for (const w of words(v.simple)) out.push({ w, a: v.a });
  return out;
}

/** Finds where a quoted passage starts (and ends) in a surah; null when it is not found. */
function locate(list, quote, near) {
  const q = words(quote).filter((w) => w !== 'الاية');
  if (q.length < 2) return null;
  const probe = q.slice(0, Math.min(5, q.length));
  const hits = [];
  for (let i = 0; i + probe.length <= list.length; i++) {
    if (probe.every((w, k) => same(list[i + k].w, w))) hits.push(i);
  }
  if (!hits.length) return null;
  const start = near ? hits.reduce((best, i) => (Math.abs(list[i].a - near) < Math.abs(list[best].a - near) ? i : best), hits[0]) : hits[0];
  // Follow the quote as far as it keeps matching the mushaf.
  let end = start;
  for (let k = 0; k < q.length && start + k < list.length && same(list[start + k].w, q[k]); k++) end = start + k;
  return { from: list[start].a, to: list[end].a };
}

function parseNumbers(tail) {
  const m = /^\s*[–-]?\s*الآي(?:ة|تان|ات)\s*((?:[٠-٩0-9]+\s*(?:[-–،,]|و|إلى)?\s*)+)/.exec(tail);
  if (!m) return [];
  return [...m[1].matchAll(/[٠-٩0-9]+/g)].map((x) => Number(fromArabicDigits(x[0])));
}

function cleanText(s) {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/^"|":$/gm, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function main() {
  const book = await fetchJson(BOOK_URL);
  const surahs = readJson('quran/surahs.json');
  const verses = readJson('quran/verses.json');
  const surahOf = surahIndex(surahs);

  // Body pages: from the first surah heading up to «أهم المراجع».
  const pages = book.pages;
  const first = pages.findIndex((p) => p.text.includes('>سورة البقرة<'));
  const last = pages.findIndex((p) => p.text.includes('أهم المراجع التي نقلت منها'));
  assert(first > 0 && last > first, 'asbab: body pages not found');

  // Split each page into body and footnotes, then cut the body into entries.
  const entries = [];
  let surah = null;
  let current = null;
  const pageNotes = [];
  for (let i = first; i < last; i++) {
    const [body, notes = ''] = pages[i].text.split(FOOTNOTE_SPLIT);
    const onPage = [];
    const pageText = new Map();
    for (const line of body.split('\n')) {
      const heading = /data-type="title"[^>]*>(سورة [^<]+)</.exec(line);
      if (heading) {
        surah = surahOf(heading[1]);
        assert(surah, `asbab: unknown surah heading «${heading[1]}»`);
        // Some surahs open directly with the narration instead of «قوله تعالى».
        current = { surah, page: pages[i].page, lines: [], notes: [], implicit: true };
        entries.push(current);
        continue;
      }
      if (/^قوله تعالى\s*:?\s*$/.test(line.trim()) || /^قوله تعالى\s*:/.test(line.trim())) {
        current = { surah, page: pages[i].page, lines: [line], notes: [] };
        entries.push(current);
      } else if (current) {
        current.lines.push(line);
      }
      if (current && !onPage.includes(current)) onPage.push(current);
      if (current) pageText.set(current, `${pageText.get(current) ?? ''}\n${line}`);
    }
    if (notes.trim()) pageNotes.push({ notes: notes.trim().split('\n'), onPage, pageText });
  }

  // Footnotes go to the entry on the same page whose text carries the marker.
  for (const { notes, onPage, pageText } of pageNotes) {
    for (const note of notes) {
      const n = /^([٠-٩]+)\s/.exec(note)?.[1];
      // Markers are digits written straight after a word on the same page, e.g. «سعيد١»
      // (volume/page references such as «ج١» are not markers).
      const marker = n ? new RegExp(`[\u0621-\u064A]{2}${n}(?![٠-٩])`) : null;
      const target = (marker && [...onPage].reverse().find((e) => marker.test(pageText.get(e) ?? ''))) ?? onPage[onPage.length - 1];
      if (target) target.notes.push(note.trim());
    }
  }

  const out = [];
  const unmatched = [];
  const cache = new Map();
  for (const e of entries) {
    const text = cleanText(e.lines.join('\n'));
    if (!text) continue;
    const quotes = [...text.matchAll(/﴿([^﴾]+)﴾/g)];
    // Text between a heading and the first «قوله تعالى» that quotes nothing is page furniture.
    if (!quotes.length && e.implicit) continue;
    assert(quotes.length, `asbab: entry without a quoted verse: ${text.slice(0, 80)}`);
    if (!cache.has(e.surah)) cache.set(e.surah, surahWords(verses, e.surah));
    const list = cache.get(e.surah);
    // The first quote that belongs to this surah (a report may cite other verses first).
    let quote = null;
    let numbers = [];
    let found = null;
    for (const q of quotes) {
      const nums = parseNumbers(text.slice(q.index + q[0].length));
      const hit = locate(list, q[1], nums[0]);
      if (hit) {
        quote = q;
        numbers = nums;
        found = hit;
        break;
      }
    }
    if (!found || !quote) {
      unmatched.push(`${e.surah}: ${quotes[0][1].slice(0, 60)}`);
      continue;
    }
    const after = text.slice(quote.index + quote[0].length);
    let to = Math.max(found.to, ...numbers.filter((n) => n >= found.from && n - found.from < 15));
    // «… إلى قوله ﴿…﴾» extends the range to the closing quote.
    const until = /إلى قوله[^﴿\n]{0,6}﴿([^﴾]+)﴾/.exec(after.slice(0, 200));
    if (until) {
      const end = locate(list.filter((x) => x.a >= found.from), until[1]);
      if (end && end.to - found.from < 30) to = Math.max(to, end.to);
    }
    if (numbers.length && !numbers.includes(found.from) && !(numbers[0] <= found.from && found.from <= Math.max(...numbers))) {
      log(`asbab: book says ${numbers.join(',')} but the quote is ${e.surah}:${found.from} — using the mushaf position`);
    }
    out.push({ surah: e.surah, from: found.from, to, page: e.page, text, footnotes: e.notes });
  }

  assert(unmatched.length <= 3, `asbab: ${unmatched.length} quotes not found in the mushaf:\n${unmatched.join('\n')}`);
  for (const u of unmatched) log(`asbab: skipped (quote not found): ${u}`);
  assert(out.length >= 170, `asbab: only ${out.length} entries parsed`);

  const info = book['ً'] ?? '';
  writeJson('quran/asbab.json', {
    source: {
      title: 'الصحيح المسند من أسباب النزول',
      author: 'مقبل بن هادي الوادعي (ت ١٤٢٢هـ)',
      edition: 'مكتبة ابن تيمية، القاهرة — الطبعة الرابعة ١٤٠٨هـ',
      url: `https://app.turath.io/book/${BOOK_ID}`,
      note: 'جمع فيه المؤلف ما صح عنده من أسباب النزول بأسانيدها مع كلامه عليها.',
      checked: typeof info === 'string' && info.includes('الصحيح المسند من أسباب النزول'),
    },
    entries: out,
  });
  log(`asbab: ${out.length} entries covering ${new Set(out.map((x) => x.surah)).size} surahs`);
}

main();
