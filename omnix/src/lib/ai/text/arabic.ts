// Arabic-aware normalisation for keyword search. PostgreSQL has no Arabic
// normaliser for the `simple` configuration, so the application normalises
// both the indexed text (ai_knowledge_chunks.search_text) and the query the
// same way. The original text is always kept for display and for the model.

const TASHKEEL = /[ؐ-ًؚ-ٰٟۖ-ۭ]/g;
const TATWEEL = /ـ/g;
const ARABIC_INDIC_DIGITS = /[٠-٩]/g;
const EXT_ARABIC_DIGITS = /[۰-۹]/g;

export function normalizeArabic(text: string): string {
  return text
    .normalize("NFKC")
    .replace(TASHKEEL, "")
    .replace(TATWEEL, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(ARABIC_INDIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(EXT_ARABIC_DIGITS, (d) => String(d.charCodeAt(0) - 0x06f0));
}

const AR_PREFIXES = ["وبال", "وكال", "فبال", "وال", "بال", "كال", "فال", "لل", "ال"];

/** Light stemming: strips the definite article and attached conjunction/preposition. */
function stemArabic(token: string): string {
  if (!/^[؀-ۿ]+$/.test(token)) return token;
  for (const p of AR_PREFIXES) {
    if (token.startsWith(p) && token.length - p.length >= 3) return token.slice(p.length);
  }
  return token;
}

/** Tokens for full-text search: normalised, lower-cased, letters and digits only. */
export function searchTokens(text: string): string[] {
  return normalizeArabic(text)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 2 && t.length <= 60)
    .map(stemArabic);
}

/** The string stored in search_text (feeds the generated tsvector). */
export function searchText(text: string): string {
  return searchTokens(text).join(" ");
}

const STOPWORDS = new Set([
  // English
  "the", "and", "for", "are", "was", "with", "what", "who", "how", "why", "when", "where", "which", "this", "that", "from",
  "about", "does", "did", "can", "you", "your", "our", "into", "is", "of", "to", "in", "on", "a", "an", "it", "be", "as", "at", "or", "by",
  // Arabic (normalised forms)
  "في", "من", "علي", "الي", "عن", "مع", "هذا", "هذه", "ذلك", "تلك", "ما", "ماذا", "هل", "كيف", "متي", "اين", "لماذا", "التي", "الذي",
  "هو", "هي", "ان", "او", "ثم", "كل", "لا", "لم", "لن", "قد", "وش", "ايش", "وين", "كذا",
]);

/** Query terms for the tsquery: stop words dropped, de-duplicated, capped. */
export function queryTerms(query: string): string[] {
  return [...new Set(searchTokens(query).filter((t) => !STOPWORDS.has(t)))].slice(0, 24);
}

/** Share of letters that are Arabic script (0..1). Used by evaluation scorers. */
export function arabicRatio(text: string): number {
  let ar = 0;
  let letters = 0;
  for (const ch of text) {
    if (/\p{L}/u.test(ch)) {
      letters++;
      if (/[؀-ۿݐ-ݿ]/.test(ch)) ar++;
    }
  }
  return letters === 0 ? 0 : ar / letters;
}
