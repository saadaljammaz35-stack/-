/**
 * Password and PIN hashing.
 *
 * Uses scrypt from Node's own crypto module — a memory-hard KDF, which is what
 * makes GPU cracking expensive. Argon2id would be the first choice in
 * production; scrypt is the strongest option available without a native
 * dependency, and the `PasswordHasher` interface below means swapping the
 * algorithm later does not touch a single call site.
 *
 * Stored format is self-describing:
 *
 *   scrypt$N=16384,r=8,p=1$<base64 salt>$<base64 derived key>
 *
 * Encoding the parameters alongside the hash means we can raise the cost
 * factor over time and still verify every hash written under the old cost —
 * and re-hash on the user's next successful login.
 */

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

export interface ScryptParams {
  /** CPU/memory cost. Must be a power of two. */
  readonly N: number;
  /** Block size. */
  readonly r: number;
  /** Parallelisation. */
  readonly p: number;
  readonly keyLength: number;
  readonly saltLength: number;
}

/** Interactive-login cost. Roughly 100 ms on a modern server core. */
export const DEFAULT_PASSWORD_PARAMS: ScryptParams = {
  N: 16384,
  r: 8,
  p: 1,
  keyLength: 32,
  saltLength: 16,
};

/**
 * PINs are short and drawn from a tiny keyspace, so the KDF cost is raised to
 * compensate. The real defence is still server-side attempt limiting — see
 * `@nabd/security`'s lockout policy — because no KDF makes a 4-digit secret
 * strong on its own.
 */
export const DEFAULT_PIN_PARAMS: ScryptParams = {
  N: 32768,
  r: 8,
  p: 1,
  keyLength: 32,
  saltLength: 16,
};

export interface PasswordHasher {
  hash(plaintext: string): Promise<string>;
  verify(plaintext: string, stored: string): Promise<boolean>;
  /** True when `stored` was produced with weaker parameters than current. */
  needsRehash(stored: string): boolean;
}

function encode(params: ScryptParams, salt: Buffer, derived: Buffer): string {
  return [
    'scrypt',
    `N=${params.N},r=${params.r},p=${params.p}`,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$');
}

interface Decoded {
  N: number;
  r: number;
  p: number;
  salt: Buffer;
  derived: Buffer;
}

function decode(stored: string): Decoded | null {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'scrypt') return null;

  const paramMatch = /^N=(\d+),r=(\d+),p=(\d+)$/.exec(parts[1] as string);
  if (paramMatch === null) return null;

  try {
    return {
      N: Number(paramMatch[1]),
      r: Number(paramMatch[2]),
      p: Number(paramMatch[3]),
      salt: Buffer.from(parts[2] as string, 'base64'),
      derived: Buffer.from(parts[3] as string, 'base64'),
    };
  } catch {
    return null;
  }
}

export class ScryptHasher implements PasswordHasher {
  constructor(private readonly params: ScryptParams = DEFAULT_PASSWORD_PARAMS) {}

  async hash(plaintext: string): Promise<string> {
    const salt = randomBytes(this.params.saltLength);
    const derived = await scrypt(
      Buffer.from(plaintext, 'utf8'),
      salt,
      this.params.keyLength,
      {
        N: this.params.N,
        r: this.params.r,
        p: this.params.p,
        maxmem: 256 * this.params.N * this.params.r,
      },
    );
    return encode(this.params, salt, derived);
  }

  /**
   * Constant-time verification.
   *
   * A malformed or missing hash still performs a full scrypt derivation before
   * returning false. Returning early would make "no such user" measurably
   * faster than "wrong password", which is a free user-enumeration oracle for
   * anyone with a stopwatch.
   */
  async verify(plaintext: string, stored: string): Promise<boolean> {
    const decoded = decode(stored);
    if (decoded === null) {
      await this.hash(plaintext);
      return false;
    }

    const candidate = await scrypt(
      Buffer.from(plaintext, 'utf8'),
      decoded.salt,
      decoded.derived.length,
      {
        N: decoded.N,
        r: decoded.r,
        p: decoded.p,
        maxmem: 256 * decoded.N * decoded.r,
      },
    );

    if (candidate.length !== decoded.derived.length) return false;
    return timingSafeEqual(candidate, decoded.derived);
  }

