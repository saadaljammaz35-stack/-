import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import {
  ConcurrencyConflictError,
  FixedClock,
  InsufficientFundsError,
  Money,
  UnbalancedJournalError,
  ValidationError,
} from '@nabd/shared';

import {
  assertTrialBalance,
  availableBalance,
  deriveTotals,
  ledgerBalance,
} from './balance.js';
import { LedgerEngine } from './engine.js';
import { JournalBuilder } from './journal.js';
import { internalTransfer, topUp } from './posting-rules.js';
import type { LedgerAccountRecord } from './store.js';
import { InMemoryLedgerStore } from './testing/in-memory-store.js';

const SAR = 'SAR' as const;

// Ledger account ids are chosen so that sort order is obvious in assertions.
const ALICE = 'la_alice';
const BOB = 'la_bob';
const SETTLEMENT = 'system:settlement:SAR';

function customerAccount(id: string): LedgerAccountRecord {
  return {
    id,
    code: `user:${id}`,
    type: 'LIABILITY',
    normalBalance: 'CREDIT',
    currency: SAR,
    isSystem: false,
    accountId: id,
    // The double-spend guard: a customer account may never go negative.
    allowsNegativeBalance: false,
  };
}

function settlementAccount(): LedgerAccountRecord {
  return {
    id: SETTLEMENT,
    code: SETTLEMENT,
    type: 'ASSET',
    normalBalance: 'DEBIT',
    currency: SAR,
    isSystem: true,
    accountId: null,
    allowsNegativeBalance: true,
  };
}

interface Fixture {
  store: InMemoryLedgerStore;
  engine: LedgerEngine;
}

/**
 * Opening balances are established by *posting a funding journal*, never by
 * assigning a number to a balance row. That is the same rule the production
 * code follows, and it means the reconciliation assertions below compare the
 * cache against a complete entry history rather than against a number that was
 * conjured into the fixture.
 */
async function fixture(aliceOpening = 100_00n, bobOpening = 0n): Promise<Fixture> {
  const store = new InMemoryLedgerStore();
  store.addAccount(customerAccount(ALICE));
  store.addAccount(customerAccount(BOB));
  store.addAccount(settlementAccount());
  store.addAccount({
    id: 'system:fees:SAR',
    code: 'system:fees:SAR',
    type: 'REVENUE',
    normalBalance: 'CREDIT',
    currency: SAR,
    isSystem: true,
    accountId: null,
    allowsNegativeBalance: true,
  });

  const engine = new LedgerEngine(store, new FixedClock(1_756_000_000_000));
  const openings: Array<[string, bigint]> = [
    [ALICE, aliceOpening],
    [BOB, bobOpening],
  ];
  for (const [id, amount] of openings) {
    if (amount === 0n) continue;
    await engine.post(
      topUp(
        { reference: `SEED-${id}`, idempotencyKey: `seed-${id}`, currency: SAR },
        { customerLedgerAccountId: id, amount: Money.fromMinor(amount, SAR) },
      ),
    );
  }
  return { store, engine };
}

function transfer(
  key: string,
  amountMinor: bigint,
  from = ALICE,
  to = BOB,
): ReturnType<typeof internalTransfer> {
  return internalTransfer(
    { reference: `REF-${key}`, idempotencyKey: key, currency: SAR },
    {
      senderLedgerAccountId: from,
      receiverLedgerAccountId: to,
      amount: Money.fromMinor(amountMinor, SAR),
    },
  );
}

async function balanceOf(f: Fixture, id: string): Promise<bigint> {
  const { ledger } = await f.engine.getBalance(id);
  return ledger.minor;
}

// ─────────────────────────────────────────────────────────────────────────────

