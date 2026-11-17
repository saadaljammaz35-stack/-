import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { env, isBackendConfigured } from '@/config/env';

import { createChunkedStorage } from './auth/secureSessionStorage';

let client: SupabaseClient | null = null;

/** Returns null when the backend is not configured: the app then runs in local-only mode. */
export function getSupabase(): SupabaseClient | null {
  if (!isBackendConfigured()) return null;
  if (client) return client;
  client = createClient(env.supabaseUrl, env.supabasePublishableKey, {
    auth: {
      storage: createChunkedStorage(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
    },
  });
  if (Platform.OS !== 'web') {
    // Refresh tokens only while the app is in the foreground.
    AppState.addEventListener('change', (state) => {
      if (state === 'active') client?.auth.startAutoRefresh();
      else client?.auth.stopAutoRefresh();
    });
  }
  return client;
}
