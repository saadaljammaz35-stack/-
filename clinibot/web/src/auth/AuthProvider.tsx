import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { describeError } from "@/lib/errors";
import { queryClientHooks } from "@/lib/queryClient";
import { safeStorage, STORAGE_KEYS } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { AuthContext, type AuthValue } from "./context";

/** After Auth confirmed the session, further 401s within this time are not re-checked. */
const SESSION_RECHECK_MS = 60_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // The user the cached data belongs to; undefined until the first session is known.
  const lastUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    let active = true;

    // A different user (sign-out, or a sign-in that replaced the session) must
    // never see the previous user's cached clinic data or remembered clinic.
    const noteUser = (next: Session | null) => {
      const nextId = next?.user.id ?? null;
      if (lastUserId.current !== undefined && lastUserId.current !== nextId) {
        queryClient.clear();
        safeStorage.remove(STORAGE_KEYS.currentOrg);
      }
      lastUserId.current = nextId;
    };

    // getSession() waits for the client to finish initialising, including a
    // PKCE ?code= exchange when the page is an auth redirect.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        if (lastUserId.current === undefined) lastUserId.current = data.session?.user.id ?? null;
        setSession(data.session);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    // Never call other supabase.auth methods inside this callback (it holds a lock).
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      // No supabase.auth calls here: clearing the query cache and storage is safe.
      noteUser(next);
      setSession(next);
      setLoading(false);
      if (event === "SIGNED_OUT") queryClient.clear();
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient]);

  const signOut = useCallback(async () => {
    // "local": this browser only. Staff often share reception computers, so
    // drop every cached query and the remembered clinic too.
    await supabase.auth.signOut({ scope: "local" });
    queryClient.clear();
    safeStorage.remove(STORAGE_KEYS.currentOrg);
    setSession(null);
  }, [queryClient]);

  // An Edge Function answered 401 (e.g. the session was revoked while the access
  // token is still valid, so PostgREST keeps working): ask Auth whether the
  // session still exists and sign out if not. ProtectedRoute then sends the
  // user to /login?next=<this page>.
  useEffect(() => {
    const hooks = queryClientHooks(queryClient);
    if (!hooks) return;
    let checking: Promise<void> | null = null;
    let confirmedAt = 0;
    const onUnauthorized = () => {
      // Several queries fail together: one check, and none right after one that passed.
      if (checking || Date.now() - confirmedAt < SESSION_RECHECK_MS) return;
      checking = (async () => {
        const { data, error } = await supabase.auth.getUser();
        if (data.user) {
          confirmedAt = Date.now(); // the session is fine: the 401 came from somewhere else
          return;
        }
        const info = describeError(error);
        // Never sign out because Auth could not be reached or is failing.
        if (info.code === "network_error" || info.code === "rate_limited") return;
        if (info.status !== null && info.status >= 500) return;
        // session_not_found: auth-js has already removed the session. Other cases
        // (e.g. a deleted user) need the sign-out; it is local and harmless either way.
        await signOut();
      })()
        .catch(() => {})
        .finally(() => {
          checking = null;
        });
    };
    hooks.onUnauthorized = onUnauthorized;
    return () => {
      if (hooks.onUnauthorized === onUnauthorized) hooks.onUnauthorized = undefined;
    };
  }, [queryClient, signOut]);

  const value = useMemo<AuthValue>(
    () => ({ session, user: session?.user ?? null, loading, signOut }),
    [session, loading, signOut],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
