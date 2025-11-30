/**
 * 统一日志系统 - 传输器工厂 (浏览器版本)
 */

import { ITransport, TransportConfig } from '../types';
import { ConsoleTransport, ConsoleTransportOptions } from './console-transport';
import { RemoteTransport, RemoteTransportOptions } from './remote-transport';

export type TransportType = 'console' | 'remote';

/**
 * 创建传输器的统一工厂函数 (浏览器环境)
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
 * 创建默认的控制台传输器
 */
export function createDefaultConsoleTransport(): ConsoleTransport {
  return new ConsoleTransport({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    colorize: false,
    timestamp: true
  });
}

/**
 * 创建默认的远程传输器 (Browser only)
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
