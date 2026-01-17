/**
 * OpenTelemetry Distributed Tracing Integration
 * 
 * Provides unified API for tracing, metrics, and logs.
 */

/**
 * OpenTelemetry Configuration
 */
export interface OtelConfig {
  /** Service Name */
  serviceName: string;
  /** Service Version */
  serviceVersion?: string;
  /** Environment Name */
  environment?: string;
  /** Trace Exporter Endpoint */
  traceExporterUrl?: string;
  /** Metrics Exporter Endpoint */
  metricsExporterUrl?: string;
  /** Sampling Ratio (0-1) */
  samplingRatio?: number;
  /** Enable auto instrumentation */
  enableAutoInstrumentation?: boolean;
  /** Enabled instrumentations */
  instrumentations?: string[];
}

/**
 * Span Context
 */
export interface SpanContext {
  traceId: string;
  spanId: string;
  traceFlags: number;
  isRemote?: boolean;
}

/**
 * Span Attributes
 */
export interface SpanAttributes {
  [key: string]: string | number | boolean | undefined;
}

/**
 * Span Event
 */
export interface SpanEvent {
  name: string;
  timestamp?: number;
  attributes?: SpanAttributes;
}

/**
 * Trace Context HTTP Headers
 */
export const TRACE_CONTEXT_HEADERS = {
  TRACEPARENT: 'traceparent',
  TRACESTATE: 'tracestate',
  BAGGAGE: 'baggage',
  REQUEST_ID: 'x-request-id',
} as const;

/**
 * Default Configuration
 */
const DEFAULT_CONFIG: Partial<OtelConfig> = {
  serviceVersion: '1.0.0',
  environment: 'development',
  samplingRatio: 0.1,
  enableAutoInstrumentation: true,
  instrumentations: ['http', 'express', 'fastify', 'pg', 'redis'],
};

/**
 * OpenTelemetry Client Wrapper
 * 
 * Note: Requires @opentelemetry/sdk-node and related packages for actual implementation.
 * Provides a type-safe wrapper for tracing operations.
 */
export class OtelClient {
  private config: OtelConfig;
  private initialized = false;

  constructor(config: OtelConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get initialization configuration
   */
  getInitConfig(): Record<string, unknown> {
    return {
      serviceName: this.config.serviceName,
      serviceVersion: this.config.serviceVersion,
      environment: this.config.environment,
      traceExporterUrl: this.config.traceExporterUrl,
      metricsExporterUrl: this.config.metricsExporterUrl,
      samplingRatio: this.config.samplingRatio,
    };
  }

  /**
   * Mark as initialized
   */
  markInitialized(): void {
    this.initialized = true;
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Generate TraceId
   */
  generateTraceId(): string {
    // 32 character hex string
    return Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }

  /**
   * Generate SpanId
   */
  generateSpanId(): string {
    // 16 character hex string
    return Array.from({ length: 16 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }

  /**
   * Parse traceparent header
   */
  parseTraceparent(header: string): SpanContext | null {
    // Format: version-traceId-spanId-traceFlags
    // Example: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
    const parts = header.split('-');
    if (parts.length !== 4) {
      return null;
    }

    const [version, traceId, spanId, flags] = parts;
    if (version !== '00' || traceId.length !== 32 || spanId.length !== 16) {
      return null;
    }

    return {
      traceId,
      spanId,
      traceFlags: parseInt(flags, 16),
      isRemote: true,
    };
  }

  /**
   * Create traceparent header
   */
  createTraceparent(context: SpanContext): string {
    const flags = context.traceFlags.toString(16).padStart(2, '0');
    return `00-${context.traceId}-${context.spanId}-${flags}`;
  }

  /**
   * Create new Span context
   */
  createSpanContext(parentContext?: SpanContext): SpanContext {
    return {
      traceId: parentContext?.traceId ?? this.generateTraceId(),
      spanId: this.generateSpanId(),
      traceFlags: parentContext?.traceFlags ?? 1,
      isRemote: false,
    };
  }

  /**
   * Extract tracing context from HTTP headers
   */
  extractFromHeaders(
    headers: Record<string, string | undefined>
  ): SpanContext | null {
    const traceparent = headers[TRACE_CONTEXT_HEADERS.TRACEPARENT];
    if (!traceparent) {
      return null;
    }
    return this.parseTraceparent(traceparent);
  }

  /**
   * Inject tracing context into HTTP headers
   */
  injectToHeaders(
    context: SpanContext,
    headers: Record<string, string>
  ): Record<string, string> {
    return {
      ...headers,
      [TRACE_CONTEXT_HEADERS.TRACEPARENT]: this.createTraceparent(context),
    };
  }

  /**
   * Get service name
   */
  getServiceName(): string {
    return this.config.serviceName;
  }

  /**
   * Get sampling ratio
   */
  getSamplingRatio(): number {
    return this.config.samplingRatio ?? 0.1;
  }
}

/**
 * Create OpenTelemetry Client
 */
export function createOtelClient(config: OtelConfig): OtelClient {
  return new OtelClient(config);
}

/**
 * Create OpenTelemetry Configuration from environment variables
 */
export function createOtelConfigFromEnv(serviceName: string): OtelConfig {
  return {
    serviceName,
    serviceVersion: process.env.npm_package_version ?? '1.0.0',
    environment: process.env.NODE_ENV ?? 'development',
    traceExporterUrl: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
    metricsExporterUrl: process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT,
    samplingRatio: parseFloat(process.env.OTEL_TRACES_SAMPLER_ARG ?? '0.1'),
    enableAutoInstrumentation: process.env.OTEL_AUTO_INSTRUMENTATION !== 'false',
  };
}
