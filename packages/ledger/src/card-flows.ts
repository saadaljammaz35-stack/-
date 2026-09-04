/**
 * Card authorisation and settlement.
 *
 * The decision that shapes this file: **a card has no balance of its own.** It
 * spends directly from the wallet it is linked to. Giving a card its own float
 * would mean two liabilities to reconcile, and would produce the single most
 * common support ticket in prepaid products — "my money is stuck on the card".
 *
 * A card purchase is therefore two events separated by hours or days, and the
 * hold mechanism is what bridges them:
 *
 *   AUTHORISATION   place a hold. Available balance drops; nothing is posted,
 *                   because no money has actually moved yet.
 *   SETTLEMENT      capture the hold and post. This is when the ledger moves.
 *
 * Everything below exists because the settlement amount is frequently NOT the
 * authorised amount — a tip is added to a restaurant bill, a fuel pump
 * pre-authorises a round number, an airline charges in another currency. A card
 * system that assumes the two are equal will either lose money or freeze a
 * customer's funds.
 */

import {
  type Clock,
  type CurrencyCode,
  InvalidStateTransitionError,
  Money,
  NotFoundError,
  systemClock,
  ValidationError,
} from '@nabd/shared';

import type { LedgerEngine } from './engine.js';
import { JournalBuilder } from './journal.js';
import { SystemAccounts } from './chart-of-accounts.js';

// ── settlement resolution ───────────────────────────────────────────────────

export type SettlementOutcome =
  /** Settled for exactly the authorised amount. */
  | 'EXACT'
  /** Settled for less; the unused portion of the hold is released. */
  | 'UNDER'
  /** Settled for more, within the accepted tolerance (tips, fuel). */
  | 'OVER_WITHIN_TOLERANCE'
  /** Settled for materially more than authorised. */
  | 'OVER_EXCEEDS_TOLERANCE';

export interface SettlementResolution {
  readonly outcome: SettlementOutcome;
  /** What will actually be posted. */
  readonly amountToPost: Money;
  /** Hold amount that is released without being posted. */
  readonly releasedMinor: bigint;
  /** Amount above the hold that must come from the remaining balance. */
  readonly excessMinor: bigint;
  /** True when the discrepancy should be surfaced to operations. */
  readonly requiresReview: boolean;
}

/**
 * Default over-settlement tolerance: 20%.
 *
 * Restaurants and fuel pumps routinely settle above the authorised amount, and
 * the card schemes require the issuer to honour it. Rejecting those would
 * decline legitimate purchases; accepting an unbounded excess would let a
 * merchant settle any amount it liked against a small authorisation. A bounded
 * tolerance is the compromise the industry actually runs on.
 */
export const DEFAULT_OVER_SETTLEMENT_TOLERANCE_PERCENT = 20n;

export function resolveSettlement(params: {
  authorisedAmount: Money;
  settlementAmount: Money;
  tolerancePercent?: bigint;
}): SettlementResolution {
  const authorised = params.authorisedAmount;
  const settlement = params.settlementAmount;

  if (authorised.currency !== settlement.currency) {
    throw new ValidationError('Settlement currency does not match the authorisation', {
      authorised: authorised.currency,
      settlement: settlement.currency,
    });
  }
  if (!settlement.isPositive) {
    throw new ValidationError('Settlement amount must be greater than zero');
  }

  const tolerance = params.tolerancePercent ?? DEFAULT_OVER_SETTLEMENT_TOLERANCE_PERCENT;
  const maxAcceptable = authorised.minor + (authorised.minor * tolerance) / 100n;

  if (settlement.minor === authorised.minor) {
    return {
      outcome: 'EXACT',
      amountToPost: settlement,
      releasedMinor: 0n,
      excessMinor: 0n,
      requiresReview: false,
    };
  }

  if (settlement.minor < authorised.minor) {
    // Under-settlement: post what was actually spent, release the rest. The
    // customer must not stay short of the difference.
    return {
      outcome: 'UNDER',
      amountToPost: settlement,
      releasedMinor: authorised.minor - settlement.minor,
      excessMinor: 0n,
      requiresReview: false,
    };
  }

  const excess = settlement.minor - authorised.minor;
  return settlement.minor <= maxAcceptable
    ? {
        outcome: 'OVER_WITHIN_TOLERANCE',
        amountToPost: settlement,
        releasedMinor: 0n,
        excessMinor: excess,
        requiresReview: false,
      }
    : {
        // Still posted — scheme rules oblige the issuer to honour it — but
        // flagged, because a merchant systematically settling far above its
        // authorisations is either broken or defrauding.
        outcome: 'OVER_EXCEEDS_TOLERANCE',
        amountToPost: settlement,
        releasedMinor: 0n,
        excessMinor: excess,
        requiresReview: true,
      };
}

