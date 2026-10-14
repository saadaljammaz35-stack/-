import { describe, expect, it } from "vitest";
import { formatSar } from "@/i18n/format";
import { translate } from "@/i18n/translate";
import type { Lang, TFunction } from "@/i18n";
import {
  EMPTY_FAQ,
  EMPTY_SERVICE,
  faqDisplay,
  formatServicePrice,
  localizedPair,
  nextSortOrder,
  parsePrice,
  parseWorkingHours,
  reorderUpdates,
  toServiceRow,
  validateFaq,
  validateService,
  type ServiceFormValues,
} from "./model";

function formatters(lang: Lang) {
  const t: TFunction = (key, params) => translate(lang, key, params);
  return { t, formatSar: (amount: number) => formatSar(lang, amount) };
}

describe("formatServicePrice", () => {
  it("shows a fixed price as an amount", () => {
    expect(formatServicePrice({ price_type: "fixed", price_sar: 250 }, formatters("ar"))).toBe(
      "250 ر.س",
    );
    expect(formatServicePrice({ price_type: "fixed", price_sar: 250 }, formatters("en"))).toBe(
      "SAR 250",
    );
  });

  it("prefixes starting-from prices", () => {
    expect(
      formatServicePrice({ price_type: "starting_from", price_sar: 250 }, formatters("ar")),
    ).toBe("يبدأ من 250 ر.س");
    expect(
      formatServicePrice({ price_type: "starting_from", price_sar: 199.5 }, formatters("en")),
    ).toBe("From SAR 199.50");
  });

  it("never shows a number for on-consultation, or when the price is missing", () => {
    expect(
      formatServicePrice({ price_type: "on_consultation", price_sar: null }, formatters("ar")),
    ).toBe("يحدد بعد الاستشارة");
    expect(formatServicePrice({ price_type: "fixed", price_sar: null }, formatters("en"))).toBe(
      "Set after consultation",
    );
  });

  it("reads numeric prices that arrive as strings", () => {
    const row = toServiceRow({
      id: "s1",
      name_ar: "تنظيف",
      name_en: null,
      description_ar: null,
      description_en: null,
      price_type: "fixed",
      price_sar: "300.00",
      duration_minutes: 30,
      is_active: true,
      sort_order: 0,
      created_at: "2026-10-01T00:00:00Z",
    });
    expect(row.price_sar).toBe(300);
    expect(formatServicePrice(row, formatters("ar"))).toBe("300 ر.س");
  });
});

describe("localizedPair", () => {
  it("puts the current language first and the other second", () => {
    expect(localizedPair("تنظيف", "Cleaning", "ar")).toEqual({
      primary: "تنظيف",
      secondary: "Cleaning",
    });
    expect(localizedPair("تنظيف", "Cleaning", "en")).toEqual({
      primary: "Cleaning",
      secondary: "تنظيف",
    });
  });

  it("falls back to the only language available", () => {
    expect(localizedPair(null, "Cleaning", "ar")).toEqual({ primary: "Cleaning", secondary: null });
    expect(localizedPair("  ", "Cleaning", "ar")).toEqual({ primary: "Cleaning", secondary: null });
  });
});

describe("validateService", () => {
  const base: ServiceFormValues = { ...EMPTY_SERVICE, name_ar: "تنظيف الأسنان", price: "250" };

  it("accepts a fixed price and builds the payload", () => {
    const result = validateService({ ...base, duration: "30" });
    expect(result).toEqual({
      ok: true,
      payload: {
        name_ar: "تنظيف الأسنان",
        name_en: null,
        description_ar: null,
        description_en: null,
        price_type: "fixed",
        price_sar: 250,
        duration_minutes: 30,
        is_active: true,
      },
    });
  });

  it("requires at least one name", () => {
    const result = validateService({ ...base, name_ar: "  ", name_en: "" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.name_ar?.key).toBe("knowledge.errNameRequired");
  });

  it("requires a price for fixed and starting-from", () => {
    for (const price_type of ["fixed", "starting_from"] as const) {
      const result = validateService({ ...base, price_type, price: "" });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.price?.key).toBe("knowledge.errPriceRequired");
    }
  });

  it("sends a null price for on-consultation even if a number was typed", () => {
    const result = validateService({ ...base, price_type: "on_consultation", price: "500" });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payload.price_sar).toBeNull();
  });

  it("rejects malformed and out-of-range prices", () => {
    for (const price of ["abc", "-5", "12.345", "1e3"]) {
      const result = validateService({ ...base, price });
      expect(result.ok, price).toBe(false);
      if (!result.ok) expect(result.errors.price?.key).toBe("knowledge.errPriceInvalid");
    }
    const tooHigh = validateService({ ...base, price: "1000001" });
    expect(!tooHigh.ok && tooHigh.errors.price?.key).toBe("knowledge.errPriceTooHigh");
  });

  it("accepts Arabic-Indic digits and separators", () => {
    expect(parsePrice("٢٥٠")).toBe(250);
    expect(parsePrice("١٩٩٫٥٠")).toBe(199.5);
    expect(parsePrice("1,250")).toBe(1250);
    expect(parsePrice("")).toBeNull();
  });

  it("checks the duration range (5–600 whole minutes)", () => {
    for (const duration of ["4", "601", "30.5", "x"]) {
      const result = validateService({ ...base, duration });
      expect(!result.ok && result.errors.duration?.key, duration).toBe("knowledge.errDuration");
    }
    const ok = validateService({ ...base, duration: "٤٥" });
    expect(ok.ok && ok.payload.duration_minutes).toBe(45);
  });

  it("limits name and description length", () => {
    const result = validateService({
      ...base,
      name_en: "x".repeat(121),
      description_ar: "ن".repeat(1001),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.name_en).toEqual({ key: "knowledge.errTooLong", params: { max: 120 } });
      expect(result.errors.description_ar?.params).toEqual({ max: 1000 });
    }
  });
});

