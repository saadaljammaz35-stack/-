import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/env";
import type { Database } from "./database.types";

export type TypedSupabaseClient = SupabaseClient<Database>;

/** True when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are present and valid. */
export const isSupabaseConfigured = env.ok;

function createUnconfiguredClient(): TypedSupabaseClient {
  // The app renders the "not configured" screen instead of anything that
  // touches Supabase, so this is never reached in practice. If it is, fail
  // with a clear message instead of an obscure network error.
  return new Proxy({} as TypedSupabaseClient, {
    get() {
      throw new Error(
        "Supabase is not configured: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see web/.env.example).",
      );
    },
  });
}

/**
 * The address the app was opened with, captured before supabase-js starts and
 * strips `?code=` from it. Auth pages read email-link parameters from here.
 */
export const initialHref: string = typeof window === "undefined" ? "" : window.location.href;

/**
 * The single Supabase client for the whole app. Uses the public anon /
 * publishable key only; RLS decides what each signed-in user may read/write.
 */
export const supabase: TypedSupabaseClient = env.ok
  ? createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "clinibot.auth",
      },
    })
  : createUnconfiguredClient();
