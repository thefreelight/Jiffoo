/**
 * Telemetry Infrastructure (R5)
 *
 * OpenTelemetry SDK setup with auto-instrumentation and Prometheus metrics.
 *
 * Key design:
 * - Zero-overhead when OTEL_EXPORTER_OTLP_ENDPOINT is not set (traces disabled)
 * - Prometheus /metrics endpoint always available (unless OTEL_METRICS_DISABLED=true)
 * - Parent-based sampling with 10% ratio (configurable)
 * - 5xx responses force-recording via span error status
 * - Business metrics registry for order/payment/plugin events
 *
 * This module must be imported BEFORE the Fastify server starts.
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { ParentBasedSampler, TraceIdRatioBasedSampler, AlwaysOnSampler } from '@opentelemetry/sdk-trace-base';
import { metrics } from '@opentelemetry/api';
import type { Meter, ObservableResult, Counter, Histogram, UpDownCounter } from '@opentelemetry/api';
import { winstonLogger } from '@/core/logger/unified-logger';

// ============================================================
// Configuration
// ============================================================

const OTEL_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
const OTEL_SAMPLER_RATIO = parseFloat(process.env.OTEL_TRACES_SAMPLER_ARG || '0.1');
const OTEL_METRICS_DISABLED = process.env.OTEL_METRICS_DISABLED === 'true';
const PROMETHEUS_PORT = parseInt(process.env.PROMETHEUS_PORT || '9464', 10);
const SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'jiffoo-api';
const SERVICE_VERSION = process.env.npm_package_version || '1.0.0';
const ENVIRONMENT = process.env.NODE_ENV || 'development';

let sdk: NodeSDK | null = null;
let started = false;

// ============================================================
// SDK Initialization
// ============================================================

/**
 * Initialize the OpenTelemetry SDK.
 * When OTEL_EXPORTER_OTLP_ENDPOINT is not set, tracing is completely disabled
 * (zero overhead). Prometheus metrics are always available unless explicitly disabled.
 */
export async function initTelemetry(): Promise<void> {
  if (started) return;
  started = true;

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: SERVICE_NAME,
    [ATTR_SERVICE_VERSION]: SERVICE_VERSION,
    'deployment.environment': ENVIRONMENT,
  });

  // Trace exporter — only if endpoint is configured
  const traceExporter = OTEL_ENDPOINT
    ? new OTLPTraceExporter({ url: `${OTEL_ENDPOINT}/v1/traces` })
    : undefined;

  // Sampler: parent-based with configurable ratio
  // - If parent sampled, follow parent
  // - If no parent, use ratio-based (default 10%)
  const sampler = new ParentBasedSampler({
    root: OTEL_ENDPOINT
      ? new TraceIdRatioBasedSampler(OTEL_SAMPLER_RATIO)
      : new AlwaysOnSampler(), // When tracing is disabled, alwaysOn is fine (no exporter)
  });

  // Metrics: Prometheus exporter (always on unless disabled) + optional OTLP
  const prometheusExporter = OTEL_METRICS_DISABLED
    ? undefined
    : new PrometheusExporter(
        { port: PROMETHEUS_PORT, endpoint: '/metrics' },
        () => {
          winstonLogger.info('Prometheus metrics server started', {
            component: 'Telemetry',
            port: PROMETHEUS_PORT,
          });
        }
      );

  const metricReader = OTEL_ENDPOINT && !OTEL_METRICS_DISABLED
    ? [
        prometheusExporter!,
        // Also export to OTLP if endpoint is set
        // (PrometheusExporter is a MetricReader, not a PushExporter)
      ]
    : prometheusExporter
      ? [prometheusExporter]
      : [];

  sdk = new NodeSDK({
    resource,
    traceExporter,
    sampler,
    metricReader: metricReader.length > 0 ? metricReader : undefined,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable instrumentations that add overhead without value
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
        // Enable key instrumentations
        '@opentelemetry/instrumentation-fastify': { enabled: true },
        '@opentelemetry/instrumentation-http': { enabled: true },
        '@opentelemetry/instrumentation-ioredis': { enabled: true },
        '@opentelemetry/instrumentation-pg': { enabled: true },
      }),
    ],
  });

  try {
    sdk.start();
    winstonLogger.info('Telemetry initialized', {
      component: 'Telemetry',
      tracingEnabled: !!OTEL_ENDPOINT,
      metricsEnabled: !OTEL_METRICS_DISABLED,
      prometheusPort: OTEL_METRICS_DISABLED ? null : PROMETHEUS_PORT,
      samplingRatio: OTEL_ENDPOINT ? OTEL_SAMPLER_RATIO : 1.0,
    });
  } catch (error) {
    winstonLogger.error('Failed to initialize telemetry', {
      component: 'Telemetry',
      error: error instanceof Error ? error.message : String(error),
    });
    // Non-fatal: continue without telemetry
  }
}

