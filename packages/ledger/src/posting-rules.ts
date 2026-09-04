/**
 * Posting rules — the accounting definition of each product operation.
 *
 * Every rule lives here rather than inside a service, so "what does a top-up do
 * to the books" has exactly one answer that finance can review in one file.
 * Each returns a `BalancedJournal`, so an unbalanced rule cannot compile past
 * its own build() call.
 */

import type { CurrencyCode, Money } from '@nabd/shared';
import { ValidationError } from '@nabd/shared';

import { SystemAccounts } from './chart-of-accounts.js';
import { BalancedJournal, JournalBuilder } from './journal.js';

export interface RuleContext {
  readonly reference: string;
  readonly idempotencyKey: string;
  readonly currency: CurrencyCode;
  readonly transactionId?: string;
  readonly createdBy?: string;
  readonly metadata?: Record<string, unknown>;
}

function builder(ctx: RuleContext, description: string): JournalBuilder {
  return new JournalBuilder({
    reference: ctx.reference,
    idempotencyKey: ctx.idempotencyKey,
    currency: ctx.currency,
    description,
    ...(ctx.transactionId === undefined ? {} : { transactionId: ctx.transactionId }),
    ...(ctx.createdBy === undefined ? {} : { createdBy: ctx.createdBy }),
    ...(ctx.metadata === undefined ? {} : { metadata: ctx.metadata }),
  });
}

/**
 * Customer → customer transfer inside NABD.
 *
 *   DEBIT   sender liability     (we owe the sender less)
 *   CREDIT  receiver liability   (we owe the receiver more)
 *
 * Platform net liability is unchanged, which is correct: no money entered or
 * left the platform, it moved between two customers.
 */
export function internalTransfer(
  ctx: RuleContext,
  params: {
    senderLedgerAccountId: string;
    receiverLedgerAccountId: string;
    amount: Money;
    /** Fee charged to the sender, on top of the transfer amount. */
    fee?: Money;
    description?: string;
  },
): BalancedJournal {
  if (params.senderLedgerAccountId === params.receiverLedgerAccountId) {
    throw new ValidationError('Cannot transfer to the same ledger account', {
      ledgerAccountId: params.senderLedgerAccountId,
    });
  }

  const b = builder(ctx, params.description ?? 'Internal transfer');
  b.debit(params.senderLedgerAccountId, params.amount, 'Transfer out');
  b.credit(params.receiverLedgerAccountId, params.amount, 'Transfer in');

  if (params.fee !== undefined && params.fee.isPositive) {
    b.debit(params.senderLedgerAccountId, params.fee, 'Transfer fee');
    b.credit(SystemAccounts.fees(ctx.currency), params.fee, 'Transfer fee income');
  }
  return b.build();
}

/**
 * Funding: money arrives from outside and lands in a customer account.
 *
 *   DEBIT   settlement asset     (we now hold more at the partner)
 *   CREDIT  customer liability   (we owe the customer more)
 *
 * Post this only on confirmed receipt from the provider, never on intent.
 */
export function topUp(
  ctx: RuleContext,
  params: {
    customerLedgerAccountId: string;
    amount: Money;
    fee?: Money;
    description?: string;
  },
): BalancedJournal {
  const b = builder(ctx, params.description ?? 'Account top-up');
  b.debit(SystemAccounts.settlement(ctx.currency), params.amount, 'Funds received');
  b.credit(params.customerLedgerAccountId, params.amount, 'Top-up');

  if (params.fee !== undefined && params.fee.isPositive) {
    b.debit(params.customerLedgerAccountId, params.fee, 'Top-up fee');
    b.credit(SystemAccounts.fees(ctx.currency), params.fee, 'Top-up fee income');
  }
  return b.build();
}

/**
 * Money leaves the platform to an external destination.
 *
 *   DEBIT   customer liability   (we owe the customer less)
 *   CREDIT  settlement asset     (we hold less at the partner)
 *
 * Post only once the provider confirms. Until then the amount sits under a hold.
 */
