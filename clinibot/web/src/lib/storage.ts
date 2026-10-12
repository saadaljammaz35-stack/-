/**
 * localStorage that never throws (Safari private mode, blocked storage,
 * quota errors). Use for small per-browser preferences only.
 */
export const safeStorage = {
  get(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // ignore: preference simply won't persist
    }
  },
  remove(key: string): void {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

export const STORAGE_KEYS = {
  lang: "clinibot.lang",
  currentOrg: "clinibot.currentOrg",
} as const;
