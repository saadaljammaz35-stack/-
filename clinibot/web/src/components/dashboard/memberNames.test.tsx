import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@supabase/supabase-js";
import { renderWithProviders } from "@/test/render";
import type { createFakeSupabase } from "@/components/knowledge/fakeSupabase";
import type { ConversationRow } from "@/components/conversations/model";
import type { AppointmentListRow } from "@/components/appointments/model";
import { memberLabel, memberNameMap, type OrgMember } from "./members";

const ORG_ID = "o1";

interface RpcResult {
  data: unknown;
  error: unknown;
}

const fake = vi.hoisted(() => {
  /** What rpc("list_org_members") answers. */
  const members: RpcResult = { data: null, error: null };
  return {
    current: null as ReturnType<typeof createFakeSupabase> | null,
    members,
    memberCalls: 0,
  };
});
vi.mock("@/lib/supabase", async () => {
  const { createFakeSupabase: create } = await import("@/components/knowledge/fakeSupabase");
  fake.current = create();
  return {
    supabase: {
      ...fake.current.client,
      rpc: (name: string) => {
        if (name !== "list_org_members") return Promise.resolve({ data: null, error: null });
        fake.memberCalls += 1;
        return Promise.resolve(fake.members);
      },
    },
  };
});

const { ConversationList } = await import("@/components/conversations/ConversationList");
const { AppointmentList } = await import("@/components/appointments/AppointmentList");
const { NotesCard } = await import("@/components/appointments/NotesCard");

function db() {
  if (!fake.current) throw new Error("supabase mock not initialised");
  return fake.current;
}

const huda: OrgMember = {
  user_id: "u2",
  member_id: "m2",
  full_name: "Huda Saleh",
  email: "huda@clinic.example",
  role: "receptionist",
  created_at: "2026-01-01T00:00:00Z",
};

const membersFail = { data: null, error: { code: "XX000", message: "boom", hint: null } };

const recent = new Date(Date.now() - 60 * 60_000).toISOString();

const conversation: ConversationRow = {
  id: "c1",
  channel: "web",
  status: "open",
  customer_name: "Sara",
  customer_wa_id: null,
  language: "en",
  ai_paused: false,
  handoff_reason: null,
  assigned_to: "u2",
  consent_at: recent,
  privacy_notice_sent_at: null,
  opted_out_at: null,
  last_message_at: recent,
  last_message_direction: "outbound",
  last_inbound_at: recent,
  created_at: recent,
};

const appointment: AppointmentListRow = {
  id: "a1",
  customer_name: "Sara",
  customer_phone: "+966551234567",
  preferred_date: null,
  preferred_time_window: "any",
  source: "web_chat",
  status: "new",
  assigned_to: "u2",
  scheduled_for: null,
  customer_notified_at: null,
  created_at: recent,
  service: null,
};

const org = {
  id: ORG_ID,
  name: "Smile Clinic",
  slug: "smile",
  defaultLanguage: "en" as const,
  role: "owner" as const,
};

function renderConversations() {
  db().tables.conversations = [conversation];
  return renderWithProviders(<ConversationList orgId={ORG_ID} />, {
    lang: "en",
    route: "/app/conversations?tab=all",
    auth: { user: { id: "u1" } as User },
  });
}

function renderAppointments() {
  db().tables.appointment_requests = [appointment];
  return renderWithProviders(<AppointmentList />, {
    lang: "en",
    route: "/app/appointments",
    org: { current: org, orgs: [org], role: "owner" },
  });
}

function NotesWithMembers({
  members,
}: {
  members: { data: OrgMember[] | undefined; isPending: boolean };
}) {
  return <NotesCard orgId={ORG_ID} requestId="a1" members={members} />;
}

describe("memberLabel", () => {
  it("tells a current member, a former member and an unknown name apart", () => {
    const names = memberNameMap([huda]);
    expect(memberLabel(names, "u2")).toEqual({ kind: "name", name: "Huda Saleh" });
    expect(memberLabel(names, "gone")).toEqual({ kind: "former" });
    expect(memberNameMap(undefined)).toBeNull();
    expect(memberLabel(null, "u2")).toEqual({ kind: "unknown" });
  });
});

describe("team names on lists", () => {
  beforeEach(() => {
    db().reset();
    fake.members = { data: [huda], error: null };
    fake.memberCalls = 0;
  });

  it("names the assignee of a conversation, and says 'former' only for someone not in the team", async () => {
    const view = renderConversations();
    expect(await screen.findByText("Assigned to Huda Saleh")).toBeInTheDocument();
    view.unmount();

    fake.members = { data: [], error: null };
    renderConversations();
    expect(await screen.findByText("Assigned to Former member")).toBeInTheDocument();
  });

  it("never labels a conversation's assignee a former member when the team list fails to load", async () => {
    const user = userEvent.setup();
    fake.members = membersFail;
    renderConversations();
    expect(await screen.findByText(/couldn't load the team's names/)).toBeInTheDocument();
    const list = await screen.findByRole("list", { name: "Conversation list" });
    expect(within(list).getByText("Assigned")).toBeInTheDocument();
    expect(screen.queryByText(/Former member/)).toBeNull();

    // One retry for the whole list.
    const calls = fake.memberCalls;
    fake.members = { data: [huda], error: null };
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Assigned to Huda Saleh")).toBeInTheDocument();
    expect(fake.memberCalls).toBe(calls + 1);
  });

  it("never labels an appointment's assignee a former member when the team list fails to load", async () => {
    fake.members = membersFail;
    renderAppointments();
    expect(await screen.findByText(/couldn't load the team's names/)).toBeInTheDocument();
    expect((await screen.findAllByText("Name unavailable")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Former member")).toBeNull();
  });

  it("names an appointment's assignee once the team is loaded", async () => {
    renderAppointments();
    expect((await screen.findAllByText("Huda Saleh")).length).toBeGreaterThan(0);
    expect(screen.queryByText(/couldn't load the team's names/)).toBeNull();
  });

  it("never labels a note's author a former member while the team is unavailable", async () => {
    db().tables.appointment_request_notes = [
      { id: "n1", body: "Called back", author_id: "u2", created_at: recent },
    ];
    const view = renderWithProviders(
      <NotesWithMembers members={{ data: undefined, isPending: false }} />,
      {
        lang: "en",
      },
    );
    expect(await screen.findByText("Called back")).toBeInTheDocument();
    expect(screen.getByText("Name unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Former member")).toBeNull();
    view.unmount();

    renderWithProviders(<NotesWithMembers members={{ data: [], isPending: false }} />, {
      lang: "en",
    });
    expect(await screen.findByText("Former member")).toBeInTheDocument();
  });

  it("moves focus to an empty note when Add is pressed", async () => {
    const user = userEvent.setup();
    db().tables.appointment_request_notes = [];
    renderWithProviders(<NotesWithMembers members={{ data: [huda], isPending: false }} />, {
      lang: "en",
    });
    await user.click(await screen.findByRole("button", { name: "Add note" }));
    const box = screen.getByRole("textbox");
    await vi.waitFor(() => expect(box).toHaveFocus());
    expect(box).toHaveAttribute("aria-invalid", "true");
    expect(db().writes("appointment_request_notes")).toEqual([]);
  });
});
