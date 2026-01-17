/**
 * Unified Logging System - Console Transport
 */

import { ITransport, LogEntry, LogLevel } from '../types';
import { ConsoleFormatter } from '../formatters';
import { shouldLog } from '../utils';

export interface ConsoleTransportOptions {
  level?: LogLevel;
  colorize?: boolean;
  timestamp?: boolean;
  json?: boolean;
  prettyPrint?: boolean;
}

/**
 * Console Transport - Supports Browser and Node.js environments
 */
export class ConsoleTransport implements ITransport {
  private level: LogLevel;
  private formatter: ConsoleFormatter;
  private isBrowser: boolean;

  constructor(options: ConsoleTransportOptions = {}) {
    this.level = options.level || 'debug';
    this.isBrowser = typeof window !== 'undefined';

    this.formatter = new ConsoleFormatter({
      timestamp: options.timestamp ?? true,
      colorize: options.colorize ?? !this.isBrowser,
      json: options.json ?? false,
      prettyPrint: options.prettyPrint ?? false
    });
  }

  /**
   * Log entry
   */
  log(entry: LogEntry): void {
    // Check log level
    if (!shouldLog(this.level, entry.level)) {
      return;
    }

    try {
      if (this.isBrowser) {
        this.logToBrowser(entry);
      } else {
        this.logToNode(entry);
      }
    } catch (error) {
      // Fail silently, do not affect main business logic
      this.handleError(error as Error);
    }
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Browser environment log output
   */
  private logToBrowser(entry: LogEntry): void {
    const { message, args } = this.formatter.formatForConsole(entry);

    switch (entry.level) {
      case 'debug':
        console.debug(message, ...args);
        break;
      case 'info':
        console.info(message, ...args);
        break;
      case 'warn':
        console.warn(message, ...args);
        break;
      case 'error':
        console.error(message, ...args);
        break;
      default:
        console.log(message, ...args);
    }
  }

  /**
   * Node.js environment log output
   */
  private logToNode(entry: LogEntry): void {
    const formattedMessage = this.formatter.format(entry);

    switch (entry.level) {
      case 'debug':
      case 'info':
        process.stdout.write(formattedMessage + '\n');
        break;
      case 'warn':
      case 'error':
        process.stderr.write(formattedMessage + '\n');
        break;
      default:
        process.stdout.write(formattedMessage + '\n');
    }
  }

  /**
   * Handle internal errors
   */
  private handleError(error: Error): void {
    // Output error info in development environment
    if (process.env.NODE_ENV === 'development') {
      console.error('ConsoleTransport error:', error);
    }
  }
}

/**
 * Factory function to create console transport
 */
export function createConsoleTransport(options: ConsoleTransportOptions = {}): ConsoleTransport {
  return new ConsoleTransport(options);
}