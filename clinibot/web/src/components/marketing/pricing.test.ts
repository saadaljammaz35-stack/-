import { describe, expect, it } from "vitest";
import { normalizePlans, planName, trialTerms } from "./pricing";

const row = (overrides: Record<string, unknown>) => ({
  plan: "starter",
  name_ar: "الأساسية",
  name_en: "Starter",
  monthly_price_sar: 299,
  ai_replies_per_month: 1000,
  seats: 3,
  sort_order: 1,
  ...overrides,
});

describe("normalizePlans", () => {
  it("sorts by sort_order and maps the columns", () => {
    const plans = normalizePlans([
      row({ plan: "pro", name_en: "Pro", sort_order: 3 }),
      row({}),
      row({ plan: "growth", name_en: "Growth", sort_order: 2 }),
    ]);
    expect(plans.map((plan) => plan.plan)).toEqual(["starter", "growth", "pro"]);
    expect(plans[0]).toEqual({
      plan: "starter",
      nameAr: "الأساسية",
      nameEn: "Starter",
      monthlyPriceSar: 299,
      aiRepliesPerMonth: 1000,
      seats: 3,
      sortOrder: 1,
    });
  });

  it("accepts numeric columns sent as strings", () => {
    expect(normalizePlans([row({ monthly_price_sar: "699.00" })])[0]?.monthlyPriceSar).toBe(699);
  });

  it("drops rows it cannot show truthfully instead of filling in values", () => {
    expect(
      normalizePlans([
        row({ monthly_price_sar: null }),
        row({ name_ar: "" }),
        row({ seats: 0 }),
        row({ ai_replies_per_month: "lots" }),
        null,
      ]),
    ).toEqual([]);
    expect(normalizePlans(null)).toEqual([]);
    expect(normalizePlans({})).toEqual([]);
  });
});

describe("planName", () => {
  it("uses the name for the current language", () => {
    const [plan] = normalizePlans([row({})]);
    expect(planName(plan!, "ar")).toBe("الأساسية");
    expect(planName(plan!, "en")).toBe("Starter");
  });
});

describe("trialTerms", () => {
  it("uses the starter plan's seats and caps replies at the trial limit", () => {
    const plans = normalizePlans([
      row({ plan: "pro", seats: 12, ai_replies_per_month: 15000, sort_order: 3 }),
      row({}),
    ]);
    expect(trialTerms(plans)).toMatchObject({ seats: 3, replies: 300 });
    expect(trialTerms(plans)?.plan.plan).toBe("starter");
    expect(trialTerms(normalizePlans([row({ ai_replies_per_month: 200 })]))?.replies).toBe(200);
  });

  it("is null when the trial plan isn't loaded", () => {
    expect(trialTerms([])).toBeNull();
    expect(trialTerms(normalizePlans([row({ plan: "growth" })]))).toBeNull();
  });
});
