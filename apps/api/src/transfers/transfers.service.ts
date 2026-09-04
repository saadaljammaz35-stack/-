/**
 * Transfer orchestration — the critical path.
 *
 * Every guard here exists because of a specific failure mode, noted inline.
 * The ordering is deliberate: cheap rejections first, then risk checks, then
 * one database transaction that either commits everything or nothing.
 *
 * Note what is NOT in this file: any arithmetic on balances. The service
 * decides *whether* a transfer may happen; `@nabd/ledger` decides what it does
 * to the books. Keeping those apart is what stops a well-meaning change here
 * from quietly inventing money.
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  AccountNotActiveError,
  ComplianceBlockError,
  type CurrencyCode,
  ForbiddenError,
  LimitExceededError,
  Money,
  NotFoundError,
  StrongAuthRequiredError,
  ValidationError,
  generateReference,
  maskPhoneForConfirmation,
  normalisePhone,
  uuidv7,
} from '@nabd/shared';
import {
  LedgerEngine,
  assertOutbound,
  internalTransfer,
  tierForKyc,
  userAccountCode,
} from '@nabd/ledger';
import { assessFraudRisk } from '@nabd/security';

import { PrismaService } from '../prisma/prisma.service.js';

export interface CreateTransferCommand {
  readonly userId: string;
  readonly senderAccountId: string;
  readonly beneficiaryId?: string;
  /** The wallet's primary way to address a recipient. Normalised before use. */
  readonly recipientPhone?: string;
  readonly recipientAccountNumber?: string;
  readonly amountMinor: bigint;
  readonly currency: CurrencyCode;
  readonly description?: string;
  readonly idempotencyKey: string;
  readonly context: {
    readonly ip?: string;
    readonly deviceId?: string;
    readonly isNewDevice: boolean;
    readonly isNewCountry: boolean;
    readonly ipIsAnonymised: boolean;
    /** Set when the caller has already satisfied an OTP or biometric challenge. */
    readonly strongAuthSatisfied: boolean;
  };
}

export interface TransferResult {
  readonly transactionId: string;
  readonly reference: string;
  readonly status: 'COMPLETED' | 'PENDING';
  readonly journalId?: string;
  readonly riskScore: number;
}

/** Above this, a transfer always requires step-up authentication. */
const STRONG_AUTH_THRESHOLD_MINOR = 500_000n; // 5,000.00 SAR

@Injectable()
export class TransfersService {
  private readonly logger = new Logger(TransfersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerEngine,
  ) {}

