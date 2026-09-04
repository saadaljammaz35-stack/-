import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FixedClock, Money, RateLimitError } from '@nabd/shared';

import { assessFraudRisk, type FraudSignalInput } from './fraud.js';
import {
  InMemoryRateLimitStore,
  RATE_LIMITS,
  RateLimiter,
  isLockedOut,
  nextLockout,
} from './rate-limit.js';
import { maskPhone, maskTail, redact, redactString } from './redaction.js';

describe('Rate limiting', () => {
  it('allows up to the limit and refuses beyond it', async () => {
    const clock = new FixedClock(1_756_000_000_000);
    const limiter = new RateLimiter(new InMemoryRateLimitStore(), clock);
    const rule = { name: 'test', limit: 3, windowMs: 60_000 };

    for (let i = 0; i < 3; i += 1) {
      const d = await limiter.check(rule, 'user_1');
      assert.equal(d.allowed, true, `request ${i + 1} should be allowed`);
    }
    const denied = await limiter.check(rule, 'user_1');
    assert.equal(denied.allowed, false);
    assert.ok(denied.retryAfterSeconds > 0);
  });

  it('scopes limits per identifier', async () => {
    const limiter = new RateLimiter(new InMemoryRateLimitStore(), new FixedClock(0));
    const rule = { name: 'test', limit: 2, windowMs: 60_000 };
    await limiter.check(rule, 'a');
    await limiter.check(rule, 'a');
    assert.equal((await limiter.check(rule, 'a')).allowed, false);
    assert.equal((await limiter.check(rule, 'b')).allowed, true, 'other users unaffected');
  });

  it('closes the fixed-window boundary burst', async () => {
    // With a fixed window, an attacker sends `limit` at the end of one window
    // and `limit` at the start of the next — double the intended rate. The
    // sliding window must refuse the second burst.
    const clock = new FixedClock(0);
    const limiter = new RateLimiter(new InMemoryRateLimitStore(), clock);
    const rule = { name: 'burst', limit: 5, windowMs: 60_000 };

    clock.set(59_000);
    for (let i = 0; i < 5; i += 1) {
      assert.equal((await limiter.check(rule, 'attacker')).allowed, true);
    }

    // Immediately into the next window.
    clock.set(60_100);
    const decisions: boolean[] = [];
    for (let i = 0; i < 5; i += 1) {
      decisions.push((await limiter.check(rule, 'attacker')).allowed);
    }
    assert.ok(
      decisions.includes(false),
      'the previous window must still count against the attacker',
    );
  });

  it('recovers after the window passes', async () => {
    const clock = new FixedClock(0);
    const limiter = new RateLimiter(new InMemoryRateLimitStore(), clock);
    const rule = { name: 'recover', limit: 2, windowMs: 60_000 };
    await limiter.check(rule, 'u');
    await limiter.check(rule, 'u');
    assert.equal((await limiter.check(rule, 'u')).allowed, false);

    clock.advance(130_000);
    assert.equal((await limiter.check(rule, 'u')).allowed, true);
  });

  it('throws RateLimitError from enforce()', async () => {
    const limiter = new RateLimiter(new InMemoryRateLimitStore(), new FixedClock(0));
    const rule = { name: 'enforce', limit: 1, windowMs: 60_000 };
    await limiter.enforce(rule, 'u');
    await assert.rejects(() => limiter.enforce(rule, 'u'), RateLimitError);
  });

  it('limits login attempts far more tightly than reads', () => {
    assert.ok(RATE_LIMITS.loginPerAccount.limit < RATE_LIMITS.readDefault.limit);
    assert.ok(
      RATE_LIMITS.beneficiaryAdd.limit <= 5,
      'adding a payee must be tightly limited',
    );
  });
});

describe('Account lockout', () => {
  const now = new Date('2026-09-04T00:00:00Z');

  it('does not lock before the threshold', () => {
    assert.equal(nextLockout(4, now).lockedUntil, null);
  });

  it('backs off exponentially rather than locking permanently', () => {
    const first = nextLockout(5, now);
    const second = nextLockout(6, now);
    const third = nextLockout(7, now);
    assert.ok(first.lockedUntil !== null);
    assert.ok(second.lockedUntil !== null && third.lockedUntil !== null);
    assert.ok(
      second.lockedUntil.getTime() > first.lockedUntil.getTime(),
      'delay must grow',
    );
    assert.ok(third.lockedUntil.getTime() > second.lockedUntil.getTime());
  });

  it('caps the delay so an attacker cannot lock an account forever', () => {
    const extreme = nextLockout(100, now);
    assert.ok(extreme.lockedUntil !== null);
    const delayMs = extreme.lockedUntil.getTime() - now.getTime();
    assert.ok(delayMs <= 60 * 60_000, 'lockout must never exceed one hour');
  });

  it('expires', () => {
    const state = nextLockout(5, now);
    assert.equal(isLockedOut(state, now), true);
    assert.equal(isLockedOut(state, new Date(now.getTime() + 2 * 60 * 60_000)), false);
  });
});

