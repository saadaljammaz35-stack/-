import { describe, expect, it } from "vitest";
import { chatStorageKey, createTokenStore, isValidSessionToken } from "./sessionStore";

const TOKEN = "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde"; // 43 chars, base64url
const OTHER = "ZyXwVuTsRqPoNmLkJiHgFeDcBa9876543210-_edcba";

/** A Storage double whose operations can be made to fail. */
function fakeStorage(options: { failSet?: boolean; failGet?: boolean; ignoreSet?: boolean } = {}) {
  const data = new Map<string, string>();
  return {
    data,
    getItem(key: string) {
      if (options.failGet) throw new DOMException("blocked", "SecurityError");
      return data.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      if (options.failSet) throw new DOMException("full", "QuotaExceededError");
      if (!options.ignoreSet) data.set(key, value);
    },
    removeItem(key: string) {
      data.delete(key);
    },
  };
}

describe("isValidSessionToken", () => {
  it("accepts the server's base64url tokens only", () => {
    expect(isValidSessionToken(TOKEN)).toBe(true);
    expect(isValidSessionToken("short")).toBe(false);
    expect(isValidSessionToken(`${TOKEN}!`)).toBe(false);
    expect(isValidSessionToken(null)).toBe(false);
  });
});

describe("createTokenStore", () => {
  it("keeps the token in localStorage under clinibot.chat.<slug>", () => {
    const storage = fakeStorage();
    const store = createTokenStore(() => storage);
    expect(store.persistent).toBe(true);
    expect(store.read("smile")).toBeNull();
    expect(store.write("smile", TOKEN)).toBe(true);
    expect(storage.data.get("clinibot.chat.smile")).toBe(TOKEN);
    expect(chatStorageKey("smile")).toBe("clinibot.chat.smile");

    // A new store (a refresh) finds it again; other clinics are separate.
    const again = createTokenStore(() => storage);
    expect(again.read("smile")).toBe(TOKEN);
    expect(again.read("other-clinic")).toBeNull();

    again.clear("smile");
    expect(storage.data.has("clinibot.chat.smile")).toBe(false);
    expect(again.read("smile")).toBeNull();
  });

  it("works with the real window.localStorage", () => {
    const store = createTokenStore();
    store.write("real-clinic", TOKEN);
    expect(window.localStorage.getItem("clinibot.chat.real-clinic")).toBe(TOKEN);
    store.clear("real-clinic");
    expect(window.localStorage.getItem("clinibot.chat.real-clinic")).toBeNull();
  });

  it("falls back to memory when storage throws, and says so", () => {
    const store = createTokenStore(() => fakeStorage({ failSet: true, failGet: true }));
    expect(store.persistent).toBe(false);
    expect(store.write("smile", TOKEN)).toBe(false);
    expect(store.read("smile")).toBe(TOKEN);
    store.clear("smile");
    expect(store.read("smile")).toBeNull();
  });

  it("falls back to memory when localStorage itself cannot be reached", () => {
    const store = createTokenStore(() => {
      throw new DOMException("denied", "SecurityError");
    });
    expect(store.persistent).toBe(false);
    expect(store.write("smile", TOKEN)).toBe(false);
    expect(store.read("smile")).toBe(TOKEN);
  });

  it("notices storage that silently drops writes", () => {
    const storage = fakeStorage();
    const store = createTokenStore(() => storage);
    expect(store.persistent).toBe(true);
    const dropping = fakeStorage({ ignoreSet: true });
    const lossy = createTokenStore(() => dropping);
    expect(lossy.write("smile", TOKEN)).toBe(false);
    expect(lossy.persistent).toBe(false);
    expect(lossy.read("smile")).toBe(TOKEN);
  });

  it("prefers what storage holds and discards malformed values", () => {
    const storage = fakeStorage();
    const store = createTokenStore(() => storage);
    store.write("smile", TOKEN);
    storage.data.set("clinibot.chat.smile", OTHER); // e.g. another tab started a new chat
    expect(store.read("smile")).toBe(OTHER);

    storage.data.set("clinibot.chat.broken", "not a token");
    expect(store.read("broken")).toBeNull();
    expect(storage.data.has("clinibot.chat.broken")).toBe(false);
  });
});
