import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { FixedClock, Money, ValidationError } from '@nabd/shared';

import { availableBalance, ledgerBalance } from './balance.js';
import {
  CardFlowService,
  TopUpService,
  isAuthorisationExpired,
  resolveSettlement,
} from './card-flows.js';
import { LedgerEngine } from './engine.js';
import type { LedgerAccountRecord } from './store.js';
import { InMemoryLedgerStore } from './testing/in-memory-store.js';

const SAR = 'SAR' as const;
const WALLET = 'la_wallet';
const SETTLEMENT = 'system:settlement:SAR';
const PAYABLE = 'system:payable:SAR';
const FEES = 'system:fees:SAR';

function sar(major: string): Money {
  return Money.fromMajor(major, SAR);
}

function systemAccount(
  id: string,
  type: LedgerAccountRecord['type'],
  normal: LedgerAccountRecord['normalBalance'],
): LedgerAccountRecord {
  return {
    id,
    code: id,
    type,
    normalBalance: normal,
    currency: SAR,
    isSystem: true,
    accountId: null,
    allowsNegativeBalance: true,
  };
}

interface Fixture {
  store: InMemoryLedgerStore;
  ledger: LedgerEngine;
  cards: CardFlowService;
  topUps: TopUpService;
}

/** Opening balance is established by a real top-up posting, never assigned. */
async function fixture(openingMajor = '1000.00'): Promise<Fixture> {
  const store = new InMemoryLedgerStore();
  store.addAccount({
    id: WALLET,
    code: `user:${WALLET}`,
    type: 'LIABILITY',
    normalBalance: 'CREDIT',
    currency: SAR,
    isSystem: false,
    accountId: WALLET,
    allowsNegativeBalance: false,
  });
  store.addAccount(systemAccount(SETTLEMENT, 'ASSET', 'DEBIT'));
  store.addAccount(systemAccount(PAYABLE, 'LIABILITY', 'CREDIT'));
  store.addAccount(systemAccount(FEES, 'REVENUE', 'CREDIT'));

  const clock = new FixedClock(1_756_000_000_000);
  const ledger = new LedgerEngine(store, clock);
  const topUps = new TopUpService(ledger);

  // Opening balance is a real posting; a zero opening simply posts nothing,
  // since a journal must move a non-zero amount.
  if (sar(openingMajor).isPositive) {
    await topUps.confirm({
      walletLedgerAccountId: WALLET,
      amount: sar(openingMajor),
      source: 'BANK_TRANSFER',
      providerPaymentId: 'seed-funding',
    });
  }

  return { store, ledger, cards: new CardFlowService(ledger, clock), topUps };
}

