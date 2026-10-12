import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router";
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

export function App() {
  return (
    <I18nProvider>
      <ErrorBoundary fullPage>
        <BrowserRouter>
          <ToastProvider>
            <QueryClientProvider client={queryClient}>
              <MutationFeedback />
              <AppRoutes />
            </QueryClientProvider>
          </ToastProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </I18nProvider>
  );
}
