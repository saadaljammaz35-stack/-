import * as SecureStore from 'expo-secure-store';

/**
 * Supabase session storage backed by the Keychain (iOS) / Keystore (Android).
 * SecureStore values are limited in size, so long sessions are split in chunks.
 */
const CHUNK = 1800;

export interface KeyValueBackend {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

const safeKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

export function createChunkedStorage(backend: KeyValueBackend = SecureStore) {
  return {
    async getItem(key: string): Promise<string | null> {
      const k = safeKey(key);
      const count = await backend.getItemAsync(`${k}.n`);
      if (count === null) return backend.getItemAsync(k);
      const n = Number(count);
      if (!Number.isInteger(n) || n < 0 || n > 64) return null;
      const parts: string[] = [];
      for (let i = 0; i < n; i++) {
        const part = await backend.getItemAsync(`${k}.${i}`);
        if (part === null) return null; // partial write: treat as signed out
        parts.push(part);
      }
      return parts.join('');
    },
    async setItem(key: string, value: string): Promise<void> {
      const k = safeKey(key);
      await this.removeItem(key);
      const n = Math.ceil(value.length / CHUNK);
      for (let i = 0; i < n; i++) await backend.setItemAsync(`${k}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
      await backend.setItemAsync(`${k}.n`, String(n));
    },
    async removeItem(key: string): Promise<void> {
      const k = safeKey(key);
      const count = await backend.getItemAsync(`${k}.n`);
      const n = count === null ? 0 : Number(count);
      for (let i = 0; i < (Number.isInteger(n) ? n : 0); i++) await backend.deleteItemAsync(`${k}.${i}`);
      await backend.deleteItemAsync(`${k}.n`);
      await backend.deleteItemAsync(k);
    },
  };
}
