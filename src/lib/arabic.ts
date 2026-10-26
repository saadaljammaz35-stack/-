// Arabic text helpers shared by the app and the data pipeline (scripts/data).
// Keep this file free of imports so Node can load it directly.

const DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿ]/g;
const TATWEEL = /ـ/g;
const ALEF_VARIANTS = /[آأإٱٲٳٵ]/g;
const NON_LETTERS = /[^ء-ي٠-٩a-z0-9\s]/g;

/** Removes tashkeel, Quranic annotation marks and tatweel. */
export function stripDiacritics(text: string): string {
  return text.replace(DIACRITICS, '').replace(TATWEEL, '');
}

/**
 * Normalizes Arabic text for search: no diacritics, unified alef/ya/ta-marbuta/hamza
 * forms, punctuation removed and whitespace collapsed. Applied to both the indexed
 * text and the user's query so they compare on the same footing.
 */
export function normalizeArabic(text: string): string {
  return stripDiacritics(text.normalize('NFC'))
    .toLowerCase()
    .replace(ALEF_VARIANTS, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ؤ]/g, 'و')
    .replace(/[ئ]/g, 'ي')
    .replace(/[ ​-‏‪-‮⁦-⁩]/g, ' ')
    .replace(NON_LETTERS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function toArabicDigits(value: number | string): string {
  return String(value).replace(/[0-9]/g, (d) => ARABIC_DIGITS[Number(d)]);
}

export function fromArabicDigits(value: string): string {
  return value.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

/** A count of days in correct Arabic: يوم واحد، يومان، ٣ أيام، ١١ يومًا، ١٠٠ يوم. */
export function arabicDays(n: number): string {
  if (n === 1) return 'يوم واحد';
  if (n === 2) return 'يومان';
  const r = n % 100;
  if (r >= 3 && r <= 10) return `${n} أيام`;
  if (r >= 11 && r <= 99) return `${n} يومًا`;
  return `${n} يوم`;
}
