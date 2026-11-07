import { createHmac, randomBytes } from "node:crypto";

/** RFC 6238 TOTP (SHA-1, 30 s, 6 digits) — what every authenticator app speaks. */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error("Invalid base32");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function totpAt(secret: string, timeMs: number, step = 30): string {
  const counter = Math.floor(timeMs / 1000 / step);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", base32Decode(secret)).update(msg).digest();
  const offset = h[h.length - 1]! & 0x0f;
  const code = ((h.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString();
  return code.padStart(6, "0");
}

/** Accepts the current step and one step either side for clock drift. */
export function verifyTotp(secret: string, code: string, nowMs = Date.now()): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  for (const drift of [-1, 0, 1]) {
    if (totpAt(secret, nowMs + drift * 30_000) === code) return true;
  }
  return false;
}

export function otpauthUri(secret: string, account: string, issuer = "MUBAYN"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}
