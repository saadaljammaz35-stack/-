// Links between the Quran and the other bundled sources, derived at build time from the texts
// themselves (nothing is matched by meaning):
//  - a hadith is linked to a verse when its text (or its explanation) quotes the verse in
//    Quranic brackets {…} / ﴿…﴾, and the quote occurs exactly once in the Quran;
//  - a name of Allah is linked to the verses al-Khattabi cites for it in «شأن الدعاء»,
//    («…» [سورة/آية]) once the quoted words are found in that verse, and to the verses where
//    the word itself occurs.
import { normalizeArabic } from '../../src/lib/arabic.ts';

/** Letters only, no spaces, alef and hamza dropped: tolerant of spelling between editions. */
const squash = (s) =>
  normalizeArabic(s)
    .replace(/[^ء-ي]/g, '')
    .replace(/[اء]/g, '');

const toLatin = (s) => s.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));

/** One string of the whole Quran with the offset at which each verse starts. */
function quranIndex(verseSearch) {
  let full = '';
  const starts = [];
  for (const v of verseSearch) {
    starts.push(full.length);
    full += squash(v);
  }
  const verseAt = (pos) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= pos) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };
  return { full, verseAt };
}

/** Verse ids a quote covers, or [] when it is too short, not found, or found more than once. */
function findQuote(index, raw) {
  const q = squash(raw);
  if (q.length < 8) return [];
  const at = index.full.indexOf(q);
  if (at < 0 || index.full.indexOf(q, at + 1) >= 0) return [];
  const from = index.verseAt(at);
  const to = index.verseAt(at + q.length - 1);
  if (to - from > 10) return [];
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

const QURAN_QUOTE = /[{﴿]([^}﴾]{4,}?)[}﴾]/g;

/** [verseId, hadithId, kind] with kind 0 = quoted in the hadith, 1 = quoted in its explanation. */
export function linkHadithVerses(verseSearch, hadiths) {
  const index = quranIndex(verseSearch);
  const links = new Map();
  for (const h of hadiths) {
    for (const [field, kind] of [
      [h.text, 0],
      [h.explanation, 1],
    ]) {
      if (!field) continue;
      for (const m of field.matchAll(QURAN_QUOTE)) {
        for (const v of findQuote(index, m[1])) {
          const key = `${v}:${h.id}`;
          if (!links.has(key) || kind < links.get(key)) links.set(key, kind);
        }
      }
    }
  }
  return [...links].map(([key, kind]) => [...key.split(':').map(Number), kind]);
}

const PREFIXES = ['', 'و', 'ف', 'ب', 'ك', 'وب', 'فب', 'وك'];
// Words that are names of Allah in the definite form but ordinary words without the article.
const DEFINITE_ONLY = new Set(['الحق', 'الاول', 'الاخر', 'الظاهر', 'الباطن', 'الملك', 'السلام', 'العدل', 'النور', 'الواحد', 'البر', 'الكبير', 'الولي', 'الوالي', 'المومن', 'الحي', 'الرحمن']);

/** The spellings of a name as a whole word: with the joined particles, and without the article. */
function wordForms(norm) {
  const out = new Set();
  for (const p of PREFIXES) out.add(p + norm);
  for (const p of ['ل', 'ول', 'فل']) out.add(p + norm.slice(1));
  if (norm === 'الله') {
    out.add('اللهم');
    out.add('تالله');
  } else if (!DEFINITE_ONLY.has(norm)) {
    const bare = norm.slice(2);
    for (const p of PREFIXES) {
      out.add(p + bare);
      out.add(`${p + bare}ا`);
    }
  }
  return out;
}

/**
 * [nameNumber, verseId, kind] with kind 0 = cited by al-Khattabi for this name, 1 = the word
 * occurs in the verse. Also returns the citations that could not be confirmed, for the build log.
 */
export function linkNameVerses(names, verseSearch, verseIndex, surahs) {
  const surahByName = new Map();
  for (const s of surahs) {
    const n = normalizeArabic(s.name);
    surahByName.set(n, s.id);
    surahByName.set(n.replace(/^ال/, ''), s.id);
  }
  const rows = [];
  const unconfirmed = [];
  for (const name of names) {
    const cited = new Set();
    // «(… quoted words …) [سورة/آية]»
    for (const m of name.explanation.matchAll(/\(([^()]{3,}?)\)\s*\[([^\]/]{2,25})\/\s*([٠-٩0-9]+)[^\]]*\]/g)) {
      const surah = surahByName.get(normalizeArabic(m[2]).replace(/^ال/, '')) ?? surahByName.get(normalizeArabic(m[2]));
      const ayah = Number(toLatin(m[3]));
      const q = squash(m[1]);
      let found = null;
      // Editions differ by a verse or two in their numbering; the quoted words decide.
      for (const d of [0, -1, 1, -2, 2]) {
        const id = surah ? verseIndex.get(`${surah}:${ayah + d}`) : undefined;
        if (id !== undefined && squash(verseSearch[id]).includes(q)) {
          found = id;
          break;
        }
      }
      if (found === null) unconfirmed.push(`${name.n} ${m[2]}/${m[3]}`);
      else cited.add(found);
    }
    for (const id of cited) rows.push([name.n, id, 0]);

    const norm = normalizeArabic(name.name);
    if (norm.includes(' ')) {
      verseSearch.forEach((v, id) => {
        if (!cited.has(id) && ` ${v} `.includes(` ${norm} `)) rows.push([name.n, id, 1]);
      });
      continue;
    }
    const forms = wordForms(norm);
    verseSearch.forEach((v, id) => {
      if (!cited.has(id) && v.split(' ').some((w) => forms.has(w))) rows.push([name.n, id, 1]);
    });
  }
  return { rows, unconfirmed };
}