export function externalPayout(
  ctx: RuleContext,
  params: {
    customerLedgerAccountId: string;
    amount: Money;
    fee?: Money;
    description?: string;
  },
): BalancedJournal {
  const b = builder(ctx, params.description ?? 'Outbound payment');
  b.debit(params.customerLedgerAccountId, params.amount, 'Payment out');
  b.credit(SystemAccounts.settlement(ctx.currency), params.amount, 'Funds sent');

  if (params.fee !== undefined && params.fee.isPositive) {
    b.debit(params.customerLedgerAccountId, params.fee, 'Payment fee');
    b.credit(SystemAccounts.fees(ctx.currency), params.fee, 'Payment fee income');
  }
  return b.build();
}

/** A standalone fee with no accompanying movement. */
export function chargeFee(
  ctx: RuleContext,
  params: { customerLedgerAccountId: string; amount: Money; description?: string },
): BalancedJournal {
  return builder(ctx, params.description ?? 'Fee')
    .debit(params.customerLedgerAccountId, params.amount, 'Fee charged')
    .credit(SystemAccounts.fees(ctx.currency), params.amount, 'Fee income')
    .build();
}

/**
 * Card settlement: the issuer has cleared a card purchase.
 *
 *   DEBIT   customer liability
 *   CREDIT  payable to the card scheme, pending settlement
 */
export function cardSettlement(
  ctx: RuleContext,
  params: { customerLedgerAccountId: string; amount: Money; merchant?: string },
): BalancedJournal {
  return builder(
    ctx,
    params.merchant === undefined ? 'Card purchase' : `Card purchase — ${params.merchant}`,
  )
    .debit(params.customerLedgerAccountId, params.amount, 'Card purchase')
    .credit(SystemAccounts.payable(ctx.currency), params.amount, 'Owed to scheme')
    .build();
}

/**
 * Funds arrived but we cannot yet attribute them to a customer.
 *
 *   DEBIT   settlement asset
 *   CREDIT  suspense
 *
 * Suspense must be cleared by operations; a suspense balance that ages is an
 * operational alarm, not a resting place for money.
 */
export function receiveToSuspense(
  ctx: RuleContext,
  params: { amount: Money; description?: string },
): BalancedJournal {
  return builder(ctx, params.description ?? 'Unattributed receipt')
    .debit(SystemAccounts.settlement(ctx.currency), params.amount, 'Funds received')
    .credit(SystemAccounts.suspense(ctx.currency), params.amount, 'Pending attribution')
    .build();
}

/** Clear suspense once the beneficiary is identified. */
export function clearSuspense(
  ctx: RuleContext,
  params: { customerLedgerAccountId: string; amount: Money },
): BalancedJournal {
  return builder(ctx, 'Suspense cleared to customer')
    .debit(SystemAccounts.suspense(ctx.currency), params.amount, 'Attributed')
    .credit(params.customerLedgerAccountId, params.amount, 'Funds credited')
    .build();
}

/**
 * The platform absorbs a loss — fraud, an unrecoverable chargeback.
 * Making customers whole is an expense, and it must show up as one.
 */
export function writeOff(
  ctx: RuleContext,
  params: { customerLedgerAccountId: string; amount: Money; reason: string },
): BalancedJournal {
  return builder(ctx, `Write-off: ${params.reason}`)
    .debit(SystemAccounts.writeoff(ctx.currency), params.amount, params.reason)
    .credit(params.customerLedgerAccountId, params.amount, 'Customer made whole')
    .build();
}

/**
 * Manual correction by finance. Deliberately requires a reason and an operator
 * id — an adjustment with no named author is an audit finding.
 */
export function manualAdjustment(
  ctx: RuleContext,
  params: {
    debitLedgerAccountId: string;
    creditLedgerAccountId: string;
    amount: Money;
    reason: string;
  },
): BalancedJournal {
  if (ctx.createdBy === undefined || ctx.createdBy.trim() === '') {
    throw new ValidationError('Manual adjustments require an operator id');
  }
  if (params.reason.trim() === '') {
    throw new ValidationError('Manual adjustments require a reason');
  }
  return builder(ctx, `Adjustment: ${params.reason}`)
    .debit(params.debitLedgerAccountId, params.amount, params.reason)
    .credit(params.creditLedgerAccountId, params.amount, params.reason)
    .build();
}
