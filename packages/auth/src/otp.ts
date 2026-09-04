/**
 * One-time passcodes for phone and email verification, and for step-up
 * authentication on sensitive actions (adding a beneficiary, raising a limit).
 *
 * Controls that make a 6-digit code safe enough to be one factor:
 *   • generated with a CSPRNG, not Math.random
 *   • stored as a salted hash, so a database read does not yield live codes
 *   • short expiry
 *   • a hard attempt cap, because 6 digits is only a million possibilities
 *   • single use — consumed on first success
 *   • constant-time comparison
 */

import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

import { type Clock, MINUTE_MS, systemClock, uuidv7 } from '@nabd/shared';

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 5 * MINUTE_MS;
export const OTP_MAX_ATTEMPTS = 5;
/** Minimum gap between sends, so the SMS channel cannot be used to spam a user. */
export const OTP_RESEND_COOLDOWN_MS = 60_000;

export type OtpPurpose =
  | 'PHONE_VERIFICATION'
  | 'EMAIL_VERIFICATION'
  | 'LOGIN'
  | 'PASSWORD_RESET'
  | 'BENEFICIARY_ADD'
  | 'HIGH_VALUE_TRANSFER'
  | 'CARD_ACTIVATION';

export interface OtpChallenge {
  readonly id: string;
  readonly userId: string | null;
  readonly destination: string;
  readonly purpose: OtpPurpose;
  readonly codeHash: string;
  readonly salt: string;
  readonly attempts: number;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
  readonly createdAt: Date;
}

export type OtpVerifyResult =
  | { readonly status: 'VALID'; readonly challenge: OtpChallenge }
  | { readonly status: 'INVALID'; readonly attemptsRemaining: number }
  | { readonly status: 'EXPIRED' }
  | { readonly status: 'CONSUMED' }
  | { readonly status: 'TOO_MANY_ATTEMPTS' };

/** Uniform over the full range — `randomInt` avoids the modulo bias of `%`. */
export function generateOtpCode(length = OTP_LENGTH): string {
  let code = '';
  for (let i = 0; i < length; i += 1) {
    code += String(randomInt(0, 10));
  }
  return code;
}

export function hashOtp(code: string, salt: string): string {
  return createHmac('sha256', salt).update(code, 'utf8').digest('hex');
}

export interface OtpStore {
  insert(challenge: OtpChallenge): Promise<void>;
  findLatest(destination: string, purpose: OtpPurpose): Promise<OtpChallenge | null>;
  incrementAttempts(id: string): Promise<void>;
  consume(id: string, at: Date): Promise<void>;
}

export class OtpService {
  constructor(
    private readonly store: OtpStore,
    private readonly clock: Clock = systemClock,
    private readonly ttlMs: number = OTP_TTL_MS,
  ) {}

  /**
   * Create a challenge. The plaintext code is returned once, for the delivery
   * channel to send, and is never recoverable afterwards.
   */
  async issue(params: {
    destination: string;
    purpose: OtpPurpose;
    userId?: string;
  }): Promise<{ code: string; challenge: OtpChallenge }> {
    const previous = await this.store.findLatest(params.destination, params.purpose);
    const now = this.clock.now();

    if (
      previous !== null &&
      previous.consumedAt === null &&
      now.getTime() - previous.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS
    ) {
      const waitMs =
        OTP_RESEND_COOLDOWN_MS - (now.getTime() - previous.createdAt.getTime());
      throw Object.assign(new Error('OTP resend cooldown'), {
        code: 'otp_cooldown',
        retryAfterSeconds: Math.ceil(waitMs / 1000),
      });
    }

    const code = generateOtpCode();
    const salt = randomBytes(16).toString('hex');
    const challenge: OtpChallenge = {
      id: uuidv7(this.clock.nowMs()),
      userId: params.userId ?? null,
      destination: params.destination,
      purpose: params.purpose,
      codeHash: hashOtp(code, salt),
      salt,
      attempts: 0,
      expiresAt: new Date(now.getTime() + this.ttlMs),
      consumedAt: null,
      createdAt: now,
    };

    await this.store.insert(challenge);
    return { code, challenge };
  }

  async verify(params: {
    destination: string;
    purpose: OtpPurpose;
    code: string;
  }): Promise<OtpVerifyResult> {
    const challenge = await this.store.findLatest(params.destination, params.purpose);
    const now = this.clock.now();

    if (challenge === null) return { status: 'INVALID', attemptsRemaining: 0 };
    if (challenge.consumedAt !== null) return { status: 'CONSUMED' };
    if (challenge.expiresAt.getTime() <= now.getTime()) return { status: 'EXPIRED' };
    // The attempt cap is what keeps a six-digit code out of brute-force range.
    if (challenge.attempts >= OTP_MAX_ATTEMPTS) return { status: 'TOO_MANY_ATTEMPTS' };

    const candidate = Buffer.from(hashOtp(params.code, challenge.salt), 'hex');
    const stored = Buffer.from(challenge.codeHash, 'hex');
    const matches =
      candidate.length === stored.length && timingSafeEqual(candidate, stored);

    if (!matches) {
      await this.store.incrementAttempts(challenge.id);
      return {
        status: 'INVALID',
        attemptsRemaining: Math.max(0, OTP_MAX_ATTEMPTS - (challenge.attempts + 1)),
      };
    }

    // Single use: consumed the moment it succeeds.
    await this.store.consume(challenge.id, now);
    return { status: 'VALID', challenge };
  }
}
