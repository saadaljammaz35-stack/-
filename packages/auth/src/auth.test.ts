import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  AuthenticationError,
  ConfigurationError,
  FixedClock,
  SessionExpiredError,
  TokenReuseDetectedError,
} from '@nabd/shared';

import { JwtService } from './jwt.js';
import {
  OtpService,
  type OtpChallenge,
  type OtpPurpose,
  type OtpStore,
  generateOtpCode,
} from './otp.js';
import { ScryptHasher, validatePassword, validatePin } from './password.js';
import {
  type RefreshTokenRecord,
  RefreshTokenService,
  type RefreshTokenStore,
  hashRefreshToken,
} from './refresh-token.js';

const SECRET = 'a'.repeat(48);

// Low cost so the suite stays fast; production parameters are the defaults.
const fastHasher = new ScryptHasher({ N: 1024, r: 8, p: 1, keyLength: 32, saltLength: 16 });

describe('Password hashing', () => {
  it('round-trips a password', async () => {
    const stored = await fastHasher.hash('correct horse battery staple');
    assert.equal(await fastHasher.verify('correct horse battery staple', stored), true);
    assert.equal(await fastHasher.verify('wrong password entirely', stored), false);
  });

  it('never stores the plaintext', async () => {
    const stored = await fastHasher.hash('SuperSecret12345');
    assert.ok(!stored.includes('SuperSecret12345'));
    assert.ok(stored.startsWith('scrypt$'));
  });

  it('produces a different hash each time for the same password', async () => {
    const a = await fastHasher.hash('same password here');
    const b = await fastHasher.hash('same password here');
    assert.notEqual(a, b, 'salts must differ');
    assert.equal(await fastHasher.verify('same password here', a), true);
    assert.equal(await fastHasher.verify('same password here', b), true);
  });

  it('encodes its parameters so cost can be raised later', async () => {
    const stored = await fastHasher.hash('whatever goes here');
    assert.match(stored, /^scrypt\$N=1024,r=8,p=1\$/);

    const stronger = new ScryptHasher({
      N: 16384,
      r: 8,
      p: 1,
      keyLength: 32,
      saltLength: 16,
    });
    assert.equal(stronger.needsRehash(stored), true, 'old cost should be flagged');
    assert.equal(fastHasher.needsRehash(stored), false);
    // Crucially, the stronger hasher can still verify the weaker hash.
    assert.equal(await stronger.verify('whatever goes here', stored), true);
  });

  it('returns false rather than throwing on a corrupt hash', async () => {
    for (const bad of [
      '',
      'garbage',
      'scrypt$bad',
      'bcrypt$N=1$a$b',
      'scrypt$N=x,r=y,p=z$a$b',
    ]) {
      assert.equal(await fastHasher.verify('password', bad), false, `input: ${bad}`);
    }
  });
});

describe('Password and PIN policy', () => {
  it('requires length over composition tricks', () => {
    assert.equal(validatePassword('Sh0rt!').valid, false);
    assert.equal(validatePassword('a-perfectly-fine-long-passphrase').valid, true);
  });

  it("rejects passwords derived from the user's own identifiers", () => {
    const result = validatePassword('my-nabd-password', {});
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('service name')));

    const withPhone = validatePassword('prefix966501234', { phone: '+966501234567' });
    assert.equal(withPhone.valid, false);
  });

  it('rejects repeated and sequential passwords', () => {
    assert.equal(validatePassword('aaaaaaaaaaaaaaa').valid, false);
    assert.equal(validatePassword('0123456789abcdef').valid, false);
  });

  it('rejects the PINs attackers guess first', () => {
    for (const pin of ['1234', '0000', '1111', '4321', '123456', '000000']) {
      assert.equal(validatePin(pin).valid, false, `${pin} should be rejected`);
    }
    assert.equal(validatePin('8264').valid, true);
    assert.equal(validatePin('073925').valid, true);
  });

  it('requires exactly 4 or 6 digits', () => {
    for (const pin of ['12', '12345', 'abcd', '12a4', '']) {
      assert.equal(validatePin(pin).valid, false, `${pin} should be rejected`);
    }
  });
});

