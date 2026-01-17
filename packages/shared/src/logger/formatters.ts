/**
 * Unified Logging System - Formatters
 */

import { LogEntry, LogFormat } from './types';

/**
 * Base log formatter
 */
export class LogFormatter {
  private formatConfig: LogFormat;

  constructor(format: LogFormat = {}) {
    this.formatConfig = {
      timestamp: true,
      colorize: false,
      json: false,
      prettyPrint: false,
      ...format
    };
  }

  /**
   * Format log entry
   */
  format(entry: LogEntry): string {
    if (this.formatConfig.json) {
      return this.formatJson(entry);
    }

    return this.formatText(entry);
  }

  /**
   * JSON formatting
   */
  private formatJson(entry: LogEntry): string {
    const formatted = { ...entry };

    if (this.formatConfig.prettyPrint) {
      return JSON.stringify(formatted, null, 2);
    }

    return JSON.stringify(formatted);
  }

  /**
   * Text formatting
   */
  private formatText(entry: LogEntry): string {
    let output = '';

    // Timestamp
    if (this.formatConfig.timestamp) {
      const timestamp = new Date(entry.timestamp).toLocaleString();
      output += `[${timestamp}] `;
    }

    // Log level
    const level = this.formatConfig.colorize ?
      this.colorizeLevel(entry.level) :
      entry.level.toUpperCase();
    output += `${level}: `;

    // App name
    output += `[${entry.appName}] `;

    // Message
    output += entry.message;

    // Metadata
    if (Object.keys(entry.meta).length > 0) {
      const metaStr = this.formatConfig.prettyPrint ?
        JSON.stringify(entry.meta, null, 2) :
        JSON.stringify(entry.meta);
      output += ` ${metaStr}`;
    }

    return output;
  }

  /**
   * Add color to log level
   */
  private colorizeLevel(level: string): string {
    const colors: Record<string, string> = {
      debug: '\x1b[36m', // cyan
      info: '\x1b[32m',  // green
      warn: '\x1b[33m',  // yellow
      error: '\x1b[31m'  // red
    };

    const reset = '\x1b[0m';
    const color = colors[level] || '';

    return `${color}${level.toUpperCase()}${reset}`;
  }
}

/**
 * Console formatter - Suitable for browser and Node.js
 */
export class ConsoleFormatter extends LogFormatter {
  private isBrowser: boolean;

  constructor(format: LogFormat = {}) {
    super({
      timestamp: true,
      colorize: typeof window === 'undefined', // Enable colors in Node.js environment
      json: false,
      prettyPrint: false,
      ...format
    });

    this.isBrowser = typeof window !== 'undefined';
  }

  /**
   * Format for console output
   */
  formatForConsole(entry: LogEntry): { message: string; args: any[] } {
    if (this.isBrowser) {
      return this.formatForBrowser(entry);
    }

    return {
      message: this.format(entry),
      args: []
    };
  }

  /**
   * Browser formatting - Use CSS styles
   */
  private formatForBrowser(entry: LogEntry): { message: string; args: any[] } {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const levelStyles = this.getBrowserLevelStyles(entry.level);

    let message = `%c[${timestamp}] %c${entry.level.toUpperCase()}%c [${entry.appName}] ${entry.message}`;
    const args: any[] = [
      'color: #666;', // timestamp style
      levelStyles,    // level style
      'color: inherit;' // reset style
    ];

    // Add metadata
    if (Object.keys(entry.meta).length > 0) {
      message += '\n%o';
      args.push(entry.meta);
    }

    return { message, args };
  }

  /**
   * Get browser log level styles
   */
  private getBrowserLevelStyles(level: string): string {
    const styles: Record<string, string> = {
      debug: 'color: #00bcd4; font-weight: bold;',
      info: 'color: #4caf50; font-weight: bold;',
      warn: 'color: #ff9800; font-weight: bold;',
      error: 'color: #f44336; font-weight: bold;'
    };

    return styles[level] || 'color: inherit; font-weight: bold;';
  }
}

/**
 * File formatter - Suitable for file output
 */
export class FileFormatter extends LogFormatter {
  constructor(format: LogFormat = {}) {
    super({
      timestamp: true,
      colorize: false,
      json: true,
      prettyPrint: false,
      ...format
    });
  }
}

/**
 * Remote formatter - Suitable for remote transport
 */
export class RemoteFormatter extends LogFormatter {
  constructor(format: LogFormat = {}) {
    super({
      timestamp: true,
      colorize: false,
      json: true,
      prettyPrint: false,
      ...format
    });
  }

  /**
   * Format for remote transport
   */
  formatForRemote(entry: LogEntry): any {
    return {
      ...entry,
      // Ensure timestamp format is correct
      timestamp: new Date(entry.timestamp).toISOString(),
      // Add client info
      clientTimestamp: Date.now()
    };
  }
}