// ── authorisation lifecycle ─────────────────────────────────────────────────

export interface AuthorisationRequest {
  /** The wallet's ledger account. The card spends from this, not from a float. */
  readonly walletLedgerAccountId: string;
  readonly amount: Money;
  /** The issuer's authorisation id. Also the idempotency key for the hold. */
  readonly providerAuthorisationId: string;
  readonly cardId: string;
  readonly merchantName: string;
  readonly expiresAt: Date;
}

export type AuthorisationResult =
  | { readonly approved: true; readonly holdId: string; readonly replayed: boolean }
  | {
      readonly approved: false;
      readonly declineCode: 'INSUFFICIENT_FUNDS' | 'CARD_NOT_ACTIVE' | 'LIMIT_EXCEEDED';
      readonly declineMessage: string;
    };

export interface SettlementRequest {
  readonly holdId: string;
  readonly authorisedAmount: Money;
  readonly settlementAmount: Money;
  readonly providerSettlementId: string;
  readonly walletLedgerAccountId: string;
  readonly merchantName: string;
  readonly transactionId?: string;
  readonly tolerancePercent?: bigint;
}

export interface SettlementResult {
  readonly journalId: string;
  readonly resolution: SettlementResolution;
  readonly replayed: boolean;
}

/**
 * Drives the card lifecycle against the ledger engine.
 *
 * It holds no state of its own: the hold row and the journal are the state, and
 * both live in the database inside the engine's transactions.
 */
export class CardFlowService {
  constructor(
    private readonly ledger: LedgerEngine,
    private readonly clock: Clock = systemClock,
  ) {}

  /**
   * Authorise a purchase — place a hold, post nothing.
   *
   * A decline is an ordinary outcome, not an exception. Card authorisations are
   * declined constantly and for mundane reasons; modelling that as a thrown
   * error would push routine control flow through a catch block and make it far
   * too easy to treat "declined" and "our system broke" the same way.
   */
  async authorise(request: AuthorisationRequest): Promise<AuthorisationResult> {
    if (!request.amount.isPositive) {
      throw new ValidationError('Authorisation amount must be greater than zero');
    }

    try {
      const hold = await this.ledger.placeHold({
        ledgerAccountId: request.walletLedgerAccountId,
        amount: request.amount,
        reference: `CARD-AUTH-${request.providerAuthorisationId}`,
        // The issuer's id is the idempotency key, so a redelivered
        // authorisation cannot reserve the customer's funds twice.
        idempotencyKey: `card-auth:${request.providerAuthorisationId}`,
        expiresAt: request.expiresAt,
      });
      return { approved: true, holdId: hold.holdId, replayed: hold.replayed };
    } catch (error) {
      if (error instanceof Error && error.name === 'InsufficientFundsError') {
        return {
          approved: false,
          declineCode: 'INSUFFICIENT_FUNDS',
          declineMessage: 'Insufficient funds',
        };
      }
      throw error;
    }
  }