async function balances(f: Fixture): Promise<{ ledger: bigint; available: bigint }> {
  const { snapshot } = await f.ledger.getBalance(WALLET);
  return {
    ledger: ledgerBalance(snapshot).minor,
    available: availableBalance(snapshot).minor,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('Settlement resolution — the settled amount is often not the authorised one', () => {
  it('handles an exact settlement', () => {
    const r = resolveSettlement({
      authorisedAmount: sar('250.00'),
      settlementAmount: sar('250.00'),
    });
    assert.equal(r.outcome, 'EXACT');
    assert.equal(r.amountToPost.minor, 25_000n);
    assert.equal(r.releasedMinor, 0n);
    assert.equal(r.requiresReview, false);
  });

  it('releases the unused hold when the merchant settles for less', () => {
    // A fuel pump pre-authorises 300.00 but the customer buys 180.00. The
    // remaining 120.00 must go back to the customer's available balance —
    // leaving it held is how a customer ends up short with no explanation.
    const r = resolveSettlement({
      authorisedAmount: sar('300.00'),
      settlementAmount: sar('180.00'),
    });
    assert.equal(r.outcome, 'UNDER');
    assert.equal(r.amountToPost.minor, 18_000n);
    assert.equal(r.releasedMinor, 12_000n);
  });

  it('accepts a tip that pushes the settlement above the authorisation', () => {
    // 100.00 authorised, 115.00 settled — a 15% tip, inside the 20% tolerance.
    const r = resolveSettlement({
      authorisedAmount: sar('100.00'),
      settlementAmount: sar('115.00'),
    });
    assert.equal(r.outcome, 'OVER_WITHIN_TOLERANCE');
    assert.equal(r.amountToPost.minor, 11_500n);
    assert.equal(r.excessMinor, 1_500n);
    assert.equal(r.requiresReview, false);
  });

  it('accepts exactly the tolerance boundary', () => {
    const r = resolveSettlement({
      authorisedAmount: sar('100.00'),
      settlementAmount: sar('120.00'),
    });
    assert.equal(r.outcome, 'OVER_WITHIN_TOLERANCE');
  });

  it('flags a settlement far above the authorisation, but still posts it', () => {
    // The scheme obliges the issuer to honour it, so refusing is not an
    // option — but a merchant settling 5x its authorisations is either broken
    // or defrauding, and operations must see it.
    const r = resolveSettlement({
      authorisedAmount: sar('100.00'),
      settlementAmount: sar('500.00'),
    });
    assert.equal(r.outcome, 'OVER_EXCEEDS_TOLERANCE');
    assert.equal(r.amountToPost.minor, 50_000n, 'still posted');
    assert.equal(r.requiresReview, true, 'and flagged');
  });

  it('respects a custom tolerance', () => {
    const strict = resolveSettlement({
      authorisedAmount: sar('100.00'),
      settlementAmount: sar('110.00'),
      tolerancePercent: 5n,
    });
    assert.equal(strict.outcome, 'OVER_EXCEEDS_TOLERANCE');
  });

  it('rejects a currency mismatch and a non-positive settlement', () => {
    assert.throws(
      () =>
        resolveSettlement({
          authorisedAmount: sar('100.00'),
          settlementAmount: Money.fromMajor('100.00', 'USD'),
        }),
      ValidationError,
    );
    assert.throws(
      () =>
        resolveSettlement({
          authorisedAmount: sar('100.00'),
          settlementAmount: Money.fromMinor(0n, SAR),
        }),
      ValidationError,
    );
  });
});

describe('Card authorisation — reserves, does not post', () => {
  let f: Fixture;
  beforeEach(async () => {
    f = await fixture('1000.00');
  });

  it('drops available balance while leaving the ledger untouched', async () => {
    const result = await f.cards.authorise({
      walletLedgerAccountId: WALLET,
      amount: sar('250.00'),
      providerAuthorisationId: 'auth-1',
      cardId: 'card-1',
      merchantName: 'Test Merchant',
      expiresAt: new Date(Date.now() + 7 * 86_400_000),
    });

    assert.equal(result.approved, true);
    const b = await balances(f);
    assert.equal(b.ledger, 100_000n, 'nothing has been posted — no money has moved yet');
    assert.equal(b.available, 75_000n, 'but the funds are reserved');
  });

  it('declines rather than throwing when funds are short', async () => {
    // A decline is an ordinary outcome. Modelling it as an exception would push
    // routine control flow through a catch block.
    const result = await f.cards.authorise({
      walletLedgerAccountId: WALLET,
      amount: sar('1000.01'),
      providerAuthorisationId: 'auth-decline',
      cardId: 'card-1',
      merchantName: 'Too Expensive',
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    assert.equal(result.approved, false);
    if (!result.approved) {
      assert.equal(result.declineCode, 'INSUFFICIENT_FUNDS');
    }
    assert.equal((await balances(f)).available, 100_000n, 'nothing was reserved');
  });

  it('does not reserve twice when the issuer redelivers an authorisation', async () => {
    const first = await f.cards.authorise({
      walletLedgerAccountId: WALLET,
      amount: sar('250.00'),
      providerAuthorisationId: 'auth-dup',
      cardId: 'card-1',
      merchantName: 'Test',
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    const second = await f.cards.authorise({
      walletLedgerAccountId: WALLET,
      amount: sar('250.00'),
      providerAuthorisationId: 'auth-dup',
      cardId: 'card-1',
      merchantName: 'Test',
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    assert.equal(first.approved && second.approved, true);
    if (first.approved && second.approved) {
      assert.equal(second.holdId, first.holdId);
      assert.equal(second.replayed, true);
    }
    assert.equal((await balances(f)).available, 75_000n, 'reserved once, not twice');
  });

  it('prevents the same funds being authorised twice over', async () => {
    await f.cards.authorise({
      walletLedgerAccountId: WALLET,
      amount: sar('800.00'),
      providerAuthorisationId: 'auth-a',
      cardId: 'card-1',
      merchantName: 'First',
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    const second = await f.cards.authorise({
      walletLedgerAccountId: WALLET,
      amount: sar('800.00'),
      providerAuthorisationId: 'auth-b',
      cardId: 'card-1',
      merchantName: 'Second',
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    assert.equal(second.approved, false, 'held funds are not available to authorise again');
  });
});

describe('Card settlement — the hold becomes a posting', () => {
  let f: Fixture;
  beforeEach(async () => {
    f = await fixture('1000.00');
  });

  async function authorise(id: string, major: string): Promise<string> {
    const result = await f.cards.authorise({
      walletLedgerAccountId: WALLET,
      amount: sar(major),
      providerAuthorisationId: id,
      cardId: 'card-1',
      merchantName: 'Merchant',
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    assert.ok(result.approved);
    return result.approved ? result.holdId : '';
  }

  it('posts the purchase and clears the hold in one step', async () => {
    const holdId = await authorise('auth-s1', '250.00');
    await f.cards.settle({
      holdId,
      authorisedAmount: sar('250.00'),
      settlementAmount: sar('250.00'),
      providerSettlementId: 'stl-1',
      walletLedgerAccountId: WALLET,
      merchantName: 'Merchant',
    });

    const b = await balances(f);
    assert.equal(b.ledger, 75_000n, 'posted');
    assert.equal(b.available, 75_000n, 'hold cleared, not double-counted');
  });

  it('returns the difference when the merchant settles for less', async () => {
    const holdId = await authorise('auth-s2', '300.00');
    const result = await f.cards.settle({
      holdId,
      authorisedAmount: sar('300.00'),
      settlementAmount: sar('180.00'),
      providerSettlementId: 'stl-2',
      walletLedgerAccountId: WALLET,
      merchantName: 'Fuel',
    });

    assert.equal(result.resolution.outcome, 'UNDER');
    const b = await balances(f);
    assert.equal(b.ledger, 82_000n, 'only what was spent is posted');
    assert.equal(b.available, 82_000n, 'the unused 120.00 came back');
  });

  it('posts the higher amount when a tip is added', async () => {
    const holdId = await authorise('auth-s3', '100.00');
    await f.cards.settle({
      holdId,
      authorisedAmount: sar('100.00'),
      settlementAmount: sar('115.00'),
      providerSettlementId: 'stl-3',
      walletLedgerAccountId: WALLET,
      merchantName: 'Restaurant',
    });

    const b = await balances(f);
    assert.equal(b.ledger, 88_500n, 'the tip is included in the posting');
  });

  it('does not post twice when the settlement file is redelivered', async () => {
    const holdId = await authorise('auth-s4', '250.00');
    const args = {
      holdId,
      authorisedAmount: sar('250.00'),
      settlementAmount: sar('250.00'),
      providerSettlementId: 'stl-dup',
      walletLedgerAccountId: WALLET,
      merchantName: 'Merchant',
    };
    const first = await f.cards.settle(args);
    const second = await f.cards.settle(args);

    assert.equal(second.journalId, first.journalId);
    assert.equal(second.replayed, true);
    assert.equal((await balances(f)).ledger, 75_000n, 'charged once');
  });

  it('books the amount as payable to the scheme, not as revenue', async () => {
    const holdId = await authorise('auth-s5', '250.00');
    await f.cards.settle({
      holdId,
      authorisedAmount: sar('250.00'),
      settlementAmount: sar('250.00'),
      providerSettlementId: 'stl-5',
      walletLedgerAccountId: WALLET,
      merchantName: 'Merchant',
    });

    const payable = await f.ledger.getBalance(PAYABLE);
    assert.equal(payable.ledger.minor, 25_000n, 'we owe the scheme until settlement');
    const fees = await f.ledger.getBalance(FEES);
    assert.equal(fees.ledger.minor, 0n, "a customer's purchase is not our income");
  });
});

describe('Authorisations that never settle', () => {
  it('returns the money when the merchant reverses', async () => {
    const f = await fixture('1000.00');
    const auth = await f.cards.authorise({
      walletLedgerAccountId: WALLET,
      amount: sar('250.00'),
      providerAuthorisationId: 'auth-rev',
      cardId: 'card-1',
      merchantName: 'Cancelled',
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    assert.ok(auth.approved);
    if (!auth.approved) return;

    await f.cards.reverseAuthorisation(auth.holdId);
    const b = await balances(f);
    assert.equal(b.available, 100_000n, 'fully returned');
    assert.equal(b.ledger, 100_000n, 'and nothing was ever posted');
  });

  it('releases a stale authorisation so funds are not reserved forever', async () => {
    // Without expiry, an authorisation the merchant never settles would reserve
    // the customer's money indefinitely, with no explanation and no end date.
    const f = await fixture('1000.00');
    const auth = await f.cards.authorise({
      walletLedgerAccountId: WALLET,
      amount: sar('400.00'),
      providerAuthorisationId: 'auth-exp',
      cardId: 'card-1',
      merchantName: 'Abandoned',
      expiresAt: new Date(Date.now() - 1_000),
    });
    assert.ok(auth.approved);
    if (!auth.approved) return;

    assert.equal((await balances(f)).available, 60_000n);
    await f.cards.expireAuthorisation(auth.holdId);
    assert.equal((await balances(f)).available, 100_000n, 'funds released');
  });

  it('is safe to release the same authorisation twice', async () => {
    const f = await fixture('1000.00');
    const auth = await f.cards.authorise({
      walletLedgerAccountId: WALLET,
      amount: sar('300.00'),
      providerAuthorisationId: 'auth-dbl',
      cardId: 'card-1',
      merchantName: 'Test',
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    assert.ok(auth.approved);
    if (!auth.approved) return;

    await f.cards.reverseAuthorisation(auth.holdId);
    await f.cards.reverseAuthorisation(auth.holdId);
    assert.equal((await balances(f)).available, 100_000n, 'not credited twice');
  });

  it('detects expiry', () => {
    const now = new Date('2026-09-04T00:00:00Z');
    assert.equal(isAuthorisationExpired(new Date('2026-09-03T00:00:00Z'), now), true);
    assert.equal(isAuthorisationExpired(new Date('2026-09-05T00:00:00Z'), now), false);
    assert.equal(isAuthorisationExpired(null, now), false);
  });
});

describe('Refunds', () => {
  it('adds a new posting rather than erasing the purchase', async () => {
    const f = await fixture('1000.00');
    const auth = await f.cards.authorise({
      walletLedgerAccountId: WALLET,
      amount: sar('250.00'),
      providerAuthorisationId: 'auth-r',
      cardId: 'card-1',
      merchantName: 'Shop',
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    assert.ok(auth.approved);
    if (!auth.approved) return;

    const settled = await f.cards.settle({
      holdId: auth.holdId,
      authorisedAmount: sar('250.00'),
      settlementAmount: sar('250.00'),
      providerSettlementId: 'stl-r',
      walletLedgerAccountId: WALLET,
      merchantName: 'Shop',
    });
    assert.equal((await balances(f)).ledger, 75_000n);

    await f.cards.refund({
      walletLedgerAccountId: WALLET,
      amount: sar('250.00'),
      providerRefundId: 'rfnd-1',
      merchantName: 'Shop',
      originalReference: 'CARD-STL-stl-r',
    });

    assert.equal((await balances(f)).ledger, 100_000n, 'customer made whole');

    // The purchase is still on the ledger. A customer who sees a purchase
    // vanish rather than be refunded cannot reconcile their own records.
    const purchase = f.store.journals.get(settled.journalId);
    assert.ok(purchase, 'the original purchase journal still exists');
    assert.equal(
      purchase.reversalOfJournalId,
      null,
      'a refund is a new posting, not a reversal',
    );
  });

  it('does not refund twice on a redelivered refund event', async () => {
    const f = await fixture('1000.00');
    const args = {
      walletLedgerAccountId: WALLET,
      amount: sar('100.00'),
      providerRefundId: 'rfnd-dup',
      merchantName: 'Shop',
      originalReference: 'CARD-STL-x',
    };
    await f.cards.refund(args);
    const second = await f.cards.refund(args);
    assert.equal(second.replayed, true);
    assert.equal((await balances(f)).ledger, 110_000n, 'credited once');
  });
});

describe('Wallet top-up — post only on confirmed receipt', () => {
  it('credits the wallet and the settlement asset together', async () => {
    const f = await fixture('0.00');
    await f.topUps.confirm({
      walletLedgerAccountId: WALLET,
      amount: sar('500.00'),
      source: 'CARD',
      providerPaymentId: 'pay-1',
    });

    assert.equal((await balances(f)).ledger, 50_000n);
    const settlement = await f.ledger.getBalance(SETTLEMENT);
    assert.equal(
      settlement.ledger.minor,
      50_000n,
      'the liability to the customer is matched by the asset held for them',
    );
  });

  it('exposes no method that credits a wallet on intent alone', () => {
    // Crediting before the provider confirms is free money: the customer can
    // spend funds that may never arrive.
    const surface = Object.getOwnPropertyNames(TopUpService.prototype);
    for (const name of surface) {
      assert.ok(
        !/^(initiate|start|begin|request|pending)/i.test(name),
        `TopUpService must not expose an intent-time credit path, found: ${name}`,
      );
    }
    assert.ok(surface.includes('confirm'));
  });

  it('credits once when the provider redelivers the webhook', async () => {
    const f = await fixture('0.00');
    const args = {
      walletLedgerAccountId: WALLET,
      amount: sar('500.00'),
      source: 'CARD' as const,
      providerPaymentId: 'pay-dup',
    };
    await f.topUps.confirm(args);
    const second = await f.topUps.confirm(args);

    assert.equal(second.replayed, true);
    assert.equal((await balances(f)).ledger, 50_000n, 'credited once, not twice');
  });

  it('charges a top-up fee to the customer and books it as revenue', async () => {
    const f = await fixture('0.00');
    await f.topUps.confirm({
      walletLedgerAccountId: WALLET,
      amount: sar('500.00'),
      source: 'CARD',
      providerPaymentId: 'pay-fee',
      fee: sar('5.00'),
    });

    assert.equal((await balances(f)).ledger, 49_500n, 'customer receives amount minus fee');
    const fees = await f.ledger.getBalance(FEES);
    assert.equal(fees.ledger.minor, 500n);
  });

  it('reverses a charged-back top-up rather than posting a fresh debit', async () => {
    const f = await fixture('0.00');
    const posted = await f.topUps.confirm({
      walletLedgerAccountId: WALLET,
      amount: sar('500.00'),
      source: 'CARD',
      providerPaymentId: 'pay-cb',
    });
    assert.equal((await balances(f)).ledger, 50_000n);

    await f.topUps.reverseFailedTopUp({
      journalId: posted.journalId,
      providerEventId: 'cb-1',
      reason: 'Funding chargeback from provider',
      operatorId: 'ops_1',
    });

    assert.equal((await balances(f)).ledger, 0n, 'the credit is undone');

    // The credit should never have existed, and the audit trail must say so.
    const reversal = [...f.store.journals.values()].find(
      (j) => j.reversalOfJournalId === posted.journalId,
    );
    assert.ok(reversal, 'a reversal journal points back at the original');
    assert.equal(reversal.createdBy, 'ops_1');
  });

  it('keeps the books balanced across a full card lifecycle', async () => {
    const f = await fixture('0.00');

    await f.topUps.confirm({
      walletLedgerAccountId: WALLET,
      amount: sar('1000.00'),
      source: 'BANK_TRANSFER',
      providerPaymentId: 'lc-fund',
    });
    const auth = await f.cards.authorise({
      walletLedgerAccountId: WALLET,
      amount: sar('300.00'),
      providerAuthorisationId: 'lc-auth',
      cardId: 'card-1',
      merchantName: 'Store',
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    assert.ok(auth.approved);
    if (!auth.approved) return;

    await f.cards.settle({
      holdId: auth.holdId,
      authorisedAmount: sar('300.00'),
      settlementAmount: sar('275.50'),
      providerSettlementId: 'lc-stl',
      walletLedgerAccountId: WALLET,
      merchantName: 'Store',
    });
    await f.cards.refund({
      walletLedgerAccountId: WALLET,
      amount: sar('75.50'),
      providerRefundId: 'lc-rfnd',
      merchantName: 'Store',
      originalReference: 'CARD-STL-lc-stl',
    });

    const b = await balances(f);
    assert.equal(b.ledger, 80_000n, '1000.00 − 275.50 + 75.50');
    assert.equal(b.available, 80_000n, 'no hold left dangling');

    // Every journal balances, and the whole book nets to zero.
    let debits = 0n;
    let credits = 0n;
    for (const entry of f.store.entries) {
      if (entry.direction === 'DEBIT') debits += entry.amountMinor;
      else credits += entry.amountMinor;
    }
    assert.equal(debits, credits, 'total debits must equal total credits');
  });
});
