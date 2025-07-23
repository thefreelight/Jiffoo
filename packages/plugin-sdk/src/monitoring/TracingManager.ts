import { Logger } from '../utils/Logger';
import { PluginError } from '../types/PluginTypes';

/**
 * 链路追踪管理器
 * 负责分布式链路追踪
 */
export class TracingManager {
  private logger: Logger;
  private config: TracingConfig;
  private activeSpans: Map<string, Span> = new Map();

  constructor(config: TracingConfig) {
    this.logger = new Logger('TracingManager');
    this.config = config;
  }

  /**
   * 初始化追踪
   */
  public async initialize(): Promise<void> {
    try {
      if (!this.config.enabled) {
        this.logger.info('Tracing is disabled');
        return;
      }

      // TODO: 初始化OpenTelemetry或Jaeger客户端
      this.logger.info('Tracing initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize tracing', error);
      throw new PluginError('Tracing initialization failed', 'TRACING_INIT_ERROR', 500, error);
    }
  }

  /**
   * 开始新的跨度
   */
  public startSpan(name: string, options?: SpanOptions): Span {
    const span: Span = {
      id: this.generateSpanId(),
      traceId: options?.traceId || this.generateTraceId(),
      parentId: options?.parentId,
      name,
      startTime: Date.now(),
      tags: options?.tags || {},
      logs: [],
      status: 'active'
    };

    this.activeSpans.set(span.id, span);
    
    this.logger.debug(`Span started: ${name}`, {
      spanId: span.id,
      traceId: span.traceId,
      parentId: span.parentId
    });

    return span;
  }

  /**
   * 结束跨度
   */
  public finishSpan(spanId: string, status?: 'success' | 'error'): void {
    const span = this.activeSpans.get(spanId);
    if (!span) {
      this.logger.warn(`Span not found: ${spanId}`);
      return;
    }

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.status = status || 'success';

    this.activeSpans.delete(spanId);
    
    // 发送到追踪系统
    this.sendSpan(span);

    this.logger.debug(`Span finished: ${span.name}`, {
      spanId: span.id,
      duration: span.duration,
      status: span.status
    });
  }

