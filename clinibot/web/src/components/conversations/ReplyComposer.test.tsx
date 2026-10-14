import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as ApiModule from "@/lib/api";
import { ApiError } from "@/lib/apiError";
import { renderWithProviders } from "@/test/render";
import type { ConversationRow } from "./model";
import { ReplyComposer } from "./ReplyComposer";

// A plain function, not vi.fn(): Vitest's spy result tracking reports a returned rejected
// promise as a test failure even when the code under test handles it.
const api = vi.hoisted(() => ({
  calls: [] as unknown[][],
  respond: (): Promise<unknown> => Promise.reject(new Error("no response set")),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
  isSupabaseConfigured: true,
  initialHref: "",
}));

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  callFunction: (...args: unknown[]) => {
    api.calls.push(args);
    return api.respond();
  },
}));

const conversation: ConversationRow = {
  id: "c1",
  channel: "whatsapp",
  status: "open",
  customer_name: "سارة",
  customer_wa_id: "966551234567",
  language: "ar",
  ai_paused: false,
  handoff_reason: null,
  assigned_to: null,
  consent_at: null,
  opted_out_at: null,
  last_message_at: "2026-10-13T08:00:00Z",
  last_message_direction: "inbound",
  last_inbound_at: "2026-10-13T08:00:00Z",
  created_at: "2026-10-13T07:00:00Z",
};

/** A failed Edge Function call, created only when the mock is called. */
function rejectWith(init: ConstructorParameters<typeof ApiError>[0]): Promise<never> {
  return Promise.reject(new ApiError(init));
}

function renderComposer(windowOpen: boolean, row: ConversationRow = conversation) {
  return renderWithProviders(
    <ReplyComposer orgId="o1" conversation={row} windowOpen={windowOpen} />,
    { lang: "en" },
  );
}

describe("ReplyComposer", () => {
  beforeEach(() => {
    api.calls = [];
  });

  it("sends the reply and pauses the assistant by default", async () => {
    api.respond = () =>
      Promise.resolve({
        message: {
          id: "m1",
          direction: "outbound",
          sender: "staff",
          body: "Hello",
          status: "sent",
          error_code: null,
          created_at: "2026-10-13T09:00:00Z",
        },
      });
    renderComposer(true);
    expect(screen.getByRole("checkbox", { name: /Pause the assistant/ })).toBeChecked();
    await userEvent.type(screen.getByRole("textbox", { name: "Your reply" }), "Hello");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() =>
      expect(api.calls).toEqual([
        [
          "conversation-reply",
          { conversation_id: "c1", body: "Hello", pause_ai: true },
          expect.anything(),
        ],
      ]),
    );
    expect(await screen.findByText(/WhatsApp accepted your message/)).toBeInTheDocument();
  });

  it("reports a message WhatsApp rejected, with Meta's error code", async () => {
    api.respond = () =>
      Promise.resolve({
        message: {
          id: "m1",
          direction: "outbound",
          sender: "staff",
          body: "Hello",
          status: "failed",
          error_code: "131047",
          created_at: "2026-10-13T09:00:00Z",
        },
      });
    renderComposer(true);
    await userEvent.type(screen.getByRole("textbox", { name: "Your reply" }), "Hello");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(
      await screen.findByText(/rejected the message with error code 131047/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/accepted your message/)).not.toBeInTheDocument();
  });

  it("offers only an approved template outside the 24-hour window", () => {
    renderComposer(false);
    expect(
      screen.getByRole("heading", { name: "Send an approved WhatsApp template" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Your reply" })).not.toBeInTheDocument();
  });

  it("switches to the template form when the server says the window has closed", async () => {
    api.respond = () =>
      rejectWith({
        status: 409,
        code: "outside_service_window",
        message: "Outside window",
        requestId: "req-123",
      });
    renderComposer(true);
    await userEvent.type(screen.getByRole("textbox", { name: "Your reply" }), "Hello");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(
      await screen.findByRole("heading", { name: "Send an approved WhatsApp template" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/only allows an approved template/)).toBeInTheDocument();
    expect(screen.getByText("req-123")).toBeInTheDocument();
  });

  it("points to the WhatsApp page when WhatsApp is not connected", async () => {
    api.respond = () =>
      rejectWith({ status: 409, code: "whatsapp_not_connected", message: "Not connected" });
    renderComposer(true);
    await userEvent.type(screen.getByRole("textbox", { name: "Your reply" }), "Hello");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("link", { name: "WhatsApp page" })).toHaveAttribute(
      "href",
      "/app/whatsapp",
    );
  });

  it("validates the template form before sending", async () => {
    renderComposer(false);
    await userEvent.type(screen.getByRole("textbox", { name: /Template name/ }), "Bad Name");
    await userEvent.click(screen.getByRole("button", { name: "Send template" }));
    expect(await screen.findByText(/lowercase English letters/)).toBeInTheDocument();
    expect(api.calls).toEqual([]);
  });
});
