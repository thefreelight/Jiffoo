/**
 * 统一日志系统 - Winston 适配器
 */

import { ILogger, LogLevel, LogMeta, OperationLog, LoggerConfig } from '../types';
import { formatError, sanitizeData } from '../utils';

export interface WinstonAdapterOptions {
  winston: any; // winston logger instance
  appName: string;
  environment: string;
  version?: string;
}

/**
 * Winston 适配器 - 将现有的 Winston logger 适配到统一接口
 */
export class WinstonAdapter implements ILogger {
  private winston: any;
  private appName: string;
  private environment: string;
  private version?: string;

  constructor(options: WinstonAdapterOptions) {
    this.winston = options.winston;
    this.appName = options.appName;
    this.environment = options.environment;
    this.version = options.version;
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
      ...operation,
      timestamp: new Date()
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
      timestamp: new Date(),
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
      details: sanitizeData(details),
      timestamp: new Date()
    });
  }

  /**
   * 记录业务日志
   */
  logBusiness(event: string, details: any): void {
    this.info('Business event', {
      type: 'business',
      event,
      details: sanitizeData(details),
      timestamp: new Date()
    });
  }

  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel): void {
    if (this.winston && typeof this.winston.level !== 'undefined') {
      this.winston.level = level;
    }
  }

  /**
   * 添加传输器 (Winston specific)
   */
  addTransport(transport: any): void {
    if (this.winston && typeof this.winston.add === 'function') {
      this.winston.add(transport);
    }
  }

  /**
   * 移除传输器 (Winston specific)
   */
  removeTransport(transport: any): void {
    if (this.winston && typeof this.winston.remove === 'function') {
      this.winston.remove(transport);
    }
  }

  /**
   * 核心日志方法
   */
  private log(level: LogLevel, message: string, meta: LogMeta = {}): void {
    try {
      // 脱敏处理
      const sanitizedMeta = sanitizeData(meta);

      // 添加统一的元数据
      const enrichedMeta = {
        ...sanitizedMeta,
        appName: this.appName,
        environment: this.environment,
        version: this.version,
        timestamp: new Date().toISOString()
      };

      // 调用 Winston logger
      this.winston.log(level, message, enrichedMeta);
    } catch (error) {
      // 日志系统内部错误不应影响主业务
      this.handleInternalError(error as Error);
    }
  }

  /**
   * 处理内部错误
   */
  private handleInternalError(error: Error): void {
    // 在开发环境下输出错误信息
    if (process.env.NODE_ENV === 'development') {
      console.error('WinstonAdapter internal error:', error);
    }
  }

  /**
   * 获取底层 Winston 实例 (用于高级用法)
   */
  getWinstonInstance(): any {
    return this.winston;
  }
}

/**
 * 创建 Winston 适配器的工厂函数
 */
export function createWinstonAdapter(winston: any, config: Partial<WinstonAdapterOptions>): WinstonAdapter {
  return new WinstonAdapter({
    winston,
    appName: config.appName || 'api',
    environment: config.environment || process.env.NODE_ENV || 'development',
    version: config.version
  });
}

/**
 * 从 LoggerConfig 创建 Winston 适配器
 */
export function createWinstonAdapterFromConfig(winston: any, config: LoggerConfig): WinstonAdapter {
  return new WinstonAdapter({
    winston,
    appName: config.appName,
    environment: config.environment,
    version: config.version
  });
}