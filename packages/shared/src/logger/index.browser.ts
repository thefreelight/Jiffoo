/**
 * Unified Logging System - Browser Entry Point
 */

// Export types
export * from './types';

// Export utils
export * from './utils';

// Export formatters
export * from './formatters';

// Export base logger
export { BaseLogger } from './base-logger';

// Export factory
export { createLogger, getLogger } from './factory';

// Export transports (browser version)
export * from './transports/index.browser';

// Export adapters (only browser adapter)
export { BrowserAdapter, createBrowserAdapter, createDefaultBrowserAdapter, type BrowserAdapterOptions } from './adapters/browser-adapter';

// Export constants
export const LOG_LEVELS: Record<string, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
} as const;
