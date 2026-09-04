/**
 * Mock providers.
 *
 * These move NO real money. They exist so the whole platform — transfers,
 * payments, cards, webhooks, reconciliation — can be built and tested end to
 * end before a partner contract exists, and so integration tests have a
 * deterministic counterparty.
 *
 * `identity.handlesRealValue` is `false` on every mock here, and the API's
 * production bootstrap refuses to start if a provider reports false while the
 * environment is `production`. That check is what stops a misconfigured deploy
 * from silently accepting customer payments into a simulator.
 */

import {
  Money,
  NotFoundError,
  ProviderError,
  type CurrencyCode,
  type Clock,
  systemClock,
  uuidv7,
} from '@nabd/shared';
import { createHmac, timingSafeEqual } from 'node:crypto';

import type {
  BankingProvider,
  CardProvider,
  CreatePaymentRequest,
  PaymentProvider,
  ProviderAccount,
  ProviderCard,
  ProviderIdentity,
  ProviderPayment,
  ProviderRequestContext,
  ProviderStatementLine,
  ProviderTransfer,
  RefundRequest,
} from '../contracts.js';

const MOCK_IDENTITY: ProviderIdentity = {
  name: 'mock',
  environment: 'development',
  // The flag that keeps a simulator out of production.
  handlesRealValue: false,
};

export interface MockBehaviour {
  /** Force the next N calls to fail, to exercise retry and circuit-breaker paths. */
  failNextCalls?: number;
  /** Artificial latency. */
  latencyMs?: number;
  /** Payments settle immediately rather than staying PENDING. */
  autoComplete?: boolean;
}

export class MockPaymentProvider implements PaymentProvider {
  readonly identity: ProviderIdentity = { ...MOCK_IDENTITY, name: 'mock-psp' };

  private readonly payments = new Map<string, ProviderPayment>();
  /** Maps our idempotency key to the payment it created. */
  private readonly byIdempotencyKey = new Map<string, string>();
  private failuresRemaining = 0;

  constructor(
    private readonly webhookSecret: string = 'mock-webhook-secret-do-not-use-in-production',
    private readonly behaviour: MockBehaviour = { autoComplete: true },
    private readonly clock: Clock = systemClock,
  ) {
    this.failuresRemaining = behaviour.failNextCalls ?? 0;
  }

  async createPayment(request: CreatePaymentRequest): Promise<ProviderPayment> {
    await this.simulate();

    // A real provider honours the idempotency key; the mock must too, or it
    // would hide double-charge bugs instead of exposing them.
    const seen = this.byIdempotencyKey.get(request.idempotencyKey);
    if (seen !== undefined) {
      return this.payments.get(seen) as ProviderPayment;
    }

    const id = `pay_${uuidv7(this.clock.nowMs())}`;
    const payment: ProviderPayment = {
      providerPaymentId: id,
      status: this.behaviour.autoComplete === false ? 'PENDING' : 'COMPLETED',
      amount: request.amount,
      reference: request.reference,
      createdAt: this.clock.now(),
      ...(this.behaviour.autoComplete === false ? {} : { completedAt: this.clock.now() }),
    };

    this.payments.set(id, payment);
    this.byIdempotencyKey.set(request.idempotencyKey, id);
    return payment;
  }

  async getPaymentStatus(providerPaymentId: string): Promise<ProviderPayment> {
    await this.simulate();
    const payment = this.payments.get(providerPaymentId);
    if (payment === undefined)
      throw new NotFoundError('Provider payment', providerPaymentId);
    return payment;
  }

  async refundPayment(request: RefundRequest): Promise<ProviderPayment> {
    await this.simulate();
    const original = this.payments.get(request.providerPaymentId);
    if (original === undefined) {
      throw new NotFoundError('Provider payment', request.providerPaymentId);
    }
    if (original.status !== 'COMPLETED') {
      throw new ProviderError(
        this.identity.name,
        'Only completed payments can be refunded',
        false,
      );
    }
    const refunded: ProviderPayment = { ...original, status: 'REFUNDED' };
    this.payments.set(original.providerPaymentId, refunded);
    return refunded;
  }

  async cancelPayment(
    providerPaymentId: string,
    _context: ProviderRequestContext,
  ): Promise<ProviderPayment> {
    await this.simulate();
    const payment = this.payments.get(providerPaymentId);
    if (payment === undefined)
      throw new NotFoundError('Provider payment', providerPaymentId);
    if (payment.status === 'COMPLETED') {
      throw new ProviderError(
        this.identity.name,
        'Completed payments cannot be cancelled',
        false,
      );
    }
    const cancelled: ProviderPayment = { ...payment, status: 'CANCELLED' };
    this.payments.set(providerPaymentId, cancelled);
    return cancelled;
  }

