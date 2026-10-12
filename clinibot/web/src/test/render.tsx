import type { ReactElement, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderResult } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { AuthContext, type AuthValue } from "@/auth/context";
import { ToastProvider } from "@/components/ui";
import { I18nProvider, type Lang } from "@/i18n";
import { OrgContext, type OrgValue } from "@/org/context";

export interface RenderOptions {
  route?: string;
  lang?: Lang;
  auth?: Partial<AuthValue>;
  org?: Partial<OrgValue>;
}

/** Renders with every app provider, using fake auth/org values (no network). */
export function renderWithProviders(ui: ReactElement, options: RenderOptions = {}): RenderResult {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const auth: AuthValue = {
    session: null,
    user: null,
    loading: false,
    signOut: () => Promise.resolve(),
    ...options.auth,
  };
  const org: OrgValue = {
    orgs: [],
    current: null,
    role: null,
    setCurrentOrg: () => {},
    refresh: () => Promise.resolve([]),
    loading: false,
    error: null,
    ...options.org,
  };
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <I18nProvider initialLang={options.lang ?? "ar"}>
        <MemoryRouter initialEntries={[options.route ?? "/"]}>
          <QueryClientProvider client={queryClient}>
            <ToastProvider>
              <AuthContext value={auth}>
                <OrgContext value={org}>{children}</OrgContext>
              </AuthContext>
            </ToastProvider>
          </QueryClientProvider>
        </MemoryRouter>
      </I18nProvider>
    );
  }
  return render(ui, { wrapper: Wrapper });
}
