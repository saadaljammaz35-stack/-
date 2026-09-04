/**
 * External financial system contracts.
 *
 * NABD holds no licence and moves no real money on its own. Every movement of
 * real value is delegated to a licensed institution or payment service provider
 * behind one of these interfaces.
 *
 * The rules that keep this boundary useful:
 *
 *   1. Nothing in the domain layer imports a vendor SDK. It imports these types.
 *   2. Every method takes an idempotency key. External calls get retried, by us
 *      and by the network; a retry must never create a second payment.
 *   3. No interface here invents an API for a real provider. Each ships with a
 *      Mock implementation. When a partner's specification arrives, a new
 *      adapter implements the same interface and the domain does not change.
 *   4. Credentials arrive via configuration, never as literals in source.
 */

import type { CurrencyCode, Money } from '@nabd/shared';

// ── shared shapes ───────────────────────────────────────────────────────────

export interface ProviderIdentity {
  /** Stable provider slug, e.g. "mock-psp". Written to every audit record. */
  readonly name: string;
  readonly environment: 'development' | 'staging' | 'production';
  /** False for mocks. Production startup refuses to boot if this is false. */
  readonly handlesRealValue: boolean;
}

export interface ProviderRequestContext {
  /** Ours, propagated to the provider so both sides can trace one operation. */
  readonly idempotencyKey: string;
  readonly reference: string;
  readonly requestId?: string;
  readonly timeoutMs?: number;
}

export type ProviderPaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REFUNDED';

export interface ProviderPayment {
  readonly providerPaymentId: string;
  readonly status: ProviderPaymentStatus;
  readonly amount: Money;
  readonly reference: string;
  readonly failureCode?: string;
  readonly failureMessage?: string;
  readonly createdAt: Date;
  readonly completedAt?: Date;
  /** Raw provider payload, retained for reconciliation and dispute handling. */
  readonly raw?: Readonly<Record<string, unknown>>;
}

// ── payment provider ────────────────────────────────────────────────────────

export interface CreatePaymentRequest extends ProviderRequestContext {
  readonly amount: Money;
  readonly description: string;
  readonly method: 'CARD' | 'QR' | 'BILL' | 'WALLET' | 'BANK_TRANSFER';
  readonly customerRef: string;
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface RefundRequest extends ProviderRequestContext {
  readonly providerPaymentId: string;
  /** Omit for a full refund. */
  readonly amount?: Money;
  readonly reason: string;
}

/**
 * A licensed payment service provider.
 *
 * `verifyWebhook` is part of the interface on purpose: signature verification is
 * provider-specific and is the only thing standing between an inbound webhook
 * and someone forging a "payment.completed" for free money.
 */
export interface PaymentProvider {
  readonly identity: ProviderIdentity;

  createPayment(request: CreatePaymentRequest): Promise<ProviderPayment>;
  getPaymentStatus(providerPaymentId: string): Promise<ProviderPayment>;
  refundPayment(request: RefundRequest): Promise<ProviderPayment>;
  cancelPayment(
    providerPaymentId: string,
    context: ProviderRequestContext,
  ): Promise<ProviderPayment>;

  /** Constant-time signature check over the raw body. Never parse before this. */
  verifyWebhook(rawBody: Buffer | string, headers: Record<string, string>): boolean;
}

// ── banking provider ────────────────────────────────────────────────────────

export interface ProviderAccount {
  readonly providerAccountId: string;
  readonly iban?: string;
  readonly accountNumber?: string;
  readonly currency: CurrencyCode;
  readonly status: 'PENDING' | 'ACTIVE' | 'FROZEN' | 'CLOSED';
}

export interface ProviderTransfer {
  readonly providerTransferId: string;
  readonly status: ProviderPaymentStatus;
  readonly amount: Money;
  readonly reference: string;
  readonly createdAt: Date;
  readonly settledAt?: Date;
}

export interface ProviderStatementLine {
  readonly providerEntryId: string;
  readonly amount: Money;
  readonly direction: 'CREDIT' | 'DEBIT';
  readonly description: string;
  readonly bookedAt: Date;
  readonly counterparty?: string;
}

/**
 * A licensed bank or Banking-as-a-Service partner.
 *
 * `getStatement` exists so NABD can reconcile its own ledger against the
 * partner's record of truth. A platform that cannot reconcile cannot detect
 * that it has lost money.
 */
export interface BankingProvider {
  readonly identity: ProviderIdentity;

  createAccount(
    request: ProviderRequestContext & {
      customerRef: string;
      currency: CurrencyCode;
    },
  ): Promise<ProviderAccount>;

  getAccount(providerAccountId: string): Promise<ProviderAccount>;
  getBalance(providerAccountId: string): Promise<Money>;

  initiateTransfer(
    request: ProviderRequestContext & {
      fromProviderAccountId: string;
      toIban?: string;
      toAccountNumber?: string;
      beneficiaryName: string;
      amount: Money;
      description: string;
    },
  ): Promise<ProviderTransfer>;

  getTransfer(providerTransferId: string): Promise<ProviderTransfer>;

  getStatement(request: {
    providerAccountId: string;
    from: Date;
    to: Date;
    cursor?: string;
  }): Promise<{ lines: readonly ProviderStatementLine[]; nextCursor?: string }>;
}

// ── card provider ───────────────────────────────────────────────────────────

export interface ProviderCard {
  readonly providerCardId: string;
  readonly status: 'PENDING' | 'ACTIVE' | 'FROZEN' | 'BLOCKED' | 'EXPIRED' | 'CANCELLED';
  readonly type: 'VIRTUAL' | 'PHYSICAL';
  readonly brand: string;
  /**
   * Last four digits only.
   *
   * The full PAN and the CVV never enter NABD's systems — not in a variable,
   * not in a log, not in the database. Card data is displayed to the customer
   * by the issuer's own SDK through a secure element, which is what keeps NABD
   * out of PCI-DSS scope for cardholder data storage.
   */
  readonly last4: string;
  readonly expiryMonth: number;
  readonly expiryYear: number;
}

export interface CardProvider {
  readonly identity: ProviderIdentity;

  issueCard(
    request: ProviderRequestContext & {
      customerRef: string;
      type: 'VIRTUAL' | 'PHYSICAL';
      currency: CurrencyCode;
    },
  ): Promise<ProviderCard>;

  getCard(providerCardId: string): Promise<ProviderCard>;
  freezeCard(
    providerCardId: string,
    context: ProviderRequestContext,
  ): Promise<ProviderCard>;
  unfreezeCard(
    providerCardId: string,
    context: ProviderRequestContext,
  ): Promise<ProviderCard>;
  terminateCard(
    providerCardId: string,
    context: ProviderRequestContext,
  ): Promise<ProviderCard>;

  setLimits(
    request: ProviderRequestContext & {
      providerCardId: string;
      dailyLimit?: Money;
      monthlyLimit?: Money;
    },
  ): Promise<ProviderCard>;

  verifyWebhook(rawBody: Buffer | string, headers: Record<string, string>): boolean;
}