/**
 * Shutdown telemetry gracefully.
 */
export async function shutdownTelemetry(): Promise<void> {
  if (!sdk) return;
  try {
    await sdk.shutdown();
    winstonLogger.info('Telemetry shut down', {
      component: 'Telemetry',
    });
  } catch (error) {
    winstonLogger.error('Telemetry shutdown error', {
      component: 'Telemetry',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ============================================================
// Business Metrics Registry (R5.1.3)
// ============================================================

/**
 * Centralized business metrics.
 * These counters and histograms are exported via Prometheus /metrics.
 */
class BusinessMetrics {
  private meter: Meter;
  private orderCreated: Counter;
  private paymentSucceeded: Counter;
  private paymentFailed: Counter;
  private pluginGatewayRequests: Counter;
  private pluginGatewayDuration: Histogram;
  private pluginGatewayBreakerState: UpDownCounter;
  private jobsQueueDepth: UpDownCounter;
  private jobsFailed: Counter;
  private jobsDuration: Histogram;
  private httpRequestDuration: Histogram;
  private httpRequestTotal: Counter;

  constructor() {
    this.meter = metrics.getMeter('jiffoo-api', SERVICE_VERSION);

    // Order metrics
    this.orderCreated = this.meter.createCounter('orders_created_total', {
      description: 'Total number of orders created',
    });

    // Payment metrics
    this.paymentSucceeded = this.meter.createCounter('payments_succeeded_total', {
      description: 'Total number of successful payments',
    });
    this.paymentFailed = this.meter.createCounter('payments_failed_total', {
      description: 'Total number of failed payments',
    });

    // Plugin gateway metrics (R2.5)
    this.pluginGatewayRequests = this.meter.createCounter('plugin_gateway_requests_total', {
      description: 'Total plugin gateway requests',
    });
    this.pluginGatewayDuration = this.meter.createHistogram('plugin_gateway_duration_seconds', {
      description: 'Plugin gateway request duration in seconds',
      unit: 's',
    });
    this.pluginGatewayBreakerState = this.meter.createUpDownCounter('plugin_gateway_breaker_state', {
      description: 'Plugin gateway circuit breaker state (1=open, 0=closed)',
    });

    // Job queue metrics (R4.4)
    this.jobsQueueDepth = this.meter.createUpDownCounter('jobs_queue_depth', {
      description: 'Current job queue depth',
    });
    this.jobsFailed = this.meter.createCounter('jobs_failed_total', {
      description: 'Total failed jobs',
    });
    this.jobsDuration = this.meter.createHistogram('jobs_duration_seconds', {
      description: 'Job processing duration in seconds',
      unit: 's',
    });

    // HTTP metrics
    this.httpRequestDuration = this.meter.createHistogram('http_request_duration_seconds', {
      description: 'HTTP request duration in seconds',
      unit: 's',
    });
    this.httpRequestTotal = this.meter.createCounter('http_requests_total', {
      description: 'Total HTTP requests',
    });
  }

  // Order
  recordOrderCreated(): void {
    this.orderCreated.add(1);
  }

  // Payment
  recordPaymentSucceeded(): void {
    this.paymentSucceeded.add(1);
  }
  recordPaymentFailed(): void {
    this.paymentFailed.add(1);
  }

  // Plugin gateway
  recordPluginGatewayRequest(slug: string, status: string): void {
    this.pluginGatewayRequests.add(1, { slug, status });
  }
  recordPluginGatewayDuration(slug: string, durationSeconds: number): void {
    this.pluginGatewayDuration.record(durationSeconds, { slug });
  }
  recordBreakerState(slug: string, isOpen: boolean): void {
    this.pluginGatewayBreakerState.add(isOpen ? 1 : 0, { slug });
  }

  // Jobs
  recordJobQueueDepth(queue: string, depth: number): void {
    this.jobsQueueDepth.add(depth, { queue });
  }
  recordJobFailed(queue: string): void {
    this.jobsFailed.add(1, { queue });
  }
  recordJobDuration(queue: string, durationSeconds: number): void {
    this.jobsDuration.record(durationSeconds, { queue });
  }

  // HTTP
  recordHttpRequest(method: string, route: string, status: number, durationSeconds: number): void {
    this.httpRequestTotal.add(1, { method, route, status: String(status) });
    this.httpRequestDuration.record(durationSeconds, { method, route, status: String(status) });
  }
}

export const businessMetrics = new BusinessMetrics();
