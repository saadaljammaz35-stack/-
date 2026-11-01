"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { env, isSupabaseConfigured } from "../env";

let client: SupabaseClient<Database> | null = null;

/** Browser client used by the admin area (sign-in and image uploads) */
export function getBrowserClient(): SupabaseClient<Database> | null {
  if (!isSupabaseConfigured()) return null;
  if (!client) client = createBrowserClient<Database>(env.supabaseUrl, env.supabaseAnonKey);
  return client;
}