  async create(command: CreateTransferCommand): Promise<TransferResult> {
    const amount = Money.fromMinor(command.amountMinor, command.currency);

    // ── 1. Basic validation. Cheapest rejections first. ──
    if (!amount.isPositive) {
      throw new ValidationError('Transfer amount must be greater than zero');
    }

    const sender = await this.prisma.account.findUnique({
      where: { id: command.senderAccountId },
      include: { ledgerAccount: true },
    });
    if (sender === null) throw new NotFoundError('Account', command.senderAccountId);

    // ── 2. Ownership. A valid token for user A must not move user B's money. ──
    if (sender.userId !== command.userId) {
      throw new ForbiddenError('Account does not belong to the caller', {
        accountId: command.senderAccountId,
      });
    }
    if (sender.status !== 'ACTIVE') {
      throw new AccountNotActiveError(`Account is ${sender.status}`, {
        accountId: sender.id,
        status: sender.status,
      });
    }
    if (sender.currency.trim() !== command.currency) {
      throw new ValidationError('Transfer currency does not match the account currency');
    }

    // ── 3. Resolve the destination. ──
    const recipient = await this.resolveRecipient(command);
    if (recipient.id === sender.id) {
      throw new ValidationError('Cannot transfer to the same account');
    }
    if (recipient.status !== 'ACTIVE') {
      throw new AccountNotActiveError('Recipient account is not active');
    }
    if (recipient.currency.trim() !== command.currency) {
      throw new ValidationError('Recipient account is in a different currency');
    }

    // ── 4. Beneficiary controls. A brand-new payee is the highest-risk
    //       destination there is; the cooling period is what defeats an
    //       attacker who has taken over the account and wants to cash out. ──
    if (command.beneficiaryId !== undefined) {
      const beneficiary = await this.prisma.beneficiary.findUnique({
        where: { id: command.beneficiaryId },
      });
      if (beneficiary === null || beneficiary.userId !== command.userId) {
        throw new NotFoundError('Beneficiary', command.beneficiaryId);
      }
      if (beneficiary.status !== 'VERIFIED') {
        throw new ValidationError('Beneficiary is not verified');
      }
      if (
        beneficiary.cooldownUntil !== null &&
        beneficiary.cooldownUntil.getTime() > Date.now() &&
        !command.context.strongAuthSatisfied
      ) {
        throw new StrongAuthRequiredError(
          'This beneficiary is still within its cooling period',
          { cooldownUntil: beneficiary.cooldownUntil.toISOString() },
        );
      }
    }

    // ── 5. Step-up authentication for large amounts. ──
    if (
      amount.minor >= STRONG_AUTH_THRESHOLD_MINOR &&
      !command.context.strongAuthSatisfied
    ) {
      throw new StrongAuthRequiredError('This amount requires additional verification', {
        threshold: STRONG_AUTH_THRESHOLD_MINOR.toString(),
      });
    }

    // ── 6. Limits. ──
    await this.assertWithinLimits(command.userId, amount, false);

    // ── 7. Fraud scoring. A recommendation, applied by policy here — the
    //       engine itself never blocks anything on its own. ──
    const risk = await this.scoreRisk(command, sender.id, amount);
    if (risk.recommendation === 'BLOCK') {
      await this.openFraudCase(command, risk, 'CONFIRMED');
      throw new ComplianceBlockError('Transfer blocked by risk policy', {
        riskScore: risk.score,
        signals: risk.signals.map((s) => s.code),
      });
    }
    if (risk.recommendation === 'REVIEW') {
      // Queued for a human rather than silently allowed or silently dropped.
      const queued = await this.queueForReview(
        command,
        risk,
        amount,
        sender.id,
        recipient.id,
      );
      return queued;
    }

    // ── 8. Post. One transaction: transaction row, journal, entries,
    //       balances, audit log and outbox rows all commit together. ──
    const reference = generateReference('NBD');
    const transactionId = uuidv7();

    const senderLedgerId = sender.ledgerAccount?.id;
    const recipientLedgerId = recipient.ledgerAccountId;
    if (senderLedgerId === undefined || recipientLedgerId === null) {
      throw new NotFoundError('Ledger account for one of the parties');
    }

    await this.prisma.transaction.create({
      data: {
        id: transactionId,
        type: 'TRANSFER',
        status: 'PROCESSING',
        amountMinor: amount.minor,
        currency: command.currency,
        senderAccountId: sender.id,
        receiverAccountId: recipient.id,
        userId: command.userId,
        reference,
        idempotencyKey: command.idempotencyKey,
        category: 'TRANSFER',
        description: command.description ?? null,
        riskScore: risk.score,
      },
    });

    const journal = internalTransfer(
      {
        reference,
        // The ledger's idempotency key is derived from the request's, so a
        // replayed API call maps to the same journal.
        idempotencyKey: `transfer:${command.idempotencyKey}`,
        currency: command.currency,
        transactionId,
        createdBy: command.userId,
        metadata: { riskScore: risk.score },
      },
      {
        senderLedgerAccountId: senderLedgerId,
        receiverLedgerAccountId: recipientLedgerId,
        amount,
        ...(command.description === undefined ? {} : { description: command.description }),
      },
    );

    const posted = await this.ledger.post(journal);

    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: { status: 'COMPLETED', processedAt: new Date() },
    });

    // Side effects go through the outbox, never inline: a slow SMS gateway
    // must never hold a lock on a customer's balance.
    await this.prisma.outboxEvent.createMany({
      data: [
        {
          id: uuidv7(),
          aggregateType: 'transaction',
          aggregateId: transactionId,
          eventType: 'transfer.completed',
          payload: {
            transactionId,
            reference,
            amountMinor: amount.minor.toString(),
            currency: command.currency,
            senderAccountId: sender.id,
            receiverAccountId: recipient.id,
          },
        },
      ],
    });

    this.logger.log(
      `Transfer ${reference} completed: ${amount.toString()} (risk ${risk.score})`,
    );

    return {
      transactionId,
      reference,
      status: 'COMPLETED',
      journalId: posted.journalId,
      riskScore: risk.score,
    };
  }

  private async resolveRecipient(command: CreateTransferCommand): Promise<{
    id: string;
    status: string;
    currency: string;
    ledgerAccountId: string | null;
  }> {
    // ── by phone number ──
    //
    // The wallet's signature flow: you send money to a number, not to an IBAN.
    // The number is normalised before lookup, because "0512345678" and
    // "+966512345678" are the same person and must resolve to the same wallet —
    // if they did not, the transfer would silently go nowhere.
    if (command.recipientPhone !== undefined) {
      const phone = normalisePhone(command.recipientPhone);

      const user = await this.prisma.user.findFirst({
        where: { phone, deletedAt: null },
        include: {
          accounts: {
            where: { currency: command.currency, closedAt: null, isPrimary: true },
            include: { ledgerAccount: true },
            take: 1,
          },
        },
      });

      const account = user?.accounts[0];

      // One error for "no such customer" and for "that customer has no wallet
      // in this currency". Distinguishing them would turn this endpoint into a
      // way to test which phone numbers are registered.
      if (user === null || account === undefined) {
        throw new NotFoundError('Recipient');
      }

      return {
        id: account.id,
        status: account.status,
        currency: account.currency,
        ledgerAccountId: account.ledgerAccount?.id ?? null,
      };
    }

    // ── by account number ──
    if (command.recipientAccountNumber !== undefined) {
      const account = await this.prisma.account.findUnique({
        where: { accountNumber: command.recipientAccountNumber },
        include: { ledgerAccount: true },
      });
      if (account === null) throw new NotFoundError('Recipient');
      return {
        id: account.id,
        status: account.status,
        currency: account.currency,
        ledgerAccountId: account.ledgerAccount?.id ?? null,
      };
    }

    throw new ValidationError(
      'A recipient phone number, account number or beneficiary is required',
    );
  }

  /**
   * Look up a recipient before sending, so the sender can confirm the name.
   *
   * Deliberately rate-limited and returns only a masked confirmation: an
   * unlimited "phone number → full name" endpoint is a directory that anyone
   * can enumerate.
   */
  async lookupRecipient(
    rawPhone: string,
    currency: CurrencyCode,
  ): Promise<{ displayName: string; maskedPhone: string }> {
    const phone = normalisePhone(rawPhone);
    const user = await this.prisma.user.findFirst({
      where: { phone, deletedAt: null, status: 'ACTIVE' },
      include: {
        profile: true,
        accounts: { where: { currency, closedAt: null, isPrimary: true }, take: 1 },
      },
    });

    if (user === null || user.accounts.length === 0) {
      throw new NotFoundError('Recipient');
    }

    // First name plus a last initial — enough to confirm the right person,
    // not enough to harvest identities.
    const first = user.profile?.firstName ?? '';
    const lastInitial = (user.profile?.lastName ?? '').slice(0, 1);
    return {
      displayName: lastInitial === '' ? first : `${first} ${lastInitial}.`,
      maskedPhone: maskPhoneForConfirmation(phone),
    };
  }

  /**
   * Tiered wallet limits.
   *
   * An electronic money institution does not give every customer the same
   * wallet — throughput is bounded by how strongly the customer's identity has
   * been verified. That is what stops a low-friction onboarding flow from
   * becoming a laundering channel, and it is why the check needs the customer's
   * KYC level rather than a single flat number.
   */
  private async assertWithinLimits(
    userId: string,
    amount: Money,
    isExternal: boolean,
  ): Promise<void> {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [user, daily, monthly] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          kycApplications: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      }),
      this.prisma.transaction.aggregate({
        where: {
          userId,
          status: { in: ['COMPLETED', 'PROCESSING'] },
          createdAt: { gte: dayAgo },
          currency: amount.currency,
        },
        _sum: { amountMinor: true },
        _count: true,
      }),
      this.prisma.transaction.aggregate({
        where: {
          userId,
          status: { in: ['COMPLETED', 'PROCESSING'] },
          createdAt: { gte: monthAgo },
          currency: amount.currency,
        },
        _sum: { amountMinor: true },
      }),
    ]);

    if (user === null) throw new NotFoundError('User', userId);

    const tier = tierForKyc(user.kycStatus, user.kycApplications[0]?.level ?? 'BASIC');

    // Throws LimitExceededError carrying the specific breach and the customer's
    // remaining headroom, so the app can tell them what to do next.
    assertOutbound({
      tier,
      amount,
      isExternal,
      usage: {
        dailyOutboundMinor: daily._sum.amountMinor ?? 0n,
        monthlyOutboundMinor: monthly._sum.amountMinor ?? 0n,
        dailyCount: daily._count,
        currentBalanceMinor: 0n,
      },
    });
  }

  private async scoreRisk(
    command: CreateTransferCommand,
    senderAccountId: string,
    amount: Money,
  ): Promise<ReturnType<typeof assessFraudRisk>> {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [velocityHour, velocityDay, user, balance, beneficiary] = await Promise.all([
      this.prisma.transaction.count({
        where: { userId: command.userId, createdAt: { gte: hourAgo } },
      }),
      this.prisma.transaction.count({
        where: { userId: command.userId, createdAt: { gte: dayAgo } },
      }),
      this.prisma.user.findUnique({ where: { id: command.userId } }),
      this.prisma.account.findUnique({
        where: { id: senderAccountId },
        include: { ledgerAccount: { include: { balance: true } } },
      }),
      command.beneficiaryId === undefined
        ? Promise.resolve(null)
        : this.prisma.beneficiary.findUnique({ where: { id: command.beneficiaryId } }),
    ]);

    const cached = balance?.ledgerAccount?.balance;
    const balanceMinor =
      cached === undefined || cached === null
        ? 0n
        : BigInt(cached.postedCreditMinor) - BigInt(cached.postedDebitMinor);

    const accountAgeDays =
      user === null
        ? 0
        : Math.floor((Date.now() - user.createdAt.getTime()) / (24 * 60 * 60 * 1000));

    return assessFraudRisk({
      amount,
      accountBalanceMinor: balanceMinor,
      velocityLastHour: velocityHour,
      velocityLast24h: velocityDay,
      beneficiaryAgeHours:
        beneficiary === null
          ? null
          : (Date.now() - beneficiary.createdAt.getTime()) / (60 * 60 * 1000),
      beneficiaryIsVerified: beneficiary?.status === 'VERIFIED',
      isNewDevice: command.context.isNewDevice,
      isNewCountry: command.context.isNewCountry,
      ipIsAnonymised: command.context.ipIsAnonymised,
      localHour: new Date().getHours(),
      accountAgeDays,
      kycVerified: user?.kycStatus === 'VERIFIED',
      priorFraudCases: 0,
    });
  }

  private async openFraudCase(
    command: CreateTransferCommand,
    risk: ReturnType<typeof assessFraudRisk>,
    status: 'OPEN' | 'CONFIRMED',
  ): Promise<string> {
    const id = uuidv7();
    await this.prisma.fraudCase.create({
      data: {
        id,
        userId: command.userId,
        riskScore: risk.score,
        level: risk.level,
        status,
        signals: { signals: risk.signals } as never,
      },
    });
    return id;
  }

  private async queueForReview(
    command: CreateTransferCommand,
    risk: ReturnType<typeof assessFraudRisk>,
    amount: Money,
    senderAccountId: string,
    recipientAccountId: string,
  ): Promise<TransferResult> {
    const reference = generateReference('NBD');
    const transactionId = uuidv7();

    await this.prisma.transaction.create({
      data: {
        id: transactionId,
        type: 'TRANSFER',
        // PENDING, not FAILED: the customer's request is alive and awaiting a
        // human decision, and nothing has been posted to the ledger.
        status: 'PENDING',
        amountMinor: amount.minor,
        currency: command.currency,
        senderAccountId,
        receiverAccountId: recipientAccountId,
        userId: command.userId,
        reference,
        idempotencyKey: command.idempotencyKey,
        category: 'TRANSFER',
        riskScore: risk.score,
      },
    });
    await this.openFraudCase(command, risk, 'OPEN');

    this.logger.warn(`Transfer ${reference} queued for review (risk ${risk.score})`);
    return { transactionId, reference, status: 'PENDING', riskScore: risk.score };
  }
}

export { userAccountCode };
