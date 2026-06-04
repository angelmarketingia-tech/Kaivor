import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import * as Sentry from '@sentry/node';

/**
 * Catch-all filter that forwards server errors to Sentry, then delegates to
 * Nest's default exception handling.
 *
 * - HttpExceptions with status < 500 (4xx) pass through unchanged — NOT sent to Sentry.
 * - HttpExceptions with status >= 500 are captured, then formatted normally.
 * - Non-HttpException errors (unknown 500s) are captured, then turned into a
 *   500 InternalServerErrorException by BaseExceptionFilter.
 *
 * Register AFTER the PrismaExceptionFilter so Prisma P2002/P2025 etc. are mapped
 * to clean 4xx first; this filter only sees what Prisma's filter didn't handle.
 */
@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const status = exception instanceof HttpException ? exception.getStatus() : 500;

    if (process.env.SENTRY_DSN && status >= 500) {
      Sentry.captureException(exception);
    }

    // Delegate to default behavior: formats HttpExceptions (incl. 4xx) unchanged,
    // and converts unknown errors into a 500 InternalServerErrorException.
    super.catch(exception, host);
  }
}
