/**
 * Sentry error tracking for the frontend.
 *
 * Initializes `@sentry/browser` when `VITE_SENTRY_DSN` is set.
 * Provides a thin `captureError()` helper used by API services and
 * component error handlers.
 */

import * as Sentry from '@sentry/browser';

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const RELEASE = import.meta.env.VITE_SENTRY_RELEASE as string | undefined;

let _initialized = false;

export function initSentry(): void {
  if (_initialized) return;

  if (!DSN) {
    // Say it once, at startup, instead of only per captureError(): without a DSN
    // the whole error-observability layer is inert and every report from here on
    // is console-only. A production build reaching this branch is a deployment
    // defect — vite.config.ts refuses such a build (assertDeployEnv), so this is
    // the second line of defence for bundles built outside that path.
    if (import.meta.env.PROD) {
      console.error(
        '[Sentry] VITE_SENTRY_DSN is not set — error reporting is disabled in this build.',
      );
    }
    return;
  }

  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.MODE,
    release: RELEASE,
    // Keep sample rate low — we only care about errors, not transactions
    tracesSampleRate: 0,
    // Don't send PII (GDPR safe)
    sendDefaultPii: false,
  });

  _initialized = true;
}

/**
 * Report an error to Sentry with optional contextual tags.
 * Falls back to `console.error` when Sentry is not configured.
 */
export function captureError(error: unknown, context?: Record<string, string>): void {
  if (!_initialized) {
    console.error('[Sentry not configured]', error, context);
    return;
  }

  Sentry.withScope((scope) => {
    if (context) {
      for (const [key, value] of Object.entries(context)) {
        scope.setTag(key, value);
      }
    }
    if (error instanceof Error) {
      Sentry.captureException(error);
    } else {
      Sentry.captureMessage(String(error), 'error');
    }
  });
}
