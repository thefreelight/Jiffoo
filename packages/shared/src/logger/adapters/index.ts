/**
 * 统一日志系统 - 适配器模块导出
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