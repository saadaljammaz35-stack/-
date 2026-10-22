import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberRole } from "@/org/context";
import { renderWithProviders } from "@/test/render";
import { filtersByOrg, type createFakeSupabase } from "./fakeSupabase";

const ORG_ID = "33333333-3333-4333-8333-333333333333";

const fake = vi.hoisted(() => ({ current: null as ReturnType<typeof createFakeSupabase> | null }));
vi.mock("@/lib/supabase", async () => {
  const { createFakeSupabase: create } = await import("./fakeSupabase");
  fake.current = create();
  return { supabase: fake.current.client };
});

const { default: KnowledgePage } = await import("@/pages/app/KnowledgePage");

function db() {
  if (!fake.current) throw new Error("supabase mock not initialised");
  return fake.current;
}

const SERVICES = [
  {
    id: "s1",
    name_ar: "تنظيف الأسنان",
    name_en: "Teeth cleaning",
    description_ar: null,
    description_en: null,
    price_type: "fixed",
    price_sar: "250.00",
    duration_minutes: 30,
    is_active: true,
    sort_order: 0,
    created_at: "2026-10-01T08:00:00Z",
  },
  {
    id: "s2",
    name_ar: "تبييض",
    name_en: null,
    description_ar: null,
    description_en: null,
    price_type: "starting_from",
    price_sar: 900,
    duration_minutes: null,
    is_active: true,
    sort_order: 1,
    created_at: "2026-10-01T09:00:00Z",
  },
  {
    id: "s3",
    name_ar: null,
    name_en: "Implants",
    description_ar: null,
    description_en: null,
    price_type: "on_consultation",
    price_sar: null,
    duration_minutes: 90,
    is_active: false,
    sort_order: 2,
    created_at: "2026-10-01T10:00:00Z",
  },
];

function renderAs(role: MemberRole, lang: "ar" | "en" = "en") {
  const org = {
    id: ORG_ID,
    name: "Smile Clinic",
    slug: "smile",
    defaultLanguage: "ar" as const,
    role,
  };
  return renderWithProviders(<KnowledgePage />, {
    route: "/app/knowledge",
    lang,
    org: { current: org, orgs: [org], role },
  });
}

describe("KnowledgePage", () => {
  beforeEach(() => {
    db().reset();
    db().tables.clinic_services = SERVICES;
    db().tables.approved_faqs = [];
  });

  it("shows the three price styles and filters reads by clinic", async () => {
    renderAs("owner");
    const list = await screen.findByRole("list", { name: "Services" });
    expect(within(list).getByText("SAR 250")).toBeInTheDocument();
    expect(within(list).getByText("From SAR 900")).toBeInTheDocument();
    expect(within(list).getByText("Set after consultation")).toBeInTheDocument();
    // English first, Arabic as the secondary line.
    expect(within(list).getByText("Teeth cleaning")).toBeInTheDocument();
    expect(within(list).getByText("تنظيف الأسنان")).toBeInTheDocument();

    const reads = db().queries.filter((query) => query.op === "select");
    expect(reads.length).toBeGreaterThan(0);
    for (const read of reads) expect(filtersByOrg(read, ORG_ID)).toBe(true);
  });

  it("is read-only for receptionists", async () => {
    renderAs("receptionist");
    expect(await screen.findByText("View only")).toBeInTheDocument();
    await screen.findByRole("list", { name: "Services" });
    expect(screen.queryByRole("button", { name: "Add service" })).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Delete/ })).not.toBeInTheDocument();
  });

  it("requires a price unless the service is priced after consultation", async () => {
    const user = userEvent.setup();
    renderAs("owner");
    await user.click(await screen.findByRole("button", { name: "Add service" }));
    const dialog = await screen.findByRole("dialog");

    await user.type(within(dialog).getByLabelText(/^Service name in English/), "Braces");
    await user.click(within(dialog).getByRole("button", { name: "Add service" }));
    expect(
      await within(dialog).findByText("Enter the price, or choose “Set after consultation”."),
    ).toBeInTheDocument();
    expect(db().writes("clinic_services")).toHaveLength(0);

    await user.selectOptions(within(dialog).getByLabelText(/^Pricing/), "on_consultation");
    expect(within(dialog).queryByLabelText(/^Price in SAR/)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Add service" }));

    await waitFor(() => expect(db().writes("clinic_services", "insert")).toHaveLength(1));
    const [insert] = db().writes("clinic_services", "insert");
    expect(insert?.payload).toEqual({
      name_ar: null,
      name_en: "Braces",
      description_ar: null,
      description_en: null,
      price_type: "on_consultation",
      price_sar: null,
      duration_minutes: null,
      is_active: true,
      organization_id: ORG_ID,
      sort_order: 3,
    });
    expect(await screen.findByText("Service added.")).toBeInTheDocument();
  });

  it("updates only granted columns, filtered by clinic and id", async () => {
    const user = userEvent.setup();
    renderAs("owner");
    const list = await screen.findByRole("list", { name: "Services" });
    await user.click(within(list).getByRole("switch", { name: /Teeth cleaning/ }));

    await waitFor(() => expect(db().writes("clinic_services", "update")).toHaveLength(1));
    const [update] = db().writes("clinic_services", "update");
    expect(update?.payload).toEqual({ is_active: false });
    expect(filtersByOrg(update!, ORG_ID)).toBe(true);
    expect(update?.filters).toContainEqual(["eq", "id", "s1"]);
  });

  it("moves a service down by swapping sort_order with its neighbour", async () => {
    const user = userEvent.setup();
    renderAs("owner");
    await screen.findByRole("list", { name: "Services" });
    await user.click(screen.getByRole("button", { name: "Move “Teeth cleaning” down" }));

    await waitFor(() => expect(db().writes("clinic_services", "update")).toHaveLength(2));
    const payloads = db()
      .writes("clinic_services", "update")
      .map((query) => [query.filters.find(([, column]) => column === "id")?.[2], query.payload]);
    expect(payloads).toEqual([
      ["s2", { sort_order: 0 }],
      ["s1", { sort_order: 1 }],
    ]);
  });

  it("keeps keyboard focus in the list after deleting a service", async () => {
    const user = userEvent.setup();
    db().respond = (query) => {
      if (query.table === "clinic_services" && query.op === "delete") {
        db().tables.clinic_services = SERVICES.filter((service) => service.id !== "s2");
      }
      return undefined;
    };
    renderAs("owner");
    await screen.findByRole("list", { name: "Services" });
    await user.click(screen.getByRole("button", { name: "Delete “تبييض”" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    // The deleted row took its button along: focus goes to the row now in its place.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Edit “Implants”" })).toHaveFocus(),
    );
    expect(screen.queryByText("تبييض")).not.toBeInTheDocument();
  });

  it("focuses the new service after adding the first one from the empty state", async () => {
    const user = userEvent.setup();
    db().tables.clinic_services = [];
    db().respond = (query) => {
      if (query.table === "clinic_services" && query.op === "insert") {
        db().tables.clinic_services = [{ ...SERVICES[2], id: "new-row-id" }];
      }
      return undefined;
    };
    renderAs("owner");
    await user.click(await screen.findByRole("button", { name: "Add service" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/^Service name in English/), "Implants");
    await user.selectOptions(within(dialog).getByLabelText(/^Pricing/), "on_consultation");
    await user.click(within(dialog).getByRole("button", { name: "Add service" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Edit “Implants”" })).toHaveFocus(),
    );
  });
});
