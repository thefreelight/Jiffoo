/**
 * Unified Logging System - Base Logger
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
 * Base logger implementation
 */
export class BaseLogger implements ILogger {
  protected config: LoggerConfig;
  protected transports: ITransport[] = [];
  protected currentLevel: LogLevel;

  constructor(config: LoggerConfig) {
    // Validate configuration
    const errors = validateLoggerConfig(config);
    if (errors.length > 0) {
      throw new Error(`Invalid logger configuration: ${errors.join(', ')}`);
    }

    this.config = { ...config };
    this.currentLevel = config.level;
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
      ...operation
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
      ...meta
    });
  }

  /**
   * Log security
   */
  logSecurity(event: string, details: any): void {
    this.warn('Security event', {
      type: 'security',
      event,
      details: sanitizeData(details)
    });
  }

  /**
   * Log business
   */
  logBusiness(event: string, details: any): void {
    this.info('Business event', {
      type: 'business',
      event,
      details: sanitizeData(details)
    });
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.currentLevel = level;

    // Update level for all transports
    this.transports.forEach(transport => {
      transport.setLevel(level);
    });
  }

  /**
   * Add transport
   */
  addTransport(transport: ITransport): void {
    this.transports.push(transport);
  }

  /**
   * Remove transport
   */
  removeTransport(transport: ITransport): void {
    const index = this.transports.indexOf(transport);
    if (index > -1) {
      this.transports.splice(index, 1);
    }
  }

  /**
   * Core log method
   */
  protected log(level: LogLevel, message: string, meta: LogMeta = {}): void {
    // Check log level
    if (!shouldLog(this.currentLevel, level)) {
      return;
    }

    try {
      // Data sanitization
      const sanitizedMeta = sanitizeData(meta);

      // Create log entry
      const entry = createLogEntry(
        level,
        message,
        this.config.appName,
        this.config.environment,
        sanitizedMeta,
        this.config.version
      );

      // Send to all transports
      this.sendToTransports(entry);
    } catch (error) {
      // Internal errors in logging system should not affect main business
      this.handleInternalError(error as Error);
    }
  }

  /**
   * Send log to transports
   */
  protected sendToTransports(entry: any): void {
    this.transports.forEach(transport => {
      try {
        const result = transport.log(entry);

        // Handle async transports
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
   * Handle transport error
   */
  protected handleTransportError(error: Error, transport: ITransport): void {
    // Error recovery strategy can be implemented here
    // E.g. remove failed transport, send alert, etc.
    console.error('Logger transport error:', error);
  }

  /**
   * Handle internal errors
   */
  protected handleInternalError(error: Error): void {
    // Logging system internal error handling
    console.error('Logger internal error:', error);
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    const closePromises = this.transports
      .filter(transport => transport.close)
      .map(transport => transport.close!());

    await Promise.all(closePromises);
    this.transports = [];
  }
}