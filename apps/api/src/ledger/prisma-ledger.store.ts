/**
 * The PostgreSQL implementation of the ledger's storage port.
 *
 * This is the bridge between the pure engine in `@nabd/ledger` and the
 * database. It is deliberately thin: it contains no business rules, only the
 * two guarantees the engine cannot provide for itself.
 *
 *   1. ATOMICITY — `runInTransaction` wraps everything in a single Prisma
 *      interactive transaction at REPEATABLE READ.
 *   2. LOCKING — `lockBalances` issues `SELECT … FOR UPDATE` in the order the
 *      engine supplies (which the engine has already sorted). Consistent lock
 *      ordering is what prevents deadlock between two transfers touching the
 *      same pair of accounts in opposite directions.
 *
 * The `ORDER BY` inside the lock query is not decoration. Without it PostgreSQL
 * may lock rows in whatever order the plan produces, and two concurrent
 * transactions can each hold the row the other is waiting for.
 */

import { Injectable } from '@nestjs/common';
import { Prisma, type PrismaClient } from '@prisma/client';
import {
  ConcurrencyConflictError,
  type CurrencyCode,
  type Direction,
  type HoldStatus,
  type LedgerAccountType,
  NotFoundError,
} from '@nabd/shared';
import type {
  BalanceSnapshot,
  HoldRecord,
  JournalRecord,
  LedgerAccountRecord,
  LedgerEntryRecord,
  LedgerStore,
  LedgerUnitOfWork,
} from '@nabd/ledger';

import { PrismaService } from '../prisma/prisma.service.js';

type Tx = Prisma.TransactionClient;

interface BalanceRow {
  ledger_account_id: string;
  posted_debit_minor: bigint;
  posted_credit_minor: bigint;
  hold_minor: bigint;
  version: bigint;
  currency: string;
  normal_balance: Direction;
}

@Injectable()
export class PrismaLedgerStore implements LedgerStore {
  constructor(private readonly prisma: PrismaService) {}

  async runInTransaction<T>(fn: (uow: LedgerUnitOfWork) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => fn(new PrismaUnitOfWork(tx)), {
      // REPEATABLE READ plus explicit row locks. SERIALIZABLE would also be
      // correct but costs retries under contention that the row locks
      // already prevent.
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      maxWait: 5_000,
      timeout: 15_000,
    });
  }
}

class PrismaUnitOfWork implements LedgerUnitOfWork {
  constructor(private readonly tx: Tx) {}

  async findJournalByIdempotencyKey(key: string): Promise<JournalRecord | null> {
    const row = await this.tx.journal.findUnique({ where: { idempotencyKey: key } });
    return row === null ? null : toJournalRecord(row);
  }

  async findEntriesByJournalId(journalId: string): Promise<LedgerEntryRecord[]> {
    const rows = await this.tx.ledgerEntry.findMany({
      where: { journalId },
      orderBy: { sequence: 'asc' },
    });
    return rows.map(toEntryRecord);
  }

  async getLedgerAccountsByIds(ids: readonly string[]): Promise<LedgerAccountRecord[]> {
    const rows = await this.tx.ledgerAccount.findMany({ where: { id: { in: [...ids] } } });
    return rows.map(toAccountRecord);
  }

  async getLedgerAccountByCode(code: string): Promise<LedgerAccountRecord | null> {
    const row = await this.tx.ledgerAccount.findUnique({ where: { code } });
    return row === null ? null : toAccountRecord(row);
  }

  /**
   * Exclusive row locks, taken in the supplied order.
   *
   * `$queryRaw` rather than Prisma's query builder because Prisma has no way to
   * express `FOR UPDATE`, and this lock is the entire double-spend defence.
   */
  async lockBalances(ledgerAccountIds: readonly string[]): Promise<BalanceSnapshot[]> {
    if (ledgerAccountIds.length === 0) return [];

    const rows = await this.tx.$queryRaw<BalanceRow[]>`
      SELECT
        b.ledger_account_id,
        b.posted_debit_minor,
        b.posted_credit_minor,
        b.hold_minor,
        b.version,
        la.currency,
        la.normal_balance
      FROM ledger_account_balances b
      JOIN ledger_accounts la ON la.id = b.ledger_account_id
      WHERE b.ledger_account_id = ANY(${[...ledgerAccountIds]}::uuid[])
      ORDER BY b.ledger_account_id
      FOR UPDATE OF b
    `;

    if (rows.length !== ledgerAccountIds.length) {
      const found = new Set(rows.map((r) => r.ledger_account_id));
      const missing = ledgerAccountIds.find((id) => !found.has(id));
      throw new NotFoundError('Ledger balance', missing);
    }

    // Return in the caller's requested order, not the database's.
    const byId = new Map(rows.map((r) => [r.ledger_account_id, r]));
    return ledgerAccountIds.map((id) => {
      const row = byId.get(id) as BalanceRow;
      return {
        ledgerAccountId: row.ledger_account_id,
        currency: row.currency.trim() as CurrencyCode,
        normalBalance: row.normal_balance,
        postedDebitMinor: BigInt(row.posted_debit_minor),
        postedCreditMinor: BigInt(row.posted_credit_minor),
        holdMinor: BigInt(row.hold_minor),
        version: BigInt(row.version),
      };
    });
  }