describe('Journal — an unbalanced journal is unrepresentable', () => {
  it('refuses to build when debits do not equal credits', () => {
    const b = new JournalBuilder({
      reference: 'R1',
      idempotencyKey: 'K1',
      currency: SAR,
      description: 'bad',
    });
    b.debit(ALICE, Money.fromMinor(100n, SAR));
    b.credit(BOB, Money.fromMinor(99n, SAR));
    assert.throws(() => b.build(), UnbalancedJournalError);
  });

  it('refuses a single-sided journal', () => {
    const b = new JournalBuilder({
      reference: 'R2',
      idempotencyKey: 'K2',
      currency: SAR,
      description: 'bad',
    });
    b.debit(ALICE, Money.fromMinor(100n, SAR));
    assert.throws(() => b.build(), ValidationError);
  });

  it('refuses a zero-value journal', () => {
    const b = new JournalBuilder({
      reference: 'R3',
      idempotencyKey: 'K3',
      currency: SAR,
      description: 'bad',
    });
    assert.throws(() => b.debit(ALICE, Money.fromMinor(0n, SAR)), ValidationError);
  });

  it('refuses a negative posting — direction carries the sign, not the amount', () => {
    const b = new JournalBuilder({
      reference: 'R4',
      idempotencyKey: 'K4',
      currency: SAR,
      description: 'bad',
    });
    assert.throws(() => b.debit(ALICE, Money.fromMinor(-100n, SAR)), ValidationError);
  });

  it('refuses to mix currencies inside one journal', () => {
    const b = new JournalBuilder({
      reference: 'R5',
      idempotencyKey: 'K5',
      currency: SAR,
      description: 'bad',
    });
    assert.throws(() => b.debit(ALICE, Money.fromMinor(100n, 'USD')), ValidationError);
  });

  it('refuses a transfer to the same account', () => {
    assert.throws(() => transfer('K6', 100n, ALICE, ALICE), ValidationError);
  });

  it('builds a balanced multi-line journal with a fee', () => {
    const journal = internalTransfer(
      { reference: 'R7', idempotencyKey: 'K7', currency: SAR },
      {
        senderLedgerAccountId: ALICE,
        receiverLedgerAccountId: BOB,
        amount: Money.fromMinor(10_000n, SAR),
        fee: Money.fromMinor(150n, SAR),
      },
    );
    assert.equal(journal.lines.length, 4);
    assert.equal(journal.totalDebit.minor, journal.totalCredit.minor);
    assert.equal(journal.totalDebit.minor, 10_150n);
  });
});

describe('LedgerEngine — posting', () => {
  let f: Fixture;
  beforeEach(async () => {
    f = await fixture();
  });

  it('moves value between two customer accounts', async () => {
    await f.engine.post(transfer('t1', 40_00n));
    assert.equal(await balanceOf(f, ALICE), 60_00n);
    assert.equal(await balanceOf(f, BOB), 40_00n);
  });

  it('treats a customer balance as a liability — credits increase it', async () => {
    // Funding: settlement (asset) is debited, the customer (liability) credited.
    await f.engine.post(
      topUp(
        { reference: 'R-top', idempotencyKey: 'top1', currency: SAR },
        { customerLedgerAccountId: BOB, amount: Money.fromMinor(25_00n, SAR) },
      ),
    );
    assert.equal(await balanceOf(f, BOB), 25_00n, 'customer balance rose on a credit');
    const settlement = await f.engine.getBalance(SETTLEMENT);
    assert.equal(settlement.ledger.minor, 100_00n + 25_00n, 'asset rose on a debit');
  });

  it('charges a fee to the sender and books it as revenue', async () => {
    await f.engine.post(
      internalTransfer(
        { reference: 'R-fee', idempotencyKey: 'fee1', currency: SAR },
        {
          senderLedgerAccountId: ALICE,
          receiverLedgerAccountId: BOB,
          amount: Money.fromMinor(10_00n, SAR),
          fee: Money.fromMinor(1_00n, SAR),
        },
      ),
    );
    assert.equal(await balanceOf(f, ALICE), 89_00n, 'sender paid amount + fee');
    assert.equal(await balanceOf(f, BOB), 10_00n, 'receiver got the amount only');
    assert.equal(await balanceOf(f, 'system:fees:SAR'), 1_00n, 'fee booked as revenue');
  });

  it('rejects a debit that exceeds the available balance', async () => {
    const before = { journals: f.store.journals.size, entries: f.store.entries.length };
    await assert.rejects(
      () => f.engine.post(transfer('t2', 100_01n)),
      InsufficientFundsError,
    );
    assert.equal(await balanceOf(f, ALICE), 100_00n, 'nothing was posted');
    assert.equal(await balanceOf(f, BOB), 0n);
    assert.equal(f.store.journals.size, before.journals, 'no journal was written');
    assert.equal(f.store.entries.length, before.entries, 'no entries were written');
  });

  it('allows spending down to exactly zero', async () => {
    await f.engine.post(transfer('t3', 100_00n));
    assert.equal(await balanceOf(f, ALICE), 0n);
  });

  it('does not leak the balance in the public error message', async () => {
    try {
      await f.engine.post(transfer('t4', 500_00n));
      assert.fail('should have thrown');
    } catch (error) {
      assert.ok(error instanceof InsufficientFundsError);
      assert.equal(error.publicMessage, 'Insufficient funds');
      assert.ok(!error.publicMessage.includes('100'), 'balance must not be echoed');
      // …but it is kept for our own logs.
      assert.ok(String(error.details['availableBefore']).includes('100.00'));
    }
  });
});