describe('JWT', () => {
  const clock = new FixedClock(1_756_000_000_000);
  const jwt = new JwtService(SECRET, undefined, clock);

  it('signs and verifies', () => {
    const { token } = jwt.sign({ sub: 'user_1', sessionId: 'sess_1' });
    const claims = jwt.verify(token);
    assert.equal(claims.sub, 'user_1');
    assert.equal(claims.sessionId, 'sess_1');
    assert.equal(claims.iss, 'nabd');
  });

  it('refuses a signing secret that is too short to be safe', () => {
    assert.throws(() => new JwtService('short'), ConfigurationError);
  });

  it('rejects alg:none — the classic signature bypass', () => {
    const { token } = jwt.sign({ sub: 'user_1' });
    const claims = token.split('.')[1] as string;
    const noneHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString(
      'base64url',
    );
    assert.throws(() => jwt.verify(`${noneHeader}.${claims}.`), AuthenticationError);
    assert.throws(
      () => jwt.verify(`${noneHeader}.${claims}.anything`),
      AuthenticationError,
    );
  });

  it('takes the algorithm from configuration, not from the token', () => {
    const { token } = jwt.sign({ sub: 'user_1' });
    const [, claims, signature] = token.split('.') as [string, string, string];
    const swapped = Buffer.from(JSON.stringify({ alg: 'HS512', typ: 'JWT' })).toString(
      'base64url',
    );
    assert.throws(
      () => jwt.verify(`${swapped}.${claims}.${signature}`),
      AuthenticationError,
    );
  });

  it('rejects a tampered payload', () => {
    const { token } = jwt.sign({ sub: 'user_1' });
    const [header, claims, signature] = token.split('.') as [string, string, string];
    const decoded = JSON.parse(Buffer.from(claims, 'base64url').toString()) as Record<
      string,
      unknown
    >;
    decoded['sub'] = 'user_admin';
    const forged = Buffer.from(JSON.stringify(decoded)).toString('base64url');
    assert.throws(
      () => jwt.verify(`${header}.${forged}.${signature}`),
      AuthenticationError,
    );
  });

  it('rejects a token signed with a different key', () => {
    const other = new JwtService('b'.repeat(48), undefined, clock);
    const { token } = other.sign({ sub: 'user_1' });
    assert.throws(() => jwt.verify(token), AuthenticationError);
  });

  it('rejects malformed tokens', () => {
    for (const bad of ['', 'a', 'a.b', 'a.b.c.d', '...', 'not-a-token']) {
      assert.throws(() => jwt.verify(bad), Error, `input: ${bad}`);
    }
  });

  it('expires', () => {
    const local = new FixedClock(1_756_000_000_000);
    const service = new JwtService(SECRET, undefined, local);
    const { token } = service.sign({ sub: 'user_1', ttlSeconds: 60 });

    local.advance(59_000);
    assert.doesNotThrow(() => service.verify(token));

    // 60s TTL + 30s configured clock tolerance.
    local.advance(45_000);
    assert.throws(() => service.verify(token), SessionExpiredError);
  });

  it('rejects a token issued for a different audience', () => {
    const other = new JwtService(
      SECRET,
      {
        algorithm: 'HS256',
        issuer: 'nabd',
        audience: 'nabd-admin',
        accessTokenTtlSeconds: 900,
        clockToleranceSeconds: 30,
      },
      clock,
    );
    const { token } = other.sign({ sub: 'admin_1' });
    assert.throws(() => jwt.verify(token), AuthenticationError);
  });

  it('gives every token a unique id so one can be revoked', () => {
    const a = jwt.sign({ sub: 'user_1' });
    const b = jwt.sign({ sub: 'user_1' });
    assert.notEqual(a.claims.jti, b.claims.jti);
  });
});

// ── refresh tokens ──────────────────────────────────────────────────────────

class MemoryRefreshStore implements RefreshTokenStore {
  readonly rows = new Map<string, RefreshTokenRecord>();
  readonly revokedFamilies: Array<{ sessionId: string; reason: string }> = [];

  async findByHash(tokenHash: string): Promise<RefreshTokenRecord | null> {
    for (const row of this.rows.values()) {
      if (row.tokenHash === tokenHash) return row;
    }
    return null;
  }

  async insert(record: RefreshTokenRecord): Promise<void> {
    this.rows.set(record.id, record);
  }

