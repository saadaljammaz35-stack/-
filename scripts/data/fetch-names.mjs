// Builds «أسماء الله الحسنى»: the 99 names exactly as listed in Jami' al-Tirmidhi (3507),
// with the explanation of each name by Imam al-Khattabi (d. 388H) from «شأن الدعاء»
// (ed. Ahmad Yusuf al-Daqqaq), which comments on that same list in order.
import { normalizeArabic, fromArabicDigits } from '../../src/lib/arabic.ts';
import { processEdition } from '../../src/lib/hadith-import.ts';
import { HADITH_API } from './hadith-books.mjs';
import { assert, fetchJson, log, writeJson } from './lib.mjs';

const KHATTABI = 'https://files.turath.io/books-v3/95700.json';
const AR = '[٠-٩]+';
const MULTI_WORD = ['مالك الملك', 'ذو الجلال والاكرام'];

/** Splits the list in the hadith text into names, keeping two-word names together. */
function namesFromTirmidhi(text) {
  const all = text.split(/\s+/).map((w) => w.replace(/[^ء-ْٰ]/g, '')).filter(Boolean);
  const start = all.findIndex(
    (w, i) =>
      normalizeArabic(w) === 'هو' &&
      normalizeArabic(all[i + 1] ?? '') === 'الله' &&
      normalizeArabic(all[i + 2] ?? '') === 'الذي',
  );
  assert(start >= 0, 'names list start not found in Tirmidhi 3507');
  const words = all.slice(start + 1);
  // Drop «الَّذِي لاَ إِلَهَ إِلاَّ هُوَ» after the first name.
  const skip = ['الذي', 'لا', 'اله', 'الا', 'هو'];
  const names = [words[0]];
  let i = 1;
  for (const s of skip) {
    assert(normalizeArabic(words[i]) === s, `unexpected word «${words[i]}» in names preamble`);
    i++;
  }
  while (names.length < 99 && i < words.length) {
    const pair = `${words[i]} ${words[i + 1] ?? ''}`;
    const triple = `${pair} ${words[i + 2] ?? ''}`;
    if (MULTI_WORD.includes(normalizeArabic(triple))) {
      names.push(triple);
      i += 3;
    } else if (MULTI_WORD.includes(normalizeArabic(pair))) {
      names.push(pair);
      i += 2;
    } else {
      names.push(words[i]);
      i += 1;
    }
  }
  assert(names.length === 99, `expected 99 names, got ${names.length}`);
  assert(normalizeArabic(names[98]) === 'الصبور', 'the list must end with الصبور');
  return names;
}

function khattabiEntries(book) {
  const text = book.pages
    // page_id (1-based position) of «باب تفسير هذه الأسماء» … the following «فصل».
    .filter((_, index) => index + 1 >= 68 && index + 1 <= 155)
    .map((p) => p.text.split(/\n_{5,}\n/)[0])
    .join('\n');
  const entries = [];
  const re = new RegExp(`(?:^|\\n)((?:${AR} - )+)(?:\\[${AR}\\] )?([^:\\n]+):`, 'g');
  const marks = [...text.matchAll(re)];
  marks.forEach((m, k) => {
    const numbers = m[1].match(new RegExp(AR, 'g')).map((d) => Number(fromArabicDigits(d)));
    const end = k + 1 < marks.length ? marks[k + 1].index : text.length;
    const body = text
      .slice(m.index + m[0].length, end)
      .replace(new RegExp(`\\(${AR}\\)`, 'g'), '')
      .replace(new RegExp(`\\[${AR}\\]`, 'g'), '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    const heading = m[2].replace(new RegExp(`\\(${AR}\\)`, 'g'), '').trim();
    entries.push({ numbers, heading, body });
  });
  return entries.filter((e) => e.numbers[0] >= 1 && e.numbers[0] <= 100);
}

async function main() {
  const { rows } = processEdition(await fetchJson(`${HADITH_API}/editions/ara-tirmidhi.min.json`));
  const hadith = rows.find((h) => h.n === 3507);
  assert(hadith, 'Tirmidhi 3507 missing');
  const names = namesFromTirmidhi(hadith.text);

  const book = await fetchJson(KHATTABI);
  const entries = khattabiEntries(book);
  // Map each normalized name to the explanation that covers it.
  const explanations = new Map();
  const register = (key, e) => {
    if (!explanations.has(key)) explanations.set(key, e);
  };
  for (const e of entries) {
    const heading = normalizeArabic(e.heading);
    register(heading, e);
    // Pair headings («القابض الباسط») explain two names; two-word names stay whole.
    if (!MULTI_WORD.includes(heading)) {
      for (const n of e.heading.split(/\s+(?=ال)/)) register(normalizeArabic(n), e);
    }
  }
  // Loose key for spelling variants such as «الرءوف» / «الرؤوف».
  const strip = (s) => normalizeArabic(s).replace(/^ال/, '').replace(/[ءوي]/g, '');
  let previous = null;
  const result = names.map((name, i) => {
    const key = normalizeArabic(name);
    let e = explanations.get(key);
    if (!e) {
      for (const [k, v] of explanations) if (strip(k) === strip(key)) e = v;
    }
    // A double-numbered entry («٢٥ - ٢٦ - المعز») explains the pair under one heading.
    if (!e && previous && previous.numbers.length === 2 && previous.heading.split(/\s+/).length === 1) {
      e = previous;
    }
    previous = e;
    return {
      n: i + 1,
      name,
      explanation: e ? e.body : null,
      khattabiNumber: e ? e.numbers.join('-') : null,
    };
  });
  const missing = result.filter((r) => !r.explanation);
  log('names', result.length, 'with explanation', result.length - missing.length);
  if (missing.length) log('missing:', missing.map((m) => m.name).join(' '));
  assert(missing.length === 0, 'every name needs its explanation');

  const r = writeJson('names/asma-ul-husna.json', {
    listSource: {
      book: 'جامع الترمذي',
      number: 3507,
      text: hadith.text,
      grades: hadith.grades,
    },
    explanationSource: {
      book: 'شأن الدعاء',
      author: 'أبو سليمان حمد بن محمد الخطابي (ت ٣٨٨هـ)',
      editor: 'أحمد يوسف الدقاق — دار الثقافة العربية',
      url: 'https://app.turath.io/book/95700',
    },
    names: result,
  });
  log(r.file, r.bytes);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
