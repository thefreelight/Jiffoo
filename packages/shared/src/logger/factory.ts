/**
 * Unified Logging System - Factory Functions
 */

import { ILogger, LoggerConfig } from './types';
import { BaseLogger } from './base-logger';

// Global logger instance cache
const loggerInstances = new Map<string, ILogger>();

/**
 * Create logger instance
 */
export function createLogger(config: LoggerConfig): ILogger {
  const logger = new BaseLogger(config);

  // Cache instance
  loggerInstances.set(config.appName, logger);

  return logger;
}

/**
 * Get created logger instance
 */
export function getLogger(appName: string): ILogger | undefined {
  return loggerInstances.get(appName);
}

/**
 * Get or create logger instance
 */
export function getOrCreateLogger(config: LoggerConfig): ILogger {
  const existing = getLogger(config.appName);
  if (existing) {
    return existing;
  }

  return createLogger(config);
}

/**
 * Clean up all logger instances
 */
export async function destroyAllLoggers(): Promise<void> {
  const destroyPromises = Array.from(loggerInstances.values())
    .map(logger => {
      if ('destroy' in logger && typeof logger.destroy === 'function') {
        return (logger as any).destroy();
      }
      return Promise.resolve();
    });

  await Promise.all(destroyPromises);
  loggerInstances.clear();
}

/**
 * Create default logger
 */
export function createDefaultLogger(appName: string): ILogger {
  const config: LoggerConfig = {
    appName,
    environment: (process.env.NODE_ENV as any) || 'development',
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transports: [
      {
        type: 'console',
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
      }
    ],
    enablePerformanceLogging: true,
    enableSecurityLogging: true
  };

  return createLogger(config);
}