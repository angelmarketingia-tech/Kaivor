import * as Sentry from '@sentry/node';
import type { Request, Response, NextFunction } from 'express';

export function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    // No DSN configured — operate without observability (do not crash)
    return;
  }
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'production',
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
    release: process.env.VERCEL_GIT_COMMIT_SHA || undefined,
    ignoreErrors: ['ForbiddenException', 'UnauthorizedException', 'NotFoundException', 'BadRequestException'],
  });
}

/**
 * Lightweight Express error middleware: forwards 5xx to Sentry, then to next.
 * Replaces the old `Sentry.Handlers.errorHandler` (removed in @sentry/node v8+).
 */
export function sentryErrorHandler() {
  return (err: any, _req: Request, _res: Response, next: NextFunction) => {
    const status = err?.status || err?.statusCode || 500;
    if (process.env.SENTRY_DSN && status >= 500) {
      Sentry.captureException(err);
    }
    next(err);
  };
}

export function captureException(err: any, context?: Record<string, any>) {
  if (!process.env.SENTRY_DSN) return;
  Sentry.captureException(err, { extra: context });
}
