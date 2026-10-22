import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/apiError";
import {
  ASSISTANT_STATE_VIEW,
  OUTCOME_VIEW,
  assistantCanReply,
  assistantState,
  buildTestMessages,
  canEnableAssistant,
  classifyTestError,
  parseSystemStatus,
  parseTestResult,
  patientChatUrl,
  validateAssistantSettings,
  type AiStatus,
  type ChatTurn,
  type Entitlements,
  type SystemStatus,
} from "./model";

const NOW = new Date("2026-10-13T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

const ai = (overrides: Partial<AiStatus> = {}): AiStatus => ({
  configured: true,
  model: "claude-opus-5-5",
  enabled: false,
  lastTestAt: null,
  lastTestOk: null,
  ...overrides,
});

const plan = (overrides: Partial<Entitlements> = {}): Entitlements => ({
  isActive: true,
  plan: "starter",
  status: "trialing",
  aiLimit: 300,
  aiUsed: 12,
  aiRemaining: 288,
  ...overrides,
});
const PLAN = plan();

describe("parseSystemStatus", () => {
  it("reads the documented shape", () => {
    const status = parseSystemStatus({
      role: "owner",
      ai: {
        configured: true,
        model: "claude-opus-5-5",
        enabled: true,
        last_test_at: daysAgo(1),
        last_test_ok: true,
      },
      whatsapp: {
        status: "connected",
        display_phone_number: "+966 55 000 0000",
        verified_name: "Clinic",
        credentials_verified_at: daysAgo(3),
        webhook_verified_at: daysAgo(2),
        last_inbound_at: null,
        last_error: null,
        webhook_url: "https://x.supabase.co/functions/v1/whatsapp-webhook/abc",
      },
      encryption_configured: true,
      entitlements: {
        is_active: true,
        plan: "starter",
        ai_replies_limit: 300,
        ai_replies_used: 12,
        ai_replies_remaining: 288,
      },
    });
    expect(status.ai).toEqual({
      configured: true,
      model: "claude-opus-5-5",
      enabled: true,
      lastTestAt: daysAgo(1),
      lastTestOk: true,
    });
    expect(status.whatsapp.status).toBe("connected");
    expect(status.whatsapp.webhookUrl).toContain("whatsapp-webhook");
    expect(status.entitlements).toMatchObject({ isActive: true, aiLimit: 300, aiUsed: 12 });
  });

  it("treats anything missing or unknown as not configured / disconnected", () => {
    const status = parseSystemStatus({ whatsapp: { status: "connected-ish" } });
    expect(status.ai.configured).toBe(false);
    expect(status.ai.enabled).toBe(false);
    expect(status.whatsapp.status).toBe("disconnected");
    expect(status.whatsapp.lastError).toBeNull();
    expect(status.encryptionConfigured).toBe(false);
    expect(status.entitlements).toBeNull();
    expect(parseSystemStatus(null).ai.lastTestOk).toBeNull();
  });
});

describe("assistantState", () => {
  it("is never active unless enabled AND the last test passed", () => {
    expect(
      assistantState(ai({ enabled: true, lastTestOk: true, lastTestAt: daysAgo(1) }), PLAN, NOW),
    ).toBe("active");
    expect(
      assistantState(ai({ enabled: true, lastTestOk: false, lastTestAt: daysAgo(1) }), PLAN, NOW),
    ).toBe("enabled_failing");
    expect(assistantState(ai({ enabled: true, lastTestOk: null }), PLAN, NOW)).toBe(
      "enabled_failing",
    );
    expect(
      assistantState(ai({ enabled: false, lastTestOk: true, lastTestAt: daysAgo(1) }), PLAN, NOW),
    ).toBe("ready");
  });

  it("is not active when the plan stops the replies (as the server does)", () => {
    const on = ai({ enabled: true, lastTestOk: true, lastTestAt: daysAgo(1) });
    // The trial ended: org_entitlements reports is_active = false.
    expect(assistantState(on, plan({ isActive: false, status: "expired" }), NOW)).toBe(
      "enabled_blocked",
    );
    expect(assistantState(on, plan({ aiUsed: 300, aiRemaining: 0 }), NOW)).toBe("enabled_blocked");
    // Unreadable entitlements count as inactive on the server.
    expect(assistantState(on, null, NOW)).toBe("enabled_blocked");
    // The plan wins over a failed test: testing can't fix a blocked plan.
    expect(
      assistantState(ai({ enabled: true, lastTestOk: false }), plan({ isActive: false }), NOW),
    ).toBe("enabled_blocked");
    expect(ASSISTANT_STATE_VIEW.enabled_blocked.tone).toBe("warning");
  });

  it("reports a missing AI key before anything else", () => {
    expect(
      assistantState(
        ai({ configured: false, enabled: true, lastTestOk: true, lastTestAt: daysAgo(1) }),
        PLAN,
        NOW,
      ),
    ).toBe("not_configured");
  });

  it("distinguishes untested, failed and expired tests", () => {
    expect(assistantState(ai(), PLAN, NOW)).toBe("not_tested");
    expect(assistantState(ai({ lastTestOk: false, lastTestAt: daysAgo(1) }), PLAN, NOW)).toBe(
      "test_failed",
    );
    // A failure never records a time, so a first-ever failure has none.
    expect(assistantState(ai({ lastTestOk: false, lastTestAt: null }), PLAN, NOW)).toBe(
      "test_failed",
    );
    expect(assistantState(ai({ lastTestOk: true, lastTestAt: daysAgo(31) }), PLAN, NOW)).toBe(
      "test_expired",
    );
  });

  it("maps every state to a label and tone; only 'active' is a success", () => {
    const successes = Object.entries(ASSISTANT_STATE_VIEW)
      .filter(([, view]) => view.tone === "success")
      .map(([state]) => state);
    expect(successes).toEqual(["active"]);
  });
});

describe("assistantCanReply", () => {
  const status = (aiOverrides: Partial<AiStatus>, entitlements: Entitlements | null = PLAN) =>
    ({
      ai: ai({ configured: true, enabled: true, ...aiOverrides }),
      whatsapp: { status: "connected" },
      encryptionConfigured: true,
      entitlements,
    }) as SystemStatus;

  it("needs the AI key, the switch and a plan with replies left", () => {
    expect(assistantCanReply(status({}))).toBe(true);
    expect(assistantCanReply(status({ configured: false }))).toBe(false);
    expect(assistantCanReply(status({ enabled: false }))).toBe(false);
    expect(assistantCanReply(status({}, plan({ isActive: false })))).toBe(false);
    expect(assistantCanReply(status({}, plan({ aiRemaining: 0 })))).toBe(false);
    expect(assistantCanReply(status({}, null))).toBe(false);
  });

  it("is unknown while the status hasn't loaded", () => {
    expect(assistantCanReply(undefined)).toBeNull();
  });
});

describe("canEnableAssistant", () => {
  it("requires a configured key and a passing test in the last 30 days", () => {
    expect(canEnableAssistant(ai({ lastTestOk: true, lastTestAt: daysAgo(29) }), NOW)).toBe(true);
    expect(canEnableAssistant(ai({ lastTestOk: true, lastTestAt: daysAgo(30.5) }), NOW)).toBe(
      false,
    );
    expect(canEnableAssistant(ai({ lastTestOk: false, lastTestAt: daysAgo(1) }), NOW)).toBe(false);
    expect(
      canEnableAssistant(ai({ configured: false, lastTestOk: true, lastTestAt: daysAgo(1) }), NOW),
    ).toBe(false);
  });
});

describe("buildTestMessages", () => {
  const turn = (index: number, role: "user" | "assistant", content = `m${index}`): ChatTurn => ({
    id: String(index),
    role,
    content,
  });

  it("sends at most the last 20 messages and starts with the user", () => {
    const turns = Array.from({ length: 25 }, (_, index) =>
      turn(index, index % 2 === 0 ? "user" : "assistant"),
    );
    const messages = buildTestMessages(turns);
    expect(messages.length).toBeLessThanOrEqual(20);
    expect(messages[0]?.role).toBe("user");
    expect(messages.at(-1)).toEqual({ role: "user", content: "m24" });
  });

  it("trims messages to 1000 characters and drops empty ones", () => {
    const messages = buildTestMessages([
      turn(1, "user", "x".repeat(1500)),
      turn(2, "assistant", "   "),
      turn(3, "user", " hi "),
    ]);
    expect(messages).toEqual([
      { role: "user", content: "x".repeat(1000) },
      { role: "user", content: "hi" },
    ]);
  });
});

describe("parseTestResult", () => {
  it("reads the reply, outcome, handoff, appointment and usage", () => {
    const result = parseTestResult({
      reply: "أهلاً",
      outcome: "handoff",
      handoff: { reason: "medical_question", summary: "Tooth pain" },
      appointment_request: {
        customer_name: "سارة",
        service_id: "s1",
        preferred_date: "2026-10-18",
        preferred_time_window: "morning",
        saved: false,
      },
      model: "claude-opus-5-5",
      usage: { input_tokens: 1200, output_tokens: 80, cache_read_input_tokens: 1000 },
    });
    expect(result.outcome).toBe("handoff");
    expect(result.handoff).toEqual({ reason: "medical_question", summary: "Tooth pain" });
    expect(result.appointment).toEqual({
      customerName: "سارة",
      serviceId: "s1",
      preferredDate: "2026-10-18",
      preferredTimeWindow: "morning",
    });
    expect(result.usage).toEqual({ input: 1200, output: 80, cacheRead: 1000 });
  });

  it("never presents an unknown outcome as a success", () => {
    expect(parseTestResult({ reply: "?", outcome: "great" }).outcome).toBe("refused");
    expect(OUTCOME_VIEW.refused.tone).not.toBe("success");
  });
});

describe("classifyTestError", () => {
  const api = (status: number, code: string, details?: unknown) =>
    new ApiError({ status, code, message: code, details });

  it("maps the documented assistant-test errors", () => {
    expect(classifyTestError(api(503, "not_configured"))).toBe("not_configured");
    expect(classifyTestError(api(409, "subscription_inactive"))).toBe("billing");
    expect(classifyTestError(api(409, "ai_quota_exhausted"))).toBe("billing");
    expect(classifyTestError(api(502, "upstream_error"))).toBe("upstream");
    expect(classifyTestError(api(429, "rate_limited"))).toBe("rate_limited");
    expect(classifyTestError(api(403, "insufficient_role"))).toBe("forbidden");
    expect(classifyTestError(api(500, "internal_error"))).toBe("other");
    expect(classifyTestError(api(0, "timeout"))).toBe("timeout");
    expect(classifyTestError(api(504, "upstream_error"))).toBe("timeout");
    expect(classifyTestError(api(0, "network_error"))).toBe("other");
  });

  it("tells a rejected platform key apart from other provider errors", () => {
    const rejected = { provider: "anthropic", reason: "api_key_rejected" };
    expect(classifyTestError(api(502, "upstream_error", rejected))).toBe("key_rejected");
    const other = { provider: "anthropic", reason: "provider_error" };
    expect(classifyTestError(api(502, "upstream_error", other))).toBe("upstream");
    expect(classifyTestError(api(502, "upstream_error", null))).toBe("upstream");
  });
});

describe("validateAssistantSettings", () => {
  const values = {
    assistant_name: " سند ",
    assistant_tone: "friendly" as const,
    welcome_message_ar: "",
    welcome_message_en: "Welcome!",
    extra_instructions: "",
    emergency_number: "٩٩٧",
  };

  it("trims, nulls empty text and normalises the emergency number", () => {
    expect(validateAssistantSettings(values)).toEqual({
      ok: true,
      payload: {
        assistant_name: "سند",
        assistant_tone: "friendly",
        welcome_message_ar: null,
        welcome_message_en: "Welcome!",
        extra_instructions: null,
        emergency_number: "997",
      },
    });
  });

  it("enforces the database limits", () => {
    const result = validateAssistantSettings({
      ...values,
      assistant_name: "x".repeat(41),
      welcome_message_ar: "x".repeat(501),
      extra_instructions: "x".repeat(2001),
      emergency_number: "99",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual([
        "assistant_name",
        "emergency_number",
        "extra_instructions",
        "welcome_message_ar",
      ]);
    }
    expect(validateAssistantSettings({ ...values, assistant_name: "   " }).ok).toBe(false);
  });
});

describe("patientChatUrl", () => {
  it("builds the /c/<slug> link", () => {
    expect(patientChatUrl("https://app.clinibot.sa/", "smile-dental")).toBe(
      "https://app.clinibot.sa/c/smile-dental",
    );
  });
});
