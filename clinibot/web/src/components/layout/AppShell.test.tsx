import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import { AuthContext, type AuthValue } from "@/auth/context";
import { ToastProvider } from "@/components/ui";
import { I18nProvider } from "@/i18n";
import { OrgContext, type Org } from "@/org/context";
import { useCurrentOrg } from "@/org/useOrg";
import { AppShell } from "./AppShell";

const clinics: Org[] = [
  { id: "a", name: "Clinic A", slug: "clinic-a", defaultLanguage: "en", role: "owner" },
  { id: "b", name: "Clinic B", slug: "clinic-b", defaultLanguage: "en", role: "owner" },
];

const auth: AuthValue = {
  session: null,
  user: null,
  loading: false,
  signOut: () => Promise.resolve(),
};

/** A real clinic switch: setCurrentOrg changes `current`, as OrgProvider does. */
function SwitchableOrg({ children }: { children: ReactNode }) {
  const [currentId, setCurrentId] = useState("a");
  const current = clinics.find((org) => org.id === currentId)!;
  return (
    <OrgContext
      value={{
        orgs: clinics,
        current,
        role: current.role,
        setCurrentOrg: setCurrentId,
        refresh: () => Promise.resolve(clinics),
        loading: false,
        error: null,
      }}
    >
      {children}
    </OrgContext>
  );
}

/** Stands in for a page with local state (a test transcript, a one-time token). */
function StatefulPage() {
  const org = useCurrentOrg();
  const [note, setNote] = useState<string | null>(null);
  return (
    <>
      <h1>{org.name}</h1>
      <button type="button" onClick={() => setNote(`token for ${org.name}`)}>
        Make note
      </button>
      {note && <p>{note}</p>}
    </>
  );
}

function renderShell() {
  return render(
    <I18nProvider initialLang="en">
      <MemoryRouter initialEntries={["/app/whatsapp"]}>
        <QueryClientProvider client={new QueryClient()}>
          <ToastProvider>
            <AuthContext value={auth}>
              <SwitchableOrg>
                <Routes>
                  <Route path="/app" element={<AppShell />}>
                    <Route path="whatsapp/*" element={<StatefulPage />} />
                    <Route path="appointments/*" element={<h1>Appointments page</h1>} />
                  </Route>
                  <Route path="/onboarding" element={<h1>Onboarding page</h1>} />
                </Routes>
              </SwitchableOrg>
            </AuthContext>
          </ToastProvider>
        </QueryClientProvider>
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe("AppShell", () => {
  it("remounts the page on a clinic switch, so no page state carries over", async () => {
    const user = userEvent.setup();
    renderShell();

    await user.click(await screen.findByRole("button", { name: "Make note" }));
    expect(screen.getByText("token for Clinic A")).toBeInTheDocument();

    // Same section path (/app/whatsapp) before and after the switch.
    await user.click(screen.getAllByRole("button", { name: "Switch clinic: Clinic A" })[0]!);
    await user.click(await screen.findByRole("menuitemradio", { name: "Clinic B" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Clinic B" })).toBeInTheDocument();
    expect(screen.queryByText(/token for/)).not.toBeInTheDocument();
  });

  it("moves focus to the page after a sidebar link, so screen readers notice the new page", async () => {
    const user = userEvent.setup();
    renderShell();
    await screen.findByRole("heading", { level: 1, name: "Clinic A" });

    const nav = screen.getAllByRole("navigation", { name: "Main navigation" })[0]!;
    await user.click(within(nav).getByRole("link", { name: "Appointments" }));

    expect(await screen.findByRole("heading", { name: "Appointments page" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveFocus();
  });

  it("reaches 'Add a clinic' in the clinic switcher with the arrow keys", async () => {
    const user = userEvent.setup();
    renderShell();
    const trigger = screen.getAllByRole("button", { name: "Switch clinic: Clinic A" })[0]!;
    trigger.focus();
    await user.keyboard("{ArrowDown}");
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByRole("menuitemradio", { name: "Clinic A" })).toHaveFocus();

    await user.keyboard("{ArrowDown}{ArrowDown}");
    const add = within(menu).getByRole("menuitem", { name: "Add a clinic" });
    expect(add).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(await screen.findByRole("heading", { name: "Onboarding page" })).toBeInTheDocument();
  });

  it("closes only the clinic switcher on Escape inside the phone menu", async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(await screen.findByRole("button", { name: "Open menu" }));
    const sheet = screen.getByRole("dialog", { name: "Menu" });
    const trigger = within(sheet).getByRole("button", { name: "Switch clinic: Clinic A" });

    await user.click(trigger);
    expect(within(sheet).getByRole("menu")).toBeInTheDocument();
    await user.keyboard("{Escape}");

    expect(within(sheet).queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Menu" })).toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());

    // The next Escape closes the menu sheet itself.
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Menu" })).not.toBeInTheDocument();
  });
});
