import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as ApiModule from "@/lib/api";
import { ApiError } from "@/lib/apiError";
import type { MemberRole } from "@/org/context";
import { renderWithProviders } from "@/test/render";
import type { createFakeSupabase } from "@/components/knowledge/fakeSupabase";

const ORG_ID = "55555555-5555-4555-8555-555555555555";
const NOW = new Date("2026-10-13T09:00:00Z");

const fake = vi.hoisted(() => ({ current: null as ReturnType<typeof createFakeSupabase> | null }));
vi.mock("@/lib/supabase", async () => {
  const { createFakeSupabase: create } = await import("@/components/knowledge/fakeSupabase");
  fake.current = create();
  return { supabase: fake.current.client };
});

const callFunction = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  callFunction: (...args: unknown[]) => callFunction(...args) as unknown,
}));

const { default: AssistantPage } = await import("@/pages/app/AssistantPage");

interface Ai {
  configured: boolean;
  enabled: boolean;
  last_test_at: string | null;
  last_test_ok: boolean | null;
}

function systemStatus(ai: Partial<Ai>, entitlements: Record<string, unknown> = {}) {
  return {
    role: "owner",
    ai: {
      configured: true,
      model: "claude-opus-5-5",
      enabled: false,
      last_test_at: null,
      last_test_ok: null,
      ...ai,
    },
    whatsapp: { status: "disconnected" },
    encryption_configured: true,
    entitlements: {
      plan: "starter",
      status: "trialing",
      is_active: true,
      ai_replies_limit: 300,
      ai_replies_used: 12,
      ai_replies_remaining: 288,
      ...entitlements,
    },
  };
}

function settingsRow(overrides: Record<string, unknown> = {}) {
  return {
    assistant_name: "Noura",
    assistant_tone: "friendly",
    welcome_message_ar: null,
    welcome_message_en: null,
    extra_instructions: null,
    emergency_number: "997",
    assistant_enabled: false,
    public_chat_enabled: false,
    ai_last_test_at: null,
    ai_last_test_ok: null,
    ...overrides,
  };
}

let currentStatus = systemStatus({});

function renderAs(role: MemberRole) {
  const org = {
    id: ORG_ID,
    name: "Smile Clinic",
    slug: "smile",
    defaultLanguage: "ar" as const,
    role,
  };
  return renderWithProviders(<AssistantPage />, {
    route: "/app/assistant",
    lang: "en",
    org: { current: org, orgs: [org], role },
  });
}

function db() {
  if (!fake.current) throw new Error("supabase mock not initialised");
  return fake.current;
}

