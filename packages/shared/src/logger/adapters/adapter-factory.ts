/**
 * Unified Logging System - Adapter Factory
 */

import { ILogger, LoggerConfig } from '../types';
import { WinstonAdapter, WinstonAdapterOptions } from './winston-adapter';
import { BrowserAdapter, BrowserAdapterOptions } from './browser-adapter';

export type AdapterType = 'winston' | 'browser' | 'auto';

export interface AdapterFactoryOptions {
  type?: AdapterType;
  config: LoggerConfig;
  winston?: any; // Winston instance for winston adapter
  remoteEndpoint?: string; // Remote endpoint for browser adapter
  enableLocalStorage?: boolean;
}

/**
 * Create adapter using unified factory function
 */
export function createAdapter(options: AdapterFactoryOptions): ILogger {
  const adapterType = options.type || detectEnvironment();

  switch (adapterType) {
    case 'winston':
      if (!options.winston) {
        throw new Error('Winston instance is required for winston adapter');
      }
      return new WinstonAdapter({
        winston: options.winston,
        appName: options.config.appName,
        environment: options.config.environment,
        version: options.config.version
      });

    case 'browser':
      return new BrowserAdapter({
        config: options.config,
        remoteEndpoint: options.remoteEndpoint,
        enableLocalStorage: options.enableLocalStorage
      });

    case 'auto':
      return createAutoAdapter(options);

    default:
      throw new Error(`Unknown adapter type: ${adapterType}`);
  }
}

/**
 * Auto-detect environment and create adapter
 */
function createAutoAdapter(options: AdapterFactoryOptions): ILogger {
  const isBrowser = typeof window !== 'undefined';
  
  if (isBrowser) {
    return new BrowserAdapter({
      config: options.config,
      remoteEndpoint: options.remoteEndpoint,
      enableLocalStorage: options.enableLocalStorage
    });
  } else {
    // Node.js environment
    if (options.winston) {
      return new WinstonAdapter({
        winston: options.winston,
        appName: options.config.appName,
        environment: options.config.environment,
        version: options.config.version
      });
    } else {
      // If no Winston instance provided, use base Logger
      const { BaseLogger } = require('../base-logger');
      return new BaseLogger(options.config);
    }
  }
}

/**
 * Detect current environment
 */
function detectEnvironment(): AdapterType {
  if (typeof window !== 'undefined') {
    return 'browser';
  } else if (typeof process !== 'undefined' && process.versions?.node) {
    return 'winston';
  } else {
    return 'auto';
  }
}

/**
 * Create default adapter suitable for current environment
 */
export function createDefaultAdapter(appName: string, options: Partial<AdapterFactoryOptions> = {}): ILogger {
  const config: LoggerConfig = {
    appName,
    environment: (process.env.NODE_ENV as any) || 'development',
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transports: [],
    enablePerformanceLogging: true,
    enableSecurityLogging: true,
    ...options.config
  };

  return createAdapter({
    type: 'auto',
    config,
    ...options
  });
}