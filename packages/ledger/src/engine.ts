/**
 * The ledger engine.
 *
 * This is the only code in NABD permitted to move value. Everything it does
 * happens inside one atomic transaction, under row locks taken in a
 * deterministic order, guarded by an idempotency key.
 *
 * What the engine guarantees:
 *
 *   • Balanced      — it only accepts a `BalancedJournal`, and re-checks totals
 *                     before writing.
 *   • Idempotent    — the same idempotency key never posts twice, no matter how
 *                     many times the request is replayed or retried.
 *   • Consistent    — the balance cache is updated in the same transaction as
 *                     the entries it summarises.
 *   • Solvent       — a customer account can never be driven below its
 *                     available balance, re-read *inside* the lock.
 *   • Immutable     — there is no update or delete path. Corrections are
 *                     reversals, which are themselves ordinary postings.
 */

import {
  ConcurrencyConflictError,
  CurrencyMismatchError,
  type CurrencyCode,
  type HoldStatus,
  InsufficientFundsError,
  type Money,
  NotFoundError,
  UnbalancedJournalError,
  ValidationError,
  type Clock,
  Money as MoneyClass,
  systemClock,
  uuidv7,
} from '@nabd/shared';

import { type BalanceSnapshot, availableBalance, ledgerBalance } from './balance.js';
import type { BalancedJournal } from './journal.js';
import type {
  HoldRecord,
  JournalRecord,
  LedgerAccountRecord,
  LedgerEntryRecord,
  LedgerStore,
  LedgerUnitOfWork,
} from './store.js';
import { assertHoldTransition } from './transaction-state.js';

export interface PostResult {
  readonly journalId: string;
  readonly reference: string;
  /**
   * True when this idempotency key had already been posted and the engine
   * returned the original journal instead of writing a second one.
   */
  readonly replayed: boolean;
  readonly balances: ReadonlyMap<string, BalanceSnapshot>;
}

export interface PlaceHoldParams {
  readonly ledgerAccountId: string;
  readonly amount: Money;
  readonly reference: string;
  readonly idempotencyKey: string;
  readonly transactionId?: string;
  readonly expiresAt?: Date;
}

export interface HoldResult {
  readonly holdId: string;
  readonly replayed: boolean;
  readonly balance: BalanceSnapshot;
}

export class LedgerEngine {
  constructor(
    private readonly store: LedgerStore,
    private readonly clock: Clock = systemClock,
  ) {}

