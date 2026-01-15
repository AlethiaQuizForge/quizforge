'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

// Make Sentry available globally for testing
if (typeof window !== 'undefined') {
  (window as typeof window & { Sentry: typeof Sentry }).Sentry = Sentry;
}

export function SentryProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
        tracesSampleRate: 0.1,
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,
        environment: process.env.NODE_ENV,
      });
      // Expose globally after init
      if (typeof window !== 'undefined') {
        (window as typeof window & { Sentry: typeof Sentry }).Sentry = Sentry;
      }
    }
  }, []);

  return <>{children}</>;
}
