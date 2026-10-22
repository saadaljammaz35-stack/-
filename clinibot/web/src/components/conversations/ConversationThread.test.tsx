import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as ApiModule from "@/lib/api";
import { renderWithProviders } from "@/test/render";
import type { createFakeSupabase } from "@/components/knowledge/fakeSupabase";
import type { ConversationRow } from "./model";

const ORG_ID = "o1";

const fake = vi.hoisted(() => ({ current: null as ReturnType<typeof createFakeSupabase> | null }));
vi.mock("@/lib/supabase", async () => {
  const { createFakeSupabase: create } = await import("@/components/knowledge/fakeSupabase");
  fake.current = create();
  return {
    supabase: {
      ...fake.current.client,
      rpc: () => Promise.resolve({ data: [], error: null }),
    },
  };
});

const status = vi.hoisted(() => ({
  respond: (): Promise<unknown> => Promise.reject(new Error("no response set")),
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  callFunction: (name: string) =>
    name === "system-status" ? status.respond() : Promise.reject(new Error(name)),
}));

const { ConversationThread } = await import("./ConversationThread");

function db() {
  if (!fake.current) throw new Error("supabase mock not initialised");
  return fake.current;
}

const recent = new Date(Date.now() - 60 * 60_000).toISOString();

const whatsapp: ConversationRow = {
  id: "c1",
  channel: "whatsapp",
  status: "open",
  customer_name: "Sara",
  customer_wa_id: "966551234567",
  language: "en",
  ai_paused: false,
  handoff_reason: null,
  assigned_to: null,
  consent_at: null,
  privacy_notice_sent_at: null,
  opted_out_at: null,
  last_message_at: recent,
  last_message_direction: "inbound",
  last_inbound_at: recent,
  created_at: recent,
};

function systemStatus(whatsappStatus: string) {
  return {
    role: "owner",
    ai: { configured: true, enabled: true, last_test_at: recent, last_test_ok: true },
    whatsapp: { status: whatsappStatus },
    encryption_configured: true,
    entitlements: { is_active: true, ai_replies_limit: 300, ai_replies_remaining: 200 },
  };
}

function renderThread(row: ConversationRow) {
  db().tables.conversations = row;
  db().tables.messages = [];
  return renderWithProviders(<ConversationThread orgId={ORG_ID} id={row.id} listSearch="" />, {
    lang: "en",
  });
}

describe("ConversationThread", () => {
  beforeEach(() => db().reset());

  it("says replies can't be sent while WhatsApp is disconnected, instead of offering them", async () => {
    status.respond = () => Promise.resolve(systemStatus("disconnected"));
    renderThread(whatsapp);
    expect(
      await screen.findByText("Replies can't be sent: WhatsApp isn't connected"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "WhatsApp page" })).toHaveAttribute(
      "href",
      "/app/whatsapp",
    );
    expect(screen.queryByText(/You can send free-text replies/)).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Your reply" })).toBeNull();
    expect(screen.getByText(/until the WhatsApp connection works/)).toBeInTheDocument();
  });

  it("names a failing connection", async () => {
    status.respond = () => Promise.resolve(systemStatus("error"));
    renderThread(whatsapp);
    expect(
      await screen.findByText("Replies can't be sent: the WhatsApp connection has an error"),
    ).toBeInTheDocument();
  });

  it("keeps the composer when the status can't be read (the server decides)", async () => {
    status.respond = () => Promise.reject(new Error("offline"));
    renderThread(whatsapp);
    expect(await screen.findByRole("textbox", { name: "Your reply" })).toBeInTheDocument();
    expect(screen.getByText(/You can send free-text replies/)).toBeInTheDocument();
  });

  it("offers free-text replies while connected", async () => {
    status.respond = () => Promise.resolve(systemStatus("connected"));
    renderThread(whatsapp);
    expect(await screen.findByRole("textbox", { name: "Your reply" })).toBeInTheDocument();
    expect(screen.getByText(/You can send free-text replies/)).toBeInTheDocument();
  });

  it("shows when WhatsApp's privacy notice was sent, not a consent that never exists there", async () => {
    status.respond = () => Promise.resolve(systemStatus("connected"));
    const view = renderThread(whatsapp);
    expect(await screen.findByText("Privacy notice sent")).toBeInTheDocument();
    expect(screen.getByText("Not sent yet")).toBeInTheDocument();
    expect(screen.queryByText("Privacy notice accepted")).toBeNull();
    view.unmount();

    renderThread({
      ...whatsapp,
      id: "c2",
      channel: "web",
      customer_wa_id: null,
      consent_at: null,
    });
    expect(await screen.findByText("Privacy notice accepted")).toBeInTheDocument();
    expect(screen.getByText("Not recorded")).toBeInTheDocument();
  });
});
