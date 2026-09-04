/**
 * JWT signing and verification (HS256), built on node:crypto.
 *
 * Written by hand rather than pulled from a library for two reasons: this
 * package has no third-party dependencies by design, and the historical JWT
 * vulnerabilities are all things a verifier must actively refuse. Those
 * refusals are explicit and commented below, so they cannot be lost in a
 * dependency bump:
 *
 *   • `alg: "none"` is rejected — the classic signature bypass.
 *   • The algorithm is taken from *our* configuration, never from the token's
 *     own header, so an attacker cannot pick a weaker one.
 *   • Signature comparison is constant-time.
 *   • `exp`, `nbf`, `iss` and `aud` are all verified, not just parsed.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

import {
  AuthenticationError,
  type Clock,
  ConfigurationError,
  SessionExpiredError,
  systemClock,
  uuidv7,
} from '@nabd/shared';

export type JwtAlgorithm = 'HS256' | 'HS384' | 'HS512';

const HASH_FOR: Record<JwtAlgorithm, string> = {
  HS256: 'sha256',
  HS384: 'sha384',
  HS512: 'sha512',
};

export interface JwtHeader {
  readonly alg: JwtAlgorithm;
  readonly typ: 'JWT';
  /** Key id, so keys can be rotated without invalidating live tokens. */
  readonly kid?: string;
}

export interface JwtClaims {
  /** Subject — the user id. */
  readonly sub: string;
  readonly iss: string;
  readonly aud: string;
  /** Issued at (seconds). */
  readonly iat: number;
  /** Expiry (seconds). */
  readonly exp: number;
  /** Not before (seconds). */
  readonly nbf?: number;
  /** Token id, so a single token can be revoked. */
  readonly jti: string;
  readonly sessionId?: string;
  readonly deviceId?: string;
  readonly scope?: readonly string[];
  readonly role?: string;
  /** Whether the session has satisfied step-up authentication. */
  readonly amr?: readonly string[];
}

export interface JwtConfig {
  readonly algorithm: JwtAlgorithm;
  readonly issuer: string;
  readonly audience: string;
  /** Access-token lifetime in seconds. Short by design. */
  readonly accessTokenTtlSeconds: number;
  /** Tolerance for clock skew between issuer and verifier. */
  readonly clockToleranceSeconds: number;
}

export const DEFAULT_JWT_CONFIG: JwtConfig = {
  algorithm: 'HS256',
  issuer: 'nabd',
  audience: 'nabd-app',
  accessTokenTtlSeconds: 15 * 60,
  clockToleranceSeconds: 30,
};

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function decodeSegment(segment: string): unknown {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as unknown;
}

export interface SignOptions {
  readonly sub: string;
  readonly ttlSeconds?: number;
  readonly sessionId?: string;
  readonly deviceId?: string;
  readonly scope?: readonly string[];
  readonly role?: string;
  readonly amr?: readonly string[];
  readonly kid?: string;
}

export class JwtService {
  private readonly key: Buffer;

  constructor(
    secret: string,
    private readonly config: JwtConfig = DEFAULT_JWT_CONFIG,
    private readonly clock: Clock = systemClock,
  ) {
    // A short signing key makes HMAC brute-forcing feasible offline. 32 bytes
    // is the minimum for HS256 and this refuses to start below it rather than
    // running insecurely.
    if (secret.length < 32) {
      throw new ConfigurationError('JWT signing secret must be at least 32 characters', {
        provided: secret.length,
      });
    }
    this.key = Buffer.from(secret, 'utf8');
  }

  sign(options: SignOptions): { token: string; claims: JwtClaims } {
    const nowSeconds = Math.floor(this.clock.nowMs() / 1000);
    const ttl = options.ttlSeconds ?? this.config.accessTokenTtlSeconds;

    const header: JwtHeader = {
      alg: this.config.algorithm,
      typ: 'JWT',
      ...(options.kid === undefined ? {} : { kid: options.kid }),
    };

    const claims: JwtClaims = {
      sub: options.sub,
      iss: this.config.issuer,
      aud: this.config.audience,
      iat: nowSeconds,
      exp: nowSeconds + ttl,
      nbf: nowSeconds,
      jti: uuidv7(this.clock.nowMs()),
      ...(options.sessionId === undefined ? {} : { sessionId: options.sessionId }),
      ...(options.deviceId === undefined ? {} : { deviceId: options.deviceId }),
      ...(options.scope === undefined ? {} : { scope: options.scope }),
      ...(options.role === undefined ? {} : { role: options.role }),
      ...(options.amr === undefined ? {} : { amr: options.amr }),
    };

    const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
    return { token: `${signingInput}.${this.signature(signingInput)}`, claims };
  }

  verify(token: string): JwtClaims {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new AuthenticationError('Malformed token', { reason: 'segment_count' });
    }
    const [headerSegment, claimsSegment, signature] = parts as [string, string, string];

    let header: JwtHeader;
    try {
      header = decodeSegment(headerSegment) as JwtHeader;
    } catch {
      throw new AuthenticationError('Malformed token header', { reason: 'header_decode' });
    }

    // The two checks that defeat the classic JWT signature bypasses. The
    // algorithm comes from OUR config; the token only gets to agree with it.
    if (header.alg === undefined || String(header.alg).toLowerCase() === 'none') {
      throw new AuthenticationError('Unsigned tokens are rejected', { reason: 'alg_none' });
    }
    if (header.alg !== this.config.algorithm) {
      throw new AuthenticationError('Unexpected token algorithm', {
        reason: 'alg_mismatch',
        expected: this.config.algorithm,
        received: header.alg,
      });
    }

    const expected = this.signature(`${headerSegment}.${claimsSegment}`);
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new AuthenticationError('Invalid token signature', { reason: 'signature' });
    }

    let claims: JwtClaims;
    try {
      claims = decodeSegment(claimsSegment) as JwtClaims;
    } catch {
      throw new AuthenticationError('Malformed token claims', { reason: 'claims_decode' });
    }

    const nowSeconds = Math.floor(this.clock.nowMs() / 1000);
    const skew = this.config.clockToleranceSeconds;

    if (typeof claims.exp !== 'number' || nowSeconds > claims.exp + skew) {
      throw new SessionExpiredError('Token has expired', { exp: claims.exp });
    }
    if (typeof claims.nbf === 'number' && nowSeconds + skew < claims.nbf) {
      throw new AuthenticationError('Token is not yet valid', { reason: 'nbf' });
    }
    if (claims.iss !== this.config.issuer) {
      throw new AuthenticationError('Unexpected token issuer', { reason: 'iss' });
    }
    if (claims.aud !== this.config.audience) {
      throw new AuthenticationError('Unexpected token audience', { reason: 'aud' });
    }
    if (typeof claims.sub !== 'string' || claims.sub === '') {
      throw new AuthenticationError('Token has no subject', { reason: 'sub' });
    }

    return claims;
  }

  /** Read claims without verifying. Diagnostics only — never authorise on this. */
  decodeUnsafe(token: string): { header: unknown; claims: unknown } | null {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    try {
      return {
        header: decodeSegment(parts[0] as string),
        claims: decodeSegment(parts[1] as string),
      };
    } catch {
      return null;
    }
  }

  private signature(signingInput: string): string {
    return createHmac(HASH_FOR[this.config.algorithm], this.key)
      .update(signingInput)
      .digest('base64url');
  }
}
