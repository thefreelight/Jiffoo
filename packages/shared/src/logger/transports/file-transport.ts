/**
 * Unified Logging System - File Transport (Node.js only)
 */

import { ITransport, LogEntry, LogLevel } from '../types';
import { FileFormatter } from '../formatters';
import { shouldLog } from '../utils';

export interface FileTransportOptions {
  level?: LogLevel;
  filename: string;
  maxSize?: string;
  maxFiles?: string | number;
  datePattern?: string;
  zippedArchive?: boolean;
  json?: boolean;
  prettyPrint?: boolean;
}

/**
 * File Transport - Based on winston-daily-rotate-file
 * Only available in Node.js environment
 */
export class FileTransport implements ITransport {
  private level: LogLevel;
  private formatter: FileFormatter;
  private options: FileTransportOptions;
  private writeStream: any = null;
  private isNode: boolean;

  constructor(options: FileTransportOptions) {
    this.level = options.level || 'debug';
    this.options = options;
    this.isNode = typeof window === 'undefined' && typeof process !== 'undefined';

    this.formatter = new FileFormatter({
      timestamp: true,
      colorize: false,
      json: options.json ?? true,
      prettyPrint: options.prettyPrint ?? false
    });

    if (this.isNode) {
      this.initializeFileStream();
    }
  }

  /**
   * Log entry
   */
  log(entry: LogEntry): void {
    // Check if in Node.js environment
    if (!this.isNode) {
      console.warn('FileTransport is only available in Node.js environment');
      return;
    }

    // Check log level
    if (!shouldLog(this.level, entry.level)) {
      return;
    }

    try {
      const formattedMessage = this.formatter.format(entry);
      this.writeToFile(formattedMessage);
    } catch (error) {
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
   * Close file stream
   */
  async close(): Promise<void> {
    if (this.writeStream && typeof this.writeStream.close === 'function') {
      return new Promise((resolve) => {
        this.writeStream.close(() => {
          resolve();
        });
      });
    }
  }

  /**
   * Initialize file stream
   */
  private initializeFileStream(): void {
    try {
      // Dynamic import
      const DailyRotateFile = require('winston-daily-rotate-file');

      this.writeStream = new DailyRotateFile({
        filename: this.options.filename,
        datePattern: this.options.datePattern || 'YYYY-MM-DD',
        maxSize: this.options.maxSize || '20m',
        maxFiles: this.options.maxFiles || '14d',
        zippedArchive: this.options.zippedArchive ?? true,
        format: {
          transform: (info: any) => {
            // Return directly as we have already formatted in log method
            return info;
          }
        }
      });

      // Listen for error events
      this.writeStream.on('error', (error: Error) => {
        this.handleError(error);
      });

    } catch (error) {
      console.warn('Failed to initialize FileTransport:', error);
      this.writeStream = null;
    }
  }

  /**
   * Write to file
   */
  private writeToFile(message: string): void {
    if (this.writeStream && typeof this.writeStream.write === 'function') {
      this.writeStream.write({
        level: 'info', // Format required by winston
        message: message,
        timestamp: new Date().toISOString()
      });
    } else {
      // Fallback to simple file write
      this.fallbackFileWrite(message);
    }
  }

  /**
   * Fallback file write method
   */
  private fallbackFileWrite(message: string): void {
    // Execute only in Node.js environment
    if (typeof window !== 'undefined') {
      console.warn('FileTransport fallback not available in browser environment');
      return;
    }

    try {
      const fs = require('fs');
      const path = require('path');

      // Ensure directory exists
      const dir = path.dirname(this.options.filename);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Append write to file
      fs.appendFileSync(this.options.filename, message + '\n', 'utf8');
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * Handle error
   */
  private handleError(error: Error): void {
    // Output error info in development environment
    if (process.env.NODE_ENV === 'development') {
      console.error('FileTransport error:', error);
    }
  }
}

/**
 * Factory function to create file transport
 */
export function createFileTransport(options: FileTransportOptions): FileTransport {
  return new FileTransport(options);
}

/**
 * Create error log file transport
 */
export function createErrorFileTransport(baseDir: string = './logs'): FileTransport {
  return new FileTransport({
    filename: `${baseDir}/error-%DATE%.log`,
    level: 'error',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    zippedArchive: true,
    json: true
  });
}

/**
 * Create combined log file transport
 */
export function createCombinedFileTransport(baseDir: string = './logs'): FileTransport {
  return new FileTransport({
    filename: `${baseDir}/combined-%DATE%.log`,
    level: 'debug',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d',
    zippedArchive: true,
    json: true
  });
}