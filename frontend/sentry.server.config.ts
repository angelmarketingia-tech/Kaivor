// Server-side Sentry init for Next.js API routes (if any).
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV || 'production',
    tracesSampleRate: 0.1,
  });
}
