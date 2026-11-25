import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isSupabaseConfigured, publicEnv } from '@/lib/env';

export const CONTENT_CACHE_TAG = 'content';

let client: SupabaseClient | null = null;

/**
 * Cookie-less client for public pages. Queries run as the anon role, so RLS only returns live content, and
 * responses go through Next's data cache (tag "content", revalidated on publish and every 60 seconds).
 */
export function getPublicClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  client ??= createClient(publicEnv.supabaseUrl!, publicEnv.supabasePublishableKey!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, next: { revalidate: 60, tags: [CONTENT_CACHE_TAG] } } as RequestInit),
    },
  });
  return client;
}
