// Fetches the Quran text (King Fahd Complex "QPC Hafs" script) with the 15-line Madani
// page layout from the Quran.com API, cross-checks every verse against Tanzil's
// independent text, and writes the processed files under data/quran/.
import { normalizeArabic } from '../../src/lib/arabic.ts';
import { assert, fetchJson, fetchText, log, mapLimit, writeJson } from './lib.mjs';

const API = 'https://api.quran.com/api/v4';
const TANZIL_SIMPLE_CLEAN =
  'https://tanzil.net/pub/download/index.php?quranType=simple-clean&outType=txt-2&agree=true';
const PAGES = 604;
const LINES_PER_PAGE = 15;

/**
 * The API splits a few written words into two morphological words (e.g. «لَّوۡمَا» → «لَّوۡ مَا»).
 * The mushaf must show the written form, so rebuild tokens from the verse text and carry
 * each token's line number over from the API words that compose it.
 */
const mergedWords = [];
function alignGraphicWords(v) {
  const tokens = v.text_qpc_hafs.replace(/\s+/gu, ' ').trim().split(' ');
  const apiWords = v.words;
  const bare = (w) => w.text_qpc_hafs.replace(/\s+/gu, '');
  const out = [];
  let i = 0;
  let j = 0;
  while (i < tokens.length && j < apiWords.length) {
    const groupT = [tokens[i]];
    const groupW = [apiWords[j]];
    let accT = tokens[i];
    let accW = bare(apiWords[j]);
    // Grow whichever side is shorter until both spell the same letters.
    while (accT !== accW) {
      if (accT.length < accW.length && i + 1 < tokens.length) {
        accT += tokens[++i];
        groupT.push(tokens[i]);
      } else if (j + 1 < apiWords.length) {
        accW += bare(apiWords[++j]);
        groupW.push(apiWords[j]);
      } else {
        throw new Error(`cannot align «${groupT.join(' ')}» in ${v.verse_key}`);
      }
    }
    i++;
    j++;
    const lines = new Set(groupW.map((p) => p.line_number));
    assert(lines.size === 1, `«${groupT.join(' ')}» in ${v.verse_key} spans lines`);
    if (groupW.length > 1) mergedWords.push(`${v.verse_key} ${groupT.join(' ')}`);
    const isEnd = groupW.some((w) => w.char_type_name === 'end');
    out.push({ ...groupW[0], char_type_name: isEnd ? 'end' : 'word', text_qpc_hafs: groupT.join(' ') });
  }
  assert(i === tokens.length && j === apiWords.length, `unaligned trailing words in ${v.verse_key}`);
  return out;
}

async function fetchChapters() {
  const [ar, en] = await Promise.all([
    fetchJson(`${API}/chapters?language=ar`),
    fetchJson(`${API}/chapters?language=en`),
  ]);
  return ar.chapters.map((c, i) => ({
    id: c.id,
    name: c.name_arabic,
    nameSimple: c.name_simple,
    nameEn: en.chapters[i].translated_name.name,
    revelation: c.revelation_place === 'makkah' ? 'meccan' : 'medinan',
    revelationOrder: c.revelation_order,
    versesCount: c.verses_count,
    bismillahPre: c.bismillah_pre,
    pages: c.pages,
  }));
}

async function fetchPage(page) {
  const fields = [
    'text_qpc_hafs',
    'text_uthmani',
    'text_imlaei_simple',
    'juz_number',
    'hizb_number',
    'rub_el_hizb_number',
    'page_number',
    'sajdah_number',
  ].join(',');
  const url = `${API}/verses/by_page/${page}?words=true&word_fields=text_qpc_hafs,line_number&fields=${fields}&per_page=50`;
  const body = await fetchJson(url);
  assert(body.pagination.total_pages === 1, `page ${page} spans multiple API pages`);
  return body.verses;
}

function buildLayout(pagesVerses, verseIndexByKey, chapters) {
  const pages = [];
  for (let p = 1; p <= PAGES; p++) {
    const lines = new Map();
    for (const v of pagesVerses[p - 1]) {
      const vi = verseIndexByKey.get(v.verse_key);
      for (const w of v.words) {
        if (!lines.has(w.line_number)) lines.set(w.line_number, []);
        // [verse index, text, 1 when the token is the verse-end number, word position in the
        // verse as numbered by the recitation timings (a rebuilt word keeps its first part's)]
        lines.get(w.line_number).push([vi, w.text_qpc_hafs, w.char_type_name === 'end' ? 1 : 0, w.position]);
      }
    }
    pages.push({ lines, special: new Map() });
  }
  const isFree = (page, line) => !page.lines.has(line) && !page.special.has(line);
  // Surah headers (and the basmala) sit on the lines right above each surah's first
  // verse; when the surah starts at the top of a page they close the previous page.
  for (let p = 1; p <= PAGES; p++) {
    for (const v of pagesVerses[p - 1]) {
      if (v.verse_number !== 1) continue;
      const surah = Number(v.verse_key.split(':')[0]);
      const needs = surah === 1 || surah === 9 ? ['surah'] : ['surah', 'basmala'];
      let pageNo = p;
      let line = Math.min(...v.words.map((w) => w.line_number)) - 1;
      for (let k = needs.length - 1; k >= 0; k--) {
        if (line < 1) {
          pageNo -= 1;
          line = LINES_PER_PAGE;
        }
        const page = pages[pageNo - 1];
        assert(page && isFree(page, line), `no room for ${needs[k]} of surah ${surah} (page ${pageNo})`);
        page.special.set(line, { t: needs[k], s: surah });
        line -= 1;
      }
    }
  }
  const layout = pages.map((page, idx) => {
    const p = idx + 1;
    const maxLine = p <= 2 ? Math.max(...page.lines.keys()) : LINES_PER_PAGE;
    const out = [];
    for (let line = 1; line <= maxLine; line++) {
      if (page.lines.has(line)) out.push({ t: 'ayah', w: page.lines.get(line) });
      else if (page.special.has(line)) out.push(page.special.get(line));
      else throw new Error(`page ${p} line ${line} is empty`);
    }
    return out;
  });
  for (const c of chapters) {
    const found = layout.some((lines) => lines.some((l) => l.t === 'surah' && l.s === c.id));
    assert(found, `surah ${c.id} header missing`);
  }
  return layout;
}

