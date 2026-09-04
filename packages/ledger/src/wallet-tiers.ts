/**
 * Wallet tiers and limits.
 *
 * An electronic money institution does not give every customer the same wallet.
 * Limits are tiered by how strongly the customer's identity has been verified:
 * a lightly-verified wallet gets a small balance cap and small monthly
 * throughput, and higher tiers unlock more. This is the standard control that
 * keeps a low-friction onboarding flow from becoming a money-laundering
 * channel.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * THE NUMBERS BELOW ARE PLACEHOLDERS.
 *
 * Actual tier thresholds are set by the licence NABD operates under and by the
 * regulator's rules for the activity — they are not an engineering choice. They
 * are defined here as *configuration*, with deliberately conservative defaults,
 * so that the enforcement logic can be built and tested now and the real values
 * dropped in when the licence is issued. Do not cite these figures as though
 * they were a regulatory requirement.
 * ───────────────────────────────────────────────────────────────────────────
 */

import { type CurrencyCode, KycStatus, LimitExceededError, Money } from '@nabd/shared';

export const WalletTier = {
  /** Registered, identity not yet verified. Cannot hold or move value. */
  TIER_0: 'TIER_0',
  /** Basic identity verification. Small wallet, small throughput. */
  TIER_1: 'TIER_1',
  /** Full verification. The standard consumer wallet. */
  TIER_2: 'TIER_2',
  /** Enhanced due diligence. High-value and business use. */
  TIER_3: 'TIER_3',
} as const;
export type WalletTier = (typeof WalletTier)[keyof typeof WalletTier];

export interface TierLimits {
  readonly tier: WalletTier;
  /** Maximum balance the wallet may hold at any moment. */
  readonly maxBalanceMinor: bigint;
  /** Maximum value of a single transaction. */
  readonly maxSingleTransactionMinor: bigint;
  /** Maximum outbound value in a rolling 24 hours. */
  readonly maxDailyOutboundMinor: bigint;
  /** Maximum outbound value in a rolling 30 days. */
  readonly maxMonthlyOutboundMinor: bigint;
  /** Maximum number of outbound transactions per day. */
  readonly maxDailyTransactionCount: number;
  /** Whether the tier may send money outside the platform at all. */
  readonly allowsExternalTransfer: boolean;
  readonly allowsCardIssuance: boolean;
}

/** Placeholder defaults in SAR minor units (halalas). See the notice above. */
export const DEFAULT_TIER_LIMITS: Readonly<Record<WalletTier, TierLimits>> = {
  TIER_0: {
    tier: 'TIER_0',
    maxBalanceMinor: 0n,
    maxSingleTransactionMinor: 0n,
    maxDailyOutboundMinor: 0n,
    maxMonthlyOutboundMinor: 0n,
    maxDailyTransactionCount: 0,
    allowsExternalTransfer: false,
    allowsCardIssuance: false,
  },
  TIER_1: {
    tier: 'TIER_1',
    maxBalanceMinor: 500_000n, //   5,000.00 SAR
    maxSingleTransactionMinor: 100_000n, // 1,000.00 SAR
    maxDailyOutboundMinor: 200_000n, //     2,000.00 SAR
    maxMonthlyOutboundMinor: 2_000_000n, // 20,000.00 SAR
    maxDailyTransactionCount: 10,
    allowsExternalTransfer: false,
    allowsCardIssuance: false,
  },
  TIER_2: {
    tier: 'TIER_2',
    maxBalanceMinor: 2_000_000n, //          20,000.00 SAR
    maxSingleTransactionMinor: 1_000_000n, // 10,000.00 SAR
    maxDailyOutboundMinor: 2_000_000n, //     20,000.00 SAR
    maxMonthlyOutboundMinor: 20_000_000n, //  200,000.00 SAR
    maxDailyTransactionCount: 50,
    allowsExternalTransfer: true,
    allowsCardIssuance: true,
  },
  TIER_3: {
    tier: 'TIER_3',
    maxBalanceMinor: 20_000_000n, //           200,000.00 SAR
    maxSingleTransactionMinor: 5_000_000n, //   50,000.00 SAR
    maxDailyOutboundMinor: 10_000_000n, //     100,000.00 SAR
    maxMonthlyOutboundMinor: 100_000_000n, // 1,000,000.00 SAR
    maxDailyTransactionCount: 200,
    allowsExternalTransfer: true,
    allowsCardIssuance: true,
  },
};