describe("validateFaq", () => {
  it("accepts one complete pair and nulls the empty language", () => {
    const result = validateFaq({
      ...EMPTY_FAQ,
      question_ar: "هل يوجد موقف سيارات؟",
      answer_ar: "نعم، أمام العيادة.",
    });
    expect(result).toEqual({
      ok: true,
      payload: {
        question_ar: "هل يوجد موقف سيارات؟",
        answer_ar: "نعم، أمام العيادة.",
        question_en: null,
        answer_en: null,
        is_active: true,
      },
    });
  });

  it("requires at least one complete pair", () => {
    const result = validateFaq(EMPTY_FAQ);
    expect(!result.ok && result.errors.question_ar?.key).toBe("knowledge.errFaqPairRequired");
  });

  it("rejects half pairs in either language", () => {
    const result = validateFaq({
      ...EMPTY_FAQ,
      question_ar: "هل تقبلون التأمين؟",
      answer_ar: "نعم",
      question_en: "Do you accept insurance?",
    });
    expect(!result.ok && result.errors.answer_en?.key).toBe("knowledge.errAnswerMissing");
    const noQuestion = validateFaq({ ...EMPTY_FAQ, answer_en: "Yes" });
    expect(!noQuestion.ok && noQuestion.errors.question_en?.key).toBe(
      "knowledge.errQuestionMissing",
    );
  });

  it("enforces question 3–300 and answer up to 2000 characters", () => {
    const short = validateFaq({ ...EMPTY_FAQ, question_en: "Hi", answer_en: "Hello" });
    expect(!short.ok && short.errors.question_en?.key).toBe("knowledge.errQuestionLength");
    const long = validateFaq({
      ...EMPTY_FAQ,
      question_en: "Parking?",
      answer_en: "x".repeat(2001),
    });
    expect(!long.ok && long.errors.answer_en?.key).toBe("knowledge.errTooLong");
  });
});

describe("faqDisplay", () => {
  const faq = {
    question_ar: "هل يوجد موقف؟",
    answer_ar: "نعم",
    question_en: "Is there parking?",
    answer_en: "Yes",
  };

  it("shows the pair in the current language", () => {
    expect(faqDisplay(faq, "en")).toMatchObject({ question: "Is there parking?", answer: "Yes" });
    expect(faqDisplay(faq, "ar")).toMatchObject({ question: "هل يوجد موقف؟", answer: "نعم" });
  });

  it("never mixes a question from one language with an answer from the other", () => {
    const half = { ...faq, answer_ar: null };
    expect(faqDisplay(half, "ar")).toMatchObject({ question: "Is there parking?", answer: "Yes" });
  });
});

describe("ordering", () => {
  it("places new items after existing ones", () => {
    expect(nextSortOrder([])).toBe(0);
    expect(
      nextSortOrder([
        { id: "a", sort_order: 3 },
        { id: "b", sort_order: 1 },
      ]),
    ).toBe(4);
  });

  it("swaps neighbours and returns only the rows that change", () => {
    const items = [
      { id: "a", sort_order: 0 },
      { id: "b", sort_order: 1 },
      { id: "c", sort_order: 2 },
    ];
    expect(reorderUpdates(items, 2, -1)).toEqual([
      { id: "c", sort_order: 1 },
      { id: "b", sort_order: 2 },
    ]);
  });

  it("repairs duplicate positions (every row starts at 0)", () => {
    const items = [
      { id: "a", sort_order: 0 },
      { id: "b", sort_order: 0 },
      { id: "c", sort_order: 0 },
    ];
    expect(reorderUpdates(items, 0, 1)).toEqual([
      { id: "a", sort_order: 1 },
      { id: "c", sort_order: 2 },
    ]);
  });

  it("does nothing at the edges", () => {
    const items = [{ id: "a", sort_order: 0 }];
    expect(reorderUpdates(items, 0, -1)).toEqual([]);
    expect(reorderUpdates(items, 0, 1)).toEqual([]);
  });
});

describe("parseWorkingHours", () => {
  it("reads valid ranges and treats anything else as closed", () => {
    const hours = parseWorkingHours({
      sat: [
        ["09:00", "13:00"],
        ["16:00", "21:00"],
      ],
      sun: [["9am", "5pm"]],
      fri: [],
      xyz: [["09:00", "10:00"]],
    });
    expect(hours.sat).toEqual([
      ["09:00", "13:00"],
      ["16:00", "21:00"],
    ]);
    expect(hours.sun).toEqual([]);
    expect(hours.mon).toEqual([]);
    expect(Object.keys(hours)).toEqual(["sat", "sun", "mon", "tue", "wed", "thu", "fri"]);
    expect(parseWorkingHours(null).thu).toEqual([]);
  });
});