describe('Log redaction', () => {
  it('redacts sensitive keys regardless of nesting', () => {
    const logged = redact({
      user: 'u1',
      password: 'hunter2',
      nested: { pin: '1234', card: { cvv: '999' } },
      list: [{ refreshToken: 'abc' }],
    }) as Record<string, unknown>;

    const json = JSON.stringify(logged);
    assert.ok(!json.includes('hunter2'));
    assert.ok(!json.includes('1234'));
    assert.ok(!json.includes('999'));
    assert.ok(!json.includes('abc'));
    assert.equal(logged['user'], 'u1', 'non-sensitive fields survive');
  });

  it('matches keys regardless of case and separators', () => {
    const out = JSON.stringify(
      redact({ API_KEY: 'k', 'card-number': '4111111111111111', AccessToken: 't' }),
    );
    assert.ok(!out.includes('"k"'));
    assert.ok(!out.includes('4111111111111111'));
    assert.ok(!out.includes('"t"'));
  });

  it('catches a card number hidden inside a free-text value', () => {
    // The field is called `note`, not `pan`. Key-based redaction alone misses it.
    const out = redactString('customer said their card 4111 1111 1111 1111 was declined');
    assert.ok(!out.includes('4111111111111111'));
    assert.ok(!out.includes('4111 1111 1111 1111'));
    assert.ok(out.includes('1111]') || out.includes('REDACTED_PAN'));
  });

  it('does not mangle a long number that is not a card', () => {
    // Fails Luhn — an order reference, not a PAN.
    const out = redactString('order 1234567890123456 shipped');
    assert.ok(out.includes('1234567890123456'), 'false positives break debugging');
  });

  it('redacts JWTs and bearer headers', () => {
    const jwt = 'eyJhbGciOi.eyJzdWIiOi.SflKxwRJSM';
    assert.ok(!redactString(`token=${jwt}`).includes(jwt));
    assert.ok(!redactString('Authorization: Bearer abc.def_ghi').includes('abc.def_ghi'));
  });

  it('redacts IBANs and partially masks emails', () => {
    assert.ok(!redactString('SA0380000000608010167519').includes('0380000000608010167519'));
    assert.equal(redactString('ali@example.com'), 'a***@example.com');
  });

  it('survives circular structures and caps depth', () => {
    const cyclic: Record<string, unknown> = { name: 'x' };
    cyclic['self'] = cyclic;
    const out = JSON.stringify(redact(cyclic));
    assert.ok(out.includes('CIRCULAR'));
  });

  it('masks for display', () => {
    assert.equal(maskPhone('+966501234567'), '+9665••••••67');
    assert.equal(maskTail('1234567890'), '••••••7890');
  });
});

describe('Fraud scoring', () => {
  const baseline: FraudSignalInput = {
    amount: Money.fromMajor('100.00', 'SAR'),
    averageAmountMinor: 10_000n,
    accountBalanceMinor: 1_000_000n,
    velocityLastHour: 1,
    velocityLast24h: 3,
    beneficiaryAgeHours: 720,
    beneficiaryIsVerified: true,
    isNewDevice: false,
    isNewCountry: false,
    ipIsAnonymised: false,
    localHour: 14,
    accountAgeDays: 400,
    kycVerified: true,
    priorFraudCases: 0,
  };

  it('scores an ordinary transfer as low risk', () => {
    const result = assessFraudRisk(baseline);
    assert.equal(result.level, 'LOW');
    assert.equal(result.recommendation, 'ALLOW');
    assert.ok(result.score < 30);
  });

  it('flags the account-takeover cash-out pattern', () => {
    // New device, new country, brand-new payee, draining the balance at 3am.
    const result = assessFraudRisk({
      ...baseline,
      amount: Money.fromMajor('9800.00', 'SAR'),
      accountBalanceMinor: 1_000_000n,
      beneficiaryAgeHours: 0.5,
      beneficiaryIsVerified: false,
      isNewDevice: true,
      isNewCountry: true,
      localHour: 3,
    });
    assert.equal(result.level, 'CRITICAL');
    assert.equal(result.recommendation, 'BLOCK');
    const codes = result.signals.map((s) => s.code);
    assert.ok(codes.includes('BENEFICIARY_BRAND_NEW'));
    assert.ok(codes.includes('NEW_DEVICE'));
    assert.ok(codes.includes('NEW_COUNTRY'));
    assert.ok(codes.includes('ACCOUNT_DRAIN'));
  });

  it('never exceeds the 0–100 range', () => {
    const worst = assessFraudRisk({
      ...baseline,
      amount: Money.fromMajor('50000.00', 'SAR'),
      beneficiaryAgeHours: 0,
      beneficiaryIsVerified: false,
      velocityLastHour: 50,
      velocityLast24h: 200,
      isNewDevice: true,
      isNewCountry: true,
      ipIsAnonymised: true,
      localHour: 3,
      accountAgeDays: 0,
      kycVerified: false,
      priorFraudCases: 5,
    });
    assert.ok(worst.score >= 0 && worst.score <= 100);
    assert.equal(worst.score, 100);
  });

  it('explains every point it assigns', () => {
    const result = assessFraudRisk({ ...baseline, isNewDevice: true, kycVerified: false });
    assert.ok(result.signals.length > 0);
    for (const signal of result.signals) {
      assert.ok(signal.code.length > 0);
      assert.ok(signal.detail.length > 0, 'every signal must be explainable to a reviewer');
      assert.ok(signal.weight > 0);
    }
    const summed = Math.min(
      100,
      result.signals.reduce((t, s) => t + s.weight, 0),
    );
    assert.equal(result.score, summed, 'the score must equal its stated reasons');
  });

  it('escalates monotonically with risk', () => {
    const low = assessFraudRisk(baseline).score;
    const medium = assessFraudRisk({
      ...baseline,
      isNewDevice: true,
      accountAgeDays: 3,
    }).score;
    const high = assessFraudRisk({
      ...baseline,
      isNewDevice: true,
      accountAgeDays: 3,
      isNewCountry: true,
      beneficiaryAgeHours: 0.5,
    }).score;
    assert.ok(low < medium && medium < high, `${low} < ${medium} < ${high}`);
  });

  it('treats an unverified customer as riskier than a verified one', () => {
    const verified = assessFraudRisk(baseline).score;
    const unverified = assessFraudRisk({ ...baseline, kycVerified: false }).score;
    assert.ok(unverified > verified);
  });
});
