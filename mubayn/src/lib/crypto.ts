import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { config } from "./config";

const scrypt = promisify(scryptCb) as (pw: string | Buffer, salt: Buffer, len: number, opts: object) => Promise<Buffer>;

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(input: string | Buffer): Buffer {
  return createHash("sha256").update(input).digest();
}

export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    // Still spend comparable time.
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

// ── passwords ───────────────────────────────────────────────────────────────
// scrypt, N=2^15 r=8 p=1 (~32 MiB, ~100ms). Stored as
// scrypt$<N>$<r>$<p>$<salt b64>$<hash b64> so parameters can be raised later.

const N = 32768;
const R = 8;
const P = 1;
const KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password.normalize("NFKC"), salt, KEYLEN, { N, r: R, p: P, maxmem: 96 * 1024 * 1024 });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) {
    // Equalise timing for unknown accounts.
    await scrypt(password, randomBytes(16), KEYLEN, { N, r: R, p: P, maxmem: 96 * 1024 * 1024 });
    return false;
  }
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts as [string, string, string, string, string, string];
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password.normalize("NFKC"), Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 96 * 1024 * 1024,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// ── field encryption (AES-256-GCM) ──────────────────────────────────────────

function key(): Buffer {
  const raw = Buffer.from(config().ENCRYPTION_KEY, "base64");
  if (raw.length < 32) throw new Error("ENCRYPTION_KEY must decode to at least 32 bytes");
  return raw.subarray(0, 32);
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${ct.toString("base64url")}`;
}

export function decrypt(payload: string): string {
  const [v, iv, tag, ct] = payload.split(".");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("Unsupported ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}