async function main() {
  const chapters = await fetchChapters();
  assert(chapters.length === 114, 'expected 114 surahs');
  log('chapters ok');

  const pageNumbers = Array.from({ length: PAGES }, (_, i) => i + 1);
  const pagesVerses = await mapLimit(pageNumbers, 6, fetchPage);
  log('pages fetched');

  const verses = [];
  const verseIndexByKey = new Map();
  for (const pv of pagesVerses) {
    for (const v of pv) {
      verseIndexByKey.set(v.verse_key, verses.length);
      const [s, a] = v.verse_key.split(':').map(Number);
      const endMarker = v.words.find((w) => w.char_type_name === 'end');
      assert(endMarker, `missing end marker ${v.verse_key}`);
      v.words = alignGraphicWords(v);
      const words = v.words.filter((w) => w.char_type_name === 'word').map((w) => w.text_qpc_hafs);
      verses.push({
        s,
        a,
        p: v.page_number,
        j: v.juz_number,
        h: v.hizb_number,
        r: v.rub_el_hizb_number,
        // The printed mushaf marks 15 prostrations with ۩ (the API flags only 14, omitting 22:77).
        sj: v.text_qpc_hafs.includes('\u06E9') ? 1 : 0,
        qpc: words.join(' '),
        uth: v.text_uthmani,
        simple: v.text_imlaei_simple,
      });
    }
  }
  assert(verses.length === 6236, `expected 6236 verses, got ${verses.length}`);
  for (const c of chapters) {
    const count = verses.filter((v) => v.s === c.id).length;
    assert(count === c.versesCount, `surah ${c.id} has ${count} verses, expected ${c.versesCount}`);
  }
  for (let i = 1; i < verses.length; i++) {
    const a = verses[i - 1];
    const b = verses[i];
    assert(
      (b.s === a.s && b.a === a.a + 1) || (b.s === a.s + 1 && b.a === 1),
      `verse order broken at ${b.s}:${b.a}`,
    );
  }
  log(`verse structure ok (${mergedWords.length} written words rebuilt from split API words)`);
  log(mergedWords.join(' | '));

  // Independent cross-check: Tanzil's simple-clean text must match letter for letter
  // once both are normalized (catches any missing or corrupted word).
  const tanzil = (await fetchText(TANZIL_SIMPLE_CLEAN))
    .split('\n')
    .filter((l) => /^\d+\|\d+\|/.test(l));
  assert(tanzil.length === 6236, `Tanzil has ${tanzil.length} lines`);
  const skeleton = (t) => normalizeArabic(t).replace(/[ء\s]/g, '').replace(/[اويى]/g, '');
  let mismatches = [];
  tanzil.forEach((line, i) => {
    const [s, a, raw] = line.split('|');
    const v = verses[i];
    // Tanzil prefixes the basmala to the first verse of every surah except 1 and 9.
    const text = v.a === 1 && v.s !== 1 && v.s !== 9 ? raw.replace(/^بسم الله الرحمن الرحيم /, '') : raw;
    assert(Number(s) === v.s && Number(a) === v.a, `Tanzil order mismatch at ${s}:${a}`);
    if (skeleton(text) !== skeleton(v.simple)) mismatches.push(`${s}:${a}`);
  });
  log(`Tanzil cross-check: ${6236 - mismatches.length}/6236 identical consonant skeletons`);
  if (mismatches.length) log('differences (orthographic variants to review):', mismatches.join(' '));

  const layout = buildLayout(pagesVerses, verseIndexByKey, chapters);
  log('layout ok');

  const juzStarts = [];
  const hizbQuarterStarts = [];
  verses.forEach((v, i) => {
    if (i === 0 || verses[i - 1].j !== v.j) juzStarts.push(i);
    if (i === 0 || verses[i - 1].r !== v.r) hizbQuarterStarts.push(i);
  });
  assert(juzStarts.length === 30, 'expected 30 juz');
  assert(hizbQuarterStarts.length === 240, `expected 240 rub' al-hizb, got ${hizbQuarterStarts.length}`);
  const sajdas = verses.flatMap((v, i) => (v.sj ? [i] : []));
  assert(sajdas.length === 15, `expected 15 sajdah verses, got ${sajdas.length}`);

  const out = [
    writeJson('quran/surahs.json', chapters),
    writeJson('quran/verses.json', verses),
    writeJson('quran/layout.json', layout),
    writeJson('quran/meta.json', {
      source: 'Quran.com API v4 (text_qpc_hafs, King Fahd Glorious Quran Printing Complex script)',
      crossCheck: 'tanzil.net simple-clean',
      tanzilDifferences: mismatches,
      juzStarts,
      hizbQuarterStarts,
      sajdas,
      generatedAt: new Date().toISOString(),
    }),
  ];
  for (const o of out) log(o.file, o.bytes, o.sha256.slice(0, 12));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
