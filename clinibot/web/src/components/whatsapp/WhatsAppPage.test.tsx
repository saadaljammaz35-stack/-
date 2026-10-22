import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as ApiModule from "@/lib/api";
import { ApiError } from "@/lib/apiError";
import type { MemberRole } from "@/org/context";
import { renderWithProviders } from "@/test/render";
import type { createFakeSupabase } from "@/components/knowledge/fakeSupabase";

const ORG_ID = "44444444-4444-4444-8444-444444444444";
const WEBHOOK_URL = "https://ref.supabase.co/functions/v1/whatsapp-webhook/k3y";

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

const { default: WhatsAppPage } = await import("@/pages/app/WhatsAppPage");

type WaStatus = "disconnected" | "credentials_verified" | "connected" | "error";

function systemStatus(status: WaStatus, extra: Record<string, unknown> = {}) {
  return {
    role: "owner",
    ai: {
      configured: true,
      model: "claude-opus-5-5",
      enabled: false,
      last_test_at: null,
      last_test_ok: null,
    },
    whatsapp: {
      status,
      display_phone_number: status === "disconnected" ? null : "+966 55 000 0000",
      verified_name: status === "disconnected" ? null : "Smile Clinic",
      credentials_verified_at: status === "disconnected" ? null : "2026-10-12T08:00:00Z",
      webhook_verified_at: status === "connected" ? "2026-10-12T08:05:00Z" : null,
      last_inbound_at: null,
      last_error: null,
      webhook_url: WEBHOOK_URL,
      ...extra,
    },
    encryption_configured: true,
    entitlements: { plan: "starter", status: "trialing", is_active: true },
    payments: { enabled: false, provider: null },
  };
}

let currentStatus = systemStatus("disconnected");

function renderAs(role: MemberRole) {
  const org = {
    id: ORG_ID,
    name: "Smile Clinic",
    slug: "smile",
    defaultLanguage: "ar" as const,
    role,
  };
  return renderWithProviders(<WhatsAppPage />, {
    route: "/app/whatsapp",
    lang: "en",
    org: { current: org, orgs: [org], role },
  });
}

function statusCard() {
  return screen.getByRole("region", { name: "Connection status" });
}

