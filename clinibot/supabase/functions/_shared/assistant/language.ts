// Reply language. Customers write Arabic, English, or a mix (Arabic with an
// English service name, English with an Arabic greeting). A message counts as
// Arabic once Arabic letters make up 30% of its letters, so a short English
// word inside an Arabic sentence does not switch the reply to English.

export type Language = "ar" | "en";

const LETTER = /\p{L}/u;
const ARABIC = /\p{Script=Arabic}/u;
const ARABIC_SHARE = 0.3;

/** Detects the reply language. Text with no letters (digits, emoji) keeps the fallback. */
export function detectLanguage(text: string, fallback?: Language | null): Language {
  let letters = 0;
  let arabic = 0;
  for (const ch of text) {
    if (!LETTER.test(ch)) continue;
    letters++;
    if (ARABIC.test(ch)) arabic++;
  }
  if (letters === 0) return fallback ?? "ar";
  return arabic / letters >= ARABIC_SHARE ? "ar" : "en";
}

export function isLanguage(value: unknown): value is Language {
  return value === "ar" || value === "en";
}