  /**
   * Settle an authorisation: convert the hold into a real posting.
   *
   *   DEBIT   the customer's wallet   (we owe them less)
   *   CREDIT  payable to the scheme   (we owe the scheme until settlement)
   *
   * Releasing the hold and posting happen in one engine transaction, so there
   * is no instant in which the funds are neither held nor posted — which is the
   * window a customer could otherwise spend them a second time.
   */
  async settle(request: SettlementRequest): Promise<SettlementResult> {
    const resolution = resolveSettlement({
      authorisedAmount: request.authorisedAmount,
      settlementAmount: request.settlementAmount,
      ...(request.tolerancePercent === undefined
        ? {}
        : { tolerancePercent: request.tolerancePercent }),
    });

    const currency = request.settlementAmount.currency;
    const journal = new JournalBuilder({
      reference: `CARD-STL-${request.providerSettlementId}`,
      // Keyed on the settlement id, so a redelivered settlement posts once.
      idempotencyKey: `card-settle:${request.providerSettlementId}`,
      currency,
      description: `Card purchase — ${request.merchantName}`,
      ...(request.transactionId === undefined
        ? {}
        : { transactionId: request.transactionId }),
      metadata: {
        merchant: request.merchantName,
        outcome: resolution.outcome,
        authorisedMinor: request.authorisedAmount.minor.toString(),
        settledMinor: request.settlementAmount.minor.toString(),
        requiresReview: resolution.requiresReview,
      },
    })
      .debit(request.walletLedgerAccountId, resolution.amountToPost, 'Card purchase')
      .credit(SystemAccounts.payable(currency), resolution.amountToPost, 'Owed to scheme')
      .build();

    const posted = await this.ledger.captureHold(request.holdId, journal);

    return {
      journalId: posted.journalId,
      resolution,
      replayed: posted.replayed,
    };
  }

  /**
   * The merchant reversed the authorisation before settling. Release the hold;
   * nothing was ever posted, so nothing needs reversing.
   */
  async reverseAuthorisation(holdId: string): Promise<void> {
    await this.ledger.releaseHold(holdId, 'RELEASED');
  }

  /**
   * Expire a stale authorisation.
   *
   * Run on a schedule. Without it, an authorisation the merchant simply never
   * settles would reserve the customer's money indefinitely — their balance
   * would show funds they cannot spend, with no explanation and no end date.
   */
  async expireAuthorisation(holdId: string): Promise<void> {
    await this.ledger.releaseHold(holdId, 'EXPIRED');
  }

  /**
   * Refund a settled card purchase.
   *
   * A refund is a *new* posting in the opposite direction, not a reversal of
   * the original. The purchase genuinely happened and stays on the statement;
   * a customer who sees a purchase vanish rather than be refunded has no way to
   * reconcile their own records.
   */
  async refund(params: {
    walletLedgerAccountId: string;
    amount: Money;
    providerRefundId: string;
    merchantName: string;
    originalReference: string;
    transactionId?: string;
  }): Promise<{ journalId: string; replayed: boolean }> {
    const currency = params.amount.currency;
    const journal = new JournalBuilder({
      reference: `CARD-RFND-${params.providerRefundId}`,
      idempotencyKey: `card-refund:${params.providerRefundId}`,
      currency,
      description: `Refund — ${params.merchantName}`,
      ...(params.transactionId === undefined
        ? {}
        : { transactionId: params.transactionId }),
      metadata: {
        merchant: params.merchantName,
        refundOf: params.originalReference,
      },
    })
      .debit(SystemAccounts.payable(currency), params.amount, 'Refund from scheme')
      .credit(params.walletLedgerAccountId, params.amount, 'Refund received')
      .build();

    const posted = await this.ledger.post(journal);
    return { journalId: posted.journalId, replayed: posted.replayed };
  }

  /**
   * A forced posting with no prior authorisation.
   *
   * Real and unavoidable: offline terminals (in-flight, transit gates) and
   * scheme-mandated chargebacks arrive with no hold to capture. It posts
   * directly, which means it can drive a wallet negative — so the wallet
   * account must permit it, and operations must see it. The alternative,
   * refusing the posting, is not available: the scheme has already paid the
   * merchant.
   */
  async forcePost(params: {
    walletLedgerAccountId: string;
    amount: Money;
    providerSettlementId: string;
    merchantName: string;
    reason: string;
  }): Promise<{ journalId: string; replayed: boolean }> {
    const currency = params.amount.currency;
    const journal = new JournalBuilder({
      reference: `CARD-FORCE-${params.providerSettlementId}`,
      idempotencyKey: `card-force:${params.providerSettlementId}`,
      currency,
      description: `Offline card purchase — ${params.merchantName}`,
      metadata: {
        merchant: params.merchantName,
        reason: params.reason,
        forced: true,
        requiresReview: true,
      },
    })
      .debit(params.walletLedgerAccountId, params.amount, 'Offline card purchase')
      .credit(SystemAccounts.payable(currency), params.amount, 'Owed to scheme')
      .build();

    const posted = await this.ledger.post(journal);
    return { journalId: posted.journalId, replayed: posted.replayed };
  }
}

