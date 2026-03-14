/**
 * Unified Logging System - Main Entry
 */

// Export types
export * from './types';

// Export utilities
export * from './utils';

// Export formatters
export * from './formatters';

// Export base logger
export { BaseLogger } from './base-logger';

// Export factory functions
export { createLogger, getLogger } from './factory';

// Export transports
export * from './transports';

// Export adapters
export * from './adapters';

// Export data sanitizer module
export * from './sanitizer';

// Export constants
export const LOG_LEVELS: Record<string, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
} as const;