  needsRehash(stored: string): boolean {
    const decoded = decode(stored);
    if (decoded === null) return true;
    return (
      decoded.N < this.params.N ||
      decoded.r < this.params.r ||
      decoded.p < this.params.p ||
      decoded.derived.length < this.params.keyLength
    );
  }
}

export const passwordHasher = new ScryptHasher(DEFAULT_PASSWORD_PARAMS);
export const pinHasher = new ScryptHasher(DEFAULT_PIN_PARAMS);

// ── password policy ────────────────────────────────────────────────────────

export interface PasswordPolicyResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

/**
 * Length is the dominant factor in password strength, so the minimum is 12 and
 * there is no composition rule forcing a symbol — those push people toward
 * `Password1!` and a sticky note. We reject known-weak shapes instead.
 */
export function validatePassword(
  password: string,
  context: { phone?: string; email?: string } = {},
): PasswordPolicyResult {
  const errors: string[] = [];

  if (password.length < 12) errors.push('Password must be at least 12 characters');
  if (password.length > 256) errors.push('Password must be at most 256 characters');
  if (/^(.)\1*$/.test(password))
    errors.push('Password must not be a single repeated character');
  if (/^(?:0123456789|1234567890|abcdefghijkl|qwertyuiop)/i.test(password)) {
    errors.push('Password must not be a common sequence');
  }

  const lower = password.toLowerCase();
  if (lower.includes('nabd') || lower.includes('نبض')) {
    errors.push('Password must not contain the service name');
  }
  // Check every 6-digit run of the phone number, not just the last six. A
  // password like "prefix966501234" reuses the *leading* digits, which a
  // tail-only check would wave through.
  if (context.phone !== undefined) {
    const digits = context.phone.replace(/\D/g, '');
    for (let i = 0; i + 6 <= digits.length; i += 1) {
      if (password.includes(digits.slice(i, i + 6))) {
        errors.push('Password must not contain part of your phone number');
        break;
      }
    }
  }
  if (context.email !== undefined) {
    const localPart = context.email.split('@')[0];
    if (
      localPart !== undefined &&
      localPart.length >= 4 &&
      lower.includes(localPart.toLowerCase())
    ) {
      errors.push('Password must not contain your email address');
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Rejects PINs an attacker would guess first. */
export function validatePin(pin: string): PasswordPolicyResult {
  const errors: string[] = [];

  if (!/^\d{4}$|^\d{6}$/.test(pin)) {
    errors.push('PIN must be 4 or 6 digits');
    return { valid: false, errors };
  }
  if (/^(\d)\1*$/.test(pin)) errors.push('PIN must not be all the same digit');

  const digits = [...pin].map(Number);
  const ascending = digits.every((d, i) => i === 0 || d === (digits[i - 1] as number) + 1);
  const descending = digits.every((d, i) => i === 0 || d === (digits[i - 1] as number) - 1);
  if (ascending || descending) errors.push('PIN must not be a sequence');

  // Commonly chosen PINs account for a large share of all real-world choices.
  const BANNED = new Set([
    '1234',
    '0000',
    '1111',
    '1212',
    '7777',
    '1004',
    '2000',
    '4444',
    '2222',
    '6969',
    '9999',
    '3333',
    '5555',
    '6666',
    '1122',
    '1313',
    '8888',
    '4321',
    '2001',
    '1010',
    '123456',
    '654321',
    '111111',
    '000000',
    '121212',
    '112233',
  ]);
  if (BANNED.has(pin)) errors.push('PIN is too common');

  return { valid: errors.length === 0, errors };
}