  /**
   * Post a balanced journal.
   *
   * Ordering inside the transaction is deliberate and load-bearing:
   *   1. idempotency check   — cheapest exit, before any lock is taken
   *   2. account load        — validate before locking
   *   3. lock, sorted        — deadlock-free
   *   4. solvency re-read    — *inside* the lock, never from a cached read
   *   5. write               — journal, entries, balances together
   */
  async post(journal: BalancedJournal): Promise<PostResult> {
    // Two requests carrying the same idempotency key can both pass the
    // existence check before either has inserted. The UNIQUE index on
    // journals.idempotency_key is what actually decides the race: the loser's
    // transaction aborts, and on retry it finds the winner's journal and
    // returns a replay. This loop is that retry.
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.postOnce(journal);
      } catch (error) {
        if (!(error instanceof ConcurrencyConflictError)) throw error;
        lastError = error;
      }
    }
    throw lastError;
  }

  private async postOnce(journal: BalancedJournal): Promise<PostResult> {
    return this.store.runInTransaction(async (uow) => {
      // 1 ── Idempotency. A replay returns the original posting untouched.
      const existing = await uow.findJournalByIdempotencyKey(journal.idempotencyKey);
      if (existing !== null) {
        const balances = await this.snapshotMap(uow, journal.touchedAccountIds);
        return {
          journalId: existing.id,
          reference: existing.reference,
          replayed: true,
          balances,
        };
      }

      // Re-verify the invariant. The type system already proves it, but a
      // posting is the last place to trust a single mechanism.
      const debits = journal.totalDebit.minor;
      const credits = journal.totalCredit.minor;
      if (debits !== credits) {
        throw new UnbalancedJournalError(debits, credits, {
          reference: journal.reference,
        });
      }

      // 2 ── Load and validate every account the journal touches.
      const touched = [...journal.touchedAccountIds].sort();
      const accounts = await uow.getLedgerAccountsByIds(touched);
      const byId = new Map(accounts.map((a) => [a.id, a]));

      for (const id of touched) {
        const account = byId.get(id);
        if (account === undefined) {
          throw new NotFoundError('Ledger account', id);
        }
        if (account.currency !== journal.currency) {
          throw new CurrencyMismatchError(journal.currency, account.currency);
        }
      }

      // 3 ── Lock, always in sorted id order.
      const locked = await uow.lockBalances(touched);
      const lockedById = new Map(locked.map((b) => [b.ledgerAccountId, b]));

      // 4 ── Solvency, computed from the state we just locked.
      const updated = new Map<string, BalanceSnapshot>();
      for (const id of touched) {
        const account = byId.get(id) as LedgerAccountRecord;
        const before = lockedById.get(id);
        if (before === undefined) {
          throw new NotFoundError('Ledger balance', id);
        }

        const gross = journal.grossFor(id);
        const after: BalanceSnapshot = {
          ...before,
          postedDebitMinor: before.postedDebitMinor + gross.debit,
          postedCreditMinor: before.postedCreditMinor + gross.credit,
          version: before.version + 1n,
        };

        if (!account.allowsNegativeBalance && availableBalance(after).isNegative) {
          throw new InsufficientFundsError('Insufficient funds', {
            ledgerAccountId: id,
            accountCode: account.code,
            // Kept in `details` for our logs; never surfaced to the caller.
            availableBefore: availableBalance(before).toString(),
            requested: MoneyClass.fromMinor(
              gross.debit - gross.credit,
              journal.currency,
            ).toString(),
          });
        }
        updated.set(id, after);
      }

      // 5 ── Write. Journal, entries and balances land in one commit.
      const journalId = uuidv7(this.clock.nowMs());
      const postedAt = this.clock.now();

      const record: JournalRecord = {
        id: journalId,
        reference: journal.reference,
        idempotencyKey: journal.idempotencyKey,
        currency: journal.currency,
        description: journal.description,
        transactionId: journal.transactionId ?? null,
        reversalOfJournalId: journal.reversalOfJournalId ?? null,
        createdBy: journal.createdBy ?? null,
        metadata: { ...journal.metadata },
        postedAt,
      };
      await uow.insertJournal(record);

      const entries: LedgerEntryRecord[] = journal.lines.map((line, index) => ({
        id: uuidv7(this.clock.nowMs()),
        journalId,
        ledgerAccountId: line.ledgerAccountId,
        direction: line.direction,
        amountMinor: line.amount.minor,
        currency: journal.currency,
        sequence: index,
        memo: line.memo ?? null,
        createdAt: postedAt,
      }));
      await uow.insertEntries(entries);

      for (const [id, snapshot] of updated) {
        const before = lockedById.get(id) as BalanceSnapshot;
        await uow.writeBalance(snapshot, before.version);
      }

      return {
        journalId,
        reference: journal.reference,
        replayed: false,
        balances: updated,
      };
    });
  }

  /**
   * Reserve funds without posting them.
   *
   * Used whenever value is committed to an external system that has not yet
   * confirmed — an outbound payment, a card authorisation. The customer's
   * ledger balance is unchanged (nothing has actually moved) but their
   * available balance drops, so the same funds cannot be committed twice while
   * the first attempt is in flight.
   */
  async placeHold(params: PlaceHoldParams): Promise<HoldResult> {
    if (!params.amount.isPositive) {
      throw new ValidationError('Hold amount must be greater than zero');
    }

    return this.store.runInTransaction(async (uow) => {
      const existing = await uow.findHoldByIdempotencyKey(params.idempotencyKey);
      if (existing !== null) {
        const [balance] = await uow.lockBalances([params.ledgerAccountId]);
        if (balance === undefined)
          throw new NotFoundError('Ledger balance', params.ledgerAccountId);
        return { holdId: existing.id, replayed: true, balance };
      }

      const [account] = await uow.getLedgerAccountsByIds([params.ledgerAccountId]);
      if (account === undefined) {
        throw new NotFoundError('Ledger account', params.ledgerAccountId);
      }
      if (account.currency !== params.amount.currency) {
        throw new CurrencyMismatchError(account.currency, params.amount.currency);
      }

      const [before] = await uow.lockBalances([params.ledgerAccountId]);
      if (before === undefined) {
        throw new NotFoundError('Ledger balance', params.ledgerAccountId);
      }

      const after: BalanceSnapshot = {
        ...before,
        holdMinor: before.holdMinor + params.amount.minor,
        version: before.version + 1n,
      };

      if (!account.allowsNegativeBalance && availableBalance(after).isNegative) {
        throw new InsufficientFundsError('Insufficient funds for hold', {
          ledgerAccountId: params.ledgerAccountId,
          availableBefore: availableBalance(before).toString(),
        });
      }

      const hold: HoldRecord = {
        id: uuidv7(this.clock.nowMs()),
        ledgerAccountId: params.ledgerAccountId,
        amountMinor: params.amount.minor,
        currency: params.amount.currency,
        status: 'ACTIVE',
        reference: params.reference,
        idempotencyKey: params.idempotencyKey,
        transactionId: params.transactionId ?? null,
        expiresAt: params.expiresAt ?? null,
        createdAt: this.clock.now(),
      };

      await uow.insertHold(hold);
      await uow.writeBalance(after, before.version);
      return { holdId: hold.id, replayed: false, balance: after };
    });
  }

  /**
   * Release a hold without posting — the reservation is abandoned because the
   * external attempt failed, was cancelled, or expired.
   */
  async releaseHold(holdId: string, status: HoldStatus = 'RELEASED'): Promise<void> {
    if (status !== 'RELEASED' && status !== 'EXPIRED') {
      throw new ValidationError(`releaseHold cannot set status ${status}`);
    }
    await this.store.runInTransaction(async (uow) => {
      const hold = await uow.findHoldById(holdId);
      if (hold === null) throw new NotFoundError('Hold', holdId);
      // A double release must not credit the balance twice.
      if (hold.status !== 'ACTIVE') return;
      assertHoldTransition(hold.status, status);

      const [before] = await uow.lockBalances([hold.ledgerAccountId]);
      if (before === undefined)
        throw new NotFoundError('Ledger balance', hold.ledgerAccountId);

      await uow.writeBalance(
        {
          ...before,
          holdMinor: before.holdMinor - hold.amountMinor,
          version: before.version + 1n,
        },
        before.version,
      );
      await uow.updateHoldStatus(holdId, status);
    });
  }

  /**
   * Capture a hold: the external system confirmed, so the reservation converts
   * into a real posting. Releasing the hold and posting the journal happen in
   * one transaction — there is no instant where the funds are neither held nor
   * posted, which is the window a customer could otherwise spend them twice.
   */
  async captureHold(holdId: string, journal: BalancedJournal): Promise<PostResult> {
    return this.store.runInTransaction(async (uow) => {
      const hold = await uow.findHoldById(holdId);
      if (hold === null) throw new NotFoundError('Hold', holdId);
      if (hold.status !== 'ACTIVE') {
        throw new ValidationError(`Hold ${holdId} is ${hold.status}, not ACTIVE`);
      }
      assertHoldTransition(hold.status, 'CAPTURED');

      const existing = await uow.findJournalByIdempotencyKey(journal.idempotencyKey);
      if (existing !== null) {
        const balances = await this.snapshotMap(uow, journal.touchedAccountIds);
        return {
          journalId: existing.id,
          reference: existing.reference,
          replayed: true,
          balances,
        };
      }

      // Drop the reservation first, then post. Both are inside this
      // transaction, so the intermediate state is never observable.
      const touched = [
        ...new Set([...journal.touchedAccountIds, hold.ledgerAccountId]),
      ].sort();
      const accounts = await uow.getLedgerAccountsByIds(touched);
      const byId = new Map(accounts.map((a) => [a.id, a]));
      const locked = await uow.lockBalances(touched);
      const lockedById = new Map(locked.map((b) => [b.ledgerAccountId, b]));

      const updated = new Map<string, BalanceSnapshot>();
      for (const id of touched) {
        const account = byId.get(id);
        if (account === undefined) throw new NotFoundError('Ledger account', id);
        const before = lockedById.get(id);
        if (before === undefined) throw new NotFoundError('Ledger balance', id);

        const gross = journal.grossFor(id);
        const releasedHold = id === hold.ledgerAccountId ? hold.amountMinor : 0n;
        const after: BalanceSnapshot = {
          ...before,
          postedDebitMinor: before.postedDebitMinor + gross.debit,
          postedCreditMinor: before.postedCreditMinor + gross.credit,
          holdMinor: before.holdMinor - releasedHold,
          version: before.version + 1n,
        };
        if (!account.allowsNegativeBalance && availableBalance(after).isNegative) {
          throw new InsufficientFundsError('Insufficient funds on capture', {
            ledgerAccountId: id,
          });
        }
        updated.set(id, after);
      }

      const journalId = uuidv7(this.clock.nowMs());
      const postedAt = this.clock.now();
      await uow.insertJournal({
        id: journalId,
        reference: journal.reference,
        idempotencyKey: journal.idempotencyKey,
        currency: journal.currency,
        description: journal.description,
        transactionId: journal.transactionId ?? null,
        reversalOfJournalId: journal.reversalOfJournalId ?? null,
        createdBy: journal.createdBy ?? null,
        metadata: { ...journal.metadata, capturedHoldId: holdId },
        postedAt,
      });
      await uow.insertEntries(
        journal.lines.map((line, index) => ({
          id: uuidv7(this.clock.nowMs()),
          journalId,
          ledgerAccountId: line.ledgerAccountId,
          direction: line.direction,
          amountMinor: line.amount.minor,
          currency: journal.currency,
          sequence: index,
          memo: line.memo ?? null,
          createdAt: postedAt,
        })),
      );
      for (const [id, snapshot] of updated) {
        const before = lockedById.get(id) as BalanceSnapshot;
        await uow.writeBalance(snapshot, before.version);
      }
      await uow.updateHoldStatus(holdId, 'CAPTURED');

      return {
        journalId,
        reference: journal.reference,
        replayed: false,
        balances: updated,
      };
    });
  }

  /** Read a balance without locking. Never use this to authorise a debit. */
  async getBalance(ledgerAccountId: string): Promise<{
    snapshot: BalanceSnapshot;
    ledger: Money;
    available: Money;
  }> {
    return this.store.runInTransaction(async (uow) => {
      const [snapshot] = await uow.lockBalances([ledgerAccountId]);
      if (snapshot === undefined) {
        throw new NotFoundError('Ledger balance', ledgerAccountId);
      }
      return {
        snapshot,
        ledger: ledgerBalance(snapshot),
        available: availableBalance(snapshot),
      };
    });
  }

  /**
   * Post the reversal of an existing journal. The original is left exactly as
   * it was; the correction is a new, ordinary posting that points back at it.
   */
  async reverse(params: {
    journalId: string;
    reference: string;
    idempotencyKey: string;
    reason: string;
    createdBy: string;
  }): Promise<PostResult> {
    const original = await this.store.runInTransaction(async (uow) => {
      const entries = await uow.findEntriesByJournalId(params.journalId);
      if (entries.length === 0) {
        throw new NotFoundError('Journal', params.journalId);
      }
      return entries;
    });

    const { JournalBuilder } = await import('./journal.js');
    const first = original[0] as LedgerEntryRecord;
    const builder = new JournalBuilder({
      reference: params.reference,
      idempotencyKey: params.idempotencyKey,
      currency: first.currency as CurrencyCode,
      description: `Reversal: ${params.reason}`,
      reversalOfJournalId: params.journalId,
      createdBy: params.createdBy,
      metadata: { reason: params.reason, reversalOf: params.journalId },
    });
    for (const entry of original) {
      builder.add(
        entry.ledgerAccountId,
        entry.direction === 'DEBIT' ? 'CREDIT' : 'DEBIT',
        MoneyClass.fromMinor(entry.amountMinor, entry.currency),
        `Reversal of entry ${entry.id}`,
      );
    }
    return this.post(builder.build());
  }

  private async snapshotMap(
    uow: LedgerUnitOfWork,
    ids: readonly string[],
  ): Promise<ReadonlyMap<string, BalanceSnapshot>> {
    const snapshots = await uow.lockBalances([...ids].sort());
    return new Map(snapshots.map((s) => [s.ledgerAccountId, s]));
  }
}

export { ConcurrencyConflictError };
