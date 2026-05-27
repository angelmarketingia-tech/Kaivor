// Browser-side Sentry init for Next.js.
// Only initializes if NEXT_PUBLIC_SENTRY_DSN is set.
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV || 'production',
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
    // Don't report network errors as Sentry issues — they're noise from offline users
    ignoreErrors: ['Network Error', 'NetworkError', 'Failed to fetch', 'AbortError'],
  });
}
