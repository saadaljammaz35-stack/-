import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
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
                  </Route>
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
});
