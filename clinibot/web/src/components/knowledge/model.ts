/**
 * Pure logic for the clinic knowledge page: price display, form validation
 * (mirrors the CHECK constraints on clinic_services / approved_faqs in
 * supabase/migrations) and reordering. No React, no network.
 */
import type { Lang, MessageKey, TFunction } from "@/i18n";
import { toLatinDigits } from "@/lib/validation";

// ─────────────────────────────── limits ───────────────────────────────

/** Same numbers as the database constraints. */
export const LIMITS = {
  nameMax: 120,
  descriptionMax: 1000,
  priceMax: 1_000_000,
  durationMin: 5,
  durationMax: 600,
  questionMin: 3,
  questionMax: 300,
  answerMax: 2000,
} as const;

/** A validation problem: a message key plus its placeholders. */
export interface FieldError {
  key: MessageKey;
  params?: Readonly<Record<string, number>>;
}

export type FormErrors<F extends string> = Partial<Record<F, FieldError>>;

export type ValidationResult<P, F extends string> =
  | { ok: true; payload: P }
  | { ok: false; errors: FormErrors<F> };

// ─────────────────────────────── rows ───────────────────────────────

export const PRICE_TYPES = ["fixed", "starting_from", "on_consultation"] as const;
export type PriceType = (typeof PRICE_TYPES)[number];

export function isPriceType(value: unknown): value is PriceType {
  return PRICE_TYPES.includes(value as PriceType);
}

export const SERVICE_COLUMNS =
  "id, name_ar, name_en, description_ar, description_en, price_type, price_sar, duration_minutes, is_active, sort_order, created_at" as const;

export const FAQ_COLUMNS =
  "id, question_ar, answer_ar, question_en, answer_en, is_active, sort_order, created_at" as const;