  /**
   * 添加标签到跨度
   */
  public setSpanTag(spanId: string, key: string, value: any): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.tags[key] = value;
      this.logger.debug(`Span tag set: ${key} = ${value}`, { spanId });
    }
  }

  /**
   * 添加日志到跨度
   */
  public logSpanEvent(spanId: string, event: string, data?: any): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.logs.push({
        timestamp: Date.now(),
        event,
        data
      });
      this.logger.debug(`Span event logged: ${event}`, { spanId, data });
    }
  }

  /**
   * 记录错误到跨度
   */
  public recordSpanError(spanId: string, error: Error): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.tags.error = true;
      span.tags['error.message'] = error.message;
      span.tags['error.stack'] = error.stack;
      
      span.logs.push({
        timestamp: Date.now(),
        event: 'error',
        data: {
          message: error.message,
          stack: error.stack
        }
      });

      this.logger.debug(`Span error recorded`, { spanId, error: error.message });
    }
  }

  /**
   * 创建子跨度
   */
  public createChildSpan(parentSpanId: string, name: string, options?: Omit<SpanOptions, 'parentId'>): Span {
    const parentSpan = this.activeSpans.get(parentSpanId);
    if (!parentSpan) {
      this.logger.warn(`Parent span not found: ${parentSpanId}`);
      return this.startSpan(name, options);
    }

    return this.startSpan(name, {
      ...options,
      parentId: parentSpanId,
      traceId: parentSpan.traceId
    });
  }

  /**
   * 获取当前活跃的跨度
   */
  public getActiveSpan(spanId: string): Span | undefined {
    return this.activeSpans.get(spanId);
  }

  /**
   * 获取所有活跃的跨度
   */
  public getAllActiveSpans(): Span[] {
    return Array.from(this.activeSpans.values());
  }

  /**
   * 包装函数以自动追踪
   */
  public trace<T>(name: string, fn: (span: Span) => T, options?: SpanOptions): T {
    const span = this.startSpan(name, options);
    
    try {
      const result = fn(span);
      this.finishSpan(span.id, 'success');
      return result;
    } catch (error) {
      this.recordSpanError(span.id, error as Error);
      this.finishSpan(span.id, 'error');
      throw error;
    }
  }

  /**
   * 包装异步函数以自动追踪
   */
  public async traceAsync<T>(
    name: string, 
    fn: (span: Span) => Promise<T>, 
    options?: SpanOptions
  ): Promise<T> {
    const span = this.startSpan(name, options);
    
    try {
      const result = await fn(span);
      this.finishSpan(span.id, 'success');
      return result;
    } catch (error) {
      this.recordSpanError(span.id, error as Error);
      this.finishSpan(span.id, 'error');
      throw error;
    }
  }

  /**
   * 从HTTP头中提取追踪上下文
   */
  public extractTraceContext(headers: Record<string, string>): TraceContext | null {
    try {
      // 支持多种追踪头格式
      const traceHeader = headers['x-trace-id'] || 
                         headers['X-Trace-Id'] ||
                         headers['traceparent'] ||
                         headers['uber-trace-id'];

      if (!traceHeader) {
        return null;
      }

      // 简单的追踪ID提取（实际实现应该支持W3C Trace Context等标准）
      const parts = traceHeader.split('-');
      if (parts.length >= 2) {
        return {
          traceId: parts[0],
          spanId: parts[1],
          flags: parts[2] || '01'
        };
      }

      return {
        traceId: traceHeader,
        spanId: this.generateSpanId(),
        flags: '01'
      };
    } catch (error) {
      this.logger.error('Failed to extract trace context', error);
      return null;
    }
  }

  /**
   * 注入追踪上下文到HTTP头
   */
  public injectTraceContext(span: Span, headers: Record<string, string>): void {
    try {
      // W3C Trace Context格式
      headers['traceparent'] = `00-${span.traceId}-${span.id}-01`;
      
      // 自定义格式
      headers['x-trace-id'] = span.traceId;
      headers['x-span-id'] = span.id;
      
      if (span.parentId) {
        headers['x-parent-span-id'] = span.parentId;
      }

      this.logger.debug('Trace context injected', {
        traceId: span.traceId,
        spanId: span.id
      });
    } catch (error) {
      this.logger.error('Failed to inject trace context', error);
    }
  }

  /**
   * 发送跨度到追踪系统
   */
  private sendSpan(span: Span): void {
    try {
      if (!this.config.enabled) {
        return;
      }

      // TODO: 发送到Jaeger、Zipkin或其他追踪系统
      this.logger.debug('Span sent to tracing system', {
        spanId: span.id,
        traceId: span.traceId,
        name: span.name,
        duration: span.duration
      });
    } catch (error) {
      this.logger.error('Failed to send span to tracing system', error);
    }
  }

  /**
   * 生成追踪ID
   */
  private generateTraceId(): string {
    return Array.from({ length: 32 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }

  /**
   * 生成跨度ID
   */
  private generateSpanId(): string {
    return Array.from({ length: 16 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
  }

  /**
   * 清理过期的跨度
   */
  public cleanup(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5分钟

    for (const [spanId, span] of this.activeSpans) {
      if (now - span.startTime > maxAge) {
        this.logger.warn(`Cleaning up stale span: ${span.name}`, { spanId });
        this.finishSpan(spanId, 'error');
      }
    }
  }

  /**
   * 获取追踪统计信息
   */
  public getStats(): TracingStats {
    return {
      activeSpans: this.activeSpans.size,
      enabled: this.config.enabled,
      serviceName: this.config.serviceName || 'unknown'
    };
  }
}

// 追踪配置接口
export interface TracingConfig {
  enabled: boolean;
  endpoint?: string;
  serviceName?: string;
  sampleRate?: number;
}

// 跨度选项接口
export interface SpanOptions {
  traceId?: string;
  parentId?: string;
  tags?: Record<string, any>;
}

// 跨度接口
export interface Span {
  id: string;
  traceId: string;
  parentId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  tags: Record<string, any>;
  logs: SpanLog[];
  status: 'active' | 'success' | 'error';
}

// 跨度日志接口
export interface SpanLog {
  timestamp: number;
  event: string;
  data?: any;
}

// 追踪上下文接口
export interface TraceContext {
  traceId: string;
  spanId: string;
  flags: string;
}

// 追踪统计接口
export interface TracingStats {
  activeSpans: number;
  enabled: boolean;
  serviceName: string;
}
