/**
 * Journals and postings.
 *
 * The central type is `BalancedJournal`. It has no public constructor — the
 * only way to obtain one is through `JournalBuilder.build()`, which refuses to
 * return unless debits equal credits. An unbalanced journal is therefore not
 * representable in the type system, so no downstream code can post one, and no
 * code review is needed to guarantee it.
 */

import {
  type CurrencyCode,
  type Direction,
  Money,
  UnbalancedJournalError,
  ValidationError,
} from '@nabd/shared';

export interface PostingLine {
  readonly ledgerAccountId: string;
  readonly direction: Direction;
  readonly amount: Money;
  readonly memo?: string;
}

export interface JournalMetadata {
  readonly reference: string;
  readonly idempotencyKey: string;
  readonly currency: CurrencyCode;
  readonly description: string;
  readonly transactionId?: string;
  /** Set only on a correcting journal; points at the journal being undone. */
  readonly reversalOfJournalId?: string;
  readonly createdBy?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * A journal that has been proven to balance. Construction is private; obtain
 * one from a JournalBuilder.
 */
export class BalancedJournal {
  readonly reference: string;
  readonly idempotencyKey: string;
  readonly currency: CurrencyCode;
  readonly description: string;
  readonly transactionId: string | undefined;
  readonly reversalOfJournalId: string | undefined;
  readonly createdBy: string | undefined;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly lines: readonly PostingLine[];

  /** @internal — call JournalBuilder.build() instead. */
  private constructor(meta: JournalMetadata, lines: readonly PostingLine[]) {
    this.reference = meta.reference;
    this.idempotencyKey = meta.idempotencyKey;
    this.currency = meta.currency;
    this.description = meta.description;
    this.transactionId = meta.transactionId;
    this.reversalOfJournalId = meta.reversalOfJournalId;
    this.createdBy = meta.createdBy;
    this.metadata = Object.freeze({ ...(meta.metadata ?? {}) });
    this.lines = Object.freeze([...lines]);
    Object.freeze(this);
  }

  /**
   * @internal Only JournalBuilder may call this, and only after validation.
   * Kept as a static so the constructor itself stays private.
   */
  static __unsafeCreate(
    meta: JournalMetadata,
    lines: readonly PostingLine[],
  ): BalancedJournal {
    return new BalancedJournal(meta, lines);
  }

  get totalDebit(): Money {
    return Money.sum(
      this.lines.filter((l) => l.direction === 'DEBIT').map((l) => l.amount),
      this.currency,
    );
  }

  get totalCredit(): Money {
    return Money.sum(
      this.lines.filter((l) => l.direction === 'CREDIT').map((l) => l.amount),
      this.currency,
    );
  }

  /** Every ledger account this journal touches, deduplicated. */
  get touchedAccountIds(): string[] {
    return [...new Set(this.lines.map((l) => l.ledgerAccountId))];
  }

  /**
   * Gross debit and credit totals for one account. The balance cache stores
   * gross totals, not net, so that a from-scratch re-derivation over
   * `ledger_entries` reproduces the cache exactly.
   */
  grossFor(ledgerAccountId: string): { debit: bigint; credit: bigint } {
    let debit = 0n;
    let credit = 0n;
    for (const line of this.lines) {
      if (line.ledgerAccountId !== ledgerAccountId) continue;
      if (line.direction === 'DEBIT') debit += line.amount.minor;
      else credit += line.amount.minor;
    }
    return { debit, credit };
  }

  /** Net effect on one account, signed by direction (debit positive). */
  netDebitFor(ledgerAccountId: string): bigint {
    let net = 0n;
    for (const line of this.lines) {
      if (line.ledgerAccountId !== ledgerAccountId) continue;
      net += line.direction === 'DEBIT' ? line.amount.minor : -line.amount.minor;
    }
    return net;
  }

  /**
   * Build the mirror journal that undoes this one. Every debit becomes a credit
   * and vice versa. This is the only sanctioned way to correct a posting — the
   * original is never modified or deleted.
   */
  reverse(meta: {
    reference: string;
    idempotencyKey: string;
    journalId: string;
    description?: string;
    createdBy?: string;
    reason: string;
  }): BalancedJournal {
    const builder = new JournalBuilder({
      reference: meta.reference,
      idempotencyKey: meta.idempotencyKey,
      currency: this.currency,
      description: meta.description ?? `Reversal of ${this.reference}`,
      reversalOfJournalId: meta.journalId,
      ...(meta.createdBy === undefined ? {} : { createdBy: meta.createdBy }),
      ...(this.transactionId === undefined ? {} : { transactionId: this.transactionId }),
      metadata: { reason: meta.reason, reversedReference: this.reference },
    });

    for (const line of this.lines) {
      builder.add(
        line.ledgerAccountId,
        line.direction === 'DEBIT' ? 'CREDIT' : 'DEBIT',
        line.amount,
        line.memo,
      );
    }
    return builder.build();
  }
}

export class JournalBuilder {
  private readonly meta: JournalMetadata;
  private readonly lines: PostingLine[] = [];

  constructor(meta: JournalMetadata) {
    if (meta.reference.trim() === '') {
      throw new ValidationError('Journal reference is required');
    }
    if (meta.idempotencyKey.trim() === '') {
      throw new ValidationError('Journal idempotency key is required');
    }
    this.meta = meta;
  }

  add(ledgerAccountId: string, direction: Direction, amount: Money, memo?: string): this {
    if (amount.currency !== this.meta.currency) {
      throw new ValidationError(
        `Posting currency ${amount.currency} does not match journal currency ${this.meta.currency}`,
        { ledgerAccountId },
      );
    }
    // Amounts are always positive; the direction carries the sign. Allowing a
    // negative debit would make the same movement expressible two ways and
    // break every aggregation built on top.
    if (!amount.isPositive) {
      throw new ValidationError('Posting amount must be greater than zero', {
        ledgerAccountId,
        amount: amount.toString(),
      });
    }
    this.lines.push({
      ledgerAccountId,
      direction,
      amount,
      ...(memo === undefined ? {} : { memo }),
    });
    return this;
  }

  debit(ledgerAccountId: string, amount: Money, memo?: string): this {
    return this.add(ledgerAccountId, 'DEBIT', amount, memo);
  }

  credit(ledgerAccountId: string, amount: Money, memo?: string): this {
    return this.add(ledgerAccountId, 'CREDIT', amount, memo);
  }

  /**
   * Validate and seal. Throws rather than returning a Result: an unbalanced
   * journal is a programming error in a posting rule, not a runtime condition
   * a caller can sensibly recover from.
   */
  build(): BalancedJournal {
    if (this.lines.length < 2) {
      throw new ValidationError('A journal needs at least two postings', {
        reference: this.meta.reference,
        lineCount: this.lines.length,
      });
    }

    let debits = 0n;
    let credits = 0n;
    for (const line of this.lines) {
      if (line.direction === 'DEBIT') debits += line.amount.minor;
      else credits += line.amount.minor;
    }

    if (debits !== credits) {
      throw new UnbalancedJournalError(debits, credits, {
        reference: this.meta.reference,
        lineCount: this.lines.length,
      });
    }
    if (debits === 0n) {
      throw new ValidationError('A journal must move a non-zero amount', {
        reference: this.meta.reference,
      });
    }

    return BalancedJournal.__unsafeCreate(this.meta, this.lines);
  }
}
