import type { User } from "@supabase/supabase-js";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as ApiModule from "@/lib/api";
import { ApiError } from "@/lib/apiError";
import type { MemberRole } from "@/org/context";
import { renderWithProviders } from "@/test/render";

const ORG_ID = "11111111-1111-4111-8111-111111111111";

const rpc = vi.fn();
vi.mock("@/lib/supabase", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) as unknown },
}));

const callFunction = vi.fn();
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof ApiModule>()),
  callFunction: (...args: unknown[]) => callFunction(...args) as unknown,
}));

const { default: StaffPage } = await import("@/pages/app/StaffPage");

const MEMBERS = [
  {
    member_id: "m-owner",
    user_id: "u-owner",
    role: "owner",
    email: "owner@clinic.sa",
    full_name: "Rana Owner",
    created_at: "2026-10-01T08:00:00Z",
  },
  {
    member_id: "m-admin",
    user_id: "u-admin",
    role: "admin",
    email: "admin@clinic.sa",
    full_name: "Sara Admin",
    created_at: "2026-10-02T08:00:00Z",
  },
  {
    member_id: "m-rec",
    user_id: "u-rec",
    role: "receptionist",
    email: "desk@clinic.sa",
    full_name: null,
    created_at: "2026-10-03T08:00:00Z",
  },
];

function entitlements(seatsUsed = 3, seatsLimit = 6) {
  return {
    plan: "growth",
    status: "active",
    is_active: true,
    trial_ends_at: null,
    current_period_end: null,
    ai_replies_limit: 5000,
    ai_replies_used: 10,
    ai_replies_remaining: 4990,
    seats_limit: seatsLimit,
    seats_used: seatsUsed,
  };
}

function mockRpc(seats = entitlements()) {
  rpc.mockImplementation((name: string) => {
    if (name === "list_org_members") return Promise.resolve({ data: MEMBERS, error: null });
    if (name === "org_entitlements") return Promise.resolve({ data: seats, error: null });
    return Promise.resolve({ data: null, error: null });
  });
}

function renderAs(role: MemberRole, userId: string, lang: "ar" | "en" = "en") {
  const org = {
    id: ORG_ID,
    name: "Smile Clinic",
    slug: "smile",
    defaultLanguage: "ar" as const,
    role,
  };
  return renderWithProviders(
    <Routes>
      <Route path="/app/staff/*" element={<StaffPage />} />
    </Routes>,
    {
      route: "/app/staff",
      lang,
      auth: { user: { id: userId } as User },
      org: { current: org, orgs: [org], role },
    },
  );
}

