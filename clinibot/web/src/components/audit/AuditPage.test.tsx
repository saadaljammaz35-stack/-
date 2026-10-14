import type { User } from "@supabase/supabase-js";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberRole, Org } from "@/org/context";
import { renderWithProviders } from "@/test/render";

const ORG_ID = "44444444-4444-4444-8444-444444444444";

interface Call {
  table: string;
  steps: [string, ...unknown[]][];
}

const calls: Call[] = [];
let pages: Record<string, unknown>[][] = [];
const rpc = vi.fn();

function entry(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    created_at: "2026-10-12T09:30:00Z",
    actor_type: "user",
    actor_user_id: "u-owner",
    action: "clinic_settings.update",
    entity_type: "clinic_settings",
    details: { changed: ["working_hours"] },
    ...overrides,
  };
}

function from(table: string) {
  const call: Call = { table, steps: [] };
  calls.push(call);
  const chain: Record<string, unknown> = {};
  for (const step of ["select", "eq", "in", "lt", "order", "limit"]) {
    chain[step] = (...args: unknown[]) => {
      call.steps.push([step, ...args]);
      return chain;
    };
  }
  chain.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => {
    const page = calls.filter((item) => item.table === "audit_logs").length - 1;
    return Promise.resolve({ data: pages[page] ?? [], error: null }).then(resolve, reject);
  };
  return chain;
}

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (table: string) => from(table),
    rpc: (...args: unknown[]) => rpc(...args) as unknown,
  },
}));

const { default: AuditPage } = await import("@/pages/app/AuditPage");

const MEMBERS = [
  {
    member_id: "m-owner",
    user_id: "u-owner",
    role: "owner",
    email: "owner@clinic.sa",
    full_name: "Rana Owner",
    created_at: "2026-10-01T00:00:00Z",
  },
  {
    member_id: "m-rec",
    user_id: "u-rec",
    role: "receptionist",
    email: "desk@clinic.sa",
    full_name: null,
    created_at: "2026-10-02T00:00:00Z",
  },
];

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname + location.search}</p>;
}

function renderAs(role: MemberRole, route = "/app/audit") {
  const org: Org = { id: ORG_ID, name: "Smile Clinic", slug: "smile", defaultLanguage: "ar", role };
  return renderWithProviders(
    <>
      <Routes>
        <Route path="/app/audit/*" element={<AuditPage />} />
      </Routes>
      <Where />
    </>,
    {
      route,
      lang: "en",
      auth: { user: { id: "u-owner" } as User },
      org: { current: org, orgs: [org], role },
    },
  );
}

function auditCalls() {
  return calls.filter((call) => call.table === "audit_logs");
}

beforeEach(() => {
  calls.length = 0;
  pages = [];
  rpc.mockReset();
  rpc.mockImplementation((name: string) =>
    Promise.resolve(
      name === "list_org_members" ? { data: MEMBERS, error: null } : { data: null, error: null },
    ),
  );
});

describe("AuditPage", () => {
  it("lists the clinic's entries newest first with readable labels", async () => {
    pages = [
      [
        entry(9, {
          action: "organization_members.update",
          details: {
            changed: ["role"],
            user_id: "u-rec",
            role_from: "receptionist",
            role_to: "admin",
          },
        }),
        entry(8, {
          actor_type: "webhook",
          actor_user_id: null,
          action: "whatsapp.webhook_verified",
          details: { status: "connected" },
        }),
        entry(7, { actor_user_id: "u-gone", action: "custom.future_action", details: {} }),
        entry(6),
      ],
    ];
    renderAs("owner");
    const table = await screen.findByRole("table", { name: "Audit log, newest first" });

    expect(within(table).getByText("Team member's role changed")).toBeInTheDocument();
    expect(within(table).getByText("Meta verified the WhatsApp webhook")).toBeInTheDocument();
    expect(within(table).getByText("custom.future_action")).toBeInTheDocument();
    expect(within(table).getByText("Clinic settings updated")).toBeInTheDocument();
    // Actor names come from list_org_members; automated entries are the system.
    expect(within(table).getAllByText("Rana Owner").length).toBeGreaterThan(0);
    expect(within(table).getByText("System")).toBeInTheDocument();
    expect(within(table).getByText("Former member")).toBeInTheDocument();
    // Details: column names and role change in words, the member by name.
    expect(within(table).getByText("Working hours")).toBeInTheDocument();
    expect(within(table).getByText("Connected")).toBeInTheDocument();
    expect(within(table).getByText("desk@clinic.sa")).toBeInTheDocument();
    expect(table).toHaveTextContent("Role: Receptionist → Admin");
    expect(table).toHaveTextContent("Fields changed: Role");

    const [query] = auditCalls();
    expect(query!.steps).toContainEqual(["eq", "organization_id", ORG_ID]);
    expect(query!.steps).toContainEqual(["order", "id", { ascending: false }]);
    expect(query!.steps).toContainEqual(["limit", 51]);
    expect(rpc).toHaveBeenCalledWith("list_org_members", { p_org: ORG_ID });
    expect(screen.getByText("This is the oldest activity on record.")).toBeInTheDocument();
  });

  it("loads 50 at a time and continues after the last id", async () => {
    const user = userEvent.setup();
    pages = [
      Array.from({ length: 51 }, (_, index) => entry(200 - index)),
      [entry(100, { action: "approved_faqs.insert", details: {} })],
    ];
    renderAs("admin");
    expect(await screen.findByText("Showing: 50")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show more" }));
    expect(await screen.findByText("Showing: 51")).toBeInTheDocument();
    const second = auditCalls()[1]!;
    expect(second.steps).toContainEqual(["lt", "id", 151]);
    expect(second.steps).toContainEqual(["eq", "organization_id", ORG_ID]);
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });

  it("filters by category and keeps the filter in the URL", async () => {
    const user = userEvent.setup();
    pages = [[entry(5)], []];
    renderAs("owner");
    await screen.findByRole("table");
    await user.selectOptions(screen.getByLabelText("Activity type"), "team");
    expect(await screen.findByText("No activity of this type")).toBeInTheDocument();
    const filtered = auditCalls()[1]!;
    const inStep = filtered.steps.find(([step]) => step === "in");
    expect(inStep?.[1]).toBe("action");
    expect(inStep?.[2]).toEqual(
      expect.arrayContaining(["member.invited", "organization_members.update"]),
    );
    expect(inStep?.[2]).not.toContain("clinic_settings.update");
    expect(screen.getByTestId("where")).toHaveTextContent("/app/audit?type=team");
    await user.click(screen.getByRole("button", { name: "Show all activity" }));
    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent(/^\/app\/audit$/));
  });

  it("never labels people as former members when the team list fails to load", async () => {
    rpc.mockImplementation(() =>
      Promise.resolve({ data: null, error: { code: "XX000", message: "boom", hint: null } }),
    );
    pages = [[entry(3)]];
    renderAs("owner");
    expect(await screen.findByText(/couldn't load the team's names/)).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getByText("Name unavailable")).toBeInTheDocument();
    expect(within(table).queryByText("Former member")).toBeNull();
  });

  it("shows an honest empty state", async () => {
    pages = [[]];
    renderAs("owner");
    expect(await screen.findByText("No activity recorded yet")).toBeInTheDocument();
  });

  it("does not query the log for receptionists", async () => {
    renderAs("receptionist");
    expect(await screen.findByText("The audit log is for owners and admins")).toBeInTheDocument();
    expect(auditCalls()).toHaveLength(0);
  });
});
