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
  /** Where supabase-js keeps the session (see src/lib/supabase.ts). */
  auth: "clinibot.auth",
} as const;

/**
 * Cheap "probably signed in" check for public pages that must not load the
 * Supabase client (e.g. to label a header link "Dashboard"). Never use it for
 * access decisions; ProtectedRoute does the real check.
 */
export function hasStoredSession(): boolean {
  return safeStorage.get(STORAGE_KEYS.auth) !== null;
}
