import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { safeStorage, STORAGE_KEYS } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { AuthContext, type AuthValue } from "./context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // getSession() waits for the client to finish initialising, including a
    // PKCE ?code= exchange when the page is an auth redirect.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    // Never call other supabase.auth methods inside this callback (it holds a lock).
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
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

  const value = useMemo<AuthValue>(
    () => ({ session, user: session?.user ?? null, loading, signOut }),
    [session, loading, signOut],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
