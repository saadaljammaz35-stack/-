import { z } from "zod";
import type { Enums } from "@/lib/database.types";

export type PlanId = Enums<"subscription_plan">;
export type SubscriptionStatus = Enums<"subscription_status">;

const PLAN_IDS = ["starter", "growth", "pro"] as const satisfies readonly PlanId[];
const STATUSES = [
  "trialing",
  "active",
  "past_due",
  "cancelled",
  "expired",
] as const satisfies readonly SubscriptionStatus[];

/** What rpc org_entitlements returns, with safe defaults for anything missing. */
export interface Entitlements {
  plan: PlanId | null;
  status: SubscriptionStatus | null;
  isActive: boolean;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  aiRepliesLimit: number;
  aiRepliesUsed: number;
  aiRepliesRemaining: number;
  /** Null when the clinic has no subscription record (then no seat limit applies). */
  seatsLimit: number | null;
  seatsUsed: number;
}

const count = z.number().int().nonnegative().catch(0);
const optionalCount = z.number().int().nonnegative().nullable().catch(null);
const timestamp = z.string().nullable().catch(null);

const entitlementsSchema = z.object({
  plan: z.enum(PLAN_IDS).nullable().catch(null),
  status: z.enum(STATUSES).nullable().catch(null),
  is_active: z.boolean().catch(false),
  trial_ends_at: timestamp,
  current_period_end: timestamp,
  ai_replies_limit: count,
  ai_replies_used: count,
  ai_replies_remaining: count,
  seats_limit: optionalCount,
  seats_used: count,
});

/**
 * Parses the jsonb from rpc org_entitlements. Missing or malformed fields fall
 * back to "nothing granted" (inactive, zero allowance), never to a made-up value.
 */
export function parseEntitlements(raw: unknown): Entitlements {
  const source = typeof raw === "object" && raw !== null && !Array.isArray(raw) ? raw : {};
  const data = entitlementsSchema.parse({
    plan: null,
    status: null,
    is_active: false,
    trial_ends_at: null,
    current_period_end: null,
    ai_replies_limit: 0,
    ai_replies_used: 0,
    ai_replies_remaining: 0,
    seats_limit: null,
    seats_used: 0,
    ...source,
  });
  return {
    plan: data.plan,
    status: data.status,
    isActive: data.is_active,
    trialEndsAt: data.trial_ends_at,
    currentPeriodEnd: data.current_period_end,
    aiRepliesLimit: data.ai_replies_limit,
    aiRepliesUsed: data.ai_replies_used,
    aiRepliesRemaining: data.ai_replies_remaining,
    seatsLimit: data.seats_limit,
    seatsUsed: data.seats_used,
  };
}

const DAY_MS = 86_400_000;

/**
 * Whole days left until `end`, rounded up: 3.2 days left → 4, 2 hours left → 1.
 * 0 once the moment has passed; null when there is no (valid) end date.
 */
export function daysLeft(
  end: string | Date | null | undefined,
  now: Date = new Date(),
): number | null {
  if (end === null || end === undefined) return null;
  const endMs = end instanceof Date ? end.getTime() : Date.parse(end);
  if (Number.isNaN(endMs)) return null;
  const remaining = endMs - now.getTime();
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / DAY_MS);
}

/**
 * How the clinic's subscription should be described. A trial whose end date
 * has passed is "trial_ended" even while the stored status still says trialing.
 */
export type PlanState =
  "none" | "trial" | "trial_ended" | "active" | "past_due" | "cancelled" | "expired";

export function planState(
  status: SubscriptionStatus | null,
  trialEndsAt: string | null,
  now: Date = new Date(),
): PlanState {
  switch (status) {
    case null:
      return "none";
    case "trialing":
      return daysLeft(trialEndsAt, now) ? "trial" : "trial_ended";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "cancelled":
      return "cancelled";
    case "expired":
      return "expired";
  }
}

/** Fraction of an allowance used, clamped to 0…1. A zero allowance with any use counts as full. */
export function usageRatio(used: number, limit: number | null): number {
  if (limit === null) return 0;
  if (limit <= 0) return used > 0 ? 1 : 0;
  return Math.min(1, Math.max(0, used / limit));
}

export type UsageLevel = "ok" | "high" | "full";

/** "high" from 80% so people see it coming; "full" when nothing is left. */
export function usageLevel(used: number, limit: number | null): UsageLevel {
  if (limit === null) return "ok";
  if (used >= limit) return "full";
  return usageRatio(used, limit) >= 0.8 ? "high" : "ok";
}

/** The trial allowance in rpc org_entitlements: a trial gets at most 300 AI replies a month. */
export const TRIAL_AI_REPLY_CAP = 300;

/** A plan's name in the interface language. */
export function planName(plan: { name_ar: string; name_en: string }, lang: "ar" | "en"): string {
  return lang === "ar" ? plan.name_ar : plan.name_en;
}
