/**
 * 统一日志系统 - 基础日志器
 */

import {
  ILogger,
  ITransport,
  LogLevel,
  LogMeta,
  LoggerConfig,
  OperationLog
} from './types';
import {
  createLogEntry,
  shouldLog,
  formatError,
  validateLoggerConfig
} from './utils';
import { sanitizeData } from './sanitizer';

/**
 * 基础日志器实现
 */
export class BaseLogger implements ILogger {
  protected config: LoggerConfig;
  protected transports: ITransport[] = [];
  protected currentLevel: LogLevel;

  constructor(config: LoggerConfig) {
    // 验证配置
    const errors = validateLoggerConfig(config);
    if (errors.length > 0) {
      throw new Error(`Invalid logger configuration: ${errors.join(', ')}`);
    }

    this.config = { ...config };
    this.currentLevel = config.level;
  }

  /**
   * Debug 级别日志
   */
  debug(message: string, meta: LogMeta = {}): void {
    this.log('debug', message, meta);
  }

  /**
   * Info 级别日志
   */
  info(message: string, meta: LogMeta = {}): void {
    this.log('info', message, meta);
  }

  /**
   * Warn 级别日志
   */
  warn(message: string, meta: LogMeta = {}): void {
    this.log('warn', message, meta);
  }

  /**
   * Error 级别日志
   */
  error(message: string | Error, meta: LogMeta = {}): void {
    let logMessage: string;
    let logMeta = { ...meta };

    if (message instanceof Error) {
      logMessage = message.message;
      logMeta.error = formatError(message);
    } else {
      logMessage = message;
    }

    this.log('error', logMessage, logMeta);
  }

  /**
   * 记录操作日志
   */
  logOperation(operation: OperationLog): void {
    this.info('Operation performed', {
      ...operation
    });
  }

  /**
   * 记录性能日志
   */
  logPerformance(operation: string, duration: number, meta: LogMeta = {}): void {
    this.info('Performance metric', {
      type: 'performance',
      operation,
      duration,
      durationMs: `${duration}ms`,
      ...meta
    });
  }

  /**
   * 记录安全日志
   */
  logSecurity(event: string, details: any): void {
    this.warn('Security event', {
      type: 'security',
      event,
      details: sanitizeData(details)
    });
  }

  /**
   * 记录业务日志
   */
  logBusiness(event: string, details: any): void {
    this.info('Business event', {
      type: 'business',
      event,
      details: sanitizeData(details)
    });
  }

  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel): void {
    this.currentLevel = level;
    
    // 更新所有传输器的级别
    this.transports.forEach(transport => {
      transport.setLevel(level);
    });
  }

  /**
   * 添加传输器
   */
  addTransport(transport: ITransport): void {
    this.transports.push(transport);
  }

  /**
   * 移除传输器
   */
  removeTransport(transport: ITransport): void {
    const index = this.transports.indexOf(transport);
    if (index > -1) {
      this.transports.splice(index, 1);
    }
  }

  /**
   * 核心日志方法
   */
  protected log(level: LogLevel, message: string, meta: LogMeta = {}): void {
    // 检查日志级别
    if (!shouldLog(this.currentLevel, level)) {
      return;
    }

    try {
      // 脱敏处理
      const sanitizedMeta = sanitizeData(meta);

      // 创建日志条目
      const entry = createLogEntry(
        level,
        message,
        this.config.appName,
        this.config.environment,
        sanitizedMeta,
        this.config.version
      );

      // 发送到所有传输器
      this.sendToTransports(entry);
    } catch (error) {
      // 日志系统内部错误不应影响主业务
      this.handleInternalError(error as Error);
    }
  }

  /**
   * 发送日志到传输器
   */
  protected sendToTransports(entry: any): void {
    this.transports.forEach(transport => {
      try {
        const result = transport.log(entry);
        
        // 处理异步传输器
        if (result instanceof Promise) {
          result.catch(error => {
            this.handleTransportError(error, transport);
          });
        }
      } catch (error) {
        this.handleTransportError(error as Error, transport);
      }
    });
  }

  /**
   * 处理传输器错误
   */
  protected handleTransportError(error: Error, transport: ITransport): void {
    // 可以在这里实现错误恢复策略
    // 例如：移除故障传输器、发送告警等
    console.error('Logger transport error:', error);
  }

  /**
   * 处理内部错误
   */
  protected handleInternalError(error: Error): void {
    // 日志系统内部错误处理
    console.error('Logger internal error:', error);
  }

  /**
   * 清理资源
   */
  async destroy(): Promise<void> {
    const closePromises = this.transports
      .filter(transport => transport.close)
      .map(transport => transport.close!());

    await Promise.all(closePromises);
    this.transports = [];
  }
}