// ── funding the wallet ──────────────────────────────────────────────────────

export type TopUpSource = 'CARD' | 'BANK_TRANSFER' | 'APPLE_PAY' | 'AGENT_CASH';

export interface TopUpConfirmation {
  readonly walletLedgerAccountId: string;
  readonly amount: Money;
  readonly source: TopUpSource;
  /** The provider's event id. The idempotency key for the posting. */
  readonly providerPaymentId: string;
  readonly transactionId?: string;
  readonly fee?: Money;
}

/**
 * Funding a wallet.
 *
 * The single rule: **post only on confirmed receipt, never on intent.**
 *
 * A top-up is a customer promising money from an outside system. Crediting the
 * wallet when they tap "add money" — before the provider confirms — credits
 * money that may never arrive, and the customer can spend it in the meantime.
 * That is not a race condition, it is free money, and it is the most common way
 * a young wallet loses real funds.
 *
 * There is deliberately no `initiate` method that touches the ledger. The
 * intent is recorded as a transaction row in a non-terminal state; only
 * `confirm` posts.
 */
export class TopUpService {
  constructor(private readonly ledger: LedgerEngine) {}

  async confirm(confirmation: TopUpConfirmation): Promise<{
    journalId: string;
    replayed: boolean;
  }> {
    if (!confirmation.amount.isPositive) {
      throw new ValidationError('Top-up amount must be greater than zero');
    }

    const currency = confirmation.amount.currency;
    const builder = new JournalBuilder({
      reference: `TOPUP-${confirmation.providerPaymentId}`,
      // The provider's payment id. A redelivered webhook credits once.
      idempotencyKey: `topup:${confirmation.providerPaymentId}`,
      currency,
      description: `Wallet top-up — ${confirmation.source}`,
      ...(confirmation.transactionId === undefined
        ? {}
        : { transactionId: confirmation.transactionId }),
      metadata: { source: confirmation.source },
    });

    // Funds arrived at the partner (asset up), and we now owe the customer
    // more (liability up).
    builder.debit(
      SystemAccounts.settlement(currency),
      confirmation.amount,
      'Funds received',
    );
    builder.credit(confirmation.walletLedgerAccountId, confirmation.amount, 'Top-up');

    if (confirmation.fee !== undefined && confirmation.fee.isPositive) {
      builder.debit(confirmation.walletLedgerAccountId, confirmation.fee, 'Top-up fee');
      builder.credit(SystemAccounts.fees(currency), confirmation.fee, 'Top-up fee income');
    }

    const posted = await this.ledger.post(builder.build());
    return { journalId: posted.journalId, replayed: posted.replayed };
  }

  /**
   * The provider reported the funding failed or was charged back after we
   * already credited the wallet.
   *
   * This must be a reversal of the original journal, not a fresh debit: the
   * credit should never have existed, and the audit trail must show that.
   */
  async reverseFailedTopUp(params: {
    journalId: string;
    providerEventId: string;
    reason: string;
    operatorId: string;
  }): Promise<{ journalId: string }> {
    const posted = await this.ledger.reverse({
      journalId: params.journalId,
      reference: `TOPUP-REV-${params.providerEventId}`,
      idempotencyKey: `topup-reverse:${params.providerEventId}`,
      reason: params.reason,
      createdBy: params.operatorId,
    });
    return { journalId: posted.journalId };
  }
}

/** Whether an authorisation has outlived its window and should be released. */
export function isAuthorisationExpired(expiresAt: Date | null, now: Date): boolean {
  return expiresAt !== null && expiresAt.getTime() <= now.getTime();
}

/** Guard used by the state machine when a settlement arrives out of order. */
export function assertSettleable(holdStatus: string): void {
  if (holdStatus !== 'ACTIVE') {
    throw new InvalidStateTransitionError('CardAuthorisation', holdStatus, 'SETTLED');
  }
}

export function assertHoldExists(hold: unknown, holdId: string): void {
  if (hold === null || hold === undefined) {
    throw new NotFoundError('Card authorisation', holdId);
  }
}

export type { CurrencyCode, Money };
