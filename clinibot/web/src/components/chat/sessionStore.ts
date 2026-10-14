/**
 * Where the visitor's chat session token lives: localStorage under
 * "clinibot.chat.<slug>", so a refresh continues the same conversation.
 * When storage is unavailable (Safari private mode, blocked site data, quota)
 * the token is kept in memory instead and `persistent` turns false, so the
 * page can say that refreshing ends the chat.
 */

/** Same shape the server accepts (randomToken(32) is 43 base64url characters). */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

export function isValidSessionToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

export function chatStorageKey(slug: string): string {
  return `clinibot.chat.${slug}`;
}

export interface TokenStore {
  read(slug: string): string | null;
  /** Returns false when the token could only be kept in memory. */
  write(slug: string, token: string): boolean;
  clear(slug: string): void;
  /** False once storage has failed: the token will not survive a refresh. */
  readonly persistent: boolean;
}

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function defaultStorage(): StorageLike | null {
  // Reading window.localStorage itself throws when site data is blocked.
  return typeof window === "undefined" ? null : window.localStorage;
}

const PROBE_KEY = "clinibot.chat.__probe";

export function createTokenStore(
  getStorage: () => StorageLike | null = defaultStorage,
): TokenStore {
  const memory = new Map<string, string>();
  let persistent = probe();

  function storage(): StorageLike | null {
    try {
      return getStorage();
    } catch {
      return null;
    }
  }

  function probe(): boolean {
    try {
      const target = getStorage();
      if (!target) return false;
      target.setItem(PROBE_KEY, "1");
      target.removeItem(PROBE_KEY);
      return true;
    } catch {
      return false;
    }
  }

  return {
    get persistent() {
      return persistent;
    },

    read(slug) {
      const key = chatStorageKey(slug);
      let stored: string | null;
      try {
        stored = storage()?.getItem(key) ?? null;
      } catch {
        stored = null;
      }
      if (stored !== null && !isValidSessionToken(stored)) {
        // Something else wrote here; never send it to the server.
        try {
          storage()?.removeItem(key);
        } catch {
          // ignore
        }
        stored = null;
      }
      return stored ?? memory.get(key) ?? null;
    },

    write(slug, token) {
      const key = chatStorageKey(slug);
      try {
        const target = storage();
        if (!target) throw new Error("storage unavailable");
        target.setItem(key, token);
        if (target.getItem(key) !== token) throw new Error("storage did not keep the value");
        memory.delete(key);
        return true;
      } catch {
        // Only this tab will know the token; a refresh ends the chat.
        memory.set(key, token);
        persistent = false;
        return false;
      }
    },

    clear(slug) {
      const key = chatStorageKey(slug);
      memory.delete(key);
      try {
        storage()?.removeItem(key);
      } catch {
        // ignore: the in-memory copy is gone, which is what matters for this tab
      }
    },
  };
}

/**
 * One store for the tab, so the in-memory fallback survives navigating away
 * from the chat and back without a reload.
 */
let shared: TokenStore | null = null;

export function sharedTokenStore(): TokenStore {
  shared ??= createTokenStore();
  return shared;
}
