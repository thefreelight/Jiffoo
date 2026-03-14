/**
 * Unified Logging System - Winston Adapter
 */

import { ILogger, LogLevel, LogMeta, OperationLog, LoggerConfig } from '../types';
import { formatError } from '../utils';
import { sanitizeData } from '../sanitizer';

export interface WinstonAdapterOptions {
  winston: any; // winston logger instance
  appName: string;
  environment: string;
  version?: string;
}

/**
 * Winston Adapter - Adapts existing Winston logger to unified interface
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
   * Debug level log
   */
  debug(message: string, meta: LogMeta = {}): void {
    this.log('debug', message, meta);
  }

  /**
   * Info level log
   */
  info(message: string, meta: LogMeta = {}): void {
    this.log('info', message, meta);
  }

  /**
   * Warn level log
   */
  warn(message: string, meta: LogMeta = {}): void {
    this.log('warn', message, meta);
  }

  /**
   * Error level log
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
   * Log operation
   */
  logOperation(operation: OperationLog): void {
    this.info('Operation performed', {
      ...operation,
      timestamp: new Date()
    });
  }

  /**
   * Log performance
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
   * Log security event
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
   * Log business event
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
   * Set log level
   */
  setLevel(level: LogLevel): void {
    if (this.winston && typeof this.winston.level !== 'undefined') {
      this.winston.level = level;
    }
  }

  /**
   * Add transport (Winston specific)
   */
  addTransport(transport: any): void {
    if (this.winston && typeof this.winston.add === 'function') {
      this.winston.add(transport);
    }
  }

  /**
   * Remove transport (Winston specific)
   */
  removeTransport(transport: any): void {
    if (this.winston && typeof this.winston.remove === 'function') {
      this.winston.remove(transport);
    }
  }

  /**
   * Core log method
   */
  private log(level: LogLevel, message: string, meta: LogMeta = {}): void {
    try {
      // Sanitize data
      const sanitizedMeta = sanitizeData(meta);

      // Add unified metadata
      const enrichedMeta = {
        ...sanitizedMeta,
        appName: this.appName,
        environment: this.environment,
        version: this.version,
        timestamp: new Date().toISOString()
      };

      // Call Winston logger
      this.winston.log(level, message, enrichedMeta);
    } catch (error) {
      // Logging system internal errors should not affect main business
      this.handleInternalError(error as Error);
    }
  }

  /**
   * Handle internal errors
   */
  private handleInternalError(error: Error): void {
    // Output error info in development environment
    if (process.env.NODE_ENV === 'development') {
      console.error('WinstonAdapter internal error:', error);
    }
  }

  /**
   * Get underlying Winston instance (for advanced usage)
   */
  getWinstonInstance(): any {
    return this.winston;
  }
}

/**
 * Factory function to create Winston adapter
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
 * Create Winston adapter from LoggerConfig
 */
export function createWinstonAdapterFromConfig(winston: any, config: LoggerConfig): WinstonAdapter {
  return new WinstonAdapter({
    winston,
    appName: config.appName,
    environment: config.environment,
    version: config.version
  });
}