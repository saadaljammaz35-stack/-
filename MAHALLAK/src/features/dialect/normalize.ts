/**
 * Arabic text normalization tuned for spoken Saudi Arabic that arrives from
 * speech-to-text or the keyboard. Pure functions, no platform dependencies.
 */

const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;
const TATWEEL = /ـ/g;
const PUNCTUATION = /[،؛؟٪-٭۔.,;:!?¿¡"'`~@#$%^&*()[\]{}<>«»“”‘’\-_=+|\\/]/g;

const EASTERN_DIGITS: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};

/** Normalizes letters so spelling variants compare equal. */
export function normalizeArabic(input: string): string {
  let s = input.normalize('NFKC').toLowerCase();
  s = s.replace(DIACRITICS, '').replace(TATWEEL, '');
  s = s.replace(/[٠-٩۰-۹]/g, (d) => EASTERN_DIGITS[d] ?? d);
  s = s
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/گ/g, 'ك')
    .replace(/چ/g, 'ج')
    .replace(/ڤ/g, 'ف')
    .replace(/پ/g, 'ب');
  s = s.replace(PUNCTUATION, ' ');
  // Elongated speech ("ويييين", "ابييي") collapses letters repeated 3+ times.
  s = s.replace(/(.)\1{2,}/gu, '$1');
  return s.replace(/\s+/g, ' ').trim();
}

export function tokenize(normalized: string): string[] {
  return normalized.length === 0 ? [] : normalized.split(' ').filter(Boolean);
}

// Proclitics glued to a word in speech: و ف ب ل ك + the definite article,
// plus the colloquial "ع" for "على" ("عالدرج") and "ف" for "في" ("فالدرج").
const PREFIXES = ['وبال', 'وال', 'بال', 'فال', 'كال', 'عال', 'لل', 'ال', 'و', 'ف', 'ب', 'ل', 'ع'];

// Possessive and object pronoun suffixes: سماعتي، شنطته، مفاتيحي، حطيتها، سماعاتي
const SUFFIXES: Array<[string, string[]]> = [
  ['اتي', ['ات', 'ه']],
  ['تي', ['ه', 'ت', '']],
  ['تك', ['ه', 'ت']],
  ['ته', ['ه', 'ت']],
  ['تها', ['ه']],
  ['ها', ['', 'ه']],
  ['هم', ['']],
  ['كم', ['']],
  ['نا', ['']],
  ['ي', ['']],
  ['ك', ['']],
  ['ه', ['', 'ه']],
];

/**
 * Candidate stems for a single token, most specific first. The lexicon decides
 * which candidate is meaningful, so over-generation here is intentional.
 */
export function stemCandidates(token: string): string[] {
  const out = new Set<string>([token]);
  const withoutPrefix: string[] = [token];
  for (const p of PREFIXES) {
    if (token.startsWith(p) && token.length - p.length >= 2) {
      const rest = token.slice(p.length);
      out.add(rest);
      withoutPrefix.push(rest);
      // "بالدرج" -> "درج" and also "الدرج" for multi-word entries that keep the article
      if (p.endsWith('ال')) out.add('ال' + rest);
    }
  }
  for (const base of withoutPrefix) {
    for (const [suffix, replacements] of SUFFIXES) {
      if (base.endsWith(suffix) && base.length - suffix.length >= 2) {
        const stem = base.slice(0, -suffix.length);
        for (const r of replacements) out.add(stem + r);
      }
    }
  }
  return [...out];
}

/** Damerau-Levenshtein (optimal string alignment) distance. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const al = a.length;
  const bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;
  const d: number[][] = Array.from({ length: al + 1 }, (_, i) => {
    const row = new Array<number>(bl + 1).fill(0);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= bl; j++) d[0][j] = j;
  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[al][bl];
}

/** 0..1 similarity; short words must match more strictly. */
export function similarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - editDistance(a, b) / max;
}

/**
 * Typo tolerance for free words. Arabic roots are mostly three letters, so two
 * short words one letter apart are usually different words (بنك / بني / بوك):
 * short words must match exactly, longer words may differ by one or two edits.
 */
export function fuzzyEquals(a: string, b: string): boolean {
  if (a === b) return true;
  const len = Math.min(a.length, b.length);
  if (len < 4) return false;
  const dist = editDistance(a, b);
  if (len <= 6) return dist <= 1 && Math.abs(a.length - b.length) <= 1;
  return dist <= 2 && similarity(a, b) >= 0.75;
}

/** Normalized word without a leading definite article, as used for free-term matching. */
export function canonicalWord(word: string): string {
  return normalizeArabic(word)
    .split(' ')
    .map((w) => (w.startsWith('ال') && w.length > 3 ? w.slice(2) : w))
    .join(' ');
}
