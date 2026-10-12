// Hashing, HMAC, tokens and authenticated encryption, on Web Crypto only.
//
// Stored integration secrets use AES-256-GCM with a key held only in the
// Edge Function environment (CREDENTIALS_ENCRYPTION_KEY, 32 random bytes,
// base64). Each ciphertext is bound to its row with additional authenticated
// data, so a ciphertext copied into another clinic's row will not decrypt.

import { requireEnv } from "./env.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function toHex(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(view, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sha256Hex(input: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(input)));
}

export async function hmacSha256Hex(secret: string, data: Uint8Array<ArrayBuffer> | string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const payload = typeof data === "string" ? encoder.encode(data) : data;
  return toHex(await crypto.subtle.sign("HMAC", key, payload));
}

/** Constant-time comparison for equal-length strings; unequal lengths are simply unequal. */
export function timingSafeEqual(a: string, b: string): boolean {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  const length = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let i = 0; i < length; i++) diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return diff === 0;
}

/** URL-safe random token from a CSPRNG. 32 bytes = 256 bits. */
export function randomToken(bytes = 32): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function importEncryptionKey(base64Key: string): Promise<CryptoKey> {
  let raw: Uint8Array<ArrayBuffer>;
  try {
    raw = fromBase64(base64Key);
  } catch {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY is not valid base64");
  }
  if (raw.length !== 32) throw new Error("CREDENTIALS_ENCRYPTION_KEY must decode to exactly 32 bytes");
  return await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

let cachedKey: Promise<CryptoKey> | undefined;

/** The credentials key from the environment. Throws ConfigError when unset. */
export function credentialsKey(): Promise<CryptoKey> {
  const value = requireEnv("CREDENTIALS_ENCRYPTION_KEY");
  cachedKey ??= importEncryptionKey(value);
  return cachedKey;
}

const FORMAT = "v1";

/** Encrypts to "v1.<iv base64>.<ciphertext base64>". */
export async function encryptSecret(plaintext: string, key: CryptoKey, associatedData: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(associatedData) },
    key,
    encoder.encode(plaintext),
  );
  return `${FORMAT}.${toBase64(iv)}.${toBase64(new Uint8Array(ciphertext))}`;
}

export async function decryptSecret(payload: string, key: CryptoKey, associatedData: string): Promise<string> {
  const [format, ivPart, dataPart] = payload.split(".");
  if (format !== FORMAT || !ivPart || !dataPart) throw new Error("Unrecognised ciphertext format");
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(ivPart), additionalData: encoder.encode(associatedData) },
    key,
    fromBase64(dataPart),
  );
  return decoder.decode(plaintext);
}
