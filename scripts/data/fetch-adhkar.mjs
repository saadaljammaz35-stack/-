// Builds the adhkar library from the book «حصن المسلم من أذكار الكتاب والسنة»
// (Sa'id al-Qahtani, Riyadh print, via turath.io/Shamela) including every footnote with
// its takhrij, merged with the official hisnmuslim.com API for repeat counts and audio,
// plus the referenced morning/evening dataset (Seen-Arabic) that splits the two lists.
import { normalizeArabic, fromArabicDigits } from '../../src/lib/arabic.ts';
import { assert, fetchJson, log, mapLimit, writeJson } from './lib.mjs';

const BOOK_URL = 'https://files.turath.io/books-v3/31307.json';
const HISN_API = 'https://www.hisnmuslim.com/api/ar';
const MORNING_EVENING =
  'https://raw.githubusercontent.com/Seen-Arabic/Morning-And-Evening-Adhkar-DB/main/result/ar.json';

const AR_DIGITS = '[٠-٩]+';
const num = (s) => Number(fromArabicDigits(s));

function parseFootnotes(block) {
  const notes = new Map();
  let current = null;
  for (const raw of block.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(new RegExp(`^\\((${AR_DIGITS})\\)\\s*(.*)$`));
    if (m) {
      current = num(m[1]);
      notes.set(current, m[2]);
    } else if (current !== null) {
      notes.set(current, `${notes.get(current)} ${line}`);
    }
  }
  return notes;
}

/** Flattens the book into a stream of chapter / item / text events with resolved footnotes. */
function tokenizeBook(book) {
  const events = [];
  for (const page of book.pages) {
    const [body, notesBlock = ''] = page.text.split(/\n_{5,}\n/);
    const notes = parseFootnotes(notesBlock);
    let text = body
      .replace(/<span data-type="title"[^>]*>([^<]*)<\/span>[؟?]?/g, (_, t) => `\n\u0001CH ${t.trim()}\n`)
      .replace(/<[^>]+>/g, '');
    // One chapter title (١٢١) is printed as a plain line: a numbered line with no quoted
    // text or footnote, directly followed by a numbered item, is a heading.
    text = text.replace(
      new RegExp(`(^|\\n)(${AR_DIGITS} - [^«﴿()\\n]+)\\n(?=${AR_DIGITS} - )`, 'g'),
      (_, pre, title) => `${pre}\n\u0001CH ${title.trim()}\n`,
    );
    // «٣٣ - (١) «...»»: the global item number, then its index inside the chapter.
    text = text.replace(
      new RegExp(`(^|\\n)(${AR_DIGITS}) - (?:\\((${AR_DIGITS})\\) )?`, 'g'),
      (_, pre, n) => `${pre}\u0001IT ${num(n)}\n`,
    );
    text = text.replace(new RegExp(`\\((${AR_DIGITS})\\)`, 'g'), (whole, n) => {
      const note = notes.get(num(n));
      return note ? `\u0002${note}\u0003` : whole;
    });
    for (const part of text.split('\u0001')) {
      if (!part) continue;
      if (part.startsWith('CH ')) {
        const title = part.slice(3).split('\n')[0];
        events.push({ type: 'chapter', title });
        const rest = part.slice(3 + title.length);
        if (rest.trim()) events.push({ type: 'text', text: rest });
      } else if (part.startsWith('IT ')) {
        const n = Number(part.slice(3).split('\n')[0]);
        events.push({ type: 'item', n });
        events.push({ type: 'text', text: part.slice(part.indexOf('\n') + 1) });
      } else {
        events.push({ type: 'text', text: part });
      }
    }
    // Page breaks fall between words.
    events.push({ type: 'text', text: '\n' });
  }
  return events;
}