  async insertJournal(journal: JournalRecord): Promise<void> {
    try {
      await this.tx.journal.create({
        data: {
          id: journal.id,
          reference: journal.reference,
          idempotencyKey: journal.idempotencyKey,
          currency: journal.currency,
          description: journal.description,
          transactionId: journal.transactionId,
          reversalOfJournalId: journal.reversalOfJournalId,
          createdBy: journal.createdBy,
          metadata: journal.metadata as Prisma.InputJsonValue,
          postedAt: journal.postedAt,
        },
      });
    } catch (error) {
      // A unique violation on idempotency_key means a concurrent request won
      // the race. Surfacing it as a retryable conflict lets the engine retry,
      // find the winner's journal, and return a replay — instead of posting
      // the same movement twice.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConcurrencyConflictError('Duplicate journal idempotency key', {
          idempotencyKey: journal.idempotencyKey,
        });
      }
      throw error;
    }
  }

  async insertEntries(entries: readonly LedgerEntryRecord[]): Promise<void> {
    await this.tx.ledgerEntry.createMany({
      data: entries.map((e) => ({
        id: e.id,
        journalId: e.journalId,
        ledgerAccountId: e.ledgerAccountId,
        direction: e.direction,
        amountMinor: e.amountMinor,
        currency: e.currency,
        sequence: e.sequence,
        memo: e.memo,
        createdAt: e.createdAt,
      })),
    });
  }

  /**
   * Compare-and-set on `version`. The row is already locked, so this cannot
   * normally fail — it is a second, independent guard against a code path that
   * writes a balance without having taken the lock.
   */
  async writeBalance(snapshot: BalanceSnapshot, expectedVersion: bigint): Promise<void> {
    const updated = await this.tx.$executeRaw`
      UPDATE ledger_account_balances
         SET posted_debit_minor  = ${snapshot.postedDebitMinor},
             posted_credit_minor = ${snapshot.postedCreditMinor},
             hold_minor          = ${snapshot.holdMinor},
             version             = ${snapshot.version},
             updated_at          = now()
       WHERE ledger_account_id = ${snapshot.ledgerAccountId}::uuid
         AND version = ${expectedVersion}
    `;

    if (updated !== 1) {
      throw new ConcurrencyConflictError('Balance was modified concurrently', {
        ledgerAccountId: snapshot.ledgerAccountId,
        expectedVersion: expectedVersion.toString(),
      });
    }
  }

  async insertHold(hold: HoldRecord): Promise<void> {
    await this.tx.hold.create({
      data: {
        id: hold.id,
        ledgerAccountId: hold.ledgerAccountId,
        amountMinor: hold.amountMinor,
        currency: hold.currency,
        status: hold.status,
        reference: hold.reference,
        idempotencyKey: hold.idempotencyKey,
        transactionId: hold.transactionId,
        expiresAt: hold.expiresAt,
        createdAt: hold.createdAt,
      },
    });
  }

  async findHoldById(id: string): Promise<HoldRecord | null> {
    const row = await this.tx.hold.findUnique({ where: { id } });
    return row === null ? null : toHoldRecord(row);
  }

  async findHoldByIdempotencyKey(key: string): Promise<HoldRecord | null> {
    const row = await this.tx.hold.findUnique({ where: { idempotencyKey: key } });
    return row === null ? null : toHoldRecord(row);
  }

  async updateHoldStatus(id: string, status: HoldStatus): Promise<void> {
    await this.tx.hold.update({
      where: { id },
      data: { status, resolvedAt: new Date() },
    });
  }
}

// ── row mappers ─────────────────────────────────────────────────────────────

function toJournalRecord(row: {
  id: string;
  reference: string;
  idempotencyKey: string;
  currency: string;
  description: string;
  transactionId: string | null;
  reversalOfJournalId: string | null;
  createdBy: string | null;
  metadata: unknown;
  postedAt: Date;
}): JournalRecord {
  return {
    id: row.id,
    reference: row.reference,
    idempotencyKey: row.idempotencyKey,
    currency: row.currency.trim() as CurrencyCode,
    description: row.description,
    transactionId: row.transactionId,
    reversalOfJournalId: row.reversalOfJournalId,
    createdBy: row.createdBy,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    postedAt: row.postedAt,
  };
}

function toEntryRecord(row: {
  id: string;
  journalId: string;
  ledgerAccountId: string;
  direction: Direction;
  amountMinor: bigint;
  currency: string;
  sequence: number;
  memo: string | null;
  createdAt: Date;
}): LedgerEntryRecord {
  return {
    id: row.id,
    journalId: row.journalId,
    ledgerAccountId: row.ledgerAccountId,
    direction: row.direction,
    amountMinor: BigInt(row.amountMinor),
    currency: row.currency.trim() as CurrencyCode,
    sequence: row.sequence,
    memo: row.memo,
    createdAt: row.createdAt,
  };
}

function toAccountRecord(row: {
  id: string;
  code: string;
  accountId: string | null;
  type: LedgerAccountType;
  normalBalance: Direction;
  currency: string;
  isSystem: boolean;
  allowsNegativeBalance: boolean;
}): LedgerAccountRecord {
  return {
    id: row.id,
    code: row.code,
    accountId: row.accountId,
    type: row.type,
    normalBalance: row.normalBalance,
    currency: row.currency.trim() as CurrencyCode,
    isSystem: row.isSystem,
    allowsNegativeBalance: row.allowsNegativeBalance,
  };
}

function toHoldRecord(row: {
  id: string;
  ledgerAccountId: string;
  amountMinor: bigint;
  currency: string;
  status: HoldStatus;
  reference: string;
  idempotencyKey: string;
  transactionId: string | null;
  expiresAt: Date | null;
  createdAt: Date;
}): HoldRecord {
  return {
    id: row.id,
    ledgerAccountId: row.ledgerAccountId,
    amountMinor: BigInt(row.amountMinor),
    currency: row.currency.trim() as CurrencyCode,
    status: row.status,
    reference: row.reference,
    idempotencyKey: row.idempotencyKey,
    transactionId: row.transactionId,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  };
}

export type { PrismaClient };
