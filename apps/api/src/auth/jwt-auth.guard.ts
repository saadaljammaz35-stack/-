/**
 * Bearer-token authentication.
 *
 * Verifying the signature is necessary but not sufficient. A token can be
 * cryptographically valid and still belong to a session that has since been
 * revoked — a stolen device, a password change, or refresh-token reuse
 * detection. Because access tokens are short-lived but not instantly
 * revocable on their own, this guard also checks the session is still alive.
 */

import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { AuthenticationError, SessionExpiredError } from '@nabd/shared';
import { JwtService } from '@nabd/auth';

import { PrismaService } from '../prisma/prisma.service.js';

interface RequestWithUser {
  headers: Record<string, string | string[] | undefined>;
  user?: {
    id: string;
    sessionId: string;
    deviceId?: string;
    role?: string;
    amr?: string[];
  };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    const header = request.headers['authorization'];
    const raw = Array.isArray(header) ? header[0] : header;
    if (raw === undefined || !raw.startsWith('Bearer ')) {
      throw new AuthenticationError('Missing bearer token', { reason: 'no_header' });
    }

    // Throws on a bad signature, alg:none, wrong issuer/audience, or expiry.
    const claims = this.jwt.verify(raw.slice('Bearer '.length));

    if (claims.sessionId === undefined) {
      throw new AuthenticationError('Token has no session', { reason: 'no_session' });
    }

    // The revocation check. Without it, a token stolen minutes before the user
    // reported their phone lost would keep working until it expired.
    const session = await this.prisma.session.findUnique({
      where: { id: claims.sessionId },
      select: { revokedAt: true, expiresAt: true, userId: true },
    });

    if (session === null || session.revokedAt !== null) {
      throw new SessionExpiredError('Session is no longer valid', {
        reason: 'revoked',
        sessionId: claims.sessionId,
      });
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      throw new SessionExpiredError('Session expired', { sessionId: claims.sessionId });
    }
    // A token whose subject no longer matches its session has been tampered
    // with or replayed across accounts.
    if (session.userId !== claims.sub) {
      throw new AuthenticationError('Token subject does not match its session', {
        reason: 'subject_mismatch',
      });
    }

    request.user = {
      id: claims.sub,
      sessionId: claims.sessionId,
      ...(claims.deviceId === undefined ? {} : { deviceId: claims.deviceId }),
      ...(claims.role === undefined ? {} : { role: claims.role }),
      ...(claims.amr === undefined ? {} : { amr: [...claims.amr] }),
    };

    void this.prisma.session
      .update({ where: { id: claims.sessionId }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);

    return true;
  }
}
