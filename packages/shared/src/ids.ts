/**
 * Identifier generation.
 *
 * NABD uses UUID v7 for every primary key. v7 embeds a millisecond timestamp in
 * its high bits, so identifiers sort chronologically. That matters at ledger
 * scale: v4 keys scatter B-tree inserts across the whole index, while v7 keys
 * append to the hot right-hand edge.
 */

import { randomBytes, randomInt, randomUUID } from 'node:crypto';

const HEX = '0123456789abcdef';

/**
 * RFC 9562 UUID version 7.
 * Layout: 48-bit big-endian Unix milliseconds | version 7 | 12 random bits
 *         | variant 10 | 62 random bits.
 */
export function uuidv7(now: number = Date.now()): string {
  const bytes = randomBytes(16);
  const timestamp = BigInt(now);

  bytes[0] = Number((timestamp >> 40n) & 0xffn);
  bytes[1] = Number((timestamp >> 32n) & 0xffn);
  bytes[2] = Number((timestamp >> 24n) & 0xffn);
  bytes[3] = Number((timestamp >> 16n) & 0xffn);
  bytes[4] = Number((timestamp >> 8n) & 0xffn);
  bytes[5] = Number(timestamp & 0xffn);

  // Version 7 in the high nibble of byte 6.
  bytes[6] = ((bytes[6] as number) & 0x0f) | 0x70;
  // RFC 4122 variant in the top two bits of byte 8.
  bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80;

  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

/** Extract the embedded millisecond timestamp from a v7 UUID. */
export function uuidv7Timestamp(uuid: string): number {
  const hex = uuid.replace(/-/g, '').slice(0, 12);
  return Number(BigInt(`0x${hex}`));
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** UUID v4, for anything that must not leak creation time. */
export function uuidv4(): string {
  return randomUUID();
}

/**
 * Customer-facing transaction reference: NBD-YYMMDD-XXXXXXXX.
 * Crockford base32 without I, L, O and U — no digit/letter confusion when a
 * customer reads a reference to a support agent over the phone.
 */
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function generateReference(prefix = 'NBD', now: Date = new Date()): string {
  const yy = String(now.getUTCFullYear() % 100).padStart(2, '0');
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');

  let suffix = '';
  const buf = randomBytes(8);
  for (let i = 0; i < 8; i += 1) {
    suffix += CROCKFORD[(buf[i] as number) % CROCKFORD.length];
  }
  return `${prefix}-${yy}${mm}${dd}-${suffix}`;
}

/**
 * Account number: 12 digits, never starting with zero so it survives being
 * pasted into a spreadsheet.
 */
export function generateAccountNumber(): string {
  let out = String(randomInt(1, 10));
  for (let i = 0; i < 11; i += 1) {
    out += String(randomInt(0, 10));
  }
  return out;
}

/** Opaque, URL-safe token for idempotency keys and one-time links. */
export function generateOpaqueToken(byteLength = 32): string {
  return randomBytes(byteLength).toString('base64url');
}

/** Lowercase hex string of `byteLength` random bytes. */
export function randomHex(byteLength: number): string {
  const buf = randomBytes(byteLength);
  let out = '';
  for (const byte of buf) {
    out += (HEX[byte >> 4] as string) + (HEX[byte & 0x0f] as string);
  }
  return out;
}