  async markRotated(id: string, rotatedToId: string, usedAt: Date): Promise<void> {
    const row = this.rows.get(id);
    if (row !== undefined) this.rows.set(id, { ...row, rotatedToId, usedAt });
  }

  async revokeSessionFamily(sessionId: string, reason: string, at: Date): Promise<void> {
    this.revokedFamilies.push({ sessionId, reason });
    for (const [id, row] of this.rows) {
      if (row.sessionId === sessionId) this.rows.set(id, { ...row, revokedAt: at });
    }
  }

  async revokeToken(id: string, at: Date): Promise<void> {
    const row = this.rows.get(id);
    if (row !== undefined) this.rows.set(id, { ...row, revokedAt: at });
  }
}

describe('Refresh tokens', () => {
  it('never stores the raw token', async () => {
    const store = new MemoryRefreshStore();
    const service = new RefreshTokenService(store, new FixedClock(1_756_000_000_000));
    const { token, record } = await service.issue({ sessionId: 's1', userId: 'u1' });

    assert.notEqual(record.tokenHash, token);
    assert.equal(record.tokenHash, hashRefreshToken(token));
    for (const row of store.rows.values()) {
      assert.ok(!JSON.stringify(row).includes(token), 'raw token leaked into storage');
    }
  });

  it('rotates on every use', async () => {
    const store = new MemoryRefreshStore();
    const service = new RefreshTokenService(store, new FixedClock(1_756_000_000_000));
    const first = await service.issue({ sessionId: 's1', userId: 'u1' });

    const rotated = await service.rotate(first.token);
    assert.notEqual(rotated.issued.token, first.token, 'a new token is issued');
    assert.equal(store.rows.get(first.record.id)?.rotatedToId, rotated.issued.record.id);

    // The new one works.
    const again = await service.rotate(rotated.issued.token);
    assert.ok(again.issued.token.length > 0);
  });

  it('detects reuse and revokes the whole session family', async () => {
    const store = new MemoryRefreshStore();
    const service = new RefreshTokenService(store, new FixedClock(1_756_000_000_000));
    const first = await service.issue({ sessionId: 's1', userId: 'u1' });

    const rotated = await service.rotate(first.token);

    // An attacker replays the token the legitimate client already spent.
    await assert.rejects(() => service.rotate(first.token), TokenReuseDetectedError);

    assert.equal(store.revokedFamilies.length, 1);
    assert.equal(store.revokedFamilies[0]?.sessionId, 's1');
    assert.equal(store.revokedFamilies[0]?.reason, 'refresh_token_reuse_detected');

    // And the token the attacker would have stolen next is dead too.
    await assert.rejects(() => service.rotate(rotated.issued.token), SessionExpiredError);
  });

  it('does not leak which identifier was wrong', async () => {
    const store = new MemoryRefreshStore();
    const service = new RefreshTokenService(store, new FixedClock(1_756_000_000_000));
    await assert.rejects(() => service.rotate('completely-made-up'), SessionExpiredError);
  });

  it('rejects an expired token', async () => {
    const clock = new FixedClock(1_756_000_000_000);
    const service = new RefreshTokenService(store(), clock, 1_000);
    function store(): MemoryRefreshStore {
      return new MemoryRefreshStore();
    }
    const issued = await service.issue({ sessionId: 's1', userId: 'u1' });
    clock.advance(2_000);
    await assert.rejects(() => service.rotate(issued.token), SessionExpiredError);
  });

  it('rejects a revoked token', async () => {
    const store = new MemoryRefreshStore();
    const service = new RefreshTokenService(store, new FixedClock(1_756_000_000_000));
    const issued = await service.issue({ sessionId: 's1', userId: 'u1' });
    await service.revoke(issued.token);
    await assert.rejects(() => service.rotate(issued.token), SessionExpiredError);
  });
});

// ── OTP ─────────────────────────────────────────────────────────────────────

class MemoryOtpStore implements OtpStore {
  readonly rows: OtpChallenge[] = [];

  async insert(challenge: OtpChallenge): Promise<void> {
    this.rows.push(challenge);
  }

  async findLatest(destination: string, purpose: OtpPurpose): Promise<OtpChallenge | null> {
    for (let i = this.rows.length - 1; i >= 0; i -= 1) {
      const row = this.rows[i] as OtpChallenge;
      if (row.destination === destination && row.purpose === purpose) return row;
    }
    return null;
  }

