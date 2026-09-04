/**
 * Database package.
 *
 * The Prisma schema and the SQL migrations are the artifacts here. This module
 * exists to assert, at compile time, that the domain unions in `@nabd/shared`
 * and the enums in the database have not drifted apart.
 *
 * If someone adds a transaction status to the Prisma schema without adding it
 * to `@nabd/shared`, this file stops compiling. Without a check like this the
 * two drift silently, and the first symptom is a runtime cast failure on a
 * value the type system swore could not exist.
 */

import type {
  AccountStatus,
  AccountType,
  CardStatus,
  Direction,
  HoldStatus,
  KycStatus,
  LedgerAccountType,
  TransactionStatus,
  TransactionType,
} from '@nabd/shared';

/** Mirrors the PostgreSQL enums declared in migrations/0001_init.sql. */
const DB_ENUMS = {
  account_type: ['PERSONAL', 'BUSINESS', 'WALLET', 'SETTLEMENT', 'SUSPENSE'],
  account_status: ['PENDING', 'ACTIVE', 'FROZEN', 'CLOSED'],
  ledger_account_type: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'],
  entry_direction: ['DEBIT', 'CREDIT'],
  hold_status: ['ACTIVE', 'RELEASED', 'CAPTURED', 'EXPIRED'],
  transaction_type: [
    'TRANSFER',
    'PAYMENT',
    'TOPUP',
    'WITHDRAWAL',
    'FEE',
    'REFUND',
    'REVERSAL',
    'CARD_AUTHORIZATION',
    'CARD_SETTLEMENT',
    'ADJUSTMENT',
  ],
  transaction_status: [
    'INITIATED',
    'PENDING',
    'PROCESSING',
    'COMPLETED',
    'FAILED',
    'CANCELLED',
    'REVERSED',
  ],
  kyc_status: ['NOT_STARTED', 'PENDING', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'EXPIRED'],
  card_status: ['PENDING', 'ACTIVE', 'FROZEN', 'BLOCKED', 'EXPIRED', 'CANCELLED'],
} as const;

/** Fails to compile if a database enum value is missing from the shared union. */
type AssertAssignable<DbValue extends SharedUnion, SharedUnion> = DbValue;

type _AccountType = AssertAssignable<(typeof DB_ENUMS.account_type)[number], AccountType>;
type _AccountStatus = AssertAssignable<
  (typeof DB_ENUMS.account_status)[number],
  AccountStatus
>;
type _LedgerAccountType = AssertAssignable<
  (typeof DB_ENUMS.ledger_account_type)[number],
  LedgerAccountType
>;
type _Direction = AssertAssignable<(typeof DB_ENUMS.entry_direction)[number], Direction>;
type _HoldStatus = AssertAssignable<(typeof DB_ENUMS.hold_status)[number], HoldStatus>;
type _TransactionType = AssertAssignable<
  (typeof DB_ENUMS.transaction_type)[number],
  TransactionType
>;
type _TransactionStatus = AssertAssignable<
  (typeof DB_ENUMS.transaction_status)[number],
  TransactionStatus
>;
type _KycStatus = AssertAssignable<(typeof DB_ENUMS.kyc_status)[number], KycStatus>;
type _CardStatus = AssertAssignable<(typeof DB_ENUMS.card_status)[number], CardStatus>;

export const databaseEnums = DB_ENUMS;

/** Path to the migration directory, for tooling. */
export const MIGRATIONS_DIR = 'packages/database/migrations';
