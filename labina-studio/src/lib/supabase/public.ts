import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { env, isSupabaseConfigured } from "../env";

let client: SupabaseClient<Database> | null = null;

/**
 * Cookie-less client for public reads and public RPCs (booking, contact).
 * Uses only the anon key; Row Level Security decides what it can see.
 * Being cookie-less keeps public pages statically renderable.
 */
export function getPublicClient(): SupabaseClient<Database> | null {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return client;
}
