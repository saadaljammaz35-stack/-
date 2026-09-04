/**
 * The single exit point for every error leaving the API.
 *
 * Its job is to make sure the outside world learns exactly what it needs to
 * (a stable error code it can branch on) and nothing more (stack traces, SQL,
 * internal ids, or the reason an authentication attempt failed). Full detail
 * goes to the log, keyed by request id, so support can correlate a customer's
 * error to the exact log line without that detail ever crossing the wire.
 */

import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { InternalError, isNabdError } from '@nabd/shared';
import { redact } from '@nabd/security';

interface ResponseLike {
  status(code: number): ResponseLike;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
}

interface RequestLike {
  method: string;
  url: string;
  id?: string;
  headers: Record<string, string | string[] | undefined>;
  user?: { id: string };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<ResponseLike>();
    const request = http.getRequest<RequestLike>();

    const requestId =
      request.id ??
      (typeof request.headers['x-request-id'] === 'string'
        ? request.headers['x-request-id']
        : undefined);

    if (isNabdError(exception)) {
      // Rate limiting is the one case where the client is told when to come back.
      if (exception.code === 'rate_limited') {
        const retryAfter = exception.details['retryAfterSeconds'];
        if (typeof retryAfter === 'number') {
          response.setHeader('Retry-After', String(retryAfter));
        }
      }

      const level = exception.status >= 500 ? 'error' : 'warn';
      this.logger[level](
        JSON.stringify({
          requestId,
          method: request.method,
          url: request.url,
          userId: request.user?.id,
          code: exception.code,
          status: exception.status,
          // The full internal detail — including anything deliberately kept
          // out of the customer's response — lands here, redacted.
          message: exception.message,
          details: redact(exception.details),
        }),
      );

      response.status(exception.status).json({
        error: exception.toJSON(requestId),
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      this.logger.warn(JSON.stringify({ requestId, status, message: exception.message }));
      response.status(status).json({
        error: {
          code: status === 404 ? 'not_found' : 'request_error',
          message: exception.message,
          status,
          requestId,
        },
      });
      return;
    }

    // Anything unrecognised is a bug. Log it in full; tell the caller nothing.
    const internal = new InternalError('Unhandled exception');
    this.logger.error(
      JSON.stringify({
        requestId,
        method: request.method,
        url: request.url,
        userId: request.user?.id,
        error: exception instanceof Error ? exception.message : String(exception),
        stack: exception instanceof Error ? exception.stack : undefined,
      }),
    );

    response.status(500).json({ error: internal.toJSON(requestId) });
  }
}
