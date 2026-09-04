/**
 * Health endpoints.
 *
 * The distinction between these three is what makes a rolling deploy safe:
 *
 *   /live   — is the process alive? Never checks dependencies. If this failed
 *             when the database blipped, the orchestrator would kill every pod
 *             and turn a brief outage into a total one.
 *   /ready  — should this instance receive traffic? Checks dependencies, and
 *             reports not-ready during shutdown draining.
 *   /health — full diagnostic detail, for humans and dashboards.
 */

import { Controller, Get, HttpCode } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { PrismaService } from '../prisma/prisma.service.js';

let shuttingDown = false;

/** Called by the shutdown hook so /ready starts failing before the process exits. */
export function beginDraining(): void {
  shuttingDown = true;
}

@ApiTags('health')
@Controller()
export class HealthController {
  private readonly startedAt = Date.now();

  constructor(private readonly prisma: PrismaService) {}

  @Get('live')
  @HttpCode(200)
  @ApiOperation({ summary: 'Liveness — process is running. Checks no dependencies.' })
  live(): { status: string; uptimeSeconds: number } {
    return {
      status: 'ok',
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness — safe to route traffic here.' })
  async ready(): Promise<{ status: string; checks: Record<string, string> }> {
    if (shuttingDown) {
      // Drain: stop taking new work while in-flight requests finish.
      return { status: 'draining', checks: { shutdown: 'in_progress' } };
    }
    const dbHealthy = await this.prisma.isHealthy();
    return {
      status: dbHealthy ? 'ready' : 'not_ready',
      checks: { database: dbHealthy ? 'ok' : 'unavailable' },
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Full diagnostic detail, including ledger integrity.' })
  async health(): Promise<Record<string, unknown>> {
    const dbHealthy = await this.prisma.isHealthy();
    let ledger: Record<string, unknown> = { status: 'unknown' };

    if (dbHealthy) {
      const integrity = await this.prisma.checkLedgerIntegrity();
      ledger = {
        // Either of these being non-zero is a paging incident.
        status:
          integrity.driftingAccounts === 0 && integrity.trialBalanceImbalance === 0n
            ? 'ok'
            : 'INTEGRITY_VIOLATION',
        driftingAccounts: integrity.driftingAccounts,
        trialBalanceImbalance: integrity.trialBalanceImbalance.toString(),
      };
    }

    return {
      status: dbHealthy ? 'ok' : 'degraded',
      version: process.env['APP_VERSION'] ?? 'dev',
      environment: process.env['NODE_ENV'] ?? 'development',
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      checks: { database: dbHealthy ? 'ok' : 'unavailable', ledger },
    };
  }
}
