/**
 * Unified Logging System - Transport Factory (Browser Version)
 */

import { ITransport, TransportConfig } from '../types';
import { ConsoleTransport, ConsoleTransportOptions } from './console-transport';
import { RemoteTransport, RemoteTransportOptions } from './remote-transport';

export type TransportType = 'console' | 'remote';

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

    case 'remote':
      return new RemoteTransport({
        level: config.level,
        ...config.options
      } as RemoteTransportOptions);

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

/**
 * Create default remote transport (Browser only)
 */
export function createDefaultRemoteTransport(endpoint: string): RemoteTransport {
  return new RemoteTransport({
    endpoint,
    level: 'info',
    batchSize: 10,
    flushInterval: 5000,
    maxRetries: 3,
    enableLocalStorage: true
  });
}
