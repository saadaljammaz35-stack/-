// Backup, restore and deletion of the user's local data (used by the settings screens and
// by account sync).
import { kvStorage, PERSISTED_KEYS, storageKey, type PersistedKey } from '@/store/storage';
import { useSettings } from '@/store/settings';
import { useActivityStore, useAdhkarStore, useFastingStore, useHadithStore, useKhatmaStore, useQuranStore, useTasbihStore } from '@/store/user';

export const BACKUP_FORMAT = 'ma-allah-backup';
export const BACKUP_VERSION = 1;

export type Backup = {
  format: typeof BACKUP_FORMAT;
  version: number;
  createdAt: string;
  stores: Partial<Record<PersistedKey, unknown>>;
};

const STORES = {
  settings: useSettings,
  quran: useQuranStore,
  khatma: useKhatmaStore,
  adhkar: useAdhkarStore,
  hadith: useHadithStore,
  tasbih: useTasbihStore,
  fasting: useFastingStore,
  activity: useActivityStore,
  fatwas: null,
} as const;

export function createBackup(): Backup {
  const stores: Backup['stores'] = {};
  for (const key of PERSISTED_KEYS) {
    const raw = kvStorage.getItem(storageKey(key)) as string | null;
    if (raw) stores[key] = JSON.parse(raw);
  }
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt: new Date().toISOString(), stores };
}

export function isBackup(value: unknown): value is Backup {
  const v = value as Backup;
  return Boolean(v && v.format === BACKUP_FORMAT && typeof v.version === 'number' && v.stores && typeof v.stores === 'object');
}

/** Writes the backup into storage and reloads every store from it. */
export async function restoreBackup(backup: Backup, keys: readonly PersistedKey[] = PERSISTED_KEYS): Promise<void> {
  for (const key of keys) {
    const value = backup.stores[key];
    if (value === undefined) continue;
    kvStorage.setItem(storageKey(key), JSON.stringify(value));
  }
  await rehydrateAll();
}

export async function rehydrateAll(): Promise<void> {
  for (const store of Object.values(STORES)) {
    if (store) await store.persist.rehydrate();
  }
}

export async function deleteAllLocalData(): Promise<void> {
  for (const key of PERSISTED_KEYS) kvStorage.removeItem(storageKey(key));
  await rehydrateAll();
  // Stores keep their in-memory defaults after rehydrating from empty storage; reset them.
  useQuranStore.setState({ lastRead: null, bookmarks: [] });
  useKhatmaStore.setState({ khatmas: [] });
  useAdhkarStore.setState({ progress: {}, favorites: [] });
  useHadithStore.setState({ favorites: [] });
  useFastingStore.setState({ days: {} });
  useActivityStore.setState({ items: [] });
  useSettings.setState({ location: null, onboarded: false });
}
