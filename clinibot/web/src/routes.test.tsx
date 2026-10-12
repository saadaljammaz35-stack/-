import type { Session } from "@supabase/supabase-js";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NotConfigured } from "@/components/layout/NotConfigured";
import { readEnv } from "@/env";
import type { Org } from "@/org/context";
import { renderWithProviders } from "@/test/render";

vi.mock("@/lib/supabase", () => ({
  supabase: { auth: {}, from: vi.fn(), rpc: vi.fn(), functions: { invoke: vi.fn() } },
  initialHref: "",
  isSupabaseConfigured: true,
}));

// The real AuthRoot wires Supabase-backed providers; tests supply fake ones.
vi.mock("@/auth/AuthRoot", async () => {
  const { Outlet } = await import("react-router");
  return { default: () => <Outlet /> };
});

const { AppRoutes } = await import("./routes");

const session = {
  user: { id: "u1", email: "owner@clinic.sa", user_metadata: {} },
} as unknown as Session;
const clinic: Org = {
  id: "o1",
  name: "Smile Dental",
  slug: "smile-dental",
  defaultLanguage: "ar",
  role: "receptionist",
};

describe("routing", () => {
  it("sends signed-out visitors from /app to /login", async () => {
    renderWithProviders(<AppRoutes />, { route: "/app/conversations", lang: "en" });
    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
  });

  it("sends signed-in users without a clinic to onboarding", async () => {
    renderWithProviders(<AppRoutes />, {
      route: "/app",
      lang: "en",
      auth: { session, user: session.user },
    });
    expect(
      await screen.findByRole("heading", { level: 1, name: "Create your clinic" }),
    ).toBeInTheDocument();
  });

  it("renders section stubs inside the shell, including nested paths", async () => {
    renderWithProviders(<AppRoutes />, {
      route: "/app/conversations/123",
      lang: "en",
      auth: { session, user: session.user },
      org: { orgs: [clinic], current: clinic, role: "receptionist" },
    });
    expect(
      await screen.findByRole("heading", { level: 1, name: "Conversations" }),
    ).toBeInTheDocument();
    // Receptionists do not see the audit log link.
    expect(screen.queryAllByRole("link", { name: "Audit log" })).toHaveLength(0);
  });

  it("blocks the audit log for receptionists", async () => {
    renderWithProviders(<AppRoutes />, {
      route: "/app/audit",
      lang: "en",
      auth: { session, user: session.user },
      org: { orgs: [clinic], current: clinic, role: "receptionist" },
    });
    expect(await screen.findByText("You don't have access")).toBeInTheDocument();
  });

  it("shows a 404 for unknown public paths", async () => {
    renderWithProviders(<AppRoutes />, { route: "/nope", lang: "en" });
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
  });
});

describe("configuration", () => {
  it("reports missing and invalid variables", () => {
    expect(readEnv({})).toEqual({
      ok: false,
      missing: ["VITE_SUPABASE_URL", "VITE_SUPABASE_ANON_KEY"],
      invalid: [],
    });
    expect(readEnv({ VITE_SUPABASE_URL: "nope", VITE_SUPABASE_ANON_KEY: "k" })).toMatchObject({
      ok: false,
      invalid: ["VITE_SUPABASE_URL"],
    });
    expect(
      readEnv({ VITE_SUPABASE_URL: "https://x.supabase.co/", VITE_SUPABASE_ANON_KEY: "k" }),
    ).toEqual({
      ok: true,
      supabaseUrl: "https://x.supabase.co",
      supabaseAnonKey: "k",
    });
  });

  it("renders a bilingual not-configured screen", () => {
    render(<NotConfigured missing={["VITE_SUPABASE_URL"]} />);
    expect(screen.getByRole("heading", { name: "التطبيق غير مهيأ بعد" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "CliniBot isn't configured yet" }),
    ).toBeInTheDocument();
    expect(screen.getByText("VITE_SUPABASE_URL")).toBeInTheDocument();
  });
});