function buildChapters(events) {
  const chapters = [];
  let chapter = null;
  let item = null;
  for (const e of events) {
    if (e.type === 'chapter') {
      const m = e.title.match(new RegExp(`^(${AR_DIGITS}) - (.*)$`));
      item = null;
      chapter = m ? { id: num(m[1]), title: m[2].trim(), items: [] } : null;
      if (chapter) chapters.push(chapter);
    } else if (e.type === 'item') {
      if (!chapter) continue;
      item = { n: e.n, raw: '' };
      chapter.items.push(item);
    } else if (item) {
      item.raw += e.text;
    }
  }
  for (const c of chapters) {
    for (const it of c.items) {
      const footnotes = [];
      const text = it.raw
        .replace(/\u0002([^\u0003]*)\u0003/g, (_, note) => {
          footnotes.push(note.trim());
          return `(${footnotes.length})`;
        })
        .replace(/\s*\n\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      it.text = text;
      it.footnotes = footnotes;
      delete it.raw;
    }
  }
  return chapters;
}

function similarity(a, b) {
  const wa = new Set(normalizeArabic(a).split(' '));
  const wb = new Set(normalizeArabic(b).split(' '));
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  return inter / Math.max(1, Math.min(wa.size, wb.size));
}

async function main() {
  const book = await fetchJson(BOOK_URL);
  const chapters = buildChapters(tokenizeBook(book));
  const items = chapters.flatMap((c) => c.items);
  log('chapters', chapters.length, 'items', items.length);

  // Item numbers must run 1..267 without gaps or duplicates.
  const numbers = items.map((i) => i.n).sort((a, b) => a - b);
  numbers.forEach((n, i) => assert(n === i + 1, `item numbering broken near ${n}`));
  const withoutNotes = items.filter((i) => i.footnotes.length === 0);
  log('items without any footnote:', withoutNotes.map((i) => i.n).join(','));

  // Official site data: repeat counts and per-item audio, matched on the shared numbering.
  const index = await fetchJson(`${HISN_API}/husn_ar.json`);
  const apiChapters = Object.values(index)[0];
  const apiItems = new Map();
  await mapLimit(apiChapters, 4, async (c) => {
    const body = await fetchJson(`${HISN_API}/${c.ID}.json`);
    for (const it of Object.values(body)[0]) apiItems.set(it.ID, { ...it, chapterAudio: c.AUDIO_URL });
  });
  let matched = 0;
  const weak = [];
  for (const it of items) {
    const api = apiItems.get(it.n);
    if (!api) continue;
    const sim = similarity(it.text, api.ARABIC_TEXT);
    if (sim < 0.5) {
      weak.push(`${it.n}:${sim.toFixed(2)}`);
      continue;
    }
    matched++;
    it.repeat = Number(api.REPEAT) || 1;
    it.audio = api.AUDIO.replace(/^http:/, 'https:');
  }
  log(`hisnmuslim.com match: ${matched}/${items.length}`, weak.length ? `low similarity: ${weak.join(' ')}` : '');
  assert(matched >= items.length - 10, 'too many items could not be matched with hisnmuslim.com');

  const me = await fetchJson(MORNING_EVENING);
  const morningEvening = me.map((m) => ({
    order: m.order,
    text: m.content,
    count: m.count,
    countLabel: m.count_description,
    fadl: m.fadl || null,
    source: m.source,
    // 0 = morning and evening, 1 = morning only, 2 = evening only
    when: m.type,
    audio: m.audio ? m.audio.replace(/^http:/, 'https:') : null,
  }));
  assert(morningEvening.every((m) => m.source), 'every morning/evening item needs a source');
  log('morning/evening items', morningEvening.length);

  const r1 = writeJson('adhkar/hisn.json', {
    title: 'حصن المسلم من أذكار الكتاب والسنة',
    author: 'د. سعيد بن علي بن وهف القحطاني',
    edition: 'مطبعة سفير، الرياض — ترقيم الكتاب موافق للمطبوع',
    source: 'https://app.turath.io/book/31307',
    audioSource: 'https://www.hisnmuslim.com',
    chapters,
  });
  const r2 = writeJson('adhkar/morning-evening.json', {
    source: 'https://github.com/Seen-Arabic/Morning-And-Evening-Adhkar-DB',
    items: morningEvening,
  });
  log(r1.file, r1.bytes, r2.file, r2.bytes);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
