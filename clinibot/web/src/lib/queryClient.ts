import { MutationCache, QueryClient } from "@tanstack/react-query";
import type { MessageKey } from "@/i18n";
import { isPermanentError } from "./errors";

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      /**
       * Set when the component shows the error itself (e.g. inline in a form),
       * so the global error toast is skipped.
       */
      silentError?: boolean;
      /** Toast shown when the mutation succeeds. */
      successMessage?: MessageKey;
    };
  }
}

export interface QueryClientHooks {
  onMutationError?: (error: unknown) => void;
  onMutationSuccess?: (message: MessageKey) => void;
}

/**
 * Shared React Query defaults: one retry for errors that might be transient
 * (never for 4xx such as forbidden / not_found), 30s freshness. Mutation
 * failures are shown as a toast unless `meta: { silentError: true }`.
 */
export function createQueryClient(hooks: QueryClientHooks = {}): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => failureCount < 1 && !isPermanentError(error),
        staleTime: 30_000,
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: false,
      },
    },
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (!mutation.meta?.silentError) hooks.onMutationError?.(error);
      },
      onSuccess: (_data, _variables, _context, mutation) => {
        const message = mutation.meta?.successMessage;
        if (message) hooks.onMutationSuccess?.(message);
      },
    }),
  });
}

/** Query-key helpers so cache invalidation stays consistent across pages. */
export const queryKeys = {
  memberships: (userId: string) => ["memberships", userId] as const,
  /** Prefix every org-scoped key with this so switching clinics never mixes data. */
  org: (orgId: string) => ["org", orgId] as const,
};