describe("AssistantPage", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    db().reset();
    db().tables.clinic_settings = settingsRow();
    db().tables.clinic_services = [];
    callFunction.mockReset();
    currentStatus = systemStatus({});
    callFunction.mockImplementation((name: string) =>
      name === "system-status" ? Promise.resolve(currentStatus) : Promise.reject(new Error(name)),
    );
  });

  it("explains how to configure the AI when the key is missing, and keeps the switch off", async () => {
    currentStatus = systemStatus({ configured: false });
    renderAs("owner");
    expect(await screen.findByRole("heading", { name: "AI isn't set up yet" })).toBeInTheDocument();
    expect(screen.getAllByText("ANTHROPIC_API_KEY").length).toBeGreaterThan(0);
    expect(screen.getAllByText("docs/DEPLOYMENT.md").length).toBeGreaterThan(0);
    expect(
      await screen.findByRole("switch", { name: "Assistant replies to patients" }),
    ).toBeDisabled();
  });

  it("never reports the assistant as active when the last test failed", async () => {
    currentStatus = systemStatus({
      enabled: true,
      last_test_ok: false,
      last_test_at: "2026-10-12T09:00:00Z",
    });
    renderAs("owner");
    expect(await screen.findByText("On, but the last test didn't succeed")).toBeInTheDocument();
    expect(screen.queryByText("On and replying to patients")).not.toBeInTheDocument();
  });

  it("allows switching on only after a recent successful test", async () => {
    const user = userEvent.setup();
    currentStatus = systemStatus({ last_test_ok: true, last_test_at: "2026-10-10T09:00:00Z" });
    renderAs("owner");
    const toggle = await screen.findByRole("switch", { name: "Assistant replies to patients" });
    await waitFor(() => expect(toggle).toBeEnabled());
    await user.click(toggle);
    await waitFor(() => expect(db().writes("clinic_settings", "update")).toHaveLength(1));
    const [update] = db().writes("clinic_settings", "update");
    expect(update?.payload).toEqual({ assistant_enabled: true });
    expect(update?.filters).toContainEqual(["eq", "organization_id", ORG_ID]);
  });

  it("explains a refused switch-on when the database says the assistant was not tested", async () => {
    const user = userEvent.setup();
    currentStatus = systemStatus({ last_test_ok: true, last_test_at: "2026-10-10T09:00:00Z" });
    db().respond = (query) =>
      query.op === "update"
        ? {
            data: null,
            error: { code: "23514", message: "x", details: null, hint: "assistant_not_tested" },
          }
        : undefined;
    renderAs("owner");
    const toggle = await screen.findByRole("switch", { name: "Assistant replies to patients" });
    await waitFor(() => expect(toggle).toBeEnabled());
    await user.click(toggle);
    expect(await screen.findByText(/The assistant wasn.t switched on/)).toBeInTheDocument();
  });

  it("runs a test conversation and shows the outcome, the unsaved request and usage", async () => {
    const user = userEvent.setup();
    callFunction.mockImplementation((name: string, body: Record<string, unknown>) => {
      if (name === "system-status") return Promise.resolve(currentStatus);
      const messages = body.messages as Array<{ role: string; content: string }>;
      if (messages.length === 1) {
        return Promise.resolve({
          reply: "Sure, which day suits you?",
          language: "en",
          outcome: "answered",
          handoff: null,
          appointment_request: {
            customer_name: "Sara",
            service_id: null,
            preferred_date: "2026-10-20",
            preferred_time_window: "morning",
            saved: false,
          },
          model: "claude-opus-5-5",
          usage: { input_tokens: 1200, output_tokens: 80, cache_read_input_tokens: 900 },
        });
      }
      return Promise.reject(
        new ApiError({
          status: 409,
          code: "ai_quota_exhausted",
          message: "quota",
          requestId: "req-7",
        }),
      );
    });
    renderAs("owner");

    const input = await screen.findByLabelText("Test message");
    await user.type(input, "I want to book a cleaning");
    await user.click(screen.getByRole("button", { name: "Send" }));

    const log = screen.getByRole("log", { name: "Test conversation" });
    expect(await within(log).findByText("Sure, which day suits you?")).toBeInTheDocument();
    expect(within(log).getByText("Answered")).toBeInTheDocument();
    expect(within(log).getByText("Appointment request (test, not saved)")).toBeInTheDocument();
    expect(within(log).getByText(/1,200 in, 80 out/)).toBeInTheDocument();
    expect(callFunction).toHaveBeenCalledWith(
      "assistant-test",
      {
        organization_id: ORG_ID,
        messages: [{ role: "user", content: "I want to book a cleaning" }],
      },
      expect.anything(),
    );

    await user.type(input, "Tomorrow morning");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("link", { name: "Go to billing" })).toHaveAttribute(
      "href",
      "/app/billing",
    );
    const testCalls = callFunction.mock.calls.filter(([name]) => name === "assistant-test");
    expect((testCalls[1]?.[1] as { messages: unknown[] }).messages).toEqual([
      { role: "user", content: "I want to book a cleaning" },
      { role: "assistant", content: "Sure, which day suits you?" },
      { role: "user", content: "Tomorrow morning" },
    ]);
    // The failed message goes back into the box so it can be resent.
    expect(input).toHaveValue("Tomorrow morning");
  });

  it("shows the configuration steps when a test reports not_configured", async () => {
    const user = userEvent.setup();
    callFunction.mockImplementation((name: string) =>
      name === "system-status"
        ? Promise.resolve(currentStatus)
        : Promise.reject(
            new ApiError({
              status: 503,
              code: "not_configured",
              message: "missing",
              details: { variable: "ANTHROPIC_API_KEY" },
            }),
          ),
    );
    renderAs("admin");
    await user.type(await screen.findByLabelText("Test message"), "What are your hours?");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("heading", { name: "AI isn't set up yet" })).toBeInTheDocument();
  });

  it("keeps receptionists out of the test console and the settings", async () => {
    renderAs("receptionist");
    expect(
      await screen.findByText(
        "You can view these settings. Only the clinic's owner or an admin can change them.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Test message")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/^Assistant name/)).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Assistant replies to patients" })).toBeDisabled();
  });
});
