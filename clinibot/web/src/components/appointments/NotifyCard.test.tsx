import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as ApiModule from "@/lib/api";
import { ApiError, type ApiErrorInit } from "@/lib/apiError";
import { renderWithProviders } from "@/test/render";
import type { AppointmentDetailRow } from "./model";
import { NotifyCard } from "./NotifyCard";

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

const confirmed: AppointmentDetailRow = {
  id: "a1",
  organization_id: "o1",
  conversation_id: "c1",
  service_id: null,
  customer_name: "سارة",
  customer_phone: "+966551234567",
  preferred_date: "2026-10-20",
  preferred_time_window: "evening",
  customer_notes: null,
  source: "whatsapp",
  status: "confirmed",
  assigned_to: null,
  scheduled_for: "2026-10-20T13:30:00.000Z",
  confirmed_at: "2026-10-13T09:00:00.000Z",
  confirmed_by: "u1",
  cancelled_at: null,
  completed_at: null,
  customer_notified_at: null,
  created_by: null,
  created_at: "2026-10-13T08:00:00.000Z",
  updated_at: "2026-10-13T09:00:00.000Z",
  service: null,
  conversation: { id: "c1", channel: "whatsapp" },
};

function rejectWith(init: ApiErrorInit): Promise<never> {
  return Promise.reject(new ApiError(init));
}

async function notify(request: AppointmentDetailRow = confirmed) {
  renderWithProviders(<NotifyCard orgId="o1" request={request} />, { lang: "en" });
  await userEvent.click(screen.getByRole("button", { name: "Notify patient" }));
}

describe("NotifyCard", () => {
  beforeEach(() => {
    api.calls = [];
  });

  it("is only offered once the request is confirmed", () => {
    renderWithProviders(<NotifyCard orgId="o1" request={{ ...confirmed, status: "contacted" }} />, {
      lang: "en",
    });
    expect(screen.queryByRole("button", { name: "Notify patient" })).toBeNull();
  });

  it("shows when the patient was notified instead of offering it again", () => {
    renderWithProviders(
      <NotifyCard
        orgId="o1"
        request={{ ...confirmed, customer_notified_at: "2026-10-13T10:00:00.000Z" }}
      />,
      { lang: "en" },
    );
    expect(screen.queryByRole("button", { name: "Notify patient" })).toBeNull();
    expect(screen.getByText(/The patient was told about this appointment on/)).toBeInTheDocument();
  });

  it("says to call the patient when the request was entered by hand", () => {
    renderWithProviders(
      <NotifyCard
        orgId="o1"
        request={{ ...confirmed, source: "dashboard", conversation_id: null, conversation: null }}
      />,
      { lang: "en" },
    );
    expect(screen.getByRole("button", { name: "Notify patient" })).toBeDisabled();
    expect(screen.getByRole("link", { name: "+966551234567" })).toHaveAttribute(
      "href",
      "tel:+966551234567",
    );
  });

  it("calls appointment-notify and reports success", async () => {
    api.respond = () =>
      Promise.resolve({
        notified_at: "2026-10-13T10:00:00.000Z",
        channel: "whatsapp",
        message: { id: "m1", status: "sent", error_code: null },
      });
    await notify();
    expect(api.calls[0]?.slice(0, 2)).toEqual([
      "appointment-notify",
      { appointment_request_id: "a1" },
    ]);
    expect(await screen.findByText(/WhatsApp accepted the confirmation/)).toBeInTheDocument();
  });

  it("links to the WhatsApp page when a confirmation template is needed", async () => {
    api.respond = () =>
      rejectWith({ status: 409, code: "template_required", message: "Template required" });
    await notify();
    expect(await screen.findByRole("link", { name: "WhatsApp page" })).toHaveAttribute(
      "href",
      "/app/whatsapp",
    );
  });

  it("names the provider error code and the support reference on a 502", async () => {
    api.respond = () =>
      rejectWith({
        status: 502,
        code: "upstream_error",
        message: "WhatsApp (Meta) did not accept the message",
        details: { provider: "meta", meta_code: 131026 },
        requestId: "req-502",
      });
    await notify();
    expect(await screen.findByText(/error code 131026/)).toBeInTheDocument();
    expect(screen.getByText("req-502")).toBeInTheDocument();
  });
});
