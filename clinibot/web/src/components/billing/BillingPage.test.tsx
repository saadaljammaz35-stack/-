import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberRole } from "@/org/context";
import { renderWithProviders } from "@/test/render";

const ORG_ID = "22222222-2222-4222-8222-222222222222";

interface Call {
  table: string;
  steps: [string, ...unknown[]][];
}

const calls: Call[] = [];
const tables: Record<string, unknown> = {};
let entitlements: unknown = null;

/** A chainable stand-in for supabase.from(): records each step, resolves with tables[table]. */
function from(table: string) {
  const call: Call = { table, steps: [] };
  calls.push(call);
  const result = () => Promise.resolve({ data: tables[table] ?? null, error: null });
  const chain: Record<string, unknown> = {};
  for (const step of ["select", "eq", "in", "lt", "order", "limit", "update"]) {
    chain[step] = (...args: unknown[]) => {
      call.steps.push([step, ...args]);
      return chain;
    };
  }
  chain.maybeSingle = result;
  chain.single = result;
  chain.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
    result().then(resolve, reject);
  return chain;
}

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => from(table),
    rpc: (name: string) =>
      Promise.resolve({ data: name === "org_entitlements" ? entitlements : null, error: null }),
  },
}));

const { default: BillingPage } = await import("@/pages/app/BillingPage");

const PLANS = [
  { plan: "starter", name_ar: "الأساسية", name_en: "Starter", monthly_price_sar: 299, ai_replies_per_month: 1000, seats: 3, sort_order: 1 },
  { plan: "growth", name_ar: "النمو", name_en: "Growth", monthly_price_sar: 699, ai_replies_per_month: 5000, seats: 6, sort_order: 2 },
  { plan: "pro", name_ar: "الاحترافية", name_en: "Pro", monthly_price_sar: 1499, ai_replies_per_month: 15000, seats: 15, sort_order: 3 },
];

function renderAs(role: MemberRole, lang: "ar" | "en" = "en") {
  const org = { id: ORG_ID, name: "Smile Clinic", slug: "smile", defaultLanguage: "ar" as const, role };
  return renderWithProviders(<BillingPage />, {
    route: "/app/billing",
    lang,
    org: { current: org, orgs: [org], role },
  });
}

describe("BillingPage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-13T09:00:00Z"));
    calls.length = 0;
    tables.plan_limits = PLANS;
    tables.subscription_records = {
      id: "s1",
      plan: "starter",
      status: "trialing",
      trial_ends_at: "2026-10-20T12:00:00Z",
      current_period_start: null,
      current_period_end: null,
      created_at: "2026-10-06T12:00:00Z",
    };
    tables.ai_usage_monthly = [
      { month: "2026-10-01", replies: 120, test_replies: 6, input_tokens: 345678, output_tokens: 23456 },
    ];
    entitlements = {
      plan: "starter",
      status: "trialing",
      is_active: true,
      trial_ends_at: "2026-10-20T12:00:00Z",
      current_period_end: null,
      ai_replies_limit: 300,
      ai_replies_used: 126,
      ai_replies_remaining: 174,
      seats_limit: 3,
      seats_used: 2,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the trial, usage and an honest payments notice without any checkout", async () => {
    renderAs("owner");
    expect(await screen.findByText("Trial ends on 20 Oct 2026")).toBeInTheDocument();
    expect(screen.getByText("Days left: 8")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "AI replies this month" })).toHaveAttribute(
      "aria-valuetext",
      "126 of 300",
    );
    expect(screen.getByText(/capped at 300 a month/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Online payment isn't available yet" })).toBeInTheDocument();
    expect(screen.getByText("We never ask for your card details inside the app.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contact the CliniBot team" })).toHaveAttribute(
      "href",
      "/#contact",
    );
    // No way to pay or upgrade inside the app.
    for (const name of [/upgrade/i, /checkout/i, /pay now/i, /subscribe/i, /buy/i]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
  });

  it("lists plans with SAR prices excluding VAT and marks the current one", async () => {
    renderAs("owner", "ar");
    const plans = await screen.findByRole("heading", { name: "الباقات" });
    const section = plans.closest("section")!;
    expect(await within(section).findByText("299 ر.س")).toBeInTheDocument();
    expect(within(section).getByText("1,499 ر.س")).toBeInTheDocument();
    const current = within(section).getByText("باقتك الحالية").closest("li")!;
    expect(within(current).getByText("الأساسية")).toBeInTheDocument();
  });

  it("shows monthly usage history scoped to the clinic", async () => {
    renderAs("admin");
    expect(await screen.findAllByText("345,678")).not.toHaveLength(0);
    const usage = calls.find((call) => call.table === "ai_usage_monthly")!;
    expect(usage.steps).toContainEqual(["eq", "organization_id", ORG_ID]);
    const subscription = calls.find((call) => call.table === "subscription_records")!;
    expect(subscription.steps).toContainEqual(["eq", "organization_id", ORG_ID]);
  });

  it("explains an ended trial", async () => {
    tables.subscription_records = {
      ...(tables.subscription_records as object),
      trial_ends_at: "2026-10-10T12:00:00Z",
    };
    renderAs("owner");
    expect(await screen.findByText(/Your trial ended on 10 Oct 2026/)).toBeInTheDocument();
    expect(screen.getAllByText("Trial ended").length).toBeGreaterThan(0);
  });

  it("gives receptionists a notice instead of billing data", () => {
    renderAs("receptionist");
    expect(screen.getByText("Billing is for owners and admins")).toBeInTheDocument();
    expect(calls.some((call) => call.table === "subscription_records")).toBe(false);
  });
});
