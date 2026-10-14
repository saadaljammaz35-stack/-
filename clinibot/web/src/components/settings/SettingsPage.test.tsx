import type { User } from "@supabase/supabase-js";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberRole, Org } from "@/org/context";
import { renderWithProviders } from "@/test/render";

const ORG_ID = "33333333-3333-4333-8333-333333333333";

interface Call {
  table: string;
  steps: [string, ...unknown[]][];
}

const calls: Call[] = [];
const rpc = vi.fn();

const PROFILE = {
  id: ORG_ID,
  name: "Smile Clinic",
  slug: "smile-clinic",
  city: "Riyadh",
  phone: "+966112345678",
  default_language: "ar",
};

const SETTINGS = {
  organization_id: ORG_ID,
  display_name_ar: "عيادة الابتسامة",
  display_name_en: null,
  address_ar: null,
  address_en: null,
  maps_url: null,
  reception_phone: null,
  working_hours: {
    sat: [["09:00", "21:00"]],
    sun: [["09:00", "21:00"]],
    mon: [["09:00", "21:00"]],
    tue: [["09:00", "21:00"]],
    wed: [["09:00", "21:00"]],
    thu: [["09:00", "21:00"]],
    fri: [],
  },
  working_hours_note_ar: null,
  working_hours_note_en: null,
  privacy_notice_ar: null,
  privacy_notice_en: null,
  message_retention_days: 180,
  appointment_retention_days: 365,
  public_chat_enabled: false,
};

function resolveCall(call: Call) {
  const isUpdate = call.steps.some(([step]) => step === "update");
  if (isUpdate) return { data: [{ id: ORG_ID, organization_id: ORG_ID }], error: null };
  if (call.table === "organizations") return { data: PROFILE, error: null };
  if (call.table === "clinic_settings") return { data: SETTINGS, error: null };
  return { data: null, error: null };
}

function from(table: string) {
  const call: Call = { table, steps: [] };
  calls.push(call);
  const result = () => Promise.resolve(resolveCall(call));
  const chain: Record<string, unknown> = {};
  for (const step of ["select", "eq", "in", "order", "limit", "update"]) {
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
    rpc: (...args: unknown[]) => rpc(...args) as unknown,
  },
}));

const { default: SettingsPage } = await import("@/pages/app/SettingsPage");

const MEMBERS = [
  { member_id: "m-owner", user_id: "u-owner", role: "owner", email: "o@c.sa", full_name: "Owner", created_at: "2026-10-01T00:00:00Z" },
  { member_id: "m-rec", user_id: "u-rec", role: "receptionist", email: "r@c.sa", full_name: "Desk", created_at: "2026-10-02T00:00:00Z" },
];

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderAs(role: MemberRole, userId: string, extra: { refresh?: () => Promise<Org[]> } = {}) {
  const org: Org = { id: ORG_ID, name: "Smile Clinic", slug: "smile-clinic", defaultLanguage: "ar", role };
  return renderWithProviders(
    <Routes>
      <Route path="/app/settings/*" element={<SettingsPage />} />
      <Route path="*" element={<Where />} />
    </Routes>,
    {
      route: "/app/settings",
      lang: "en",
      auth: { user: { id: userId } as User },
      org: { current: org, orgs: [org], role, ...extra },
    },
  );
}

function updates(table: string) {
  return calls
    .filter((call) => call.table === table && call.steps.some(([step]) => step === "update"))
    .map((call) => ({
      patch: call.steps.find(([step]) => step === "update")?.[1],
      filters: call.steps.filter(([step]) => step === "eq"),
    }));
}