/**
 * Map a KYC outcome to a wallet tier.
 *
 * Anything short of a completed verification lands on TIER_0, which can hold
 * nothing and move nothing. Failing closed here is the point: a wallet that is
 * usable while verification is "pending" is a wallet an attacker can use before
 * anyone has confirmed who they are.
 */
export function tierForKyc(
  kycStatus: KycStatus,
  level: 'BASIC' | 'FULL' | 'ENHANCED' = 'BASIC',
): WalletTier {
  if (kycStatus !== KycStatus.VERIFIED) return WalletTier.TIER_0;
  switch (level) {
    case 'ENHANCED':
      return WalletTier.TIER_3;
    case 'FULL':
      return WalletTier.TIER_2;
    case 'BASIC':
      return WalletTier.TIER_1;
    default:
      return WalletTier.TIER_0;
  }
}

export interface UsageWindow {
  /** Outbound value already moved in the rolling 24 hours. */
  readonly dailyOutboundMinor: bigint;
  /** Outbound value already moved in the rolling 30 days. */
  readonly monthlyOutboundMinor: bigint;
  /** Outbound transactions already made in the rolling 24 hours. */
  readonly dailyCount: number;
  /** Current posted balance. */
  readonly currentBalanceMinor: bigint;
}

export type LimitBreach =
  | 'TIER_NOT_PERMITTED'
  | 'SINGLE_TRANSACTION'
  | 'DAILY_VALUE'
  | 'MONTHLY_VALUE'
  | 'DAILY_COUNT'
  | 'BALANCE_CAP'
  | 'EXTERNAL_NOT_ALLOWED';

export interface LimitCheck {
  readonly allowed: boolean;
  readonly breach?: LimitBreach;
  /** How much more the customer could send right now. */
  readonly remainingDailyMinor: bigint;
  readonly remainingMonthlyMinor: bigint;
  readonly tier: WalletTier;
}

/**
 * Check an outbound transaction against the tier's limits.
 *
 * Returns a decision rather than throwing, because the caller often wants to
 * show the customer *why* and what their remaining headroom is. `assertOutbound`
 * is the throwing form for the enforcement path.
 */
export function checkOutbound(params: {
  tier: WalletTier;
  amount: Money;
  usage: UsageWindow;
  isExternal: boolean;
  limits?: Readonly<Record<WalletTier, TierLimits>>;
}): LimitCheck {
  const table = params.limits ?? DEFAULT_TIER_LIMITS;
  const limits = table[params.tier];
  const amount = params.amount.minor;
  const usage = params.usage;

  const remainingDaily =
    limits.maxDailyOutboundMinor - usage.dailyOutboundMinor > 0n
      ? limits.maxDailyOutboundMinor - usage.dailyOutboundMinor
      : 0n;
  const remainingMonthly =
    limits.maxMonthlyOutboundMinor - usage.monthlyOutboundMinor > 0n
      ? limits.maxMonthlyOutboundMinor - usage.monthlyOutboundMinor
      : 0n;

  const base = {
    remainingDailyMinor: remainingDaily,
    remainingMonthlyMinor: remainingMonthly,
    tier: params.tier,
  };

  // TIER_0 holds nothing and moves nothing.
  if (limits.maxSingleTransactionMinor === 0n) {
    return { ...base, allowed: false, breach: 'TIER_NOT_PERMITTED' };
  }
  if (params.isExternal && !limits.allowsExternalTransfer) {
    return { ...base, allowed: false, breach: 'EXTERNAL_NOT_ALLOWED' };
  }
  if (amount > limits.maxSingleTransactionMinor) {
    return { ...base, allowed: false, breach: 'SINGLE_TRANSACTION' };
  }
  if (usage.dailyCount + 1 > limits.maxDailyTransactionCount) {
    return { ...base, allowed: false, breach: 'DAILY_COUNT' };
  }
  if (usage.dailyOutboundMinor + amount > limits.maxDailyOutboundMinor) {
    return { ...base, allowed: false, breach: 'DAILY_VALUE' };
  }
  if (usage.monthlyOutboundMinor + amount > limits.maxMonthlyOutboundMinor) {
    return { ...base, allowed: false, breach: 'MONTHLY_VALUE' };
  }

  return { ...base, allowed: true };
}

