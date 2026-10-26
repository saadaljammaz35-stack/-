// Optional account and cloud sync (Supabase). Enabled when the build provides
// EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY; the app works fully without it.
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { changeTimes, PERSISTED_KEYS, type PersistedKey } from '@/store/storage';

import { createBackup, restoreBackup, type Backup } from './backup';

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const syncAvailable = Boolean(URL && KEY);

// Session tokens live in the platform keychain / keystore.
const secureStorage = {
  getItem: (k: string) => (Platform.OS === 'web' ? Promise.resolve(globalThis.localStorage?.getItem(k) ?? null) : SecureStore.getItemAsync(k)),
  setItem: (k: string, v: string) => (Platform.OS === 'web' ? Promise.resolve(globalThis.localStorage?.setItem(k, v)) : SecureStore.setItemAsync(k, v)),
  removeItem: (k: string) => (Platform.OS === 'web' ? Promise.resolve(globalThis.localStorage?.removeItem(k)) : SecureStore.deleteItemAsync(k)),
};

let client: SupabaseClient | null = null;
function supabase(): SupabaseClient {
  if (!syncAvailable) throw new Error('sync not configured');
  if (!client) {
    client = createClient(URL!, KEY!, {
      auth: { storage: secureStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
    });
  }
  return client;
}

type SyncState = {
  session: Session | null;
  lastSync: number | null;
  busy: boolean;
  error: string | null;
  set: (p: Partial<Omit<SyncState, 'set'>>) => void;
};

export const useSync = create<SyncState>((set) => ({ session: null, lastSync: null, busy: false, error: null, set: (p) => set(p) }));

export async function loadSession(): Promise<void> {
  if (!syncAvailable) return;
  const { data } = await supabase().auth.getSession();
  useSync.getState().set({ session: data.session });
}

export async function sendCode(email: string): Promise<void> {
  const { error } = await supabase().auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw error;
}

export async function verifyCode(email: string, token: string): Promise<void> {
  const { data, error } = await supabase().auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw error;
  useSync.getState().set({ session: data.session });
}

export async function signOut(): Promise<void> {
  await supabase().auth.signOut();
  useSync.getState().set({ session: null, lastSync: null });
}

// Recent activity stays on each device.
const SYNCED: PersistedKey[] = PERSISTED_KEYS.filter((k) => k !== 'activity');

/**
 * Two-way sync: the newer side wins per store. Each upload records when every store last
 * changed on this device, so concurrent edits on two devices do not erase each other.
 */
export async function syncNow(): Promise<void> {
  const s = useSync.getState();
  if (!s.session) return;
  s.set({ busy: true, error: null });
  try {
    const db = supabase();
    const userId = s.session.user.id;
    const { data: row, error } = await db.from('user_state').select('data, updated_at').eq('user_id', userId).maybeSingle();
    if (error) throw error;
    const remote = (row?.data ?? null) as (Backup & { changed?: Record<string, number> }) | null;
    const local = createBackup();
    const localChanged = changeTimes();
    const merged: Backup & { changed: Record<string, number> } = { ...local, changed: {} };
    const pull: PersistedKey[] = [];
    for (const key of SYNCED) {
      const lt = localChanged[key] ?? 0;
      const rt = remote?.changed?.[key] ?? 0;
      if (remote && rt > lt && remote.stores[key] !== undefined) {
        merged.stores[key] = remote.stores[key];
        merged.changed[key] = rt;
        pull.push(key);
      } else {
        merged.changed[key] = lt;
      }
    }
    if (pull.length && remote) await restoreBackup(remote, pull);
    const { error: upErr } = await db.from('user_state').upsert({ user_id: userId, data: merged, updated_at: new Date().toISOString() });
    if (upErr) throw upErr;
    s.set({ lastSync: Date.now() });
  } catch (err) {
    s.set({ error: (err as Error).message });
  } finally {
    useSync.getState().set({ busy: false });
  }
}

export async function deleteAccount(): Promise<void> {
  const { error } = await supabase().rpc('delete_my_account');
  if (error) throw error;
  await supabase().auth.signOut();
  useSync.getState().set({ session: null, lastSync: null });
}