describe("SettingsPage", () => {
  beforeEach(() => {
    calls.length = 0;
    rpc.mockReset();
    rpc.mockImplementation((name: string) =>
      Promise.resolve({ data: name === "list_org_members" ? MEMBERS : null, error: null }),
    );
  });

  it("saves working hours as the exact JSON shape, scoped to the clinic", async () => {
    const user = userEvent.setup();
    renderAs("owner", "u-owner");
    const friday = await screen.findByRole("switch", { name: "Friday" });
    await user.click(friday);
    const from = screen.getByLabelText("Friday, period 1: from");
    const to = screen.getByLabelText("Friday, period 1: to");
    await user.clear(from);
    await user.type(from, "16:00");
    await user.clear(to);
    await user.type(to, "00:00"); // midnight
    const section = screen.getByRole("heading", { name: "Working hours" }).closest("section")!;
    await user.click(within(section).getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(updates("clinic_settings")).toHaveLength(1));
    const [update] = updates("clinic_settings");
    expect(update!.filters).toContainEqual(["eq", "organization_id", ORG_ID]);
    expect(update!.patch).toEqual({
      working_hours: {
        sat: [["09:00", "21:00"]],
        sun: [["09:00", "21:00"]],
        mon: [["09:00", "21:00"]],
        tue: [["09:00", "21:00"]],
        wed: [["09:00", "21:00"]],
        thu: [["09:00", "21:00"]],
        fri: [["16:00", "24:00"]],
      },
      working_hours_note_ar: null,
      working_hours_note_en: null,
    });
  });

  it("blocks saving hours that close before they open", async () => {
    const user = userEvent.setup();
    renderAs("owner", "u-owner");
    const open = await screen.findByLabelText("Saturday, period 1: from");
    await user.clear(open);
    await user.type(open, "22:00");
    const section = screen.getByRole("heading", { name: "Working hours" }).closest("section")!;
    await user.click(within(section).getByRole("button", { name: "Save changes" }));
    expect(await within(section).findByText("The closing time must be after the opening time.")).toBeInTheDocument();
    expect(updates("clinic_settings")).toHaveLength(0);
  });

  it("normalises the clinic phone and updates only granted organization columns", async () => {
    const user = userEvent.setup();
    renderAs("owner", "u-owner");
    const phone = await screen.findByLabelText(/Clinic phone/);
    await user.clear(phone);
    await user.type(phone, "055 123 4567");
    const section = screen.getByRole("heading", { name: "Clinic profile" }).closest("section")!;
    await user.click(within(section).getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(updates("organizations")).toHaveLength(1));
    const [update] = updates("organizations");
    expect(update!.patch).toEqual({
      name: "Smile Clinic",
      city: "Riyadh",
      phone: "+966551234567",
      default_language: "ar",
    });
    expect(update!.filters).toContainEqual(["eq", "id", ORG_ID]);
  });

  it("shows the patient chat link and that public chat is off", async () => {
    renderAs("owner", "u-owner");
    expect(await screen.findByText(`${window.location.origin}/c/smile-clinic`)).toBeInTheDocument();
    expect(await screen.findByText("Chat page is off")).toBeInTheDocument();
  });

  it("uses the default privacy notice as the placeholder", async () => {
    renderAs("owner", "u-owner");
    const arabic = await screen.findByLabelText(/Privacy notice in Arabic/);
    expect(arabic.getAttribute("placeholder")).toContain("عيادة الابتسامة");
    expect(arabic.getAttribute("placeholder")).toContain("180");
    const english = screen.getByLabelText(/Privacy notice in English/);
    expect(english.getAttribute("placeholder")).toMatch(/^Welcome to Smile Clinic\. .*for 180 days/);
  });

  it("is read-only for receptionists, who can only leave", async () => {
    renderAs("receptionist", "u-rec");
    expect(await screen.findByText(/You can view these settings/)).toBeInTheDocument();
    expect(await screen.findByLabelText(/Clinic name$/)).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete clinic" })).toBeNull();
    expect(await screen.findByRole("button", { name: "Leave clinic" })).toBeEnabled();
  });

  it("deletes the clinic only after the link is typed, then leaves for onboarding", async () => {
    const user = userEvent.setup();
    const refresh = vi.fn(() => Promise.resolve([] as Org[]));
    renderAs("owner", "u-owner", { refresh });
    await user.click(await screen.findByRole("button", { name: "Delete clinic" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Permanently delete Smile Clinic?" });
    expect(within(dialog).getByText(/WhatsApp credentials will be deleted/)).toBeInTheDocument();
    const confirm = within(dialog).getByRole("button", { name: "Delete clinic permanently" });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByRole("textbox"), "smile-clinic");
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    expect(rpc).toHaveBeenCalledWith("delete_organization", {
      p_org: ORG_ID,
      p_confirm_slug: "smile-clinic",
    });
    expect(await screen.findByTestId("where")).toHaveTextContent("/onboarding");
    expect(refresh).toHaveBeenCalled();
  });

  it("explains that the only owner cannot leave", async () => {
    renderAs("owner", "u-owner");
    expect(await screen.findByText(/You're this clinic's only owner/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Leave clinic" })).toBeNull();
  });
});
