import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { createFakeSupabase } from "@/components/knowledge/fakeSupabase";
import type { ConversationRow } from "./model";

const fake = vi.hoisted(() => ({ current: null as ReturnType<typeof createFakeSupabase> | null }));
vi.mock("@/lib/supabase", async () => {
  const { createFakeSupabase: create } = await import("@/components/knowledge/fakeSupabase");
  fake.current = create();
  return { supabase: fake.current.client };
});

const { ConversationActions } = await import("./ConversationActions");

function db() {
  if (!fake.current) throw new Error("supabase mock not initialised");
  return fake.current;
}

const paused: ConversationRow = {
  id: "c1",
  channel: "whatsapp",
  status: "awaiting_human",
  customer_name: "Sara",
  customer_wa_id: "966551234567",
  language: "en",
  ai_paused: true,
  handoff_reason: null,
  assigned_to: null,
  consent_at: null,
  privacy_notice_sent_at: "2026-10-13T08:00:05Z",
  opted_out_at: null,
  last_message_at: "2026-10-13T08:00:00Z",
  last_message_direction: "inbound",
  last_inbound_at: "2026-10-13T08:00:00Z",
  created_at: "2026-10-13T07:00:00Z",
};

function renderActions(conversation: ConversationRow, canReply: boolean | null) {
  return renderWithProviders(
    <ConversationActions
      orgId="o1"
      conversation={conversation}
      role="receptionist"
      members={[]}
      listSearch=""
      canReply={canReply}
    />,
    { lang: "en" },
  );
}

async function resume() {
  await userEvent.click(screen.getByRole("button", { name: "Turn the assistant back on" }));
  await waitFor(() => expect(db().writes("conversations", "update")).toHaveLength(1));
  return db().writes("conversations", "update")[0]?.payload;
}

describe("ConversationActions: turning the assistant back on", () => {
  beforeEach(() => db().reset());

  it("is not offered after the patient opted out", () => {
    renderActions({ ...paused, opted_out_at: "2026-10-13T08:30:00Z" }, true);
    expect(screen.queryByRole("button", { name: "Turn the assistant back on" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Take over" })).toBeNull();
  });

  it("hands the conversation back when the assistant can reply, without promising a reply", async () => {
    renderActions(paused, true);
    expect(await resume()).toEqual({ ai_paused: false, status: "open" });
    expect(
      await screen.findByText("The assistant will answer the patient's next message."),
    ).toBeInTheDocument();
  });

  it("keeps the patient in the reception queue while the assistant is off or not set up", async () => {
    renderActions(paused, false);
    expect(await resume()).toEqual({ ai_paused: false });
    expect(
      await screen.findByText(/isn't answering patients in this clinic right now/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/will answer the patient's next message/)).toBeNull();
  });

  it("changes nothing else while the assistant's status is unknown", async () => {
    renderActions(paused, null);
    expect(await resume()).toEqual({ ai_paused: false });
    expect(
      await screen.findByText("The assistant is no longer paused in this conversation."),
    ).toBeInTheDocument();
  });

  it("never reopens a closed conversation", async () => {
    renderActions({ ...paused, status: "closed" }, true);
    expect(await resume()).toEqual({ ai_paused: false });
    expect(screen.getByRole("button", { name: "Reopen" })).toBeInTheDocument();
  });
});
