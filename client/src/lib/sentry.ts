/**
 * Sentry Performance & Error Monitoring — Enterprise Observability Layer
 * 
 * Initializes Sentry with:
 *   - Error tracking (automatic exception capture)
 *   - Performance tracing (page load, navigation, API calls)
 *   - React component render profiling
 *   - Session replay for debugging
 * 
 * Gracefully no-ops if VITE_SENTRY_DSN is not set.
 */
import * as Sentry from '@sentry/react';

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

export function initSentry() {
  if (!SENTRY_DSN) {
    console.info('[Sentry] No DSN configured — monitoring disabled');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE || 'production',
    release: `elite-writer-v5@${import.meta.env.VITE_APP_VERSION || '1.0.0'}`,

    // Performance: capture 100% of transactions in dev, 20% in prod
    tracesSampleRate: import.meta.env.DEV ? 1.0 : 0.2,

    // Session Replay: capture 10% of sessions, 100% on error
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    integrations: [
      // Browser tracing — captures page loads, navigations, fetch/XHR
      Sentry.browserTracingIntegration(),
      // Session replay — full DOM recording on errors
      Sentry.replayIntegration(),
    ],

    // Filter noisy errors
    beforeSend(event) {
      // Don't report ResizeObserver loop errors (benign browser noise)
      if (event.exception?.values?.[0]?.value?.includes('ResizeObserver loop')) {
        return null;
      }
      return event;
    },
  });

  console.info('[Sentry] Monitoring initialized');
}

// Re-export Sentry for use in components
export { Sentry };

/**
 * React Error Boundary powered by Sentry.
 * Wrap critical subtrees to capture React rendering errors.
 * 
 * Usage:
 *   <SentryErrorBoundary fallback={<ErrorPage />}>
 *     <App />
 *   </SentryErrorBoundary>
 */
export const SentryErrorBoundary = Sentry.ErrorBoundary;

/**
 * React Profiler powered by Sentry.
 * Wraps components to track render performance.
 * 
 * Usage:
 *   <SentryProfiler id="Dashboard" includeRender includeUpdates>
 *     <Dashboard />
 *   </SentryProfiler>
 */
export const SentryProfiler = Sentry.withProfiler;
