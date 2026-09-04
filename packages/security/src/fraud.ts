/**
 * Fraud scoring.
 *
 * Deliberately a transparent, weighted rule engine rather than an opaque model.
 * At this stage of a platform, explainability matters more than accuracy: a
 * compliance officer must be able to answer "why was this blocked" from the
 * stored signals, and a customer complaint must be reviewable.
 *
 * Two things this is NOT, and the surrounding code must respect both:
 *
 *   • It is not a decision. It produces a score and a recommendation; blocking a
 *     customer's money on a single rule is a product decision that belongs in a
 *     reviewed policy, with a human queue behind it.
 *   • It is not a substitute for the real thing. A production deployment feeds
 *     these signals into a trained model plus a vendor, and keeps this as the
 *     explainable floor.
 */

import { type Money, type RiskLevel } from '@nabd/shared';

export interface FraudSignalInput {
  readonly amount: Money;
  /** Customer's typical transaction size, if known. */
  readonly averageAmountMinor?: bigint;
  readonly accountBalanceMinor: bigint;
  /** Transactions by this user in the last hour. */
  readonly velocityLastHour: number;
  /** Transactions by this user in the last 24 hours. */
  readonly velocityLast24h: number;
  /** Age of the beneficiary relationship, in hours. */
  readonly beneficiaryAgeHours: number | null;
  readonly beneficiaryIsVerified: boolean;
  readonly isNewDevice: boolean;
  readonly isNewCountry: boolean;
  readonly ipIsAnonymised: boolean;
  /** Local hour of day, 0–23. */
  readonly localHour: number;
  readonly accountAgeDays: number;
  readonly kycVerified: boolean;
  readonly priorFraudCases: number;
}

export interface FraudSignal {
  readonly code: string;
  readonly weight: number;
  readonly detail: string;
}

export interface FraudAssessment {
  readonly score: number;
  readonly level: RiskLevel;
  readonly signals: readonly FraudSignal[];
  readonly recommendation: 'ALLOW' | 'CHALLENGE' | 'REVIEW' | 'BLOCK';
}

function pct(numerator: bigint, denominator: bigint): number {
  if (denominator === 0n) return 0;
  return Number((numerator * 100n) / denominator);
}

export function assessFraudRisk(input: FraudSignalInput): FraudAssessment {
  const signals: FraudSignal[] = [];
  const add = (code: string, weight: number, detail: string): void => {
    signals.push({ code, weight, detail });
  };

  // ── amount ──
  if (input.averageAmountMinor !== undefined && input.averageAmountMinor > 0n) {
    const ratio = pct(input.amount.minor, input.averageAmountMinor);
    if (ratio >= 1000) add('AMOUNT_10X_AVERAGE', 25, `${ratio}% of the customer's average`);
    else if (ratio >= 500)
      add('AMOUNT_5X_AVERAGE', 15, `${ratio}% of the customer's average`);
  }
  if (input.accountBalanceMinor > 0n) {
    const drain = pct(input.amount.minor, input.accountBalanceMinor);
    // Emptying an account is the shape of a cash-out, not of normal spending.
    if (drain >= 95) add('ACCOUNT_DRAIN', 20, `moves ${drain}% of the balance`);
    else if (drain >= 75) add('LARGE_BALANCE_SHARE', 10, `moves ${drain}% of the balance`);
  }

  // ── velocity ──
  if (input.velocityLastHour >= 10)
    add('VELOCITY_HOUR_HIGH', 20, `${input.velocityLastHour} in the last hour`);
  else if (input.velocityLastHour >= 5)
    add('VELOCITY_HOUR', 10, `${input.velocityLastHour} in the last hour`);
  if (input.velocityLast24h >= 30)
    add('VELOCITY_DAY_HIGH', 15, `${input.velocityLast24h} in 24h`);

  // ── beneficiary ──
  if (input.beneficiaryAgeHours !== null) {
    // A brand-new payee plus a large amount is the canonical takeover cash-out.
    if (input.beneficiaryAgeHours < 1)
      add('BENEFICIARY_BRAND_NEW', 25, 'added under an hour ago');
    else if (input.beneficiaryAgeHours < 24)
      add('BENEFICIARY_NEW', 15, 'added under a day ago');
  }
  if (!input.beneficiaryIsVerified)
    add('BENEFICIARY_UNVERIFIED', 10, 'beneficiary not verified');

  // ── device, location, network ──
  if (input.isNewDevice) add('NEW_DEVICE', 15, 'first use of this device');
  if (input.isNewCountry) add('NEW_COUNTRY', 20, 'country not seen before');
  if (input.ipIsAnonymised) add('ANONYMISED_IP', 15, 'VPN, proxy or Tor exit');

  // ── time ──
  if (input.localHour >= 2 && input.localHour <= 5) {
    add(
      'UNUSUAL_HOUR',
      5,
      `initiated at ${String(input.localHour).padStart(2, '0')}:00 local`,
    );
  }

  // ── account standing ──
  if (input.accountAgeDays < 7)
    add('ACCOUNT_VERY_NEW', 15, `account is ${input.accountAgeDays}d old`);
  else if (input.accountAgeDays < 30)
    add('ACCOUNT_NEW', 5, `account is ${input.accountAgeDays}d old`);
  if (!input.kycVerified) add('KYC_NOT_VERIFIED', 20, 'KYC incomplete');
  if (input.priorFraudCases > 0) {
    add(
      'PRIOR_FRAUD',
      Math.min(30, input.priorFraudCases * 15),
      `${input.priorFraudCases} prior case(s)`,
    );
  }

  const score = Math.min(
    100,
    signals.reduce((total, s) => total + s.weight, 0),
  );
  const level: RiskLevel =
    score >= 80 ? 'CRITICAL' : score >= 60 ? 'HIGH' : score >= 30 ? 'MEDIUM' : 'LOW';

  // A recommendation, not a verdict. The caller applies policy.
  const recommendation =
    level === 'CRITICAL'
      ? 'BLOCK'
      : level === 'HIGH'
        ? 'REVIEW'
        : level === 'MEDIUM'
          ? 'CHALLENGE'
          : 'ALLOW';

  return { score, level, signals, recommendation };
}
