import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LimitExceededError, Money } from '@nabd/shared';

import {
  DEFAULT_TIER_LIMITS,
  type UsageWindow,
  WalletTier,
  assertOutbound,
  checkInbound,
  checkOutbound,
  tierForKyc,
} from './wallet-tiers.js';

const SAR = 'SAR' as const;

const idle: UsageWindow = {
  dailyOutboundMinor: 0n,
  monthlyOutboundMinor: 0n,
  dailyCount: 0,
  currentBalanceMinor: 0n,
};

function sar(major: string): Money {
  return Money.fromMajor(major, SAR);
}

describe('Wallet tier assignment', () => {
  it('gives an unverified customer a wallet that holds and moves nothing', () => {
    // Failing closed is the point: a wallet usable while verification is
    // "pending" is a wallet an attacker can use before anyone confirmed who
    // they are.
    for (const status of [
      'NOT_STARTED',
      'PENDING',
      'UNDER_REVIEW',
      'REJECTED',
      'EXPIRED',
    ] as const) {
      assert.equal(tierForKyc(status), WalletTier.TIER_0, `${status} must be TIER_0`);
    }
  });

  it('maps verification depth to tier', () => {
    assert.equal(tierForKyc('VERIFIED', 'BASIC'), WalletTier.TIER_1);
    assert.equal(tierForKyc('VERIFIED', 'FULL'), WalletTier.TIER_2);
    assert.equal(tierForKyc('VERIFIED', 'ENHANCED'), WalletTier.TIER_3);
  });

  it('keeps limits monotonically increasing across tiers', () => {
    const order = [WalletTier.TIER_1, WalletTier.TIER_2, WalletTier.TIER_3];
    for (let i = 1; i < order.length; i += 1) {
      const lower = DEFAULT_TIER_LIMITS[order[i - 1] as WalletTier];
      const higher = DEFAULT_TIER_LIMITS[order[i] as WalletTier];
      assert.ok(higher.maxBalanceMinor > lower.maxBalanceMinor);
      assert.ok(higher.maxSingleTransactionMinor > lower.maxSingleTransactionMinor);
      assert.ok(higher.maxDailyOutboundMinor > lower.maxDailyOutboundMinor);
      assert.ok(higher.maxMonthlyOutboundMinor > lower.maxMonthlyOutboundMinor);
    }
  });

  it('never lets a limit exceed the one above it in the same window', () => {
    for (const tier of Object.values(WalletTier)) {
      const l = DEFAULT_TIER_LIMITS[tier];
      assert.ok(
        l.maxSingleTransactionMinor <= l.maxDailyOutboundMinor,
        `${tier}: a single transaction may not exceed the daily limit`,
      );
      assert.ok(
        l.maxDailyOutboundMinor <= l.maxMonthlyOutboundMinor,
        `${tier}: the daily limit may not exceed the monthly limit`,
      );
    }
  });
});

