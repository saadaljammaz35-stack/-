/**
 * The storage port.
 *
 * The ledger engine talks only to this interface. `apps/api` implements it over
 * Prisma/PostgreSQL; the tests implement it in memory. Because the engine never
 * imports a database client, the rules that decide where money goes are testable
 * without a database and portable if the database ever changes.
 *
 * Two obligations any implementation must honour, because the engine relies on
 * them for correctness and cannot verify them itself:
 *
 *   1. `runInTransaction` is atomic. Everything inside it commits or none of it
 *      does — journal, entries, balances, holds.
 *   2. `lockBalances` takes an exclusive row lock (`SELECT … FOR UPDATE`) on
 *      every id, and the engine always passes ids pre-sorted. Consistent lock
 *      ordering is what prevents deadlock between two concurrent transfers that
 *      touch the same pair of accounts in opposite directions.
 */

import type { CurrencyCode, Direction, HoldStatus, LedgerAccountType } from '@nabd/shared';

import type { BalanceSnapshot } from './balance.js';

export interface LedgerAccountRecord {
  readonly id: string;
  readonly code: string;
  readonly type: LedgerAccountType;
  readonly normalBalance: Direction;
  readonly currency: CurrencyCode;
  readonly isSystem: boolean;
  /** The product account this backs, for customer liability accounts. */
  readonly accountId: string | null;
  /**
   * Whether this account may hold a balance on the wrong side of its normal
   * side. Customer accounts must not (that is the double-spend guard); some
   * system accounts legitimately swing negative between settlement cycles.
   */
  readonly allowsNegativeBalance: boolean;
}

export interface JournalRecord {
  readonly id: string;
  readonly reference: string;
  readonly idempotencyKey: string;
  readonly currency: CurrencyCode;
  readonly description: string;
  readonly transactionId: string | null;
  readonly reversalOfJournalId: string | null;
  readonly createdBy: string | null;
  readonly metadata: Record<string, unknown>;
  readonly postedAt: Date;
}

export interface LedgerEntryRecord {
  readonly id: string;
  readonly journalId: string;
  readonly ledgerAccountId: string;
  readonly direction: Direction;
  readonly amountMinor: bigint;
  readonly currency: CurrencyCode;
  readonly sequence: number;
  readonly memo: string | null;
  readonly createdAt: Date;
}

export interface HoldRecord {
  readonly id: string;
  readonly ledgerAccountId: string;
  readonly amountMinor: bigint;
  readonly currency: CurrencyCode;
  readonly status: HoldStatus;
  readonly reference: string;
  readonly idempotencyKey: string;
  readonly transactionId: string | null;
  readonly expiresAt: Date | null;
  readonly createdAt: Date;
}

/** The handle handed to work running inside one atomic transaction. */
export interface LedgerUnitOfWork {
  findJournalByIdempotencyKey(key: string): Promise<JournalRecord | null>;
  findEntriesByJournalId(journalId: string): Promise<LedgerEntryRecord[]>;

  getLedgerAccountsByIds(ids: readonly string[]): Promise<LedgerAccountRecord[]>;
  getLedgerAccountByCode(code: string): Promise<LedgerAccountRecord | null>;

  /**
   * Exclusive row lock on each balance row, in the order supplied.
   * The engine always supplies sorted ids.
   */
  lockBalances(ledgerAccountIds: readonly string[]): Promise<BalanceSnapshot[]>;

  insertJournal(journal: JournalRecord): Promise<void>;
  insertEntries(entries: readonly LedgerEntryRecord[]): Promise<void>;

  /** Compare-and-set on `version`. Must reject a stale version. */
  writeBalance(snapshot: BalanceSnapshot, expectedVersion: bigint): Promise<void>;

  insertHold(hold: HoldRecord): Promise<void>;
  findHoldById(id: string): Promise<HoldRecord | null>;
  findHoldByIdempotencyKey(key: string): Promise<HoldRecord | null>;
  updateHoldStatus(id: string, status: HoldStatus): Promise<void>;
}

export interface LedgerStore {
  runInTransaction<T>(fn: (uow: LedgerUnitOfWork) => Promise<T>): Promise<T>;
}