describe('LedgerEngine — idempotency', () => {
  let f: Fixture;
  beforeEach(async () => {
    f = await fixture();
  });

  it('posts once when the same key is submitted twice in sequence', async () => {
    const before = { journals: f.store.journals.size, entries: f.store.entries.length };
    const first = await f.engine.post(transfer('dup', 30_00n));
    const second = await f.engine.post(transfer('dup', 30_00n));

    assert.equal(first.replayed, false);
    assert.equal(second.replayed, true, 'second submission is a replay');
    assert.equal(second.journalId, first.journalId, 'same journal returned');
    assert.equal(await balanceOf(f, ALICE), 70_00n, 'money moved exactly once');
    assert.equal(f.store.journals.size - before.journals, 1, 'one new journal');
    assert.equal(f.store.entries.length - before.entries, 2, 'two new entries');
  });

  it('posts once when the same key races with itself', async () => {
    const before = { journals: f.store.journals.size, entries: f.store.entries.length };
    // Both requests pass the existence check before either inserts. The unique
    // index decides the winner; the loser retries and replays.
    const results = await Promise.all([
      f.engine.post(transfer('race', 30_00n)),
      f.engine.post(transfer('race', 30_00n)),
      f.engine.post(transfer('race', 30_00n)),
    ]);

    assert.equal(
      f.store.journals.size - before.journals,
      1,
      'exactly one journal was added',
    );
    assert.equal(
      f.store.entries.length - before.entries,
      2,
      'exactly two entries were added',
    );
    assert.equal(await balanceOf(f, ALICE), 70_00n, 'debited once, not three times');
    assert.equal(results.filter((r) => !r.replayed).length, 1, 'exactly one winner');
    assert.equal(results.filter((r) => r.replayed).length, 2, 'two replays');
    const ids = new Set(results.map((r) => r.journalId));
    assert.equal(ids.size, 1, 'all callers got the same journal id');
  });

  it('surfaces a conflict that never resolves rather than posting twice', async () => {
    const store = new InMemoryLedgerStore();
    store.addAccount(customerAccount(ALICE), 100_00n);
    store.addAccount(customerAccount(BOB), 0n);
    // A store that always claims a duplicate must never produce a second post.
    const original = store.runInTransaction.bind(store);
    store.runInTransaction = async <T>(fn: Parameters<typeof original>[0]): Promise<T> =>
      original(async (uow) => {
        const patched = {
          ...uow,
          insertJournal: async () => {
            throw new ConcurrencyConflictError('always conflicts');
          },
        };
        return fn(patched);
      }) as Promise<T>;

    const engine = new LedgerEngine(store);
    await assert.rejects(
      () => engine.post(transfer('never', 10_00n)),
      ConcurrencyConflictError,
    );
    assert.equal(store.journals.size, 0);
  });
});

