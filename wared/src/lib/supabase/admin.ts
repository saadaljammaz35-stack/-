import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/env';
import { serverEnv } from '@/lib/server-env';

let client: SupabaseClient | null = null;

/**
 * Service-role client. Bypasses RLS, so only call it from server code that has already validated input and,
 * where relevant, checked the caller's permission.
 */
export function getServiceClient(): SupabaseClient | null {
  if (!publicEnv.supabaseUrl || !serverEnv.supabaseSecretKey) return null;
  client ??= createClient(publicEnv.supabaseUrl, serverEnv.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}