export interface ServiceRow {
  id: string;
  name_ar: string | null;
  name_en: string | null;
  description_ar: string | null;
  description_en: string | null;
  price_type: PriceType;
  price_sar: number | null;
  duration_minutes: number | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface FaqRow {
  id: string;
  question_ar: string | null;
  answer_ar: string | null;
  question_en: string | null;
  answer_en: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

interface RawServiceRow extends Omit<ServiceRow, "price_type" | "price_sar"> {
  price_type: string;
  price_sar: number | string | null;
}

/** numeric(10,2) may arrive as a string; an unexpected price type is treated as "on consultation". */
export function toServiceRow(raw: RawServiceRow): ServiceRow {
  const price = raw.price_sar === null ? null : Number(raw.price_sar);
  return {
    ...raw,
    price_type: isPriceType(raw.price_type) ? raw.price_type : "on_consultation",
    price_sar: price !== null && Number.isFinite(price) ? price : null,
  };
}

// ─────────────────────────────── display ───────────────────────────────

/**
 * The text to show first (current language) and the other language as a
 * secondary line, when both exist and differ.
 */
export function localizedPair(
  ar: string | null | undefined,
  en: string | null | undefined,
  lang: Lang,
): { primary: string; secondary: string | null } {
  const a = ar?.trim() || null;
  const e = en?.trim() || null;
  const primary = (lang === "ar" ? (a ?? e) : (e ?? a)) ?? "";
  const other = lang === "ar" ? e : a;
  return { primary, secondary: other && a && e && other !== primary ? other : null };
}

export interface PriceFormatters {
  t: TFunction;
  formatSar: (amount: number) => string;
}

/**
 * "250 ر.س" / "يبدأ من 250 ر.س" / "يحدد بعد الاستشارة" (and the English
 * equivalents). A price-bearing type without a price never shows a number.
 */
export function formatServicePrice(
  service: Pick<ServiceRow, "price_type" | "price_sar">,
  { t, formatSar }: PriceFormatters,
): string {
  if (service.price_type === "on_consultation" || service.price_sar === null) {
    return t("knowledge.priceOnConsultation");
  }
  const amount = formatSar(service.price_sar);
  return service.price_type === "starting_from"
    ? t("knowledge.priceStartingFrom", { price: amount })
    : amount;
}

// ─────────────────────────────── services ───────────────────────────────

export interface ServiceFormValues {
  name_ar: string;
  name_en: string;
  description_ar: string;
  description_en: string;
  price_type: PriceType;
  /** As typed: Latin or Arabic-Indic digits, optional decimals. */
  price: string;
  duration: string;
  is_active: boolean;
}

export type ServiceField = keyof ServiceFormValues;

/** Exactly the columns the browser may write (see the grants in the security migration). */
export interface ServicePayload {
  name_ar: string | null;
  name_en: string | null;
  description_ar: string | null;
  description_en: string | null;
  price_type: PriceType;
  price_sar: number | null;
  duration_minutes: number | null;
  is_active: boolean;
}

export const EMPTY_SERVICE: ServiceFormValues = {
  name_ar: "",
  name_en: "",
  description_ar: "",
  description_en: "",
  price_type: "fixed",
  price: "",
  duration: "",
  is_active: true,
};

export function serviceToForm(row: ServiceRow): ServiceFormValues {
  return {
    name_ar: row.name_ar ?? "",
    name_en: row.name_en ?? "",
    description_ar: row.description_ar ?? "",
    description_en: row.description_en ?? "",
    price_type: row.price_type,
    price: row.price_sar === null ? "" : String(row.price_sar),
    duration: row.duration_minutes === null ? "" : String(row.duration_minutes),
    is_active: row.is_active,
  };
}

/** Accepts "250", "250.5", "1,250", "٢٥٠٫٥٠"; returns null when it is not a valid amount. */
export function parsePrice(input: string): number | null {
  const text = toLatinDigits(input)
    .trim()
    .replace(/٫/g, ".")
    .replace(/[,،\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

/** Whole minutes only; null when it is not a whole number. */
export function parseWholeNumber(input: string): number | null {
  const text = toLatinDigits(input).trim();
  if (!/^\d+$/.test(text)) return null;
  return Number(text);
}

function optionalText(value: string): string | null {
  const text = value.trim();
  return text === "" ? null : text;
}

export function validateService(
  values: ServiceFormValues,
): ValidationResult<ServicePayload, ServiceField> {
  const errors: FormErrors<ServiceField> = {};
  const nameAr = optionalText(values.name_ar);
  const nameEn = optionalText(values.name_en);

  if (!nameAr && !nameEn) errors.name_ar = { key: "knowledge.errNameRequired" };
  if (nameAr && nameAr.length > LIMITS.nameMax) {
    errors.name_ar = { key: "knowledge.errTooLong", params: { max: LIMITS.nameMax } };
  }
  if (nameEn && nameEn.length > LIMITS.nameMax) {
    errors.name_en = { key: "knowledge.errTooLong", params: { max: LIMITS.nameMax } };
  }

  const descriptionAr = optionalText(values.description_ar);
  const descriptionEn = optionalText(values.description_en);
  if (descriptionAr && descriptionAr.length > LIMITS.descriptionMax) {
    errors.description_ar = { key: "knowledge.errTooLong", params: { max: LIMITS.descriptionMax } };
  }
  if (descriptionEn && descriptionEn.length > LIMITS.descriptionMax) {
    errors.description_en = { key: "knowledge.errTooLong", params: { max: LIMITS.descriptionMax } };
  }

  let price: number | null = null;
  if (!isPriceType(values.price_type)) {
    errors.price_type = { key: "knowledge.errPriceType" };
  } else if (values.price_type !== "on_consultation") {
    // The database requires a price for fixed / starting-from, and none for on-consultation.
    if (values.price.trim() === "") {
      errors.price = { key: "knowledge.errPriceRequired" };
    } else {
      price = parsePrice(values.price);
      if (price === null) errors.price = { key: "knowledge.errPriceInvalid" };
      else if (price > LIMITS.priceMax) {
        errors.price = { key: "knowledge.errPriceTooHigh", params: { max: LIMITS.priceMax } };
      }
    }
  }

  let duration: number | null = null;
  if (values.duration.trim() !== "") {
    duration = parseWholeNumber(values.duration);
    if (duration === null || duration < LIMITS.durationMin || duration > LIMITS.durationMax) {
      errors.duration = {
        key: "knowledge.errDuration",
        params: { min: LIMITS.durationMin, max: LIMITS.durationMax },
      };
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    payload: {
      name_ar: nameAr,
      name_en: nameEn,
      description_ar: descriptionAr,
      description_en: descriptionEn,
      price_type: values.price_type,
      price_sar: values.price_type === "on_consultation" ? null : price,
      duration_minutes: duration,
      is_active: values.is_active,
    },
  };
}

// ─────────────────────────────── FAQs ───────────────────────────────

export interface FaqFormValues {
  question_ar: string;
  answer_ar: string;
  question_en: string;
  answer_en: string;
  is_active: boolean;
}

export type FaqField = keyof FaqFormValues;

export interface FaqPayload {
  question_ar: string | null;
  answer_ar: string | null;
  question_en: string | null;
  answer_en: string | null;
  is_active: boolean;
}

/**
 * The question and answer to show for a FAQ, both from the same language:
 * the current language when its pair is complete, otherwise the other one.
 */
export function faqDisplay(
  faq: Pick<FaqRow, "question_ar" | "answer_ar" | "question_en" | "answer_en">,
  lang: Lang,
): { question: string; answer: string; hasAr: boolean; hasEn: boolean } {
  const hasAr = Boolean(faq.question_ar?.trim() && faq.answer_ar?.trim());
  const hasEn = Boolean(faq.question_en?.trim() && faq.answer_en?.trim());
  const useAr = lang === "ar" ? hasAr || !hasEn : hasAr && !hasEn;
  const question = (useAr ? faq.question_ar : faq.question_en)?.trim() ?? "";
  const answer = (useAr ? faq.answer_ar : faq.answer_en)?.trim() ?? "";
  return { question, answer, hasAr, hasEn };
}

export const EMPTY_FAQ: FaqFormValues = {
  question_ar: "",
  answer_ar: "",
  question_en: "",
  answer_en: "",
  is_active: true,
};

export function faqToForm(row: FaqRow): FaqFormValues {
  return {
    question_ar: row.question_ar ?? "",
    answer_ar: row.answer_ar ?? "",
    question_en: row.question_en ?? "",
    answer_en: row.answer_en ?? "",
    is_active: row.is_active,
  };
}

/**
 * Each language is either empty or a complete pair (question 3–300, answer
 * up to 2000 characters), and at least one language is complete.
 */
export function validateFaq(values: FaqFormValues): ValidationResult<FaqPayload, FaqField> {
  const errors: FormErrors<FaqField> = {};
  const pairs = [
    { q: "question_ar", a: "answer_ar" },
    { q: "question_en", a: "answer_en" },
  ] as const;
  let complete = 0;

  for (const { q, a } of pairs) {
    const question = values[q].trim();
    const answer = values[a].trim();
    if (!question && !answer) continue;
    if (!question) errors[q] = { key: "knowledge.errQuestionMissing" };
    else if (question.length < LIMITS.questionMin || question.length > LIMITS.questionMax) {
      errors[q] = {
        key: "knowledge.errQuestionLength",
        params: { min: LIMITS.questionMin, max: LIMITS.questionMax },
      };
    }
    if (!answer) errors[a] = { key: "knowledge.errAnswerMissing" };
    else if (answer.length > LIMITS.answerMax) {
      errors[a] = { key: "knowledge.errTooLong", params: { max: LIMITS.answerMax } };
    }
    if (!errors[q] && !errors[a]) complete += 1;
  }

  if (complete === 0 && Object.keys(errors).length === 0) {
    errors.question_ar = { key: "knowledge.errFaqPairRequired" };
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    payload: {
      question_ar: optionalText(values.question_ar),
      answer_ar: optionalText(values.answer_ar),
      question_en: optionalText(values.question_en),
      answer_en: optionalText(values.answer_en),
      is_active: values.is_active,
    },
  };
}

// ─────────────────────────────── ordering ───────────────────────────────

export interface Orderable {
  id: string;
  sort_order: number;
}

/** sort_order for a new item: after every existing one. */
export function nextSortOrder(items: readonly Orderable[]): number {
  return items.reduce((max, item) => Math.max(max, item.sort_order + 1), 0);
}

/**
 * Moves items[index] one place up (-1) or down (+1) in the displayed order
 * and returns only the rows whose sort_order must change. Positions become
 * 0…n-1, which also repairs duplicates (every row starts at 0).
 */
export function reorderUpdates(
  items: readonly Orderable[],
  index: number,
  delta: -1 | 1,
): Array<{ id: string; sort_order: number }> {
  const target = index + delta;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return [];
  const order = [...items];
  const moving = order[index];
  const other = order[target];
  if (!moving || !other) return [];
  order[index] = other;
  order[target] = moving;
  return order.flatMap((item, position) =>
    item.sort_order === position ? [] : [{ id: item.id, sort_order: position }],
  );
}

// ─────────────────────────────── working hours ───────────────────────────────

/** Saudi week order, as stored in clinic_settings.working_hours. */
export const DAY_CODES = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"] as const;
export type DayCode = (typeof DAY_CODES)[number];
export type WorkingHours = Record<DayCode, Array<[string, string]>>;

const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/;

/** Reads the jsonb column defensively; anything malformed counts as closed. */
export function parseWorkingHours(value: unknown): WorkingHours {
  const source =
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const result = {} as WorkingHours;
  for (const day of DAY_CODES) {
    const ranges = source[day];
    result[day] = Array.isArray(ranges)
      ? ranges.flatMap((range): Array<[string, string]> =>
          Array.isArray(range) &&
          range.length === 2 &&
          typeof range[0] === "string" &&
          typeof range[1] === "string" &&
          TIME.test(range[0]) &&
          TIME.test(range[1])
            ? [[range[0], range[1]]]
            : [],
        )
      : [];
  }
  return result;
}
