import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { AppError } from "@/lib/http/errors";

// Provider API keys are never stored in plain text. They are either
//   env:OMNIX_PROVIDER_SECRET_<NAME>   a pointer to a server environment variable (platform admins), or
//   enc:v1:<iv>:<ciphertext>:<tag>     AES-256-GCM, key = OMNIX_SECRETS_KEY (outside the database).

function key(): Buffer {
  const raw = process.env.OMNIX_SECRETS_KEY;
  const k = raw ? Buffer.from(raw, "base64") : null;
  if (!k || k.length !== 32) {
    throw new AppError("PRECONDITION_FAILED", "OMNIX_SECRETS_KEY is not configured; provider keys cannot be stored");
  }
  return k;
}

const b64u = (b: Buffer) => b.toString("base64url");

/** HMAC-SHA256 under a key derived from OMNIX_SECRETS_KEY for one purpose (never the encryption key itself). */
export function signValue(purpose: string, value: string): string {
  const k = createHmac("sha256", key()).update(`omnix:${purpose}`).digest();
  return b64u(createHmac("sha256", k).update(value).digest()).slice(0, 32);
}

export function verifySignedValue(purpose: string, value: string, signature: string): boolean {
  const expected = Buffer.from(signValue(purpose, value));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function sealSecret(plaintext: string, aad = "omnix:provider-secret"): string {
  if (!plaintext || plaintext.length > 4096) throw new AppError("VALIDATION_FAILED", "Secret must be 1-4096 characters");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return `enc:v1:${b64u(iv)}:${b64u(ct)}:${b64u(cipher.getAuthTag())}`;
}

export function openSecret(sealed: string, aad = "omnix:provider-secret"): string {
  const m = /^enc:v1:([A-Za-z0-9_-]+):([A-Za-z0-9_-]+):([A-Za-z0-9_-]+)$/.exec(sealed);
  if (!m) throw new AppError("INTERNAL", "Malformed sealed secret");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(m[1]!, "base64url"));
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(Buffer.from(m[3]!, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(m[2]!, "base64url")), decipher.final()]).toString("utf8");
}

/** Resolves a secret_reference to the secret value. Server-side only. */
export function resolveSecretReference(ref: string): string {
  if (ref.startsWith("env:")) {
    const name = ref.slice(4);
    if (!/^OMNIX_PROVIDER_SECRET_[A-Z0-9_]{1,64}$/.test(name)) throw new AppError("FORBIDDEN", "Secret reference not allowed");
    const v = process.env[name];
    if (!v) throw new AppError("PRECONDITION_FAILED", `Environment secret ${name} is not set on the server`);
    return v;
  }
  if (ref.startsWith("enc:")) return openSecret(ref);
  throw new AppError("INTERNAL", "Unknown secret reference format");
}

/** Last 4 characters, for display ("…a1b2"). */
export function secretHint(secret: string): string {
  return secret.length >= 8 ? `…${secret.slice(-4)}` : "…";
}
