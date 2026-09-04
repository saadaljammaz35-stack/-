/**
 * Rotating refresh tokens with reuse detection.
 *
 * The rules, and why each exists:
 *
 *   1. The raw token is never stored. Only its SHA-256 hash is, so a database
 *      dump cannot be replayed against the API.
 *   2. Every use rotates the token: the presented one is retired and a fresh
 *      one issued. A stolen token is therefore useful only until the legitimate
 *      client refreshes.
 *   3. Presenting an already-rotated token revokes the entire session family.
 *      There are only two ways that happens — an attacker replaying a stolen
 *      token, or a legitimate client whose refresh response was lost. Both are
 *      worth ending the session for; the second costs one re-login, the first
 *      is an account takeover.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

import {
  type Clock,
  DAY_MS,
  SessionExpiredError,
  TokenReuseDetectedError,
  systemClock,
  uuidv7,
} from '@nabd/shared';

export interface RefreshTokenRecord {
  readonly id: string;
  readonly sessionId: string;
  readonly userId: string;
  readonly tokenHash: string;
  /** Non-null once this token has been rotated away. */
  readonly rotatedToId: string | null;
  readonly usedAt: Date | null;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
  readonly createdAt: Date;
}

export interface IssuedRefreshToken {
  /** Returned to the client exactly once, then unrecoverable. */
  readonly token: string;
  readonly record: RefreshTokenRecord;
}

export const REFRESH_TOKEN_BYTES = 32;
export const DEFAULT_REFRESH_TTL_MS = 30 * DAY_MS;

/** SHA-256 is correct here: the token is already 256 bits of entropy, so it
 *  needs no key stretching — only a one-way transform. */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function constantTimeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return timingSafeEqual(bufA, bufB);
}

export interface RefreshTokenStore {
  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  insert(record: RefreshTokenRecord): Promise<void>;
  markRotated(id: string, rotatedToId: string, usedAt: Date): Promise<void>;
  /** Revoke every token belonging to a session. Used on reuse detection. */
  revokeSessionFamily(sessionId: string, reason: string, at: Date): Promise<void>;
  revokeToken(id: string, at: Date): Promise<void>;
}

export interface RotationResult {
  readonly issued: IssuedRefreshToken;
  readonly previous: RefreshTokenRecord;
}

export class RefreshTokenService {
  constructor(
    private readonly store: RefreshTokenStore,
    private readonly clock: Clock = systemClock,
    private readonly ttlMs: number = DEFAULT_REFRESH_TTL_MS,
  ) {}

  /** Mint a brand-new token, e.g. at login. */
  async issue(params: { sessionId: string; userId: string }): Promise<IssuedRefreshToken> {
    const token = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    const now = this.clock.now();
    const record: RefreshTokenRecord = {
      id: uuidv7(this.clock.nowMs()),
      sessionId: params.sessionId,
      userId: params.userId,
      tokenHash: hashRefreshToken(token),
      rotatedToId: null,
      usedAt: null,
      expiresAt: new Date(now.getTime() + this.ttlMs),
      revokedAt: null,
      createdAt: now,
    };
    await this.store.insert(record);
    return { token, record };
  }

  /**
   * Exchange a refresh token for a new one.
   *
   * Throws `TokenReuseDetectedError` — after revoking the whole family — if the
   * presented token was already rotated. The caller must treat that as a
   * security event, not a routine auth failure.
   */
  async rotate(presentedToken: string): Promise<RotationResult> {
    const now = this.clock.now();
    const presentedHash = hashRefreshToken(presentedToken);
    const existing = await this.store.findByHash(presentedHash);

    if (existing === null) {
      throw new SessionExpiredError('Refresh token not recognised', {
        reason: 'unknown_token',
      });
    }

    // The reuse signal. A token that has already been rotated is being
    // presented a second time: either a replay, or a client that lost our
    // response. Both end the session.
    if (existing.rotatedToId !== null || existing.usedAt !== null) {
      await this.store.revokeSessionFamily(
        existing.sessionId,
        'refresh_token_reuse_detected',
        now,
      );
      throw new TokenReuseDetectedError('Refresh token was already used', {
        sessionId: existing.sessionId,
        userId: existing.userId,
        tokenId: existing.id,
      });
    }

    if (existing.revokedAt !== null) {
      throw new SessionExpiredError('Refresh token was revoked', {
        reason: 'revoked',
        sessionId: existing.sessionId,
      });
    }

    if (existing.expiresAt.getTime() <= now.getTime()) {
      throw new SessionExpiredError('Refresh token has expired', {
        reason: 'expired',
        sessionId: existing.sessionId,
      });
    }

    const issued = await this.issue({
      sessionId: existing.sessionId,
      userId: existing.userId,
    });
    await this.store.markRotated(existing.id, issued.record.id, now);

    return { issued, previous: existing };
  }

  async revoke(token: string): Promise<void> {
    const record = await this.store.findByHash(hashRefreshToken(token));
    if (record !== null) {
      await this.store.revokeToken(record.id, this.clock.now());
    }
  }

  async revokeSession(sessionId: string, reason: string): Promise<void> {
    await this.store.revokeSessionFamily(sessionId, reason, this.clock.now());
  }
}
