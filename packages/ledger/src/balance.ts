/**
 * Balance derivation.
 *
 * A balance is never stored as an authoritative number. It is computed from the
 * posted debit and credit totals, which are themselves sums over immutable
 * ledger entries. `ledger_account_balances` caches these two totals, and the
 * reconciliation job re-derives them from `ledger_entries` and alarms on drift.
 */

import { type CurrencyCode, type Direction, Money } from '@nabd/shared';

export interface BalanceSnapshot {
  readonly ledgerAccountId: string;
  readonly currency: CurrencyCode;
  /** Which side increases this account. */
  readonly normalBalance: Direction;
  readonly postedDebitMinor: bigint;
  readonly postedCreditMinor: bigint;
  /** Sum of ACTIVE holds — reserved but not yet posted. */
  readonly holdMinor: bigint;
  /** Optimistic-concurrency guard on the cache row. */
  readonly version: bigint;
}

/**
 * The posted balance: what the ledger says this account is worth right now.
 * Signed so that a debit-normal account grows on debits and a credit-normal
 * account grows on credits.
 */
export function ledgerBalance(snapshot: BalanceSnapshot): Money {
  const signed =
    snapshot.normalBalance === 'DEBIT'
      ? snapshot.postedDebitMinor - snapshot.postedCreditMinor
      : snapshot.postedCreditMinor - snapshot.postedDebitMinor;
  return Money.fromMinor(signed, snapshot.currency);
}

/**
 * What the customer can actually spend: the posted balance minus anything
 * reserved by an active hold. Authorised-but-unsettled card spend and in-flight
 * outbound payments live here, which is what stops the same riyal being spent
 * twice while a payment is still with the provider.
 */
export function availableBalance(snapshot: BalanceSnapshot): Money {
  return ledgerBalance(snapshot).subtract(
    Money.fromMinor(snapshot.holdMinor, snapshot.currency),
  );
}

/** Would this posting leave the account able to cover it? */
export function canCover(snapshot: BalanceSnapshot, amount: Money): boolean {
  return availableBalance(snapshot).greaterThanOrEqual(amount);
}

/**
 * Apply a journal's net effect to a cached snapshot. Used both by the engine
 * (to write the new cache row) and by tests (to assert the cache matches a
 * from-scratch re-derivation).
 */
export function applyNetToSnapshot(
  snapshot: BalanceSnapshot,
  netDebitMinor: bigint,
): BalanceSnapshot {
  return {
    ...snapshot,
    postedDebitMinor: snapshot.postedDebitMinor + (netDebitMinor > 0n ? netDebitMinor : 0n),
    postedCreditMinor:
      snapshot.postedCreditMinor + (netDebitMinor < 0n ? -netDebitMinor : 0n),
    version: snapshot.version + 1n,
  };
}

export interface EntryLike {
  readonly ledgerAccountId: string;
  readonly direction: Direction;
  readonly amountMinor: bigint;
}

/**
 * Re-derive totals from raw entries. This is the reconciliation path: it never
 * reads the cache, so it can prove the cache correct (or catch it wrong).
 */
export function deriveTotals(
  entries: readonly EntryLike[],
  ledgerAccountId: string,
): { postedDebitMinor: bigint; postedCreditMinor: bigint } {
  let debit = 0n;
  let credit = 0n;
  for (const entry of entries) {
    if (entry.ledgerAccountId !== ledgerAccountId) continue;
    if (entry.direction === 'DEBIT') debit += entry.amountMinor;
    else credit += entry.amountMinor;
  }
  return { postedDebitMinor: debit, postedCreditMinor: credit };
}

/**
 * The system-wide accounting identity. Across every account in a currency, the
 * sum of debits must equal the sum of credits — if it does not, a journal was
 * written that did not balance, and the books are broken.
 */
export function assertTrialBalance(entries: readonly EntryLike[]): {
  balanced: boolean;
  totalDebitMinor: bigint;
  totalCreditMinor: bigint;
} {
  let debit = 0n;
  let credit = 0n;
  for (const entry of entries) {
    if (entry.direction === 'DEBIT') debit += entry.amountMinor;
    else credit += entry.amountMinor;
  }
  return {
    balanced: debit === credit,
    totalDebitMinor: debit,
    totalCreditMinor: credit,
  };
}
