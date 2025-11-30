/**
 * 统一日志系统 - 传输器工厂
 */

import { ITransport, TransportConfig } from '../types';
import { ConsoleTransport, ConsoleTransportOptions } from './console-transport';
import { RemoteTransport, RemoteTransportOptions } from './remote-transport';

// 动态导入 FileTransport 以避免在浏览器环境中打包
type FileTransportType = typeof import('./file-transport').FileTransport;
type FileTransportOptionsType = import('./file-transport').FileTransportOptions;

export type TransportType = 'console' | 'file' | 'remote';

/**
 * 创建传输器的统一工厂函数
 */
export function createTransport(config: TransportConfig): ITransport {
  switch (config.type) {
    case 'console':
      return new ConsoleTransport({
        level: config.level,
        ...config.options
      } as ConsoleTransportOptions);

    case 'file':
      if (typeof window !== 'undefined') {
        throw new Error('FileTransport is not available in browser environment');
      }
      // 动态导入 FileTransport
      const { FileTransport } = require('./file-transport');
      return new FileTransport({
        level: config.level,
        ...config.options
      } as FileTransportOptionsType);

    case 'remote':
      if (typeof window === 'undefined') {
        throw new Error('RemoteTransport is primarily designed for browser environment');
      }
      return new RemoteTransport({
        level: config.level,
        ...config.options
      } as RemoteTransportOptions);

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
    colorize: typeof window === 'undefined',
    timestamp: true
  });
}

/**
 * 创建默认的文件传输器组合 (Node.js only)
 */
export function createDefaultFileTransports(baseDir: string = './logs'): ITransport[] {
  if (typeof window !== 'undefined') {
    return [];
  }

  // 动态导入 FileTransport
  const { FileTransport } = require('./file-transport');

  return [
    // 错误日志
    new FileTransport({
      filename: `${baseDir}/error-%DATE%.log`,
      level: 'error',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true,
      json: true
    }),
    // 组合日志
    new FileTransport({
      filename: `${baseDir}/combined-%DATE%.log`,
      level: 'debug',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '30d',
      zippedArchive: true,
      json: true
    })
  ];
}

/**
 * 创建默认的远程传输器 (Browser only)
 */
export function createDefaultRemoteTransport(endpoint: string): RemoteTransport | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return new RemoteTransport({
    endpoint,
    level: 'info',
    batchSize: 10,
    flushInterval: 5000,
    maxRetries: 3,
    enableLocalStorage: true
  });
}