import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import type { MessageKey } from "@/i18n";
import { describeError, isPermanentError } from "./errors";

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
  /**
   * A query or mutation failed because the session may have ended (401
   * unauthorized, or session_expired); AuthProvider checks it and signs out.
   */
  onUnauthorized?: (error: unknown) => void;
}

const hooksByClient = new WeakMap<QueryClient, QueryClientHooks>();

/** The hooks of a client made by createQueryClient(), for providers that fill one in. */
export function queryClientHooks(client: QueryClient): QueryClientHooks | undefined {
  return hooksByClient.get(client);
}

function isSessionError(error: unknown): boolean {
  const { code } = describeError(error);
  return code === "unauthorized" || code === "session_expired";
}

/**
 * Shared React Query defaults: one retry for errors that might be transient
 * (never for 4xx such as forbidden / not_found), 30s freshness. Mutation
 * failures are shown as a toast unless `meta: { silentError: true }`.
 * `hooks` is read when a query fails or a mutation settles, so it can be
 * filled in later by a component that has access to toasts and translations
 * (see App.tsx) or to the session (AuthProvider, via queryClientHooks()).
 */
export function createQueryClient(hooks: QueryClientHooks = {}): QueryClient {
  const client = new QueryClient({
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
    queryCache: new QueryCache({
      onError: (error) => {
        if (isSessionError(error)) hooks.onUnauthorized?.(error);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (isSessionError(error)) hooks.onUnauthorized?.(error);
        if (!mutation.meta?.silentError) hooks.onMutationError?.(error);
      },
      onSuccess: (_data, _variables, _context, mutation) => {
        const message = mutation.meta?.successMessage;
        if (message) hooks.onMutationSuccess?.(message);
      },
    }),
  });
  hooksByClient.set(client, hooks);
  return client;
}

/** Query-key helpers so cache invalidation stays consistent across pages. */
export const queryKeys = {
  memberships: (userId: string) => ["memberships", userId] as const,
  /** Prefix every org-scoped key with this so switching clinics never mixes data. */
  org: (orgId: string) => ["org", orgId] as const,
};
