import type { Session, User } from "@supabase/supabase-js";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { UrlAuthResult } from "@/auth/urlAuth";
import type { Org } from "@/org/context";
import { renderWithProviders } from "@/test/render";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getSession: () => Promise.resolve({ data: { session: {} }, error: null }) },
  },
  initialHref: "",
}));

const urlAuth = vi.hoisted(() => ({
  completeAuthFromUrl: vi.fn<() => Promise<UrlAuthResult>>(),
  retryAuthFromUrl: vi.fn<() => Promise<UrlAuthResult>>(),
}));
vi.mock("@/auth/urlAuth", () => urlAuth);

const { default: AuthCallbackPage } = await import("./AuthCallbackPage");

const user = { id: "u1", email: "new@clinic.sa", user_metadata: {} } as unknown as User;
const clinic: Org = {
  id: "o1",
  name: "Smile Dental",
  slug: "smile",
  defaultLanguage: "en",
  role: "owner",
};

function renderPage(signOut = vi.fn(() => Promise.resolve())) {
  renderWithProviders(
    <Routes>
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      <Route path="/app" element={<h1>Dashboard</h1>} />
      <Route path="/login" element={<h1>Sign in</h1>} />
    </Routes>,
    {
      route: "/auth/callback",
      lang: "en",
      auth: { user, session: { user } as unknown as Session, signOut },
      org: { orgs: [clinic], current: clinic, role: "owner" },
    },
  );
  return signOut;
}

describe("AuthCallbackPage", () => {
  it("goes straight on after this browser's own PKCE code", async () => {
    urlAuth.completeAuthFromUrl.mockResolvedValue({ status: "session", type: null, via: "code" });
    renderPage();
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("says which account a link signed in to before going on", async () => {
    const u = userEvent.setup();
    urlAuth.completeAuthFromUrl.mockResolvedValue({
      status: "session",
      type: "signup",
      via: "link",
    });
    renderPage();
    expect(await screen.findByText("new@clinic.sa")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Dashboard" })).not.toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("asks before a link replaces the signed-in account, and uses it only after signing out", async () => {
    const u = userEvent.setup();
    urlAuth.completeAuthFromUrl.mockResolvedValue({
      status: "conflict",
      email: "owner@clinic.sa",
      usedInvite: false,
    });
    urlAuth.retryAuthFromUrl.mockResolvedValue({ status: "session", type: "signup", via: "link" });
    const signOut = renderPage();

    expect(
      await screen.findByRole("heading", { name: "You're signed in with another account" }),
    ).toBeInTheDocument();
    expect(screen.getByText("owner@clinic.sa")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Stay signed in" })).toHaveAttribute("href", "/app");
    expect(urlAuth.retryAuthFromUrl).not.toHaveBeenCalled();

    await u.click(screen.getByRole("button", { name: "Sign out and continue" }));
    await waitFor(() => expect(urlAuth.retryAuthFromUrl).toHaveBeenCalledTimes(1));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signOut.mock.invocationCallOrder[0]).toBeLessThan(
      urlAuth.retryAuthFromUrl.mock.invocationCallOrder[0]!,
    );
  });
});
