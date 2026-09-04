/**
 * API-level idempotency.
 *
 * Sits in front of every value-moving endpoint. The ledger has its own
 * idempotency guard, but this layer exists for a different reason: it returns
 * the *original response body* on a replay, so a client that retried because
 * its connection dropped sees the same answer rather than a confusing 409.
 *
 * The three states, and why each matters:
 *
 *   COMPLETED  → return the stored response verbatim. The client's retry is
 *                satisfied without touching the ledger at all.
 *   IN_FLIGHT  → 409. The first attempt is still running; letting a second one
 *                through would race it.
 *   not found  → claim the key with an INSERT. If a concurrent request claimed
 *                it first, the UNIQUE constraint rejects us and we become the
 *                IN_FLIGHT case above.
 *
 * A key reused with a *different* request body is a client bug and is rejected,
 * never replayed — replaying it would return the wrong answer for the request
 * actually made.
 */

import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { type Observable, from, of, switchMap } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  IdempotencyConflictError,
  RequestInProgressError,
  ValidationError,
} from '@nabd/shared';

import { PrismaService } from '../prisma/prisma.service.js';

/** How long a key stays claimed. Longer than any client's retry window. */
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

interface AuthenticatedRequest {
  method: string;
  path: string;
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
  user?: { id: string };
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    // Only mutating requests need a key.
    if (!['POST', 'PUT', 'PATCH'].includes(request.method)) {
      return next.handle();
    }

    const header = request.headers['idempotency-key'];
    const key = Array.isArray(header) ? header[0] : header;
    if (key === undefined || key.trim() === '') {
      throw new ValidationError('Idempotency-Key header is required for this request');
    }
    if (key.length > 255) {
      throw new ValidationError('Idempotency-Key must be at most 255 characters');
    }

    const requestHash = createHash('sha256')
      .update(JSON.stringify(request.body ?? {}))
      .digest('hex');
    const userId = request.user?.id ?? null;

    return from(this.claim(key, request.path, requestHash, userId)).pipe(
      switchMap((existing) => {
        if (existing !== null) return of(existing);

        return next.handle().pipe(
          tap({
            next: (body: unknown) => {
              void this.complete(key, 200, body);
            },
            // A failed request releases its key so the client can genuinely
            // retry. Holding it would turn one transient error into a
            // permanently unusable key.
            error: () => {
              void this.release(key);
            },
          }),
        );
      }),
    );
  }

  /** Returns the stored response on a replay, or null when we won the claim. */
  private async claim(
    key: string,
    endpoint: string,
    requestHash: string,
    userId: string | null,
  ): Promise<unknown | null> {
    const existing = await this.prisma.idempotencyKey.findUnique({ where: { key } });

    if (existing !== null) {
      if (existing.requestHash !== requestHash) {
        throw new IdempotencyConflictError(
          'This idempotency key was used with a different request body',
          { key },
        );
      }
      if (existing.status === 'IN_FLIGHT') {
        throw new RequestInProgressError('An identical request is still in progress', {
          key,
        });
      }
      return existing.responseBody;
    }

    try {
      await this.prisma.idempotencyKey.create({
        data: {
          key,
          userId,
          endpoint,
          requestHash,
          status: 'IN_FLIGHT',
          expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
        },
      });
      return null;
    } catch {
      // Lost the race to claim the key — the winner is in flight.
      throw new RequestInProgressError('An identical request is still in progress', {
        key,
      });
    }
  }

  private async complete(key: string, status: number, body: unknown): Promise<void> {
    await this.prisma.idempotencyKey.update({
      where: { key },
      data: {
        status: 'COMPLETED',
        responseStatus: status,
        responseBody: JSON.parse(JSON.stringify(body, bigintReplacer)) as never,
        completedAt: new Date(),
      },
    });
  }

  private async release(key: string): Promise<void> {
    await this.prisma.idempotencyKey.delete({ where: { key } }).catch(() => undefined);
  }
}

/** JSON cannot serialise bigint; amounts become decimal strings. */
function bigintReplacer(_key: string, value: unknown): unknown {
  return typeof value === 'bigint' ? value.toString() : value;
}
