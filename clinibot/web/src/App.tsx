import { useEffect, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, useLocation } from "react-router";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";
import { ToastProvider, useToast } from "@/components/ui";
import { I18nProvider, useI18n } from "@/i18n";
import { errorText } from "@/lib/errors";
import { createQueryClient, type QueryClientHooks } from "@/lib/queryClient";
import { AppRoutes } from "./routes";

// One client for the app. Mutation feedback is wired up by <MutationFeedback />.
const mutationFeedback: QueryClientHooks = {};
const queryClient = createQueryClient(mutationFeedback);

/** Shows failed mutations (and `meta.successMessage`) as translated toasts. */
function MutationFeedback() {
  const toast = useToast();
  const { t } = useI18n();
  useEffect(() => {
    mutationFeedback.onMutationError = (error) => toast.error(errorText(t, error));
    mutationFeedback.onMutationSuccess = (message) => toast.success(t(message));
  }, [t, toast]);
  return null;
}

/**
 * Clears a page error when the path changes (links, back and forward) on the
 * public and auth pages too; /app/* has its own boundary in AppShell.
 */
function RouteBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary fullPage resetKey={pathname}>
      {children}
    </ErrorBoundary>
  );
}

export function App() {
  return (
    <I18nProvider>
      {/* Last resort, outside the router. */}
      <ErrorBoundary fullPage>
        <BrowserRouter>
          <RouteBoundary>
            <ToastProvider>
              <QueryClientProvider client={queryClient}>
                <MutationFeedback />
                <AppRoutes />
              </QueryClientProvider>
            </ToastProvider>
          </RouteBoundary>
        </BrowserRouter>
      </ErrorBoundary>
    </I18nProvider>
  );
}