describe("StaffPage", () => {
  beforeEach(() => {
    rpc.mockReset();
    callFunction.mockReset();
    mockRpc();
  });

  it("lists members with roles, the 'you' marker and seat usage", async () => {
    renderAs("owner", "u-owner", "ar");
    const list = await screen.findByRole("list", { name: "أعضاء فريق العيادة" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(within(rows[0]!).getByText("Rana Owner")).toBeInTheDocument();
    expect(within(rows[0]!).getByText("أنت")).toBeInTheDocument();
    expect(within(rows[0]!).getByText("مالك")).toBeInTheDocument();
    // No full name: the email is the name.
    expect(within(rows[2]!).getByText("desk@clinic.sa")).toBeInTheDocument();
    expect(await screen.findByRole("progressbar", { name: "مقاعد الفريق" })).toHaveAttribute(
      "aria-valuenow",
      "3",
    );
    expect(rpc).toHaveBeenCalledWith("list_org_members", { p_org: ORG_ID });
    expect(rpc).toHaveBeenCalledWith("org_entitlements", { p_org: ORG_ID });
  });

  it("protects the last owner from removal and demotion", async () => {
    renderAs("owner", "u-owner");
    const list = await screen.findByRole("list", { name: "Clinic team members" });
    const ownerRow = within(list).getAllByRole("listitem")[0]!;
    expect(within(ownerRow).getByText(/only owner can't be removed/)).toBeInTheDocument();
    expect(within(ownerRow).queryByRole("button")).toBeNull();
    const adminRow = within(list).getAllByRole("listitem")[1]!;
    expect(within(adminRow).getByRole("button", { name: "Change role" })).toBeInTheDocument();
    expect(within(adminRow).getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it("invites with the roles an owner may give and reports an emailed invitation", async () => {
    const user = userEvent.setup();
    callFunction.mockResolvedValue({ member_id: "m-new", invited: true });
    renderAs("owner", "u-owner");

    await user.click(await screen.findByRole("button", { name: "Invite member" }));
    const dialog = await screen.findByRole("dialog", { name: "Invite a team member" });
    expect(
      within(dialog)
        .getAllByRole("radio")
        .map((radio) => radio.getAttribute("value")),
    ).toEqual(["admin", "receptionist"]);

    await user.type(within(dialog).getByLabelText(/Email/), "  New.Person@Clinic.SA ");
    await user.type(within(dialog).getByLabelText(/Name/), "Huda");
    await user.click(within(dialog).getByRole("radio", { name: /Admin/ }));
    await user.click(within(dialog).getByRole("button", { name: "Send invitation" }));

    await waitFor(() =>
      expect(callFunction).toHaveBeenCalledWith("invite-member", {
        organization_id: ORG_ID,
        email: "new.person@clinic.sa",
        role: "admin",
        full_name: "Huda",
      }),
    );
    expect(
      await screen.findByText(/We emailed an invitation to new.person@clinic.sa/),
    ).toBeInTheDocument();
  });

  it("says when an existing account was added instead", async () => {
    const user = userEvent.setup();
    callFunction.mockResolvedValue({ member_id: "m-new", invited: false });
    renderAs("owner", "u-owner");
    await user.click(await screen.findByRole("button", { name: "Invite member" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/Email/), "known@clinic.sa");
    await user.click(within(dialog).getByRole("button", { name: "Send invitation" }));
    expect(await screen.findByText(/already has a CliniBot account/)).toBeInTheDocument();
  });

  it("explains a seat limit with a link to billing", async () => {
    const user = userEvent.setup();
    callFunction.mockRejectedValue(
      new ApiError({ status: 409, code: "seat_limit", message: "All seats taken" }),
    );
    renderAs("owner", "u-owner");
    await user.click(await screen.findByRole("button", { name: "Invite member" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/Email/), "x@clinic.sa");
    await user.click(within(dialog).getByRole("button", { name: "Send invitation" }));
    expect(await within(dialog).findByText("No seats available")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "See plans" })).toHaveAttribute(
      "href",
      "/app/billing",
    );
  });

  it("says the invitation email failed, with the reference, instead of blaming AI or WhatsApp", async () => {
    const user = userEvent.setup();
    callFunction.mockRejectedValue(
      new ApiError({
        status: 502,
        code: "upstream_error",
        message: "The invitation email could not be sent",
        details: { provider: "supabase_auth" },
        requestId: "req-mail-1",
      }),
    );
    renderAs("owner", "u-owner");
    await user.click(await screen.findByRole("button", { name: "Invite member" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/Email/), "new.person@clinic.sa");
    await user.click(within(dialog).getByRole("button", { name: "Send invitation" }));
    expect(
      await within(dialog).findByText(/We couldn't send the invitation email/),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("req-mail-1")).toBeInTheDocument();
    expect(within(dialog).queryByText(/AI or WhatsApp/)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/outside service/)).not.toBeInTheDocument();
  });

  it("marks an existing member on the email field", async () => {
    const user = userEvent.setup();
    callFunction.mockRejectedValue(
      new ApiError({ status: 409, code: "already_member", message: "Already a member" }),
    );
    renderAs("owner", "u-owner");
    await user.click(await screen.findByRole("button", { name: "Invite member" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/Email/), "admin@clinic.sa");
    await user.click(within(dialog).getByRole("button", { name: "Send invitation" }));
    expect(
      await within(dialog).findByText("This person is already on the clinic's team."),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Email/)).toHaveAttribute("aria-invalid", "true");
  });

  it("lets admins invite receptionists only", async () => {
    const user = userEvent.setup();
    renderAs("admin", "u-admin");
    await user.click(await screen.findByRole("button", { name: "Invite member" }));
    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog)
        .getAllByRole("radio")
        .map((radio) => radio.getAttribute("value")),
    ).toEqual(["receptionist"]);
    expect(
      within(dialog).getByText("As an admin you can invite receptionists only."),
    ).toBeInTheDocument();
  });

  it("disables inviting when every seat is used", async () => {
    mockRpc(entitlements(3, 3));
    renderAs("owner", "u-owner");
    expect(
      await screen.findByText(/All seats on your current plan are in use/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Invite member" })).toBeDisabled();
  });

  it("gives receptionists a read-only view with only 'leave' on their own row", async () => {
    renderAs("receptionist", "u-rec");
    const list = await screen.findByRole("list", { name: "Clinic team members" });
    expect(screen.queryByRole("button", { name: "Invite member" })).toBeNull();
    expect(screen.getByText(/Only the clinic's owners and admins can invite/)).toBeInTheDocument();
    const buttons = within(list).getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual(["Leave clinic"]);
  });

  it("removes a member after confirmation and shows server errors in the dialog", async () => {
    const user = userEvent.setup();
    renderAs("owner", "u-owner");
    const list = await screen.findByRole("list", { name: "Clinic team members" });
    rpc.mockImplementation((name: string) => {
      if (name === "remove_member") {
        return Promise.resolve({
          data: null,
          error: { code: "42501", message: "forbidden", details: null, hint: null },
        });
      }
      if (name === "list_org_members") return Promise.resolve({ data: MEMBERS, error: null });
      return Promise.resolve({ data: entitlements(), error: null });
    });
    await user.click(
      within(within(list).getAllByRole("listitem")[2]!).getByRole("button", { name: "Remove" }),
    );
    const dialog = await screen.findByRole("alertdialog", {
      name: "Remove desk@clinic.sa from the team?",
    });
    await user.click(within(dialog).getByRole("button", { name: "Remove from team" }));
    expect(rpc).toHaveBeenCalledWith("remove_member", { p_member_id: "m-rec" });
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "You don't have permission to do this in this clinic.",
    );
  });

  it("asks owners to confirm before changing their own role", async () => {
    const user = userEvent.setup();
    const twoOwners = MEMBERS.map((member) =>
      member.member_id === "m-admin" ? { ...member, role: "owner" } : member,
    );
    rpc.mockImplementation((name: string) => {
      if (name === "list_org_members") return Promise.resolve({ data: twoOwners, error: null });
      if (name === "org_entitlements")
        return Promise.resolve({ data: entitlements(), error: null });
      return Promise.resolve({ data: null, error: null });
    });
    renderAs("owner", "u-owner");
    const list = await screen.findByRole("list", { name: "Clinic team members" });
    await user.click(
      within(within(list).getAllByRole("listitem")[0]!).getByRole("button", {
        name: "Change role",
      }),
    );
    const dialog = await screen.findByRole("alertdialog");
    const save = within(dialog).getByRole("button", { name: "Save role" });
    expect(save).toBeDisabled();
    await user.click(within(dialog).getByLabelText(/I understand/));
    expect(save).toBeEnabled();
    await user.click(save);
    expect(rpc).toHaveBeenCalledWith("update_member_role", {
      p_member_id: "m-owner",
      p_role: "admin",
    });
  });

  it("shows the role permissions table", async () => {
    renderAs("owner", "u-owner");
    const table = await screen.findByRole("table", { name: "Role permissions in the clinic" });
    const row = within(table).getByRole("row", { name: /Permanently delete the clinic/ });
    expect(within(row).getAllByText("Allowed")).toHaveLength(1);
    expect(within(row).getAllByText("Not allowed")).toHaveLength(2);
  });
});