  /**
   * HMAC-SHA256 over the raw body, compared in constant time.
   *
   * The body must be the *raw* bytes, before JSON parsing: re-serialising a
   * parsed object changes key order and whitespace, and the signature no longer
   * matches. Every real integration has this same requirement.
   */
  verifyWebhook(rawBody: Buffer | string, headers: Record<string, string>): boolean {
    const provided = headers['x-nabd-signature'] ?? headers['X-NABD-Signature'];
    if (provided === undefined) return false;

    const expected = createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    const a = Buffer.from(provided, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  /** Test helper: sign a body the way the provider would. */
  signWebhook(rawBody: Buffer | string): string {
    return createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
  }

  /** Test helper: drive a pending payment to a terminal state. */
  settle(providerPaymentId: string, status: 'COMPLETED' | 'FAILED'): void {
    const payment = this.payments.get(providerPaymentId);
    if (payment === undefined) return;
    this.payments.set(providerPaymentId, {
      ...payment,
      status,
      ...(status === 'COMPLETED' ? { completedAt: this.clock.now() } : {}),
    });
  }

  private async simulate(): Promise<void> {
    if (this.behaviour.latencyMs !== undefined && this.behaviour.latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.behaviour.latencyMs));
    }
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1;
      throw new ProviderError(this.identity.name, 'Simulated provider failure', true);
    }
  }
}

export class MockBankingProvider implements BankingProvider {
  readonly identity: ProviderIdentity = { ...MOCK_IDENTITY, name: 'mock-bank' };

  private readonly accounts = new Map<string, ProviderAccount>();
  private readonly balances = new Map<string, bigint>();
  private readonly transfers = new Map<string, ProviderTransfer>();
  private readonly byIdempotencyKey = new Map<string, string>();
  private readonly statements = new Map<string, ProviderStatementLine[]>();

  constructor(private readonly clock: Clock = systemClock) {}

  async createAccount(
    request: ProviderRequestContext & { customerRef: string; currency: CurrencyCode },
  ): Promise<ProviderAccount> {
    const existing = this.byIdempotencyKey.get(request.idempotencyKey);
    if (existing !== undefined) return this.accounts.get(existing) as ProviderAccount;

    const id = `acct_${uuidv7(this.clock.nowMs())}`;
    const account: ProviderAccount = {
      providerAccountId: id,
      // Shaped like an IBAN but issued by nothing. Not a real bank account.
      iban: `SA${String(Math.floor(Math.random() * 90) + 10)}MOCK${id.slice(-14).toUpperCase()}`,
      currency: request.currency,
      status: 'ACTIVE',
    };
    this.accounts.set(id, account);
    this.balances.set(id, 0n);
    this.statements.set(id, []);
    this.byIdempotencyKey.set(request.idempotencyKey, id);
    return account;
  }

  async getAccount(providerAccountId: string): Promise<ProviderAccount> {
    const account = this.accounts.get(providerAccountId);
    if (account === undefined)
      throw new NotFoundError('Provider account', providerAccountId);
    return account;
  }

  async getBalance(providerAccountId: string): Promise<Money> {
    const account = await this.getAccount(providerAccountId);
    return Money.fromMinor(this.balances.get(providerAccountId) ?? 0n, account.currency);
  }

  async initiateTransfer(
    request: ProviderRequestContext & {
      fromProviderAccountId: string;
      toIban?: string;
      toAccountNumber?: string;
      beneficiaryName: string;
      amount: Money;
      description: string;
    },
  ): Promise<ProviderTransfer> {
    const existing = this.byIdempotencyKey.get(request.idempotencyKey);
    if (existing !== undefined) return this.transfers.get(existing) as ProviderTransfer;

    await this.getAccount(request.fromProviderAccountId);
    const id = `tr_${uuidv7(this.clock.nowMs())}`;
    const transfer: ProviderTransfer = {
      providerTransferId: id,
      status: 'PROCESSING',
      amount: request.amount,
      reference: request.reference,
      createdAt: this.clock.now(),
    };
    this.transfers.set(id, transfer);
    this.byIdempotencyKey.set(request.idempotencyKey, id);
    return transfer;
  }