describe("WhatsAppPage", () => {
  beforeEach(() => {
    fake.current?.reset();
    callFunction.mockReset();
    currentStatus = systemStatus("disconnected");
    callFunction.mockImplementation((name: string) =>
      name === "system-status" ? Promise.resolve(currentStatus) : Promise.reject(new Error(name)),
    );
  });

  it("never says Connected while Meta's webhook check is pending", async () => {
    currentStatus = systemStatus("credentials_verified");
    renderAs("owner");
    expect(
      await screen.findByText("Credentials verified — waiting for Meta webhook verification"),
    ).toBeInTheDocument();
    expect(within(statusCard()).queryByText("Connected")).not.toBeInTheDocument();
    expect(screen.getByText("Waiting for Meta to verify the webhook")).toBeInTheDocument();
    expect(callFunction).toHaveBeenCalledWith(
      "system-status",
      { organization_id: ORG_ID },
      expect.anything(),
    );
  });

  it("warns managers while no message has arrived after Meta's verification", async () => {
    currentStatus = systemStatus("connected");
    const view = renderAs("owner");
    expect(await screen.findByText("No messages received yet")).toBeInTheDocument();
    expect(
      within(statusCard()).getByText(/Messages arrive only once your app is subscribed/),
    ).toBeInTheDocument();
    // The steps that subscribe the "messages" field are right there.
    expect(screen.getAllByText("messages").length).toBeGreaterThan(0);
    view.unmount();

    currentStatus = systemStatus("connected", { last_inbound_at: "2026-10-12T09:00:00Z" });
    renderAs("owner");
    expect(await within(statusCard()).findByText("Connected")).toBeInTheDocument();
    expect(screen.queryByText("No messages received yet")).not.toBeInTheDocument();
  });

  it("shows receptionists the status only", async () => {
    currentStatus = systemStatus("connected", { last_error: undefined, webhook_url: undefined });
    renderAs("receptionist");
    expect(
      await within(await screen.findByRole("region", { name: "Connection status" })).findByText(
        "Connected",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("+966 55 000 0000")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Manage the connection" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Permanent access token/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Disconnect/ })).not.toBeInTheDocument();
  });

  it("shows the last error from Meta to managers", async () => {
    currentStatus = systemStatus("error", { last_error: "Error validating access token" });
    renderAs("owner");
    expect(await screen.findByText("Error validating access token")).toBeInTheDocument();
    expect(within(statusCard()).queryByText("Connected")).not.toBeInTheDocument();
  });

  it("saves credentials and reveals the verify token once", async () => {
    const user = userEvent.setup();
    callFunction.mockImplementation((name: string, body: Record<string, unknown>) => {
      if (name === "system-status") return Promise.resolve(currentStatus);
      if (body.action === "save") {
        currentStatus = systemStatus("credentials_verified");
        return Promise.resolve({
          status: "credentials_verified",
          display_phone_number: "+966 55 000 0000",
          verified_name: "Smile Clinic",
          webhook_url: WEBHOOK_URL,
          verify_token: "vt_once_only_123",
          app_subscribed: true,
        });
      }
      return Promise.reject(new Error("unexpected"));
    });
    renderAs("owner");

    const token = await screen.findByLabelText(/^Permanent access token/);
    // Never a password field: browsers must not offer to save or generate the Meta secrets.
    expect(token).not.toHaveAttribute("type", "password");
    expect(token).toHaveAttribute("autocomplete", "off");
    expect(screen.getByLabelText(/^App secret/)).not.toHaveAttribute("type", "password");
    expect(screen.getByLabelText(/^App secret/)).toHaveAttribute("autocomplete", "off");
    expect(token).toHaveValue("");
    await user.type(screen.getByLabelText(/^Phone number ID/), " 1234 5678 ");
    await user.type(screen.getByLabelText(/^WhatsApp Business Account ID/), "987654321");
    await user.type(token, "EAAG-test-token-0123456789");
    await user.type(screen.getByLabelText(/^App secret/), "0123456789abcdef0123");
    await user.click(screen.getByRole("button", { name: "Save and verify" }));

    await waitFor(() =>
      expect(callFunction).toHaveBeenCalledWith(
        "whatsapp-connect",
        {
          action: "save",
          organization_id: ORG_ID,
          phone_number_id: "12345678",
          waba_id: "987654321",
          access_token: "EAAG-test-token-0123456789",
          app_secret: "0123456789abcdef0123",
        },
        expect.anything(),
      ),
    );
    expect(await screen.findByText("The verify token is shown only this once")).toBeInTheDocument();
    expect(screen.getByLabelText("Verify token")).toHaveValue("vt_once_only_123");

    await user.click(screen.getByRole("button", { name: "I've copied them — close" }));
    expect(screen.queryByDisplayValue("vt_once_only_123")).not.toBeInTheDocument();
    // The focused Done button went with the panel: focus lands on the status, not <body>.
    await waitFor(() => expect(screen.getByText("Connection status")).toHaveFocus());
  });

  it("shows Meta's own error when the credentials are rejected, and clears the secrets", async () => {
    const user = userEvent.setup();
    callFunction.mockImplementation((name: string) =>
      name === "system-status"
        ? Promise.resolve(currentStatus)
        : Promise.reject(
            new ApiError({
              status: 502,
              code: "upstream_error",
              message: "Meta rejected",
              details: {
                provider: "meta",
                meta_code: 190,
                meta_message: "Invalid OAuth access token.",
              },
              requestId: "req-42",
            }),
          ),
    );
    renderAs("admin");

    await user.type(await screen.findByLabelText(/^Phone number ID/), "12345678");
    await user.type(screen.getByLabelText(/^WhatsApp Business Account ID/), "987654321");
    await user.type(screen.getByLabelText(/^Permanent access token/), "EAAG-test-token-0123456789");
    await user.type(screen.getByLabelText(/^App secret/), "0123456789abcdef0123");
    await user.click(screen.getByRole("button", { name: "Save and verify" }));

    expect(await screen.findByText("Meta rejected the request")).toBeInTheDocument();
    expect(screen.getByText("Invalid OAuth access token.")).toBeInTheDocument();
    expect(screen.getByText("190")).toBeInTheDocument();
    expect(screen.getByText(/req-42/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Permanent access token/)).toHaveValue("");
    expect(screen.getByLabelText(/^App secret/)).toHaveValue("");
    expect(screen.getByLabelText(/^Phone number ID/)).toHaveValue("12345678");
  });

  it("asks for the clinic link before disconnecting", async () => {
    const user = userEvent.setup();
    currentStatus = systemStatus("connected");
    callFunction.mockImplementation((name: string, body: Record<string, unknown>) => {
      if (name === "system-status") return Promise.resolve(currentStatus);
      if (body.action === "disconnect") {
        currentStatus = systemStatus("disconnected");
        return Promise.resolve({ status: "disconnected" });
      }
      return Promise.reject(new Error("unexpected"));
    });
    renderAs("owner");

    await user.click(await screen.findByRole("button", { name: "Disconnect WhatsApp" }));
    const dialog = await screen.findByRole("alertdialog");
    const confirm = within(dialog).getByRole("button", { name: "Disconnect WhatsApp" });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByRole("textbox"), "smile");
    await user.click(confirm);

    await waitFor(() =>
      expect(callFunction).toHaveBeenCalledWith(
        "whatsapp-connect",
        { action: "disconnect", organization_id: ORG_ID },
        expect.anything(),
      ),
    );
    expect(await within(statusCard()).findByText("Disconnected")).toBeInTheDocument();
  });
});
