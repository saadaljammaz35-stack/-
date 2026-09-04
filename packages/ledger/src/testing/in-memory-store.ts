/**
 * An in-memory `LedgerStore` used by the engine's own tests.
 *
 * It is not a toy. To be worth testing against it reproduces the three
 * behaviours of the real PostgreSQL implementation that the engine depends on:
 *
 *   • row locks that are actually held for the duration of a transaction, so
 *     concurrent transfers genuinely contend rather than interleaving freely;
 *   • all-or-nothing commit — writes are buffered and discarded on throw;
 *   • a unique constraint on the journal idempotency key that rejects a second
 *     insert, exactly as the database index does.
 *
 * Without those, a passing concurrency test would prove nothing.
 */

import {
  ConcurrencyConflictError,
  type HoldStatus,
  IdempotencyConflictError,
} from '@nabd/shared';

import type { BalanceSnapshot } from '../balance.js';
import type {
  HoldRecord,
  JournalRecord,
  LedgerAccountRecord,
  LedgerEntryRecord,
  LedgerStore,
  LedgerUnitOfWork,
} from '../store.js';

/** A FIFO mutex, so lock waiters are served in arrival order. */
class Mutex {
  private locked = false;
  private readonly waiters: Array<() => void> = [];

  async acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return;
    }
    await new Promise<void>((resolve) => this.waiters.push(resolve));
  }

  release(): void {
    const next = this.waiters.shift();
    if (next === undefined) {
      this.locked = false;
    } else {
      next();
    }
  }
}

interface Buffered {
  journals: JournalRecord[];
  entries: LedgerEntryRecord[];
  balances: Map<string, BalanceSnapshot>;
  holds: HoldRecord[];
  holdStatuses: Map<string, HoldStatus>;
}

export class InMemoryLedgerStore implements LedgerStore {
  readonly accounts = new Map<string, LedgerAccountRecord>();
  readonly balances = new Map<string, BalanceSnapshot>();
  readonly journals = new Map<string, JournalRecord>();
  readonly entries: LedgerEntryRecord[] = [];
  readonly holds = new Map<string, HoldRecord>();

  private readonly mutexes = new Map<string, Mutex>();

  /** Serialises the global transaction body only where a real DB would. */
  private mutexFor(id: string): Mutex {
    let m = this.mutexes.get(id);
    if (m === undefined) {
      m = new Mutex();
      this.mutexes.set(id, m);
    }
    return m;
  }

  addAccount(account: LedgerAccountRecord, openingBalanceMinor = 0n): void {
    this.accounts.set(account.id, account);
    const credit = account.normalBalance === 'CREDIT' ? openingBalanceMinor : 0n;
    const debit = account.normalBalance === 'DEBIT' ? openingBalanceMinor : 0n;
    this.balances.set(account.id, {
      ledgerAccountId: account.id,
      currency: account.currency,
      normalBalance: account.normalBalance,
      postedDebitMinor: debit,
      postedCreditMinor: credit,
      holdMinor: 0n,
      version: 0n,
    });
  }

  async runInTransaction<T>(fn: (uow: LedgerUnitOfWork) => Promise<T>): Promise<T> {
    const buffered: Buffered = {
      journals: [],
      entries: [],
      balances: new Map(),
      holds: [],
      holdStatuses: new Map(),
    };
    const held: string[] = [];
    const store = this;

    const uow: LedgerUnitOfWork = {
      async findJournalByIdempotencyKey(key) {
        for (const j of store.journals.values()) {
          if (j.idempotencyKey === key) return j;
        }
        return buffered.journals.find((j) => j.idempotencyKey === key) ?? null;
      },

      async findEntriesByJournalId(journalId) {
        return store.entries.filter((e) => e.journalId === journalId);
      },

      async getLedgerAccountsByIds(ids) {
        return ids
          .map((id) => store.accounts.get(id))
          .filter((a): a is LedgerAccountRecord => a !== undefined);
      },

      async getLedgerAccountByCode(code) {
        for (const a of store.accounts.values()) {
          if (a.code === code) return a;
        }
        return null;
      },

      async lockBalances(ids) {
        // Acquire in the order given. The engine sorts; if a caller did not,
        // this is exactly where a deadlock would show up in production.
        for (const id of ids) {
          if (held.includes(id)) continue;
          await store.mutexFor(id).acquire();
          held.push(id);
        }
        return ids.map((id) => {
          const pending = buffered.balances.get(id);
          if (pending !== undefined) return pending;
          const current = store.balances.get(id);
          if (current === undefined) {
            throw new Error(`No balance row for ledger account ${id}`);
          }
          return current;
        });
      },

      async insertJournal(journal) {
        for (const j of store.journals.values()) {
          if (j.idempotencyKey === journal.idempotencyKey) {
            // Mirrors the UNIQUE index on journals.idempotency_key.
            throw new ConcurrencyConflictError('Duplicate journal idempotency key', {
              idempotencyKey: journal.idempotencyKey,
            });
          }
        }
        buffered.journals.push(journal);
      },

      async insertEntries(entries) {
        buffered.entries.push(...entries);
      },

      async writeBalance(snapshot, expectedVersion) {
        const current =
          buffered.balances.get(snapshot.ledgerAccountId) ??
          store.balances.get(snapshot.ledgerAccountId);
        if (current === undefined) {
          throw new Error(`No balance row for ${snapshot.ledgerAccountId}`);
        }
        if (current.version !== expectedVersion) {
          throw new ConcurrencyConflictError('Stale balance version', {
            ledgerAccountId: snapshot.ledgerAccountId,
            expected: expectedVersion.toString(),
            actual: current.version.toString(),
          });
        }
        buffered.balances.set(snapshot.ledgerAccountId, snapshot);
      },

      async insertHold(hold) {
        for (const h of store.holds.values()) {
          if (h.idempotencyKey === hold.idempotencyKey) {
            throw new IdempotencyConflictError('Duplicate hold idempotency key');
          }
        }
        buffered.holds.push(hold);
      },

      async findHoldById(id) {
        return store.holds.get(id) ?? buffered.holds.find((h) => h.id === id) ?? null;
      },

      async findHoldByIdempotencyKey(key) {
        for (const h of store.holds.values()) {
          if (h.idempotencyKey === key) return h;
        }
        return buffered.holds.find((h) => h.idempotencyKey === key) ?? null;
      },

      async updateHoldStatus(id, status) {
        buffered.holdStatuses.set(id, status);
      },
    };

    try {
      const result = await fn(uow);
      // Commit.
      for (const j of buffered.journals) this.journals.set(j.id, j);
      this.entries.push(...buffered.entries);
      for (const [id, b] of buffered.balances) this.balances.set(id, b);
      for (const h of buffered.holds) this.holds.set(h.id, h);
      for (const [id, status] of buffered.holdStatuses) {
        const hold = this.holds.get(id);
        if (hold !== undefined) this.holds.set(id, { ...hold, status });
      }
      return result;
    } finally {
      // Rollback is implicit: buffered writes are simply never applied.
      for (const id of held.reverse()) {
        this.mutexFor(id).release();
      }
    }
  }

  /** Every entry ever committed — the reconciliation input. */
  allEntries(): readonly LedgerEntryRecord[] {
    return this.entries;
  }
}