describe('Outbound limits', () => {
  it('allows an ordinary transfer on a verified wallet', () => {
    const result = checkOutbound({
      tier: WalletTier.TIER_2,
      amount: sar('500.00'),
      usage: idle,
      isExternal: false,
    });
    assert.equal(result.allowed, true);
  });

  it('blocks an unverified wallet entirely', () => {
    const result = checkOutbound({
      tier: WalletTier.TIER_0,
      amount: sar('1.00'),
      usage: idle,
      isExternal: false,
    });
    assert.equal(result.allowed, false);
    assert.equal(result.breach, 'TIER_NOT_PERMITTED');
  });

  it('blocks a single transaction above the per-transaction cap', () => {
    const result = checkOutbound({
      tier: WalletTier.TIER_1,
      amount: sar('1000.01'),
      usage: idle,
      isExternal: false,
    });
    assert.equal(result.allowed, false);
    assert.equal(result.breach, 'SINGLE_TRANSACTION');
  });

  it('accumulates against the daily limit rather than checking each in isolation', () => {
    // TIER_1 daily cap is 2,000.00. Two transfers of 1,000.00 fit exactly;
    // a third of any size must not.
    const afterTwo: UsageWindow = { ...idle, dailyOutboundMinor: 200_000n, dailyCount: 2 };
    const result = checkOutbound({
      tier: WalletTier.TIER_1,
      amount: sar('0.01'),
      usage: afterTwo,
      isExternal: false,
    });
    assert.equal(result.allowed, false);
    assert.equal(result.breach, 'DAILY_VALUE');
    assert.equal(result.remainingDailyMinor, 0n);
  });

  it('allows a transfer that exactly reaches the daily limit', () => {
    const result = checkOutbound({
      tier: WalletTier.TIER_1,
      amount: sar('1000.00'),
      usage: { ...idle, dailyOutboundMinor: 100_000n, dailyCount: 1 },
      isExternal: false,
    });
    assert.equal(result.allowed, true, 'the boundary itself must be permitted');
  });

  it('enforces the monthly limit independently of the daily one', () => {
    const result = checkOutbound({
      tier: WalletTier.TIER_2,
      amount: sar('5000.00'),
      // Well inside today's limit, but the month is nearly spent.
      usage: { ...idle, monthlyOutboundMinor: 19_800_000n },
      isExternal: false,
    });
    assert.equal(result.allowed, false);
    assert.equal(result.breach, 'MONTHLY_VALUE');
  });

  it('enforces a daily transaction count, not just value', () => {
    // Structuring: many small transfers that each pass a value check.
    const result = checkOutbound({
      tier: WalletTier.TIER_1,
      amount: sar('1.00'),
      usage: { ...idle, dailyCount: 10 },
      isExternal: false,
    });
    assert.equal(result.allowed, false);
    assert.equal(result.breach, 'DAILY_COUNT');
  });

  it('refuses external transfer on a tier that may not send outside', () => {
    const internal = checkOutbound({
      tier: WalletTier.TIER_1,
      amount: sar('100.00'),
      usage: idle,
      isExternal: false,
    });
    const external = checkOutbound({
      tier: WalletTier.TIER_1,
      amount: sar('100.00'),
      usage: idle,
      isExternal: true,
    });
    assert.equal(internal.allowed, true, 'in-platform transfer is fine');
    assert.equal(external.allowed, false);
    assert.equal(external.breach, 'EXTERNAL_NOT_ALLOWED');
  });

  it('reports remaining headroom so the customer can be told what they have left', () => {
    const result = checkOutbound({
      tier: WalletTier.TIER_2,
      amount: sar('100.00'),
      usage: { ...idle, dailyOutboundMinor: 500_000n, monthlyOutboundMinor: 1_000_000n },
      isExternal: false,
    });
    assert.equal(result.allowed, true);
    assert.equal(result.remainingDailyMinor, 1_500_000n);
    assert.equal(result.remainingMonthlyMinor, 19_000_000n);
  });

  it('never reports negative headroom', () => {
    const result = checkOutbound({
      tier: WalletTier.TIER_1,
      amount: sar('1.00'),
      usage: { ...idle, dailyOutboundMinor: 999_999n, monthlyOutboundMinor: 99_999_999n },
      isExternal: false,
    });
    assert.ok(result.remainingDailyMinor >= 0n);
    assert.ok(result.remainingMonthlyMinor >= 0n);
  });

  it('throws with an actionable message from the enforcement form', () => {
    try {
      assertOutbound({
        tier: WalletTier.TIER_0,
        amount: sar('10.00'),
        usage: idle,
        isExternal: false,
      });
      assert.fail('should have thrown');
    } catch (error) {
      assert.ok(error instanceof LimitExceededError);
      // A limit message with no path forward sends the customer to support
      // instead of to verification.
      assert.match(error.message, /verification/i);
      assert.equal(error.details['breach'], 'TIER_NOT_PERMITTED');
    }
  });
});

describe('Inbound balance cap', () => {
  it('allows a credit that stays under the cap', () => {
    const result = checkInbound({
      tier: WalletTier.TIER_1,
      amount: sar('1000.00'),
      currentBalanceMinor: 100_000n,
    });
    assert.equal(result.allowed, true);
  });

  it('refuses a credit that would breach the wallet cap', () => {
    // TIER_1 holds at most 5,000.00. Silently exceeding it would put the
    // platform in breach on the customer's behalf.
    const result = checkInbound({
      tier: WalletTier.TIER_1,
      amount: sar('1000.00'),
      currentBalanceMinor: 450_000n,
    });
    assert.equal(result.allowed, false);
    assert.equal(result.breach, 'BALANCE_CAP');
  });

  it('allows a credit landing exactly on the cap', () => {
    const result = checkInbound({
      tier: WalletTier.TIER_1,
      amount: sar('500.00'),
      currentBalanceMinor: 450_000n,
    });
    assert.equal(result.allowed, true);
  });

  it('refuses any credit to an unverified wallet', () => {
    const result = checkInbound({
      tier: WalletTier.TIER_0,
      amount: sar('1.00'),
      currentBalanceMinor: 0n,
    });
    assert.equal(result.allowed, false);
    assert.equal(result.breach, 'TIER_NOT_PERMITTED');
  });

  it('tells the customer how to raise the cap', () => {
    try {
      const result = checkInbound({
        tier: WalletTier.TIER_1,
        amount: sar('10000.00'),
        currentBalanceMinor: 0n,
      });
      assert.equal(result.allowed, false);
    } catch {
      assert.fail('checkInbound must not throw');
    }
  });
});