describe('LedgerEngine — concurrency and double spend', () => {
  it('lets only one of two concurrent overlapping debits succeed', async () => {
    // Alice has 100.00. Two transfers of 60.00 race. Together they need 120.00.
    const f = await fixture(100_00n);
    const outcomes = await Promise.allSettled([
      f.engine.post(transfer('spend-a', 60_00n)),
      f.engine.post(transfer('spend-b', 60_00n)),
    ]);

    const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
    const rejected = outcomes.filter((o) => o.status === 'rejected');
    assert.equal(fulfilled.length, 1, 'exactly one transfer succeeded');
    assert.equal(rejected.length, 1, 'exactly one was refused');
    assert.ok(
      (rejected[0] as PromiseRejectedResult).reason instanceof InsufficientFundsError,
    );

    assert.equal(await balanceOf(f, ALICE), 40_00n);
    assert.equal(await balanceOf(f, BOB), 60_00n);
    assert.ok((await balanceOf(f, ALICE)) >= 0n, 'balance never went negative');
  });

  it('holds the line under heavy contention', async () => {
    // 20 concurrent transfers of 10.00 against a 100.00 balance.
    // Exactly 10 may succeed. Not 11, and never a negative balance.
    const f = await fixture(100_00n);
    const outcomes = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) => f.engine.post(transfer(`burst-${i}`, 10_00n))),
    );

    const succeeded = outcomes.filter((o) => o.status === 'fulfilled').length;
    assert.equal(succeeded, 10, `expected exactly 10 successes, got ${succeeded}`);
    assert.equal(await balanceOf(f, ALICE), 0n);
    assert.equal(await balanceOf(f, BOB), 100_00n);

    for (const outcome of outcomes) {
      if (outcome.status === 'rejected') {
        assert.ok(outcome.reason instanceof InsufficientFundsError);
      }
    }
  });

  it('does not deadlock when two transfers cross in opposite directions', async () => {
    // A→B and B→A at the same time. The engine sorts lock ids, so both
    // transactions take the same account in the same order. Without that, this
    // is a textbook deadlock and the test would hang.
    const f = await fixture(100_00n, 100_00n);
    const settled = await Promise.race([
      Promise.allSettled([
        f.engine.post(transfer('cross-1', 30_00n, ALICE, BOB)),
        f.engine.post(transfer('cross-2', 20_00n, BOB, ALICE)),
      ]),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('deadlock: locks were not ordered')), 2000),
      ),
    ]);

    assert.ok(Array.isArray(settled));
    assert.equal(await balanceOf(f, ALICE), 90_00n);
    assert.equal(await balanceOf(f, BOB), 110_00n);
  });

  it('conserves total value across a burst of concurrent transfers', async () => {
    const f = await fixture(500_00n, 500_00n);
    const before = (await balanceOf(f, ALICE)) + (await balanceOf(f, BOB));

    await Promise.allSettled([
      ...Array.from({ length: 15 }, (_, i) =>
        f.engine.post(transfer(`x-${i}`, 7_00n, ALICE, BOB)),
      ),
      ...Array.from({ length: 15 }, (_, i) =>
        f.engine.post(transfer(`y-${i}`, 11_00n, BOB, ALICE)),
      ),
    ]);

    const after = (await balanceOf(f, ALICE)) + (await balanceOf(f, BOB));
    assert.equal(after, before, 'no money was created or destroyed');
  });
});