/**
 * Check an *incoming* amount against the wallet's balance cap.
 *
 * Checked separately from outbound because a breach here has a different
 * remedy: the customer is not doing anything wrong, they simply need to upgrade
 * their verification before they can receive more. Rejecting the credit is the
 * correct behaviour — silently exceeding the cap would put the platform in
 * breach on the customer's behalf.
 */
export function checkInbound(params: {
  tier: WalletTier;
  amount: Money;
  currentBalanceMinor: bigint;
  limits?: Readonly<Record<WalletTier, TierLimits>>;
}): LimitCheck {
  const table = params.limits ?? DEFAULT_TIER_LIMITS;
  const limits = table[params.tier];

  const base = {
    remainingDailyMinor: 0n,
    remainingMonthlyMinor: 0n,
    tier: params.tier,
  };

  if (limits.maxBalanceMinor === 0n) {
    return { ...base, allowed: false, breach: 'TIER_NOT_PERMITTED' };
  }
  if (params.currentBalanceMinor + params.amount.minor > limits.maxBalanceMinor) {
    return { ...base, allowed: false, breach: 'BALANCE_CAP' };
  }
  return { ...base, allowed: true };
}

/** Enforcement form. Throws `LimitExceededError` with the breach in details. */
export function assertOutbound(params: Parameters<typeof checkOutbound>[0]): LimitCheck {
  const result = checkOutbound(params);
  if (!result.allowed) {
    throw new LimitExceededError(messageFor(result.breach as LimitBreach), {
      breach: result.breach,
      tier: result.tier,
      remainingDailyMinor: result.remainingDailyMinor.toString(),
      remainingMonthlyMinor: result.remainingMonthlyMinor.toString(),
    });
  }
  return result;
}

export function assertInbound(params: Parameters<typeof checkInbound>[0]): LimitCheck {
  const result = checkInbound(params);
  if (!result.allowed) {
    throw new LimitExceededError(messageFor(result.breach as LimitBreach), {
      breach: result.breach,
      tier: result.tier,
    });
  }
  return result;
}

/**
 * Customer-facing wording.
 *
 * Each message says what to do next. "Limit exceeded" with no path forward is
 * how a customer ends up in support instead of completing verification.
 */
function messageFor(breach: LimitBreach): string {
  switch (breach) {
    case 'TIER_NOT_PERMITTED':
      return 'Complete identity verification to activate your wallet';
    case 'EXTERNAL_NOT_ALLOWED':
      return 'Upgrade your verification to send money outside NABD';
    case 'SINGLE_TRANSACTION':
      return 'This amount is above your per-transaction limit';
    case 'DAILY_VALUE':
      return 'You have reached your daily transfer limit';
    case 'MONTHLY_VALUE':
      return 'You have reached your monthly transfer limit';
    case 'DAILY_COUNT':
      return 'You have reached your daily transaction count limit';
    case 'BALANCE_CAP':
      return 'This would put your wallet above its balance limit. Upgrade your verification to raise it.';
    default:
      return 'Limit exceeded';
  }
}

/** Currency guard — the limit table is denominated in one currency. */
export function assertLimitsCurrency(amount: Money, expected: CurrencyCode): void {
  if (amount.currency !== expected) {
    throw new LimitExceededError('Limits are not configured for this currency', {
      expected,
      received: amount.currency,
    });
  }
}
