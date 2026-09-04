/**
 * NABD's chart of accounts.
 *
 * Customer money is a LIABILITY of the platform: the balance a customer sees is
 * money NABD owes them, not money NABD owns. Getting this the wrong way round
 * is the classic fintech ledger bug — it makes every customer deposit look like
 * platform revenue.
 */

import type { CurrencyCode, LedgerAccountType } from '@nabd/shared';

/** Code for the liability account backing a customer's product account. */
export function userAccountCode(accountId: string): string {
  return `user:${accountId}`;
}

/**
 * System accounts. One per currency — a journal never mixes currencies, so
 * settlement in SAR and settlement in USD are separate accounts.
 */
export const SystemAccounts = {
  /** Funds we hold at the partner bank / PSP. Grows when customers fund. */
  settlement: (currency: CurrencyCode): string => `system:settlement:${currency}`,
  /** Money that arrived but is not yet attributable to a customer. */
  suspense: (currency: CurrencyCode): string => `system:suspense:${currency}`,
  /** Fee income. */
  fees: (currency: CurrencyCode): string => `system:fees:${currency}`,
  /** FX spread income. */
  fx: (currency: CurrencyCode): string => `system:fx:${currency}`,
  /** Amounts owed to external parties, pending settlement. */
  payable: (currency: CurrencyCode): string => `system:payable:${currency}`,
  /** Losses we absorb: chargebacks, fraud write-offs. */
  writeoff: (currency: CurrencyCode): string => `system:writeoff:${currency}`,
} as const;

export interface SystemAccountSpec {
  readonly code: string;
  readonly type: LedgerAccountType;
  readonly description: string;
}

/** Every system account that must exist before the platform can post anything. */
export function systemAccountSpecs(currency: CurrencyCode): SystemAccountSpec[] {
  return [
    {
      code: SystemAccounts.settlement(currency),
      type: 'ASSET',
      description: `Funds held at partner institution (${currency})`,
    },
    {
      code: SystemAccounts.suspense(currency),
      type: 'ASSET',
      description: `Unattributed / in-flight funds (${currency})`,
    },
    {
      code: SystemAccounts.fees(currency),
      type: 'REVENUE',
      description: `Fee income (${currency})`,
    },
    {
      code: SystemAccounts.fx(currency),
      type: 'REVENUE',
      description: `FX spread income (${currency})`,
    },
    {
      code: SystemAccounts.payable(currency),
      type: 'LIABILITY',
      description: `Payable to external parties (${currency})`,
    },
    {
      code: SystemAccounts.writeoff(currency),
      type: 'EXPENSE',
      description: `Write-offs and absorbed losses (${currency})`,
    },
  ];
}

export function isSystemAccountCode(code: string): boolean {
  return code.startsWith('system:');
}

export function isUserAccountCode(code: string): boolean {
  return code.startsWith('user:');
}

/** Recover the product account id from a user ledger account code. */
export function accountIdFromCode(code: string): string | null {
  return code.startsWith('user:') ? code.slice('user:'.length) : null;
}
