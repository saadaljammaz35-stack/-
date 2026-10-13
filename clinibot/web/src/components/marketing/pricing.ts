import type { Lang } from "@/i18n";

/** A public plan row from `plan_limits` (readable by anonymous visitors). */
export interface Plan {
  plan: string;
  nameAr: string;
  nameEn: string;
  monthlyPriceSar: number;
  aiRepliesPerMonth: number;
  seats: number;
  sortOrder: number;
}

export const PLAN_COLUMNS =
  "plan,name_ar,name_en,monthly_price_sar,ai_replies_per_month,seats,sort_order";

export const PLANS_QUERY_KEY = ["public", "plan_limits"] as const;

function toNumber(value: unknown): number | null {
  const number = typeof value === "string" ? Number(value) : value;
  return typeof number === "number" && Number.isFinite(number) ? number : null;
}

function toText(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/**
 * Turns rows from the database into plans, sorted by sort_order. Rows with a
 * missing name or an invalid number are dropped rather than shown with made-up
 * values. (numeric columns can arrive as strings, so both are accepted.)
 */
export function normalizePlans(rows: unknown): Plan[] {
  if (!Array.isArray(rows)) return [];
  const plans: Plan[] = [];
  for (const row of rows as Array<Record<string, unknown> | null>) {
    if (!row || typeof row !== "object") continue;
    const plan = toText(row.plan);
    const nameAr = toText(row.name_ar);
    const nameEn = toText(row.name_en);
    const price = toNumber(row.monthly_price_sar);
    const replies = toNumber(row.ai_replies_per_month);
    const seats = toNumber(row.seats);
    const sortOrder = toNumber(row.sort_order) ?? 0;
    if (!plan || !nameAr || !nameEn || price === null || replies === null || seats === null)
      continue;
    if (price < 0 || replies <= 0 || seats <= 0) continue;
    plans.push({
      plan,
      nameAr,
      nameEn,
      monthlyPriceSar: price,
      aiRepliesPerMonth: replies,
      seats,
      sortOrder,
    });
  }
  return plans.sort((a, b) => a.sortOrder - b.sortOrder || a.plan.localeCompare(b.plan));
}

export function planName(plan: Plan, lang: Lang): string {
  return lang === "ar" ? plan.nameAr : plan.nameEn;
}

/**
 * Loads the plans. The Supabase client is imported on demand so the landing
 * page paints without it.
 */
export async function fetchPlans(): Promise<Plan[]> {
  const { supabase } = await import("@/lib/supabase");
  const { data, error } = await supabase
    .from("plan_limits")
    .select(PLAN_COLUMNS)
    .order("sort_order");
  if (error) throw error;
  return normalizePlans(data);
}
