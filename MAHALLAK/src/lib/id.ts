import * as Crypto from 'expo-crypto';

/** RFC 4122 v4 id. Uses the platform crypto when present (web, Node tests), expo-crypto on device. */
export function newId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return Crypto.randomUUID();
}
