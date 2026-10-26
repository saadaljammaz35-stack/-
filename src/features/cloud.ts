// The app's optional online service (Supabase), used by group khatmas and, when switched on,
// by account sync. Configured in app.json → expo.extra.cloud (the URL and the publishable
// key are public by design; the database only allows what its functions permit), or by the
// EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY build variables.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

type CloudExtra = { url?: string; publishableKey?: string; accountSync?: boolean };
const extra = ((Constants.expoConfig?.extra ?? {}) as { cloud?: CloudExtra }).cloud ?? {};

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL || extra.url;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra.publishableKey;

export const cloudAvailable = Boolean(URL && KEY);
/** Account sign-in and sync stay off until the project's sign-in email is set up. */
export const accountSyncEnabled = cloudAvailable && extra.accountSync === true;

// Session tokens live in the platform keychain / keystore.
const secureStorage = {
  getItem: (k: string) => (Platform.OS === 'web' ? Promise.resolve(globalThis.localStorage?.getItem(k) ?? null) : SecureStore.getItemAsync(k)),
  setItem: (k: string, v: string) => (Platform.OS === 'web' ? Promise.resolve(globalThis.localStorage?.setItem(k, v)) : SecureStore.setItemAsync(k, v)),
  removeItem: (k: string) => (Platform.OS === 'web' ? Promise.resolve(globalThis.localStorage?.removeItem(k)) : SecureStore.deleteItemAsync(k)),
};

let client: SupabaseClient | null = null;
export function cloud(): SupabaseClient {
  if (!cloudAvailable) throw new Error('cloud not configured');
  if (!client) {
    client = createClient(URL!, KEY!, {
      auth: { storage: secureStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
    });
  }
  return client;
}
