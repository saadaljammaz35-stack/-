import type { Session } from '@supabase/supabase-js';
import * as Network from 'expo-network';
import { Platform } from 'react-native';
import { create } from 'zustand';

import { PLAN } from '@/config/plans';
import type { ImageRef, Item, Place } from '@/domain/models';
import { getCompiledLexicon, refreshLexicon } from '@/features/dialect/lexiconProvider';
import { SearchIndex } from '@/features/search/searchEngine';
import type { AiGate } from '@/services/ai/aiClient';
import { readBytes } from '@/services/media/imageService';
import { hasFullAccess, identify } from '@/services/purchase/purchaseService';
import { getSupabase } from '@/services/supabase';
import { SyncService, type SyncReport } from '@/services/sync/syncService';

import { getItemService, getStore, setChangeListener } from './services';
import { DEFAULT_SETTINGS, sanitizeSettings, type UserSettings } from './settings';

interface AppState {
  ready: boolean;
  settings: UserSettings;
  session: Session | null;
  items: Item[];
  places: Place[];
  images: Record<string, ImageRef>;
  index: SearchIndex;
  fullAccess: boolean;
  online: boolean;
  syncing: boolean;
  lastSync: SyncReport | null;
  lastSyncAt: string | null;

  bootstrap: () => Promise<void>;
  reload: () => Promise<void>;
  updateSettings: (patch: Partial<UserSettings>) => Promise<void>;
  setSession: (s: Session | null) => void;
  refreshEntitlement: () => Promise<void>;
  syncNow: () => Promise<SyncReport | null>;
  aiGate: () => AiGate;
  canAddItem: () => boolean;
}

async function loadSettings(): Promise<UserSettings> {
  const row = await getStore().get<{ id: string; value: unknown }>('kv', 'settings');
  return sanitizeSettings(row?.value);
}

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  settings: DEFAULT_SETTINGS,
  session: null,
  items: [],
  places: [],
  images: {},
  index: new SearchIndex(getCompiledLexicon()),
  fullAccess: false,
  online: true,
  syncing: false,
  lastSync: null,
  lastSyncAt: null,

  bootstrap: async () => {
    await getStore().init();
    setChangeListener(() => void get().reload());
    const settings = await loadSettings();
    set({ settings });
    await get().reload();

    // Dialect lexicon: cached copy instantly, newer version from the backend in the background.
    const client = getSupabase();
    void refreshLexicon(
      client
        ? {
            fetchLatest: async () => {
              const { data } = await client
                .from('dialect_lexicons')
                .select('payload')
                .eq('is_active', true)
                .order('version', { ascending: false })
                .limit(1)
                .maybeSingle();
              return data?.payload ?? null;
            },
          }
        : null,
      {
        read: async () => (await getStore().get<{ id: string; value: unknown }>('kv', 'lexicon'))?.value ?? null,
        write: async (value) => getStore().put('kv', { id: 'lexicon', value }),
      },
    ).then(() => {
      const index = new SearchIndex(getCompiledLexicon());
      set({ index });
      void get().reload();
    });

    if (client) {
      const { data } = await client.auth.getSession();
      set({ session: data.session });
      client.auth.onAuthStateChange((_event, session) => {
        set({ session });
        void identify(session?.user.id ?? null).then(() => get().refreshEntitlement());
      });
    }
    if (Platform.OS !== 'web') {
      try {
        const st = await Network.getNetworkStateAsync();
        set({ online: Boolean(st.isConnected && st.isInternetReachable !== false) });
        Network.addNetworkStateListener((s) => set({ online: Boolean(s.isConnected && s.isInternetReachable !== false) }));
      } catch {
        // assume online; requests will fail gracefully
      }
    }
    void get().refreshEntitlement();
    set({ ready: true });
  },

  reload: async () => {
    const svc = getItemService();
    const [items, places, imageRows] = await Promise.all([
      svc.listItems(),
      svc.listPlaces(),
      getStore().all<ImageRef>('images'),
    ]);
    const byPlace = new Map(places.map((p) => [p.id, p]));
    const index = get().index;
    index.rebuild(
      items.map((item) => ({ item, place: item.currentLocationId ? (byPlace.get(item.currentLocationId) ?? null) : null })),
      places,
    );
    set({ items, places, images: Object.fromEntries(imageRows.map((i) => [i.id, i])) });
  },

  updateSettings: async (patch) => {
    const settings = sanitizeSettings({ ...get().settings, ...patch });
    await getStore().put('kv', { id: 'settings', value: settings });
    set({ settings });
    const client = getSupabase();
    const userId = get().session?.user.id;
    if (client && userId) {
      // Best effort: consent flags are also enforced server-side by the AI functions.
      void client.from('user_settings').upsert({
        user_id: userId,
        language: settings.language,
        theme: settings.theme,
        cloud_sync: settings.cloudSync,
        cloud_photos: settings.cloudPhotos,
        ai_consent: settings.aiConsent,
        ai_training_consent: settings.aiTrainingConsent,
        keep_search_history: settings.keepSearchHistory,
        updated_at: new Date().toISOString(),
      });
    }
  },

  setSession: (session) => set({ session }),

  refreshEntitlement: async () => {
    set({ fullAccess: await hasFullAccess() });
  },

  syncNow: async () => {
    const { session, settings, syncing } = get();
    const client = getSupabase();
    if (!client || !session || !settings.cloudSync || syncing || !get().online) return null;
    set({ syncing: true });
    try {
      const svc = new SyncService({
        store: getStore(),
        client,
        userId: session.user.id,
        options: () => ({ cloudPhotos: get().settings.cloudPhotos }),
        readBytes,
      });
      const report = await svc.syncNow();
      set({ lastSync: report, lastSyncAt: new Date().toISOString() });
      await get().reload();
      return report;
    } finally {
      set({ syncing: false });
    }
  },

  aiGate: () => ({
    client: getSupabase(),
    signedIn: Boolean(get().session),
    consent: get().settings.aiConsent,
    online: get().online,
  }),

  canAddItem: () => get().fullAccess || get().items.length < PLAN.free.maxItems,
}));
