import pino, { Logger as PinoLogger } from 'pino';

/**
 * 日志管理器
 * 提供结构化日志记录功能
 */
export class Logger {
  private pinoLogger: PinoLogger;
  private context: string;

  constructor(context: string = 'Plugin', level: string = 'info') {
    this.context = context;
    
    this.pinoLogger = pino({
      name: context,
      level,
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => {
          return { level: label.toUpperCase() };
        },
        log: (object) => {
          return {
            ...object,
            context: this.context,
            timestamp: new Date().toISOString(),
            pid: process.pid
          };
        }
      },
      serializers: {
        error: pino.stdSerializers.err,
        req: pino.stdSerializers.req,
        res: pino.stdSerializers.res
      },
      transport: process.env.NODE_ENV === 'development' ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      } : undefined
    });
  }

  /**
   * 记录调试信息
   */
  public debug(message: string, meta?: any): void {
    this.pinoLogger.debug(meta, message);
  }

  /**
   * 记录一般信息
   */
  public info(message: string, meta?: any): void {
    this.pinoLogger.info(meta, message);
  }

  /**
   * 记录警告信息
   */
  public warn(message: string, meta?: any): void {
    this.pinoLogger.warn(meta, message);
  }

  /**
   * 记录错误信息
   */
  public error(message: string, error?: Error | any, meta?: any): void {
    if (error instanceof Error) {
      this.pinoLogger.error({ err: error, ...meta }, message);
    } else {
      this.pinoLogger.error({ error, ...meta }, message);
    }
  }

  /**
   * 记录致命错误
   */
  public fatal(message: string, error?: Error | any, meta?: any): void {
    if (error instanceof Error) {
      this.pinoLogger.fatal({ err: error, ...meta }, message);
    } else {
      this.pinoLogger.fatal({ error, ...meta }, message);
    }
  }

  /**
   * 创建子日志器
   */
  public child(bindings: any): Logger {
    const childLogger = new Logger(this.context);
    childLogger.pinoLogger = this.pinoLogger.child(bindings);
    return childLogger;
  }

  /**
   * 设置日志级别
   */
  public setLevel(level: string): void {
    this.pinoLogger.level = level;
  }

  /**
   * 获取Pino日志器实例
   */
  public getPinoLogger(): PinoLogger {
    return this.pinoLogger;
  }

  /**
   * 记录HTTP请求
   */
  public logRequest(req: any, res: any, responseTime?: number): void {
    const meta = {
      req: {
        method: req.method,
        url: req.url,
        headers: req.headers,
        remoteAddress: req.ip,
        userAgent: req.headers['user-agent']
      },
      res: {
        statusCode: res.statusCode,
        headers: res.getHeaders ? res.getHeaders() : {}
      },
      responseTime
    };

    if (res.statusCode >= 400) {
      this.error(`HTTP ${req.method} ${req.url} - ${res.statusCode}`, null, meta);
    } else {
      this.info(`HTTP ${req.method} ${req.url} - ${res.statusCode}`, meta);
    }
  }

  /**
   * 记录数据库操作
   */
  public logDatabase(operation: string, table?: string, duration?: number, error?: Error): void {
    const meta = {
      operation,
      table,
      duration,
      type: 'database'
    };

    if (error) {
      this.error(`Database operation failed: ${operation}`, error, meta);
    } else {
      this.debug(`Database operation: ${operation}`, meta);
    }
  }

  /**
   * 记录缓存操作
   */
  public logCache(operation: string, key?: string, hit?: boolean, duration?: number): void {
    const meta = {
      operation,
      key,
      hit,
      duration,
      type: 'cache'
    };

    this.debug(`Cache operation: ${operation}`, meta);
  }

  /**
   * 记录外部API调用
   */
  public logExternalApi(
    method: string,
    url: string,
    statusCode?: number,
    duration?: number,
    error?: Error
  ): void {
    const meta = {
      method,
      url,
      statusCode,
      duration,
      type: 'external_api'
    };

    if (error) {
      this.error(`External API call failed: ${method} ${url}`, error, meta);
    } else if (statusCode && statusCode >= 400) {
      this.warn(`External API call returned error: ${method} ${url} - ${statusCode}`, meta);
    } else {
      this.info(`External API call: ${method} ${url} - ${statusCode}`, meta);
    }
  }

  /**
   * 记录业务事件
   */
  public logBusinessEvent(event: string, data?: any, userId?: string): void {
    const meta = {
      event,
      data,
      userId,
      type: 'business_event'
    };

    this.info(`Business event: ${event}`, meta);
  }

  /**
   * 记录安全事件
   */
  public logSecurityEvent(event: string, details?: any, severity: 'low' | 'medium' | 'high' = 'medium'): void {
    const meta = {
      event,
      details,
      severity,
      type: 'security_event'
    };

    if (severity === 'high') {
      this.error(`Security event: ${event}`, null, meta);
    } else if (severity === 'medium') {
      this.warn(`Security event: ${event}`, meta);
    } else {
      this.info(`Security event: ${event}`, meta);
    }
  }

  /**
   * 记录性能指标
   */
  public logPerformance(metric: string, value: number, unit: string = 'ms', tags?: Record<string, string>): void {
    const meta = {
      metric,
      value,
      unit,
      tags,
      type: 'performance'
    };

    this.info(`Performance metric: ${metric} = ${value}${unit}`, meta);
  }

  /**
   * 记录插件生命周期事件
   */
  public logLifecycle(event: 'starting' | 'started' | 'stopping' | 'stopped' | 'error', details?: any): void {
    const meta = {
      event,
      details,
      type: 'lifecycle'
    };

    if (event === 'error') {
      this.error(`Plugin lifecycle event: ${event}`, details, meta);
    } else {
      this.info(`Plugin lifecycle event: ${event}`, meta);
    }
  }

  /**
   * 记录配置变更
   */
  public logConfigChange(key: string, oldValue?: any, newValue?: any, source?: string): void {
    const meta = {
      key,
      oldValue,
      newValue,
      source,
      type: 'config_change'
    };

    this.info(`Configuration changed: ${key}`, meta);
  }

  /**
   * 记录资源使用情况
   */
  public logResourceUsage(resource: string, usage: number, limit?: number, unit?: string): void {
    const meta = {
      resource,
      usage,
      limit,
      unit,
      percentage: limit ? Math.round((usage / limit) * 100) : undefined,
      type: 'resource_usage'
    };

    const level = limit && usage > limit * 0.8 ? 'warn' : 'debug';
    this[level](`Resource usage: ${resource} = ${usage}${unit || ''}`, meta);
  }

  /**
   * 创建计时器
   */
  public timer(label: string): () => void {
    const start = Date.now();
    
    return () => {
      const duration = Date.now() - start;
      this.logPerformance(label, duration, 'ms');
    };
  }

  /**
   * 异步操作包装器
   */
  public async withTiming<T>(label: string, operation: () => Promise<T>): Promise<T> {
    const start = Date.now();
    
    try {
      const result = await operation();
      const duration = Date.now() - start;
      this.logPerformance(label, duration, 'ms');
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.error(`Operation failed: ${label}`, error, { duration });
      throw error;
    }
  }

  /**
   * 批量日志记录
   */
  public batch(logs: Array<{
    level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
    message: string;
    meta?: any;
    error?: Error;
  }>): void {
    logs.forEach(log => {
      if (log.level === 'error' || log.level === 'fatal') {
        this[log.level](log.message, log.error, log.meta);
      } else {
        this[log.level](log.message, log.meta);
      }
    });
  }

  /**
   * 获取日志统计信息
   */
  public getStats(): {
    context: string;
    level: string;
    pid: number;
  } {
    return {
      context: this.context,
      level: this.pinoLogger.level,
      pid: process.pid
    };
  }
}
