/**
 * Unified Logging System - Transport Factory (Browser Version)
 */

import { ITransport, TransportConfig } from '../types';
import { ConsoleTransport, ConsoleTransportOptions } from './console-transport';

export type TransportType = 'console';

/**
 * Unified factory function for creating transports (Browser environment)
 */
export function createTransport(config: TransportConfig): ITransport {
  switch (config.type) {
    case 'console':
      return new ConsoleTransport({
        level: config.level,
        ...config.options
      } as ConsoleTransportOptions);

    case 'file':
      throw new Error('FileTransport is not available in browser environment');

    default:
      throw new Error(`Unknown transport type: ${config.type}`);
  }
}

/**
 * Create default console transport
 */
export function createDefaultConsoleTransport(): ConsoleTransport {
  return new ConsoleTransport({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    colorize: false,
    timestamp: true
  });
}

