import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import type { createFakeSupabase } from "@/components/knowledge/fakeSupabase";
import type { OrgMember } from "@/components/dashboard/members";
import type { AppointmentDetailRow } from "./model";

const ORG_ID = "o1";

const fake = vi.hoisted(() => ({
  current: null as ReturnType<typeof createFakeSupabase> | null,
  members: [] as unknown[],
}));
vi.mock("@/lib/supabase", async () => {
  const { createFakeSupabase: create } = await import("@/components/knowledge/fakeSupabase");
  fake.current = create();
  return {
    supabase: {
      ...fake.current.client,
      rpc: (name: string) =>
        Promise.resolve({ data: name === "list_org_members" ? fake.members : null, error: null }),
    },
  };
});

const { AppointmentDetail } = await import("./AppointmentDetail");

function db() {
  if (!fake.current) throw new Error("supabase mock not initialised");
  return fake.current;
}

function member(userId: string, name: string): OrgMember {
  return {
    user_id: userId,
    member_id: `m-${userId}`,
    full_name: name,
    email: `${userId}@clinic.example`,
    role: "receptionist",
    created_at: "2026-01-01T00:00:00Z",
  };
}

const request: AppointmentDetailRow = {
  id: "a1",
  organization_id: ORG_ID,
  conversation_id: null,
  service_id: null,
  customer_name: "Sara",
  customer_phone: "+966551234567",
  preferred_date: null,
  preferred_time_window: "any",
  customer_notes: null,
  source: "dashboard",
  status: "new",
  assigned_to: null,
  scheduled_for: null,
  confirmed_at: null,
  confirmed_by: null,
  cancelled_at: null,
  completed_at: null,
  customer_notified_at: null,
  created_by: "u1",
  created_at: "2026-10-13T08:00:00.000Z",
  updated_at: "2026-10-13T08:00:00.000Z",
  service: null,
  conversation: null,
};

function renderDetail() {
  const org = {
    id: ORG_ID,
    name: "Smile Clinic",
    slug: "smile",
    defaultLanguage: "en" as const,
    role: "owner" as const,
  };
  return renderWithProviders(
    <Routes>
      <Route path="/app/appointments/:id" element={<AppointmentDetail />} />
    </Routes>,
    {
      lang: "en",
      route: "/app/appointments/a1",
      org: { current: org, orgs: [org], role: "owner" },
    },
  );
}

describe("AppointmentDetail: assigning", () => {
  beforeEach(() => {
    db().reset();
    db().tables.appointment_requests = [request];
    db().tables.appointment_request_notes = [];
    fake.members = [member("u1", "Rana"), member("u2", "Huda"), member("u3", "Lama")];
  });

  it("saves only on Assign, so arrow keys on the select never assign the wrong person", async () => {
    const user = userEvent.setup();
    renderDetail();
    const card = await screen.findByRole("region", { name: "Assignee" });
    const select = within(card).getByRole("combobox", { name: "Assign the request to" });
    await waitFor(() => expect(within(select).getAllByRole("option")).toHaveLength(4));

    // Arrow keys on a closed select change its value at once; nothing is saved yet.
    await user.selectOptions(select, "u2");
    await user.selectOptions(select, "u3");
    expect(db().writes("appointment_requests")).toEqual([]);
    expect(select).toBeEnabled();

    await user.click(within(card).getByRole("button", { name: "Assign" }));
    await waitFor(() => expect(db().writes("appointment_requests", "update")).toHaveLength(1));
    expect(db().writes("appointment_requests", "update")[0]?.payload).toEqual({
      assigned_to: "u3",
    });
    expect(await screen.findByText("Request assigned.")).toBeInTheDocument();
  });

  it("does nothing when the choice is the saved one", async () => {
    const user = userEvent.setup();
    renderDetail();
    const card = await screen.findByRole("region", { name: "Assignee" });
    const assign = within(card).getByRole("button", { name: "Assign" });
    expect(assign).toHaveAttribute("aria-disabled", "true");
    await user.click(assign);
    expect(db().writes("appointment_requests")).toEqual([]);
  });
});
