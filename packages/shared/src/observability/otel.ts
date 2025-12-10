/**
 * OpenTelemetry 分布式追踪集成
 * 
 * 提供统一的追踪、指标和日志 API
 */

/**
 * OpenTelemetry 配置
 */
export interface OtelConfig {
  /** 服务名称 */
  serviceName: string;
  /** 服务版本 */
  serviceVersion?: string;
  /** 环境名称 */
  environment?: string;
  /** 追踪导出端点 */
  traceExporterUrl?: string;
  /** 指标导出端点 */
  metricsExporterUrl?: string;
  /** 采样率 (0-1) */
  samplingRatio?: number;
  /** 是否启用自动 instrumentation */
  enableAutoInstrumentation?: boolean;
  /** 启用的 instrumentations */
  instrumentations?: string[];
}

/**
 * Span 上下文
 */
export interface SpanContext {
  traceId: string;
  spanId: string;
  traceFlags: number;
  isRemote?: boolean;
}

/**
 * Span 属性
 */
export interface SpanAttributes {
  [key: string]: string | number | boolean | undefined;
}

/**
 * Span 事件
 */
export interface SpanEvent {
  name: string;
  timestamp?: number;
  attributes?: SpanAttributes;
}

/**
 * 追踪上下文 HTTP 头
 */
export const TRACE_CONTEXT_HEADERS = {
  TRACEPARENT: 'traceparent',
  TRACESTATE: 'tracestate',
  BAGGAGE: 'baggage',
} as const;

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Partial<OtelConfig> = {
  serviceVersion: '1.0.0',
  environment: 'development',
  samplingRatio: 0.1,
  enableAutoInstrumentation: true,
  instrumentations: ['http', 'express', 'fastify', 'pg', 'redis'],
};

/**
 * OpenTelemetry 客户端包装器
 * 
 * 注意：实际使用时需要安装 @opentelemetry/sdk-node 和相关包
 * 这里提供类型安全的包装器
 */
export class OtelClient {
  private config: OtelConfig;
  private initialized = false;

  constructor(config: OtelConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 获取初始化配置
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
   * 标记为已初始化
   */
  markInitialized(): void {
    this.initialized = true;
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 生成 TraceId
   */
  generateTraceId(): string {
    // 32 character hex string
    return Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }

  /**
   * 生成 SpanId
   */
  generateSpanId(): string {
    // 16 character hex string
    return Array.from({ length: 16 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }

  /**
   * 解析 traceparent 头
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
   * 创建 traceparent 头
   */
  createTraceparent(context: SpanContext): string {
    const flags = context.traceFlags.toString(16).padStart(2, '0');
    return `00-${context.traceId}-${context.spanId}-${flags}`;
  }

  /**
   * 创建新的 Span 上下文
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
   * 从 HTTP 头提取追踪上下文
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
   * 注入追踪上下文到 HTTP 头
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
   * 获取服务名称
   */
  getServiceName(): string {
    return this.config.serviceName;
  }

  /**
   * 获取采样率
   */
  getSamplingRatio(): number {
    return this.config.samplingRatio ?? 0.1;
  }
}

/**
 * 创建 OpenTelemetry 客户端
 */
export function createOtelClient(config: OtelConfig): OtelClient {
  return new OtelClient(config);
}

/**
 * 创建 OpenTelemetry 配置（从环境变量）
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

