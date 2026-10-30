// Persistent storage for app state: SQLite-backed key/value store on devices,
// localStorage on web.
import { Platform } from 'react-native';
import { createJSONStorage, type StateStorage } from 'zustand/middleware';

function createStorage(): StateStorage {
  if (Platform.OS === 'web') {
    return {
      getItem: (k) => (typeof localStorage === 'undefined' ? null : localStorage.getItem(k)),
      setItem: (k, v) => {
        if (typeof localStorage !== 'undefined') localStorage.setItem(k, v);
      },
      removeItem: (k) => {
        if (typeof localStorage !== 'undefined') localStorage.removeItem(k);
      },
    };
  }
  // Loaded lazily so tests and web never touch the native module.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const KV = require('expo-sqlite/kv-store').default as {
    getItemSync(k: string): string | null;
    setItemSync(k: string, v: string): void;
    removeItemSync(k: string): void;
  };
  return {
    getItem: (k) => KV.getItemSync(k),
    setItem: (k, v) => KV.setItemSync(k, v),
    removeItem: (k) => KV.removeItemSync(k),
  };
}

const base = createStorage();
export const CHANGED_KEY = 'maallah:changed';

/** Last local change time of each persisted store (used to merge with cloud sync). */
export function changeTimes(): Record<string, number> {
  try {
    return JSON.parse((base.getItem(CHANGED_KEY) as string | null) ?? '{}') as Record<string, number>;
  } catch {
    return {};
  }
}

export const kvStorage: StateStorage = {
  getItem: (k) => base.getItem(k),
  setItem: (k, v) => {
    const previous = base.getItem(k);
    base.setItem(k, v);
    if (k.startsWith('maallah:') && k !== CHANGED_KEY && previous !== v) {
      base.setItem(CHANGED_KEY, JSON.stringify({ ...changeTimes(), [k.slice('maallah:'.length)]: Date.now() }));
    }
  },
  removeItem: (k) => base.removeItem(k),
};
export const jsonStorage = createJSONStorage(() => kvStorage);

/** Keys of every persisted store, used by backup / restore / delete-all. */
export const PERSISTED_KEYS = [
  'settings',
  'quran',
  'khatma',
  'adhkar',
  'hadith',
  'tasbih',
  'fasting',
  'activity',
  'fatwas',
  'hifz',
  'prayers',
  'groups',
  'duas',
  'listening',
  'walks',
  'qada',
  'kids',
  'istikhara',
  'ramadan',
  'adhkarHifz',
  'learn',
  'habits',
  'relatives',
  'journal',
] as const;
export type PersistedKey = (typeof PERSISTED_KEYS)[number];
export const storageKey = (k: PersistedKey) => `maallah:${k}`;
