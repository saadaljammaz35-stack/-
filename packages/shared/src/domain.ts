/**
 * Shared domain vocabulary.
 *
 * These unions are the single source of truth for every enum that crosses a
 * package boundary. The Prisma schema mirrors them exactly, and
 * `packages/database` has a compile-time test that fails if the two drift.
 *
 * They are `as const` objects rather than TypeScript `enum`s: enums emit
 * runtime code that does not survive `isolatedModules` cleanly, and the union
 * type gives better exhaustiveness checking in switches.
 */

export const AccountType = {
  PERSONAL: 'PERSONAL',
  BUSINESS: 'BUSINESS',
  WALLET: 'WALLET',
  SETTLEMENT: 'SETTLEMENT',
  SUSPENSE: 'SUSPENSE',
} as const;
export type AccountType = (typeof AccountType)[keyof typeof AccountType];

export const AccountStatus = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  FROZEN: 'FROZEN',
  CLOSED: 'CLOSED',
} as const;
export type AccountStatus = (typeof AccountStatus)[keyof typeof AccountStatus];

/** Standard accounting classification. Decides which side increases a balance. */
export const LedgerAccountType = {
  ASSET: 'ASSET',
  LIABILITY: 'LIABILITY',
  EQUITY: 'EQUITY',
  REVENUE: 'REVENUE',
  EXPENSE: 'EXPENSE',
} as const;
export type LedgerAccountType = (typeof LedgerAccountType)[keyof typeof LedgerAccountType];

export const Direction = {
  DEBIT: 'DEBIT',
  CREDIT: 'CREDIT',
} as const;
export type Direction = (typeof Direction)[keyof typeof Direction];

export const TransactionType = {
  TRANSFER: 'TRANSFER',
  PAYMENT: 'PAYMENT',
  TOPUP: 'TOPUP',
  WITHDRAWAL: 'WITHDRAWAL',
  FEE: 'FEE',
  REFUND: 'REFUND',
  REVERSAL: 'REVERSAL',
  CARD_AUTHORIZATION: 'CARD_AUTHORIZATION',
  CARD_SETTLEMENT: 'CARD_SETTLEMENT',
  ADJUSTMENT: 'ADJUSTMENT',
} as const;
export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType];

export const TransactionStatus = {
  INITIATED: 'INITIATED',
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  REVERSED: 'REVERSED',
} as const;
export type TransactionStatus = (typeof TransactionStatus)[keyof typeof TransactionStatus];

export const TransactionCategory = {
  FOOD: 'FOOD',
  SHOPPING: 'SHOPPING',
  TRANSPORT: 'TRANSPORT',
  BILLS: 'BILLS',
  ENTERTAINMENT: 'ENTERTAINMENT',
  TRANSFER: 'TRANSFER',
  INCOME: 'INCOME',
  OTHER: 'OTHER',
} as const;
export type TransactionCategory =
  (typeof TransactionCategory)[keyof typeof TransactionCategory];

export const HoldStatus = {
  ACTIVE: 'ACTIVE',
  RELEASED: 'RELEASED',
  CAPTURED: 'CAPTURED',
  EXPIRED: 'EXPIRED',
} as const;
export type HoldStatus = (typeof HoldStatus)[keyof typeof HoldStatus];

export const KycStatus = {
  NOT_STARTED: 'NOT_STARTED',
  PENDING: 'PENDING',
  UNDER_REVIEW: 'UNDER_REVIEW',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
} as const;
export type KycStatus = (typeof KycStatus)[keyof typeof KycStatus];

export const CardStatus = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  FROZEN: 'FROZEN',
  BLOCKED: 'BLOCKED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;
export type CardStatus = (typeof CardStatus)[keyof typeof CardStatus];

export const BeneficiaryStatus = {
  PENDING: 'PENDING',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
  DISABLED: 'DISABLED',
} as const;
export type BeneficiaryStatus = (typeof BeneficiaryStatus)[keyof typeof BeneficiaryStatus];

export const RiskLevel = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;
export type RiskLevel = (typeof RiskLevel)[keyof typeof RiskLevel];

export const AdminRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  COMPLIANCE: 'COMPLIANCE',
  RISK: 'RISK',
  SUPPORT: 'SUPPORT',
  OPERATIONS: 'OPERATIONS',
  FINANCE: 'FINANCE',
  AUDITOR: 'AUDITOR',
} as const;
export type AdminRole = (typeof AdminRole)[keyof typeof AdminRole];

export const NotificationChannel = {
  PUSH: 'PUSH',
  SMS: 'SMS',
  EMAIL: 'EMAIL',
  IN_APP: 'IN_APP',
} as const;
export type NotificationChannel =
  (typeof NotificationChannel)[keyof typeof NotificationChannel];

export const TicketStatus = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  WAITING_CUSTOMER: 'WAITING_CUSTOMER',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
} as const;
export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

/**
 * Which side of an account increases its balance. An ASSET grows on the debit
 * side; a LIABILITY grows on the credit side. Customer balances are
 * liabilities of the platform — the money belongs to the customer, we owe it
 * to them — so a customer's balance increases on a CREDIT.
 */
export function normalBalanceOf(type: LedgerAccountType): Direction {
  switch (type) {
    case 'ASSET':
    case 'EXPENSE':
      return Direction.DEBIT;
    case 'LIABILITY':
    case 'EQUITY':
    case 'REVENUE':
      return Direction.CREDIT;
    default: {
      const exhaustive: never = type;
      throw new Error(`Unhandled ledger account type: ${String(exhaustive)}`);
    }
  }
}

export function oppositeDirection(direction: Direction): Direction {
  return direction === Direction.DEBIT ? Direction.CREDIT : Direction.DEBIT;
}
