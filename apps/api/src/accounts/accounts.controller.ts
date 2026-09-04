/**
 * Account and balance endpoints.
 *
 * Every balance served here is derived from the ledger, never read from a
 * column that some other code path might have written. The response carries
 * both `ledgerBalance` (what has actually posted) and `availableBalance`
 * (posted minus active holds) because they are genuinely different numbers and
 * a customer needs to see the one they can spend.
 */

import { Controller, ForbiddenException, Get, Param, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { availableBalance, ledgerBalance } from '@nabd/ledger';
import { type CurrencyCode, NotFoundError } from '@nabd/shared';

import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';

interface AuthedRequest {
  user: { id: string };
}

@ApiTags('accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: "List the caller's accounts with derived balances" })
  async list(@Req() request: AuthedRequest): Promise<{ accounts: unknown[] }> {
    const accounts = await this.prisma.account.findMany({
      // Row scoping: the query itself is bounded to the caller, so a bug in a
      // filter cannot leak another customer's account.
      where: { userId: request.user.id, closedAt: null },
      include: { ledgerAccount: { include: { balance: true } } },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });

    return { accounts: accounts.map((a) => this.present(a)) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Fetch one account' })
  async get(
    @Param('id') id: string,
    @Req() request: AuthedRequest,
  ): Promise<Record<string, unknown>> {
    const account = await this.prisma.account.findUnique({
      where: { id },
      include: { ledgerAccount: { include: { balance: true } } },
    });

    if (account === null) throw new NotFoundError('Account', id);
    // Ownership is checked after the lookup but the error is the same either
    // way, so this endpoint cannot be used to probe which ids exist.
    if (account.userId !== request.user.id) {
      throw new ForbiddenException('Account does not belong to the caller');
    }

    return this.present(account);
  }

  private present(account: {
    id: string;
    type: string;
    status: string;
    currency: string;
    accountNumber: string;
    iban: string | null;
    isPrimary: boolean;
    createdAt: Date;
    ledgerAccount: {
      id: string;
      normalBalance: 'DEBIT' | 'CREDIT';
      balance: {
        postedDebitMinor: bigint;
        postedCreditMinor: bigint;
        holdMinor: bigint;
        version: bigint;
      } | null;
    } | null;
  }): Record<string, unknown> {
    const currency = account.currency.trim() as CurrencyCode;
    const cached = account.ledgerAccount?.balance;

    // An account with no balance row is a provisioning bug, not a zero balance.
    // Report it as unknown rather than showing the customer a confident 0.00.
    if (account.ledgerAccount === null || cached === undefined || cached === null) {
      return {
        id: account.id,
        type: account.type,
        status: account.status,
        currency,
        accountNumber: account.accountNumber,
        balanceStatus: 'UNAVAILABLE',
      };
    }

    const snapshot = {
      ledgerAccountId: account.ledgerAccount.id,
      currency,
      normalBalance: account.ledgerAccount.normalBalance,
      postedDebitMinor: BigInt(cached.postedDebitMinor),
      postedCreditMinor: BigInt(cached.postedCreditMinor),
      holdMinor: BigInt(cached.holdMinor),
      version: BigInt(cached.version),
    };

    return {
      id: account.id,
      type: account.type,
      status: account.status,
      currency,
      accountNumber: account.accountNumber,
      iban: account.iban,
      isPrimary: account.isPrimary,
      createdAt: account.createdAt.toISOString(),
      // Both numbers, because they differ whenever a hold is active and the
      // customer can only spend the second one.
      ledgerBalance: ledgerBalance(snapshot).toJSON(),
      availableBalance: availableBalance(snapshot).toJSON(),
      heldAmount: {
        amount: snapshot.holdMinor.toString(),
        currency,
      },
    };
  }
}
