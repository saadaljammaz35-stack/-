import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * The Prisma client, wired into Nest's lifecycle.
 *
 * `enableShutdownHooks` matters more than it looks: on SIGTERM the process must
 * finish its in-flight transactions before the connection pool closes. Tearing
 * the pool down mid-transaction during a rolling deploy is how a transfer ends
 * up half-recorded.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Database connection established');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Database connection closed');
  }

  /** Liveness probe for /ready. */
  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reconciliation check, run on a schedule.
   *
   * Any non-zero drift means the cached balances no longer match the entries
   * they summarise. That is a paging incident, not a warning: it means either a
   * write path bypassed the engine, or the cache update and the entry insert
   * were not in the same transaction.
   */
  async checkLedgerIntegrity(): Promise<{
    driftingAccounts: number;
    trialBalanceImbalance: bigint;
  }> {
    const [drift] = await this.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count FROM ledger_reconciliation WHERE drift <> 0
    `;
    const [trial] = await this.$queryRaw<Array<{ imbalance: bigint | null }>>`
      SELECT COALESCE(SUM(ABS(imbalance_minor)), 0)::bigint AS imbalance FROM ledger_trial_balance
    `;

    return {
      driftingAccounts: Number(drift?.count ?? 0n),
      trialBalanceImbalance: BigInt(trial?.imbalance ?? 0n),
    };
  }
}