  async getTransfer(providerTransferId: string): Promise<ProviderTransfer> {
    const transfer = this.transfers.get(providerTransferId);
    if (transfer === undefined)
      throw new NotFoundError('Provider transfer', providerTransferId);
    return transfer;
  }

  async getStatement(request: {
    providerAccountId: string;
    from: Date;
    to: Date;
    cursor?: string;
  }): Promise<{ lines: readonly ProviderStatementLine[]; nextCursor?: string }> {
    const all = this.statements.get(request.providerAccountId) ?? [];
    return {
      lines: all.filter((l) => l.bookedAt >= request.from && l.bookedAt <= request.to),
    };
  }

  /** Test helper: credit a mock account and record a statement line. */
  creditForTesting(providerAccountId: string, amount: Money, description: string): void {
    this.balances.set(
      providerAccountId,
      (this.balances.get(providerAccountId) ?? 0n) + amount.minor,
    );
    this.statements.get(providerAccountId)?.push({
      providerEntryId: `line_${uuidv7(this.clock.nowMs())}`,
      amount,
      direction: 'CREDIT',
      description,
      bookedAt: this.clock.now(),
    });
  }
}

export class MockCardProvider implements CardProvider {
  readonly identity: ProviderIdentity = { ...MOCK_IDENTITY, name: 'mock-issuer' };

  private readonly cards = new Map<string, ProviderCard>();
  private readonly byIdempotencyKey = new Map<string, string>();

  constructor(
    private readonly webhookSecret = 'mock-card-webhook-secret',
    private readonly clock: Clock = systemClock,
  ) {}

  async issueCard(
    request: ProviderRequestContext & {
      customerRef: string;
      type: 'VIRTUAL' | 'PHYSICAL';
      currency: CurrencyCode;
    },
  ): Promise<ProviderCard> {
    const existing = this.byIdempotencyKey.get(request.idempotencyKey);
    if (existing !== undefined) return this.cards.get(existing) as ProviderCard;

    const id = `card_${uuidv7(this.clock.nowMs())}`;
    const now = this.clock.now();
    const card: ProviderCard = {
      providerCardId: id,
      status: request.type === 'VIRTUAL' ? 'ACTIVE' : 'PENDING',
      type: request.type,
      brand: 'MOCK',
      // Only ever the last four. No PAN is generated, because NABD must never
      // hold one — not even a fake one, so no code path learns to expect it.
      last4: String(Math.floor(Math.random() * 9000) + 1000),
      expiryMonth: now.getUTCMonth() + 1,
      expiryYear: now.getUTCFullYear() + 4,
    };
    this.cards.set(id, card);
    this.byIdempotencyKey.set(request.idempotencyKey, id);
    return card;
  }

  async getCard(providerCardId: string): Promise<ProviderCard> {
    const card = this.cards.get(providerCardId);
    if (card === undefined) throw new NotFoundError('Provider card', providerCardId);
    return card;
  }

  async freezeCard(providerCardId: string): Promise<ProviderCard> {
    return this.setStatus(providerCardId, 'FROZEN');
  }

  async unfreezeCard(providerCardId: string): Promise<ProviderCard> {
    const card = await this.getCard(providerCardId);
    if (card.status === 'BLOCKED' || card.status === 'CANCELLED') {
      throw new ProviderError(
        this.identity.name,
        `Cannot unfreeze a ${card.status} card`,
        false,
      );
    }
    return this.setStatus(providerCardId, 'ACTIVE');
  }

  async terminateCard(providerCardId: string): Promise<ProviderCard> {
    return this.setStatus(providerCardId, 'CANCELLED');
  }

  async setLimits(
    request: ProviderRequestContext & {
      providerCardId: string;
      dailyLimit?: Money;
      monthlyLimit?: Money;
    },
  ): Promise<ProviderCard> {
    return this.getCard(request.providerCardId);
  }

  verifyWebhook(rawBody: Buffer | string, headers: Record<string, string>): boolean {
    const provided = headers['x-nabd-signature'];
    if (provided === undefined) return false;
    const expected = createHmac('sha256', this.webhookSecret).update(rawBody).digest('hex');
    const a = Buffer.from(provided, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private async setStatus(
    id: string,
    status: ProviderCard['status'],
  ): Promise<ProviderCard> {
    const card = await this.getCard(id);
    const updated: ProviderCard = { ...card, status };
    this.cards.set(id, updated);
    return updated;
  }
}