describe('LedgerEngine — holds', () => {
  it('reduces available balance without touching the ledger balance', async () => {
    const f = await fixture(100_00n);
    await f.engine.placeHold({
      ledgerAccountId: ALICE,
      amount: Money.fromMinor(30_00n, SAR),
      reference: 'HOLD-1',
      idempotencyKey: 'h1',
    });

    const { snapshot } = await f.engine.getBalance(ALICE);
    assert.equal(ledgerBalance(snapshot).minor, 100_00n, 'nothing was posted');
    assert.equal(availableBalance(snapshot).minor, 70_00n, 'available dropped');
  });

  it('prevents spending funds that are already reserved', async () => {
    const f = await fixture(100_00n);
    await f.engine.placeHold({
      ledgerAccountId: ALICE,
      amount: Money.fromMinor(80_00n, SAR),
      reference: 'HOLD-2',
      idempotencyKey: 'h2',
    });
    await assert.rejects(
      () => f.engine.post(transfer('after-hold', 30_00n)),
      InsufficientFundsError,
      'held funds are not spendable',
    );
    await f.engine.post(transfer('within-hold', 20_00n));
    assert.equal(await balanceOf(f, ALICE), 80_00n);
  });

  it('releases a hold and restores available balance', async () => {
    const f = await fixture(100_00n);
    const { holdId } = await f.engine.placeHold({
      ledgerAccountId: ALICE,
      amount: Money.fromMinor(40_00n, SAR),
      reference: 'HOLD-3',
      idempotencyKey: 'h3',
    });
    await f.engine.releaseHold(holdId);
    const { snapshot } = await f.engine.getBalance(ALICE);
    assert.equal(availableBalance(snapshot).minor, 100_00n);
  });

  it('is safe to release the same hold twice', async () => {
    const f = await fixture(100_00n);
    const { holdId } = await f.engine.placeHold({
      ledgerAccountId: ALICE,
      amount: Money.fromMinor(40_00n, SAR),
      reference: 'HOLD-4',
      idempotencyKey: 'h4',
    });
    await f.engine.releaseHold(holdId);
    await f.engine.releaseHold(holdId);
    const { snapshot } = await f.engine.getBalance(ALICE);
    assert.equal(availableBalance(snapshot).minor, 100_00n, 'not credited twice');
  });

  it('captures a hold: the reservation becomes a posting in one step', async () => {
    const f = await fixture(100_00n);
    const { holdId } = await f.engine.placeHold({
      ledgerAccountId: ALICE,
      amount: Money.fromMinor(25_00n, SAR),
      reference: 'HOLD-5',
      idempotencyKey: 'h5',
    });
    await f.engine.captureHold(holdId, transfer('cap', 25_00n));

    const { snapshot } = await f.engine.getBalance(ALICE);
    assert.equal(ledgerBalance(snapshot).minor, 75_00n, 'posted');
    assert.equal(
      availableBalance(snapshot).minor,
      75_00n,
      'hold released, not double-counted',
    );
    assert.equal(await balanceOf(f, BOB), 25_00n);
  });

  it('replays a hold placed with the same idempotency key', async () => {
    const f = await fixture(100_00n);
    const a = await f.engine.placeHold({
      ledgerAccountId: ALICE,
      amount: Money.fromMinor(10_00n, SAR),
      reference: 'HOLD-6',
      idempotencyKey: 'h6',
    });
    const b = await f.engine.placeHold({
      ledgerAccountId: ALICE,
      amount: Money.fromMinor(10_00n, SAR),
      reference: 'HOLD-6',
      idempotencyKey: 'h6',
    });
    assert.equal(b.replayed, true);
    assert.equal(b.holdId, a.holdId);
    const { snapshot } = await f.engine.getBalance(ALICE);
    assert.equal(availableBalance(snapshot).minor, 90_00n, 'reserved once');
  });

  it('refuses a hold larger than the available balance', async () => {
    const f = await fixture(100_00n);
    await assert.rejects(
      () =>
        f.engine.placeHold({
          ledgerAccountId: ALICE,
          amount: Money.fromMinor(100_01n, SAR),
          reference: 'HOLD-7',
          idempotencyKey: 'h7',
        }),
      InsufficientFundsError,
    );
  });
});

