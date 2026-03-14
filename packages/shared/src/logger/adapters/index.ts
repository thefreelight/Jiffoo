/**
 * Unified Logging System - Adapter Module Exports
 */

// Winston Adapter (Node.js)
export {
  WinstonAdapter,
  createWinstonAdapter,
  createWinstonAdapterFromConfig,
  type WinstonAdapterOptions
} from './winston-adapter';

// Browser Adapter
export {
  BrowserAdapter,
  createBrowserAdapter,
  createDefaultBrowserAdapter,
  type BrowserAdapterOptions
} from './browser-adapter';

// Adapter Factory
export { createAdapter, type AdapterType } from './adapter-factory';