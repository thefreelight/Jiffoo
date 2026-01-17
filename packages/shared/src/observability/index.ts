/**
 * Observability Module
 *
 * Unified export of all observability components
 */

// Log Redactor
import { LogRedactor as LogRedactorClass } from './log-redactor';
export {
  LogRedactor,
  createLogRedactor,
  redactSensitiveData,
  DEFAULT_SENSITIVE_FIELDS,
  SENSITIVE_PATTERNS,
  type RedactorConfig,
} from './log-redactor';

// Health Check
import { HealthCheckService as HealthCheckServiceClass } from './health-check';
export {
  HealthCheckService,
  createHealthCheckService,
  createDatabaseCheck,
  createRedisCheck,
  createHttpCheck,
  createMemoryCheck,
  HealthStatus,
  type CheckResult,
  type HealthCheckResult,
  type HealthCheckFn,
  type HealthCheckConfig,
} from './health-check';

// Sentry APM
import { SentryClient as SentryClientClass } from './sentry';
export {
  SentryClient,
  createSentryClient,
  createSentryConfigFromEnv,
  type SentryConfig,
  type UserContext,
  type ErrorContext,
  type TransactionContext,
} from './sentry';

// OpenTelemetry
import { OtelClient as OtelClientClass } from './otel';
export {
  OtelClient,
  createOtelClient,
  createOtelConfigFromEnv,
  TRACE_CONTEXT_HEADERS,
  type OtelConfig,
  type SpanContext,
  type SpanAttributes,
  type SpanEvent,
} from './otel';

// Log Forwarder
import { LogForwarder as LogForwarderClass } from './log-forwarder';
export {
  LogForwarder,
  createLogForwarder,
  createLogForwarderConfigFromEnv,
  type LogForwarderConfig,
  type LogEntry,
  type LogLevel,
  type LokiPushPayload,
} from './log-forwarder';

// Type aliases for interface usage
export type SentryClientInstance = InstanceType<typeof SentryClientClass>;
export type OtelClientInstance = InstanceType<typeof OtelClientClass>;
export type LogForwarderInstance = InstanceType<typeof LogForwarderClass>;
export type HealthCheckServiceInstance = InstanceType<typeof HealthCheckServiceClass>;
export type LogRedactorInstance = InstanceType<typeof LogRedactorClass>;

/**
 * Observability initialization config
 */
export interface ObservabilityConfig {
  serviceName: string;
  serviceVersion?: string;
  environment?: string;
  sentry?: {
    dsn: string;
    tracesSampleRate?: number;
  };
  otel?: {
    traceExporterUrl?: string;
    metricsExporterUrl?: string;
    samplingRatio?: number;
  };
  loki?: {
    url: string;
    batchSize?: number;
    flushInterval?: number;
  };
  healthCheck?: {
    timeout?: number;
  };
  logRedactor?: {
    sensitiveFields?: string[];
    enablePatternMatching?: boolean;
  };
}

/**
 * Observability system instance
 */
export interface ObservabilitySystem {
  sentry?: SentryClientInstance;
  otel?: OtelClientInstance;
  logForwarder?: LogForwarderInstance;
  healthCheck: HealthCheckServiceInstance;
  logRedactor: LogRedactorInstance;
}

/**
 * Initialize observability system
 */
export function initializeObservability(
  config: ObservabilityConfig
): ObservabilitySystem {
  // Initialize Log Redactor
  const logRedactor = new LogRedactorClass(config.logRedactor);

  // Initialize Health Check Service
  const healthCheck = new HealthCheckServiceClass({
    version: config.serviceVersion,
    timeout: config.healthCheck?.timeout,
  });

  // Optional: Initialize Sentry
  let sentry: SentryClientInstance | undefined;
  if (config.sentry?.dsn) {
    sentry = new SentryClientClass({
      dsn: config.sentry.dsn,
      environment: config.environment ?? 'development',
      release: config.serviceVersion,
      tracesSampleRate: config.sentry.tracesSampleRate,
    });
  }

  // Optional: Initialize OpenTelemetry
  let otel: OtelClientInstance | undefined;
  if (config.otel?.traceExporterUrl) {
    otel = new OtelClientClass({
      serviceName: config.serviceName,
      serviceVersion: config.serviceVersion,
      environment: config.environment,
      traceExporterUrl: config.otel.traceExporterUrl,
      metricsExporterUrl: config.otel.metricsExporterUrl,
      samplingRatio: config.otel.samplingRatio,
    });
  }

  // Optional: Initialize Log Forwarder
  let logForwarder: LogForwarderInstance | undefined;
  if (config.loki?.url) {
    logForwarder = new LogForwarderClass({
      lokiUrl: config.loki.url,
      batchSize: config.loki.batchSize,
      flushInterval: config.loki.flushInterval,
      defaultLabels: {
        app: config.serviceName,
        env: config.environment ?? 'development',
      },
    });
  }

  return {
    sentry,
    otel,
    logForwarder,
    healthCheck,
    logRedactor,
  };
}

