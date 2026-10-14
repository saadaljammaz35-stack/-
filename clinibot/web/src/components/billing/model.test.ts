import { describe, expect, it } from "vitest";
import { daysLeft, parseEntitlements, planState, usageLevel, usageRatio } from "./model";

const NOW = new Date("2026-10-13T09:00:00Z");

describe("daysLeft", () => {
  it("rounds partial days up", () => {
    expect(daysLeft("2026-10-16T13:48:00Z", NOW)).toBe(4); // 3.2 days
    expect(daysLeft("2026-10-13T11:00:00Z", NOW)).toBe(1); // 2 hours
    expect(daysLeft("2026-10-27T09:00:00Z", NOW)).toBe(14); // exactly 14 days
  });

  it("is 0 once the end has passed or is now", () => {
    expect(daysLeft("2026-10-13T09:00:00Z", NOW)).toBe(0);
    expect(daysLeft("2026-10-01T00:00:00Z", NOW)).toBe(0);
  });

  it("is null without a valid end date", () => {
    expect(daysLeft(null, NOW)).toBeNull();
    expect(daysLeft(undefined, NOW)).toBeNull();
    expect(daysLeft("not a date", NOW)).toBeNull();
  });

  it("accepts Date objects", () => {
    expect(daysLeft(new Date("2026-10-14T09:00:00Z"), NOW)).toBe(1);
  });
});

describe("planState", () => {
  it("separates a running trial from one that has ended", () => {
    expect(planState("trialing", "2026-10-20T00:00:00Z", NOW)).toBe("trial");
    expect(planState("trialing", "2026-10-10T00:00:00Z", NOW)).toBe("trial_ended");
    expect(planState("trialing", null, NOW)).toBe("trial_ended");
  });

  it("passes other statuses through and reports no subscription", () => {
    expect(planState("active", null, NOW)).toBe("active");
    expect(planState("past_due", null, NOW)).toBe("past_due");
    expect(planState("cancelled", null, NOW)).toBe("cancelled");
    expect(planState("expired", null, NOW)).toBe("expired");
    expect(planState(null, null, NOW)).toBe("none");
  });
});

describe("parseEntitlements", () => {
  it("maps the rpc payload", () => {
    expect(
      parseEntitlements({
        plan: "starter",
        status: "trialing",
        is_active: true,
        trial_ends_at: "2026-10-26T10:00:00+00:00",
        current_period_end: null,
        ai_replies_limit: 300,
        ai_replies_used: 42,
        ai_replies_remaining: 258,
        seats_limit: 3,
        seats_used: 2,
      }),
    ).toEqual({
      plan: "starter",
      status: "trialing",
      isActive: true,
      trialEndsAt: "2026-10-26T10:00:00+00:00",
      currentPeriodEnd: null,
      aiRepliesLimit: 300,
      aiRepliesUsed: 42,
      aiRepliesRemaining: 258,
      seatsLimit: 3,
      seatsUsed: 2,
    });
  });

  it("falls back to nothing granted for a clinic without a subscription", () => {
    const parsed = parseEntitlements({
      plan: null,
      status: null,
      is_active: false,
      seats_limit: null,
      seats_used: 1,
      ai_replies_limit: 0,
      ai_replies_used: 0,
      ai_replies_remaining: 0,
    });
    expect(parsed.plan).toBeNull();
    expect(parsed.isActive).toBe(false);
    expect(parsed.seatsLimit).toBeNull();
    expect(parsed.seatsUsed).toBe(1);
  });

  it("never invents values from malformed input", () => {
    const parsed = parseEntitlements({ plan: "enterprise", is_active: "yes", seats_used: -1 });
    expect(parsed.plan).toBeNull();
    expect(parsed.isActive).toBe(false);
    expect(parsed.seatsUsed).toBe(0);
    expect(parseEntitlements(null).aiRepliesLimit).toBe(0);
    expect(parseEntitlements([1, 2]).status).toBeNull();
  });
});

describe("usage helpers", () => {
  it("computes a clamped ratio", () => {
    expect(usageRatio(50, 200)).toBe(0.25);
    expect(usageRatio(500, 200)).toBe(1);
    expect(usageRatio(0, 0)).toBe(0);
    expect(usageRatio(3, 0)).toBe(1);
    expect(usageRatio(3, null)).toBe(0);
  });

  it("flags high and full usage", () => {
    expect(usageLevel(10, 100)).toBe("ok");
    expect(usageLevel(80, 100)).toBe("high");
    expect(usageLevel(100, 100)).toBe("full");
    expect(usageLevel(3, 3)).toBe("full");
    expect(usageLevel(5, null)).toBe("ok");
  });
});
