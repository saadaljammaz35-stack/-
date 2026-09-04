/**
 * Transaction state machine.
 *
 * Money states are not free-form strings that services assign at will. Every
 * transition is declared here, and anything not declared is rejected. This is
 * what stops a COMPLETED transaction being quietly moved back to PENDING by a
 * retried webhook, which would let it be posted a second time.
 */

import { InvalidStateTransitionError, type TransactionStatus } from '@nabd/shared';

const TRANSITIONS: Readonly<Record<TransactionStatus, readonly TransactionStatus[]>> = {
  INITIATED: ['PENDING', 'PROCESSING', 'FAILED', 'CANCELLED'],
  // PENDING covers awaiting approval, fraud review, or strong authentication.
  PENDING: ['PROCESSING', 'FAILED', 'CANCELLED'],
  PROCESSING: ['COMPLETED', 'FAILED', 'CANCELLED'],
  // A completed transaction is undone only by posting a reversal journal.
  COMPLETED: ['REVERSED'],
  FAILED: [],
  CANCELLED: [],
  REVERSED: [],
};

export const TERMINAL_STATUSES: readonly TransactionStatus[] = [
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'REVERSED',
];

/** States in which value has actually moved on the ledger. */
export const POSTED_STATUSES: readonly TransactionStatus[] = ['COMPLETED', 'REVERSED'];

export function isTerminal(status: TransactionStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/** States a reconciliation sweep must keep chasing. */
export function isInFlight(status: TransactionStatus): boolean {
  return !isTerminal(status);
}

export function allowedTransitions(from: TransactionStatus): readonly TransactionStatus[] {
  return TRANSITIONS[from];
}

export function canTransition(from: TransactionStatus, to: TransactionStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/**
 * Assert a transition is legal. Throws `InvalidStateTransitionError` otherwise —
 * a rejected transition is a bug or a replayed message, never something to
 * paper over.
 */
export function assertTransition(
  from: TransactionStatus,
  to: TransactionStatus,
  entity = 'Transaction',
): void {
  if (from === to) {
    throw new InvalidStateTransitionError(entity, from, to);
  }
  if (!canTransition(from, to)) {
    throw new InvalidStateTransitionError(entity, from, to);
  }
}

/**
 * Idempotent transition helper for message handlers: a webhook that redelivers
 * `payment.completed` after we already completed the transaction should be a
 * no-op, not an error. Returns whether the state actually changed.
 */
export function transitionOrNoop(
  from: TransactionStatus,
  to: TransactionStatus,
  entity = 'Transaction',
): { changed: boolean; status: TransactionStatus } {
  if (from === to) return { changed: false, status: from };
  assertTransition(from, to, entity);
  return { changed: true, status: to };
}

// ── Hold lifecycle ────────────────────────────────────────────────────────

const HOLD_TRANSITIONS = {
  ACTIVE: ['RELEASED', 'CAPTURED', 'EXPIRED'],
  RELEASED: [],
  CAPTURED: [],
  EXPIRED: [],
} as const satisfies Record<string, readonly string[]>;

export type HoldState = keyof typeof HOLD_TRANSITIONS;

export function canTransitionHold(from: HoldState, to: HoldState): boolean {
  return (HOLD_TRANSITIONS[from] as readonly string[]).includes(to);
}

export function assertHoldTransition(from: HoldState, to: HoldState): void {
  if (!canTransitionHold(from, to)) {
    throw new InvalidStateTransitionError('Hold', from, to);
  }
}
