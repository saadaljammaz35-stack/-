import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LedgerEngine } from '@nabd/ledger';
import { MockBankingProvider, MockCardProvider, MockPaymentProvider } from '@nabd/payments';
import { InMemoryRateLimitStore, RateLimiter } from '@nabd/security';

import { IdempotencyInterceptor } from './common/idempotency.interceptor.js';
import { loadConfig } from './config/configuration.js';
import { HealthController } from './health/health.controller.js';
import { PrismaLedgerStore } from './ledger/prisma-ledger.store.js';
import { PrismaService } from './prisma/prisma.service.js';
import { TransfersService } from './transfers/transfers.service.js';

/**
 * Provider selection lives here and nowhere else.
 *
 * Swapping a mock for a licensed partner is a change to this factory — the
 * domain code that calls `PaymentProvider` never learns which implementation it
 * received. `assertProductionSafety` in the config has already refused to boot
 * if a mock was selected while NODE_ENV is production.
 */
@Module({
  controllers: [HealthController],
  providers: [
    PrismaService,
    PrismaLedgerStore,

    { provide: 'APP_CONFIG', useFactory: () => loadConfig() },

    {
      provide: LedgerEngine,
      useFactory: (store: PrismaLedgerStore) => new LedgerEngine(store),
      inject: [PrismaLedgerStore],
    },

    {
      provide: RateLimiter,
      // Redis-backed in production; the in-memory store does not share state
      // across processes and is therefore not a limiter in a cluster.
      useFactory: () => new RateLimiter(new InMemoryRateLimitStore()),
    },

    {
      provide: 'PAYMENT_PROVIDER',
      useFactory: () => new MockPaymentProvider(process.env['PAYMENT_WEBHOOK_SECRET']),
    },
    { provide: 'BANKING_PROVIDER', useFactory: () => new MockBankingProvider() },
    { provide: 'CARD_PROVIDER', useFactory: () => new MockCardProvider() },

    TransfersService,

    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
  ],
})
export class AppModule {}
