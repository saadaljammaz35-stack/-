import { useEffect, useRef, useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router";
import { AuthProvider } from "@/auth/AuthProvider";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";
import { ToastProvider, useToast } from "@/components/ui";
import { I18nProvider, useI18n } from "@/i18n";
import { errorText } from "@/lib/errors";
import { createQueryClient } from "@/lib/queryClient";
import { OrgProvider } from "@/org/OrgProvider";
import { AppRoutes } from "./routes";

/** React Query with failed mutations surfaced as a translated toast. */
function QueryProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const { t } = useI18n();
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
  const [client] = useState(() =>
    createQueryClient({
      onMutationError: (error) => toast.error(errorText(tRef.current, error)),
      onMutationSuccess: (message) => toast.success(tRef.current(message)),
    }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export function App() {
  return (
    <I18nProvider>
      <ErrorBoundary fullPage>
        <BrowserRouter>
          <ToastProvider>
            <QueryProvider>
              <AuthProvider>
                <OrgProvider>
                  <AppRoutes />
                </OrgProvider>
              </AuthProvider>
            </QueryProvider>
          </ToastProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </I18nProvider>
  );
}