describe('LedgerEngine — reversal, not mutation', () => {
  it('undoes a posting with a mirror journal and leaves the original intact', async () => {
    const f = await fixture(100_00n);
    const before = { journals: f.store.journals.size };
    const posted = await f.engine.post(transfer('rev-src', 40_00n));
    assert.equal(await balanceOf(f, ALICE), 60_00n);

    const entriesBefore = f.store.entries.filter((e) => e.journalId === posted.journalId);
    const snapshotBefore = entriesBefore.map((e) => `${e.direction}:${e.amountMinor}`);

    await f.engine.reverse({
      journalId: posted.journalId,
      reference: 'REF-rev',
      idempotencyKey: 'rev-1',
      reason: 'Customer disputed the transfer',
      createdBy: 'admin_test',
    });

    assert.equal(await balanceOf(f, ALICE), 100_00n, 'balance restored');
    assert.equal(await balanceOf(f, BOB), 0n);

    // The original journal and its entries are untouched.
    const entriesAfter = f.store.entries.filter((e) => e.journalId === posted.journalId);
    assert.deepEqual(
      entriesAfter.map((e) => `${e.direction}:${e.amountMinor}`),
      snapshotBefore,
      'original entries were not modified',
    );
    assert.equal(
      f.store.journals.size - before.journals,
      2,
      'original + correction, nothing edited',
    );

    const reversal = [...f.store.journals.values()].find(
      (j) => j.reversalOfJournalId === posted.journalId,
    );
    assert.ok(reversal, 'reversal points back at the original');
    assert.equal(reversal.createdBy, 'admin_test', 'reversal records who did it');
    assert.equal(reversal.metadata['reason'], 'Customer disputed the transfer');
  });

  it('exposes no mutation or deletion path at all', async () => {
    const engine = (await fixture()).engine;
    const surface = new Set([
      ...Object.getOwnPropertyNames(LedgerEngine.prototype),
      ...Object.keys(engine),
    ]);
    for (const name of surface) {
      assert.ok(
        !/^(update|edit|delete|remove|destroy|patch)/i.test(name),
        `engine must not expose a mutation method, found: ${name}`,
      );
    }
  });
});

describe('Ledger invariants hold after arbitrary activity', () => {
  it('keeps the trial balance and the balance cache correct', async () => {
    const f = await fixture(1_000_00n, 1_000_00n);

    // A deterministic but varied workload.
    const ops: Array<Promise<unknown>> = [];
    for (let i = 0; i < 25; i += 1) {
      const amount = BigInt((i % 7) + 1) * 3_00n;
      ops.push(
        f.engine.post(transfer(`mix-a-${i}`, amount, ALICE, BOB)).catch(() => undefined),
      );
      ops.push(
        f.engine.post(transfer(`mix-b-${i}`, amount, BOB, ALICE)).catch(() => undefined),
      );
    }
    await Promise.all(ops);

    // 1. Every journal balances.
    for (const journal of f.store.journals.values()) {
      const entries = f.store.entries.filter((e) => e.journalId === journal.id);
      const debit = entries
        .filter((e) => e.direction === 'DEBIT')
        .reduce((a, e) => a + e.amountMinor, 0n);
      const credit = entries
        .filter((e) => e.direction === 'CREDIT')
        .reduce((a, e) => a + e.amountMinor, 0n);
      assert.equal(debit, credit, `journal ${journal.reference} does not balance`);
      assert.ok(entries.length >= 2);
    }

    // 2. The system-wide trial balance holds.
    const trial = assertTrialBalance(
      f.store.entries.map((e) => ({
        ledgerAccountId: e.ledgerAccountId,
        direction: e.direction,
        amountMinor: e.amountMinor,
      })),
    );
    assert.ok(trial.balanced, 'total debits must equal total credits');

    // 3. The cached balance matches a from-scratch re-derivation.
    for (const id of [ALICE, BOB]) {
      const cached = f.store.balances.get(id);
      assert.ok(cached);
      const derived = deriveTotals(
        f.store.entries.map((e) => ({
          ledgerAccountId: e.ledgerAccountId,
          direction: e.direction,
          amountMinor: e.amountMinor,
        })),
        id,
      );
      assert.equal(
        cached.postedDebitMinor,
        derived.postedDebitMinor,
        `cached debit total drifted for ${id}`,
      );
      assert.equal(
        cached.postedCreditMinor,
        derived.postedCreditMinor,
        `cached credit total drifted for ${id}`,
      );
    }

    // 4. No customer account went negative.
    for (const id of [ALICE, BOB]) {
      assert.ok((await balanceOf(f, id)) >= 0n, `${id} went negative`);
    }

    // 5. Value is conserved.
    assert.equal((await balanceOf(f, ALICE)) + (await balanceOf(f, BOB)), 2_000_00n);
  });
});
