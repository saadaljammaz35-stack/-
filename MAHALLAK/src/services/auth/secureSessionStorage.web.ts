/** Web preview: sessions in localStorage (supabase-js default behaviour). */
export interface KeyValueBackend {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export function createChunkedStorage() {
  return {
    async getItem(key: string) {
      return globalThis.localStorage?.getItem(key) ?? null;
    },
    async setItem(key: string, value: string) {
      globalThis.localStorage?.setItem(key, value);
    },
    async removeItem(key: string) {
      globalThis.localStorage?.removeItem(key);
    },
  };
}