  async incrementAttempts(id: string): Promise<void> {
    const index = this.rows.findIndex((r) => r.id === id);
    const row = this.rows[index];
    if (row !== undefined) this.rows[index] = { ...row, attempts: row.attempts + 1 };
  }

  async consume(id: string, at: Date): Promise<void> {
    const index = this.rows.findIndex((r) => r.id === id);
    const row = this.rows[index];
    if (row !== undefined) this.rows[index] = { ...row, consumedAt: at };
  }
}

describe('OTP', () => {
  const PHONE = '+966500000001';

  it('generates codes of the right shape from a CSPRNG', () => {
    for (let i = 0; i < 100; i += 1) {
      assert.match(generateOtpCode(), /^\d{6}$/);
    }
    const sample = new Set(Array.from({ length: 200 }, () => generateOtpCode()));
    assert.ok(sample.size > 150, 'codes must not repeat predictably');
  });

  it('never stores the code in the clear', async () => {
    const store = new MemoryOtpStore();
    const service = new OtpService(store, new FixedClock(1_756_000_000_000));
    const { code } = await service.issue({ destination: PHONE, purpose: 'LOGIN' });
    assert.ok(
      !JSON.stringify(store.rows).includes(code),
      'plaintext OTP leaked to storage',
    );
  });

  it('accepts the right code exactly once', async () => {
    const store = new MemoryOtpStore();
    const service = new OtpService(store, new FixedClock(1_756_000_000_000));
    const { code } = await service.issue({ destination: PHONE, purpose: 'LOGIN' });

    const first = await service.verify({ destination: PHONE, purpose: 'LOGIN', code });
    assert.equal(first.status, 'VALID');

    const replay = await service.verify({ destination: PHONE, purpose: 'LOGIN', code });
    assert.equal(replay.status, 'CONSUMED', 'a code must not be reusable');
  });

  it('caps attempts so six digits cannot be brute-forced', async () => {
    const store = new MemoryOtpStore();
    const service = new OtpService(store, new FixedClock(1_756_000_000_000));
    const { code } = await service.issue({ destination: PHONE, purpose: 'LOGIN' });
    const wrong = code === '000000' ? '111111' : '000000';

    for (let i = 0; i < 5; i += 1) {
      const r = await service.verify({ destination: PHONE, purpose: 'LOGIN', code: wrong });
      assert.equal(r.status, 'INVALID');
    }
    const blocked = await service.verify({
      destination: PHONE,
      purpose: 'LOGIN',
      code: wrong,
    });
    assert.equal(blocked.status, 'TOO_MANY_ATTEMPTS');

    // Even the correct code is refused once the cap is hit.
    const correct = await service.verify({ destination: PHONE, purpose: 'LOGIN', code });
    assert.equal(correct.status, 'TOO_MANY_ATTEMPTS');
  });

  it('expires', async () => {
    const clock = new FixedClock(1_756_000_000_000);
    const service = new OtpService(new MemoryOtpStore(), clock);
    const { code } = await service.issue({ destination: PHONE, purpose: 'LOGIN' });
    clock.advance(6 * 60_000);
    const result = await service.verify({ destination: PHONE, purpose: 'LOGIN', code });
    assert.equal(result.status, 'EXPIRED');
  });

  it('is scoped to a purpose — a login code cannot approve a transfer', async () => {
    const store = new MemoryOtpStore();
    const service = new OtpService(store, new FixedClock(1_756_000_000_000));
    const { code } = await service.issue({ destination: PHONE, purpose: 'LOGIN' });

    const misuse = await service.verify({
      destination: PHONE,
      purpose: 'HIGH_VALUE_TRANSFER',
      code,
    });
    assert.notEqual(misuse.status, 'VALID');
  });

  it('enforces a resend cooldown', async () => {
    const clock = new FixedClock(1_756_000_000_000);
    const service = new OtpService(new MemoryOtpStore(), clock);
    await service.issue({ destination: PHONE, purpose: 'LOGIN' });
    await assert.rejects(() => service.issue({ destination: PHONE, purpose: 'LOGIN' }));

    clock.advance(61_000);
    await assert.doesNotReject(() =>
      service.issue({ destination: PHONE, purpose: 'LOGIN' }),
    );
  });
});
