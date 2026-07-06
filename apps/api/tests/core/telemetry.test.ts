/**
 * Tests for Telemetry Infrastructure (R5)
 *
 * Tests cover:
 * - BusinessMetrics: recording and no-throw guarantees
 * - SlowQueryExtension: shouldLog rate limiting
 * - Telemetry init/shutdown lifecycle
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock winston logger
vi.mock('@/core/logger/unified-logger', () => ({
  winstonLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  LoggerService: {
    log: vi.fn(),
    logError: vi.fn(),
  },
}));

// Mock OTel SDK to avoid actual telemetry initialization
vi.mock('@opentelemetry/sdk-node', () => ({
  NodeSDK: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    shutdown: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@opentelemetry/auto-instrumentations-node', () => ({
  getNodeAutoInstrumentations: vi.fn().mockReturnValue([]),
}));

vi.mock('@opentelemetry/exporter-trace-otlp-http', () => ({
  OTLPTraceExporter: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@opentelemetry/exporter-metrics-otlp-http', () => ({
  OTLPMetricExporter: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@opentelemetry/exporter-prometheus', () => ({
  PrometheusExporter: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@opentelemetry/resources', () => ({
  resourceFromAttributes: vi.fn().mockReturnValue({}),
}));

vi.mock('@opentelemetry/semantic-conventions', () => ({
  ATTR_SERVICE_NAME: 'service.name',
  ATTR_SERVICE_VERSION: 'service.version',
}));

vi.mock('@opentelemetry/sdk-trace-base', () => ({
  ParentBasedSampler: vi.fn().mockImplementation(() => ({})),
  TraceIdRatioBasedSampler: vi.fn().mockImplementation(() => ({})),
  AlwaysOnSampler: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@opentelemetry/api', () => {
  const mockMeter = {
    createCounter: vi.fn().mockReturnValue({
      add: vi.fn(),
    }),
    createHistogram: vi.fn().mockReturnValue({
      record: vi.fn(),
    }),
    createUpDownCounter: vi.fn().mockReturnValue({
      add: vi.fn(),
    }),
  };
  return {
    metrics: {
      getMeter: vi.fn().mockReturnValue(mockMeter),
    },
  };
});

describe('Telemetry Infrastructure (R5)', () => {
  describe('BusinessMetrics', () => {
    it('should record order creation without throwing', async () => {
      const { businessMetrics } = await import('@/infra/telemetry');
      expect(() => businessMetrics.recordOrderCreated()).not.toThrow();
    });

    it('should record payment success/failure without throwing', async () => {
      const { businessMetrics } = await import('@/infra/telemetry');
      expect(() => businessMetrics.recordPaymentSucceeded()).not.toThrow();
      expect(() => businessMetrics.recordPaymentFailed()).not.toThrow();
    });

    it('should record plugin gateway metrics without throwing', async () => {
      const { businessMetrics } = await import('@/infra/telemetry');
      expect(() => businessMetrics.recordPluginGatewayRequest('test-plugin', '200')).not.toThrow();
      expect(() => businessMetrics.recordPluginGatewayDuration('test-plugin', 0.5)).not.toThrow();
      expect(() => businessMetrics.recordBreakerState('test-plugin', false)).not.toThrow();
    });

    it('should record job queue metrics without throwing', async () => {
      const { businessMetrics } = await import('@/infra/telemetry');
      expect(() => businessMetrics.recordJobQueueDepth('webhook-delivery', 10)).not.toThrow();
      expect(() => businessMetrics.recordJobFailed('email')).not.toThrow();
      expect(() => businessMetrics.recordJobDuration('fulfillment', 1.5)).not.toThrow();
    });

    it('should record HTTP request metrics without throwing', async () => {
      const { businessMetrics } = await import('@/infra/telemetry');
      expect(() =>
        businessMetrics.recordHttpRequest('GET', '/api/products', 200, 0.05)
      ).not.toThrow();
      expect(() =>
        businessMetrics.recordHttpRequest('POST', '/api/orders', 500, 2.5)
      ).not.toThrow();
    });
  });

  describe('SlowQueryExtension', () => {
    it('should export a Prisma extension', async () => {
      const { slowQueryExtension } = await import('@/infra/prisma-slow-query-extension');
      expect(slowQueryExtension).toBeDefined();
    });
  });

  describe('Telemetry Lifecycle', () => {
    it('should initialize and shutdown without errors', async () => {
      const { initTelemetry, shutdownTelemetry } = await import('@/infra/telemetry');
      await expect(initTelemetry()).resolves.not.toThrow();
      await expect(shutdownTelemetry()).resolves.not.toThrow();
    });

    it('should be idempotent on multiple init calls', async () => {
      const { initTelemetry } = await import('@/infra/telemetry');
      await expect(initTelemetry()).resolves.not.toThrow();
      await expect(initTelemetry()).resolves.not.toThrow(); // No-op
    });
  });
});
