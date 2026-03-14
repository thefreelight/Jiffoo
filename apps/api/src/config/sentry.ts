// @ts-nocheck
/**
 * Sentry Configuration
 *
 * Initializes Sentry error tracking and APM for the API service
 */

import * as Sentry from '@sentry/node';
import { createSentryClient, createSentryConfigFromEnv } from 'shared/observability/sentry';
import { LoggerService } from '@/core/logger/unified-logger';

/**
 * Initialize Sentry
 *
 * Should be called as early as possible in the application lifecycle
 */
export function initializeSentry(): void {
  const config = createSentryConfigFromEnv();

  if (!config) {
    LoggerService.logSystem('Sentry not configured (SENTRY_DSN not set)');
    return;
  }

  const sentryClient = createSentryClient(config);
  const initConfig = sentryClient.getInitConfig();

  // Initialize Sentry SDK
  Sentry.init({
    ...initConfig,
    integrations: [
      // HTTP instrumentation
      Sentry.httpIntegration(),
      // Express/Fastify instrumentation
      Sentry.expressIntegration(),
    ],
  });

  sentryClient.markInitialized();
  LoggerService.logSystem('Sentry initialized', {
    environment: config.environment,
    tracesSampleRate: config.tracesSampleRate,
  });
}

/**
 * Export Sentry SDK for use in error handlers
 */
export { Sentry };
