import {
  AuthApiError,
  AuthRetryableFetchError,
  type AuthChangeEvent,
  type Session,
} from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/apiError";
import { createQueryClient, type QueryClientHooks } from "@/lib/queryClient";
import { safeStorage, STORAGE_KEYS } from "@/lib/storage";

type Listener = (event: AuthChangeEvent, session: Session | null) => void;

const auth = vi.hoisted(() => ({
  listener: null as Listener | null,
  getSession: vi.fn(),
  getUser: vi.fn(),
  refreshSession: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: auth.getSession,
      getUser: auth.getUser,
      refreshSession: auth.refreshSession,
      signOut: auth.signOut,
      onAuthStateChange: (listener: Listener) => {
        auth.listener = listener;
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },
  },
}));

const { AuthProvider } = await import("./AuthProvider");

function session(userId: string): Session {
  return { user: { id: userId, email: `${userId}@clinic.sa` } } as unknown as Session;
}

function setup() {
  const queryClient = new QueryClient();
  auth.getSession.mockResolvedValue({ data: { session: session("u1") }, error: null });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <span />
      </AuthProvider>
    </QueryClientProvider>,
  );
  const emit = (event: AuthChangeEvent, next: Session | null) =>
    act(() => auth.listener?.(event, next));
  const seed = () => {
    queryClient.setQueryData(["memberships", "u1"], [{ id: "clinic-a" }]);
    safeStorage.set(STORAGE_KEYS.currentOrg, "clinic-a");
  };
  const cached = () => queryClient.getQueryData(["memberships", "u1"]);
  return { emit, seed, cached };
}

describe("AuthProvider", () => {
  it("keeps the cache and the remembered clinic while the same user stays signed in", async () => {
    const { emit, seed, cached } = setup();
    emit("INITIAL_SESSION", session("u1"));
    seed();
    emit("TOKEN_REFRESHED", session("u1"));
    emit("SIGNED_IN", session("u1"));
    await waitFor(() => expect(auth.getSession).toHaveBeenCalled());
    expect(cached()).toEqual([{ id: "clinic-a" }]);
    expect(safeStorage.get(STORAGE_KEYS.currentOrg)).toBe("clinic-a");
  });

  it("drops the previous user's cache and remembered clinic when another user signs in", () => {
    const { emit, seed, cached } = setup();
    emit("INITIAL_SESSION", session("u1"));
    seed();
    // A link swapped the session: SIGNED_IN, not SIGNED_OUT.
    emit("SIGNED_IN", session("attacker"));
    expect(cached()).toBeUndefined();
    expect(safeStorage.get(STORAGE_KEYS.currentOrg)).toBeNull();
  });

  it("drops them when the session ends without signOut()", () => {
    const { emit, seed, cached } = setup();
    emit("INITIAL_SESSION", session("u1"));
    seed();
    emit("SIGNED_OUT", null);
    expect(cached()).toBeUndefined();
    expect(safeStorage.get(STORAGE_KEYS.currentOrg)).toBeNull();
  });
});

describe("AuthProvider after a 401 from an Edge Function", () => {
  beforeEach(() => {
    auth.getUser.mockReset();
    auth.refreshSession.mockReset();
    auth.refreshSession.mockResolvedValue({
      data: { session: null, user: null },
      error: new AuthApiError("Invalid Refresh Token", 400, "refresh_token_not_found"),
    });
    auth.signOut.mockReset();
    auth.signOut.mockResolvedValue({ error: null });
    auth.getSession.mockResolvedValue({ data: { session: session("u1") }, error: null });
  });

  async function setupWithHooks() {
    const hooks: QueryClientHooks = {};
    const queryClient = createQueryClient(hooks);
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <span />
        </AuthProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(hooks.onUnauthorized).toBeTypeOf("function"));
    const failQuery = (key: string, code = "unauthorized", status = 401) =>
      queryClient
        .fetchQuery({
          queryKey: [key],
          queryFn: () => Promise.reject(new ApiError({ status, code, message: code })),
        })
        .catch(() => {});
    return { failQuery };
  }

  it("signs out (once) when Auth no longer knows the session", async () => {
    let answer: (value: unknown) => void = () => {};
    auth.getUser.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    const { failQuery } = await setupWithHooks();
    await failQuery("status");
    await failQuery("dashboard");
    expect(auth.getUser).toHaveBeenCalledTimes(1);
    answer({
      data: { user: null },
      error: new AuthApiError("Session not found", 403, "session_not_found"),
    });
    await waitFor(() => expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" }));
  });

  it("refreshes instead of signing out when the access token has expired", async () => {
    auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new AuthApiError("invalid JWT: token is expired", 403, "bad_jwt"),
    });
    auth.refreshSession.mockResolvedValue({
      data: { session: session("u1"), user: { id: "u1" } },
      error: null,
    });
    const { failQuery } = await setupWithHooks();
    await failQuery("status");
    await waitFor(() => expect(auth.refreshSession).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it("does not sign out when the refresh could not reach Auth", async () => {
    auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new AuthApiError("invalid JWT: token is expired", 403, "bad_jwt"),
    });
    auth.refreshSession.mockResolvedValue({
      data: { session: null, user: null },
      error: new AuthRetryableFetchError("Failed to fetch", 0),
    });
    const { failQuery } = await setupWithHooks();
    await failQuery("status");
    await waitFor(() => expect(auth.refreshSession).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it("stays signed in when the session is still valid, and does not ask again right away", async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    const { failQuery } = await setupWithHooks();
    await failQuery("status");
    await waitFor(() => expect(auth.getUser).toHaveBeenCalledTimes(1));
    await failQuery("other");
    await Promise.resolve();
    expect(auth.getUser).toHaveBeenCalledTimes(1);
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it("never signs out because Auth could not be reached", async () => {
    auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new AuthRetryableFetchError("Failed to fetch", 0),
    });
    const { failQuery } = await setupWithHooks();
    await failQuery("status");
    await waitFor(() => expect(auth.getUser).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it("does not re-check the session on a 403 from a membership check", async () => {
    const { failQuery } = await setupWithHooks();
    await failQuery("status", "forbidden", 403);
    await failQuery("status2", "insufficient_role", 403);
    expect(auth.getUser).not.toHaveBeenCalled();
  });
});
