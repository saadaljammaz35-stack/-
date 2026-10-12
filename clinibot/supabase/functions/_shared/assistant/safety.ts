// Deterministic safety checks that run around the model, never instead of
// staff: customer commands (STOP, delete my data), emergency phrases that are
// answered without the model, and the price guard that withholds any reply
// quoting an amount the clinic never published. Pure functions, no I/O.

import { normalizeDigits } from "../phone.ts";

// Harakat, Quranic marks and superscript alef: optional in written Arabic.
const ARABIC_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۨ-ۭ]/g;
const TATWEEL = /ـ/g;

/**
 * Folds the spelling variants people actually type into one form: NFKC (presentation
 * forms, ligatures), no diacritics or tatweel, one alef, one ya, ta marbuta as ha,
 * typographic apostrophes as "'", lower case, single spaces.
 */
export function normalizeArabic(text: string): string {
  return text
    .normalize("NFKC")
    .replace(ARABIC_MARKS, "")
    .replace(TATWEEL, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/[ىی]/g, "ي")
    .replace(/ئ/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ة/g, "ه")
    .replace(/ک/g, "ك")
    .replace(/[‘’‛`´]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// ───────────────────────────── commands ─────────────────────────────

export type CustomerCommand = "stop" | "delete";

const STOP_COMMANDS = new Set(["stop", "إيقاف", "ايقاف", "توقف"].map(normalizeArabic));
const DELETE_COMMANDS = new Set(["delete my data", "حذف بياناتي", "احذف بياناتي"].map(normalizeArabic));
const EDGE_PUNCTUATION = /^[\s.!?؟،,؛;:]+|[\s.!?؟،,؛;:]+$/g;

/** A command is the whole message (surrounding punctuation ignored), never a phrase inside a sentence. */
export function detectCommand(text: string): CustomerCommand | null {
  const message = normalizeArabic(text).replace(EDGE_PUNCTUATION, "");
  if (STOP_COMMANDS.has(message)) return "stop";
  if (DELETE_COMMANDS.has(message)) return "delete";
  return null;
}

// ──────────────────────────── emergencies ────────────────────────────
// Deliberately a short list of unambiguous phrases. A miss still reaches the
// model, whose rules send emergencies to 997; a false positive pauses the
// assistant and hands the chat to reception, which is the safe direction.

const ENGLISH_EMERGENCY: RegExp[] = [
  /\bchest pains?\b/,
  /\bpain in (?:my|his|her|the) chest\b/,
  /\bheart attack\b/,
  /\b(?:can'?t|cannot|can not|couldn'?t|could not|unable to|struggling to) breath(?:e|ing)?\b/,
  /\b(?:not|stopped) breathing\b/,
  /\bsevere(?:ly)? (?:shortness of breath|short of breath|breathing difficult(?:y|ies))\b/,
  /\bchoking\b/,
  /\bunconscious\b/,
  /\bunresponsive\b/,
  /\bpassed out\b/,
  /\bfaint(?:ed|ing)\b/,
  /\bsevere(?:ly)? bleed(?:ing)?\b/,
  /\b(?:heavy|uncontrolled|nonstop|non-stop) bleeding\b/,
  /\bbleeding (?:heavily|badly|a lot|won'?t stop)\b/,
  /\bstroke\b/,
  /\bsuicid(?:e|al)\b/,
  /\bkill(?:ing)? (?:myself|himself|herself)\b/,
  /\b(?:want|going) to die\b/,
  /\bend (?:my|his|her) life\b/,
  /\boverdos(?:e|ed|ing)\b/,
  /\bseizures?\b/,
  /\bconvuls(?:ion|ions|ing)\b/,
  /\bpoison(?:ed|ing)\b/,
  /\baccident\b/,
];

const ARABIC_EMERGENCY_PHRASES = [
  "ألم في الصدر",
  "ألم بالصدر",
  "ألم في صدري",
  "ألم بصدري",
  "ألم شديد في الصدر",
  "وجع في الصدر",
  "وجع بالصدر",
  "وجع صدري",
  "نوبة قلبية",
  "ذبحة صدرية",
  "سكتة قلبية",
  "لا أستطيع التنفس",
  "لا أستطيع أن أتنفس",
  "لا يستطيع التنفس",
  "ما أقدر أتنفس",
  "ما يقدر يتنفس",
  "مو قادر أتنفس",
  "ما قادر أتنفس",
  "ضيق تنفس شديد",
  "ضيق شديد في التنفس",
  "صعوبة شديدة في التنفس",
  "اختناق",
  "يختنق",
  "فقد الوعي",
  "فاقد الوعي",
  "فقدان الوعي",
  "فقدت الوعي",
  "إغماء",
  "أغمي علي",
  "مغمى علي",
  "نزيف شديد",
  "نزيف حاد",
  "نزيف قوي",
  "نزيف لا يتوقف",
  "ينزف بشدة",
  "جلطة",
  "جلطات",
  "سكتة دماغية",
  "انتحار",
  "انتحر",
  "أريد أن أموت",
  "أبي أموت",
  "أبغى أموت",
  "أقتل نفسي",
  "أنهي حياتي",
  "جرعة زائدة",
  "جرعة مفرطة",
  "تشنج",
  "نوبة صرع",
  "تسمم",
  "حادث",
];

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Arabic attaches conjunctions, prepositions and the article to the next word
// ("والجلطة", "بحادث"). The phrase must start a word, optionally after those
// clitics, so "محادثة" (conversation) does not match "حادث" (accident).
const ARABIC_EMERGENCY: RegExp[] = ARABIC_EMERGENCY_PHRASES.map((phrase) =>
  new RegExp(`(?:^|[^\\p{L}\\p{N}])(?:لل|[وفبكل]?(?:ال)?)${escapeRegExp(normalizeArabic(phrase))}`, "u")
);

export function detectEmergency(text: string): boolean {
  const normalized = normalizeArabic(text);
  return ENGLISH_EMERGENCY.some((pattern) => pattern.test(normalized)) ||
    ARABIC_EMERGENCY.some((pattern) => pattern.test(normalized));
}

// ──────────────────────────── price guard ────────────────────────────

// "1,250.50" / "1٬250٫50" (thousands separators required in groups of three) or "1250.5".
const NUMBER = String.raw`\d{1,3}(?:[,٬]\d{3})+(?:[.٫]\d+)?|\d+(?:[.٫]\d+)?`;
// Applied to normalizeArabic() output: lower case, "﷼" already folded to "ريال".
const CURRENCY = String.raw`ريالات|ريالا|ريال|ر\s?\.\s?س\.?|رس|⃁|sar|sr|riyals|riyal|rials|rial`;
// "إلى" and "حتى" as they read after normalizeArabic().
const RANGE = String.raw`\s*(?:-|–|—|~|to|الي|حتي)\s*`;

const AMOUNT_THEN_CURRENCY = new RegExp(
  String.raw`(?<![\d.,٫٬])(${NUMBER})(?:${RANGE}(${NUMBER}))?\s*(?:${CURRENCY})(?![\p{L}])`,
  "gu",
);
const CURRENCY_THEN_AMOUNT = new RegExp(
  String.raw`(?<![\p{L}])(?:${CURRENCY})\s*(${NUMBER})(?:${RANGE}(${NUMBER}))?(?![\d])`,
  "gu",
);
const ANY_NUMBER = new RegExp(String.raw`(?<![\d.,٫٬])(?:${NUMBER})`, "gu");

function priceText(text: string): string {
  return normalizeArabic(normalizeDigits(text));
}

function parseAmount(raw: string): number {
  return Number(raw.replace(/[,٬]/g, "").replace("٫", "."));
}

/** Every amount written next to a currency marker, before or after it, including both ends of a range. */
export function extractPriceMentions(text: string): number[] {
  const normalized = priceText(text);
  const amounts: number[] = [];
  for (const pattern of [AMOUNT_THEN_CURRENCY, CURRENCY_THEN_AMOUNT]) {
    for (const match of normalized.matchAll(pattern)) {
      for (const group of [match[1], match[2]]) {
        if (group !== undefined) amounts.push(parseAmount(group));
      }
    }
  }
  return amounts.filter((amount) => Number.isFinite(amount));
}

/** Every number in a text, currency or not. Used to collect the amounts a clinic itself wrote. */
export function extractNumbers(text: string): number[] {
  return [...priceText(text).matchAll(ANY_NUMBER)]
    .map((match) => parseAmount(match[0]))
    .filter((amount) => Number.isFinite(amount));
}

const PRICE_TOLERANCE = 0.005;

export interface PriceCheck {
  ok: boolean;
  unknown: number[];
}

/** A reply passes only if every amount it quotes in riyals is one the clinic published. */
export function checkPrices(reply: string, allowed: readonly number[]): PriceCheck {
  const unknown: number[] = [];
  for (const amount of extractPriceMentions(reply)) {
    const known = allowed.some((price) => Math.abs(price - amount) < PRICE_TOLERANCE);
    if (!known && !unknown.includes(amount)) unknown.push(amount);
  }
  return { ok: unknown.length === 0, unknown };
}
