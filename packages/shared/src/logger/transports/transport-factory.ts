/**
 * Unified Logging System - Transport Factory
 */

import { ITransport, TransportConfig } from '../types';
import { ConsoleTransport, ConsoleTransportOptions } from './console-transport';

// Dynamically import FileTransport to avoid bundling in browser environment
type FileTransportType = typeof import('./file-transport').FileTransport;
type FileTransportOptionsType = import('./file-transport').FileTransportOptions;

export type TransportType = 'console' | 'file';

/**
 * Unified factory function for creating transports
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
      // Dynamically import FileTransport
      const { FileTransport } = require('./file-transport');
      return new FileTransport({
        level: config.level,
        ...config.options
      } as FileTransportOptionsType);

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
    colorize: typeof window === 'undefined',
    timestamp: true
  });
}

/**
 * Create default file transport combination (Node.js only)
 */
export function createDefaultFileTransports(baseDir: string = './logs'): ITransport[] {
  if (typeof window !== 'undefined') {
    return [];
  }

  // Dynamically import FileTransport
  const { FileTransport } = require('./file-transport');

  return [
    // Error log
    new FileTransport({
      filename: `${baseDir}/error-%DATE%.log`,
      level: 'error',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      zippedArchive: true,
      json: true
    }),
    // Combined log
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

