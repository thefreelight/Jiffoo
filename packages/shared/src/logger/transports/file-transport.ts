/**
 * 统一日志系统 - 文件传输器 (Node.js only)
 */

import { ITransport, LogEntry, LogLevel } from '../types';
import { FileFormatter } from '../formatters';
import { shouldLog } from '../utils';

export interface FileTransportOptions {
  level?: LogLevel;
  filename: string;
  maxSize?: string;
  maxFiles?: string | number;
  datePattern?: string;
  zippedArchive?: boolean;
  json?: boolean;
  prettyPrint?: boolean;
}

/**
 * 文件传输器 - 基于 winston-daily-rotate-file
 * 仅在 Node.js 环境中可用
 */
export class FileTransport implements ITransport {
  private level: LogLevel;
  private formatter: FileFormatter;
  private options: FileTransportOptions;
  private writeStream: any = null;
  private isNode: boolean;

  constructor(options: FileTransportOptions) {
    this.level = options.level || 'debug';
    this.options = options;
    this.isNode = typeof window === 'undefined' && typeof process !== 'undefined';
    
    this.formatter = new FileFormatter({
      timestamp: true,
      colorize: false,
      json: options.json ?? true,
      prettyPrint: options.prettyPrint ?? false
    });

    if (this.isNode) {
      this.initializeFileStream();
    }
  }

  /**
   * 记录日志
   */
  log(entry: LogEntry): void {
    // 检查是否在 Node.js 环境
    if (!this.isNode) {
      console.warn('FileTransport is only available in Node.js environment');
      return;
    }

    // 检查日志级别
    if (!shouldLog(this.level, entry.level)) {
      return;
    }

    try {
      const formattedMessage = this.formatter.format(entry);
      this.writeToFile(formattedMessage);
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * 关闭文件流
   */
  async close(): Promise<void> {
    if (this.writeStream && typeof this.writeStream.close === 'function') {
      return new Promise((resolve) => {
        this.writeStream.close(() => {
          resolve();
        });
      });
    }
  }

  /**
   * 初始化文件流
   */
  private initializeFileStream(): void {
    try {
      // 动态导入 winston-daily-rotate-file
      const DailyRotateFile = require('winston-daily-rotate-file');
      
      this.writeStream = new DailyRotateFile({
        filename: this.options.filename,
        datePattern: this.options.datePattern || 'YYYY-MM-DD',
        maxSize: this.options.maxSize || '20m',
        maxFiles: this.options.maxFiles || '14d',
        zippedArchive: this.options.zippedArchive ?? true,
        format: {
          transform: (info: any) => {
            // 直接返回，因为我们已经在 log 方法中格式化了
            return info;
          }
        }
      });

      // 监听错误事件
      this.writeStream.on('error', (error: Error) => {
        this.handleError(error);
      });

    } catch (error) {
      console.warn('Failed to initialize FileTransport:', error);
      this.writeStream = null;
    }
  }

  /**
   * 写入文件
   */
  private writeToFile(message: string): void {
    if (this.writeStream && typeof this.writeStream.write === 'function') {
      this.writeStream.write({
        level: 'info', // winston 需要的格式
        message: message,
        timestamp: new Date().toISOString()
      });
    } else {
      // 降级到简单的文件写入
      this.fallbackFileWrite(message);
    }
  }

  /**
   * 降级文件写入方法
   */
  private fallbackFileWrite(message: string): void {
    // 只在 Node.js 环境中执行
    if (typeof window !== 'undefined') {
      console.warn('FileTransport fallback not available in browser environment');
      return;
    }

    try {
      const fs = require('fs');
      const path = require('path');
      
      // 确保目录存在
      const dir = path.dirname(this.options.filename);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // 追加写入文件
      fs.appendFileSync(this.options.filename, message + '\n', 'utf8');
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * 处理错误
   */
  private handleError(error: Error): void {
    // 在开发环境下输出错误信息
    if (process.env.NODE_ENV === 'development') {
      console.error('FileTransport error:', error);
    }
  }
}

/**
 * 创建文件传输器的工厂函数
 */
export function createFileTransport(options: FileTransportOptions): FileTransport {
  return new FileTransport(options);
}

/**
 * 创建错误日志文件传输器
 */
export function createErrorFileTransport(baseDir: string = './logs'): FileTransport {
  return new FileTransport({
    filename: `${baseDir}/error-%DATE%.log`,
    level: 'error',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    zippedArchive: true,
    json: true
  });
}

/**
 * 创建组合日志文件传输器
 */
export function createCombinedFileTransport(baseDir: string = './logs'): FileTransport {
  return new FileTransport({
    filename: `${baseDir}/combined-%DATE%.log`,
    level: 'debug',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d',
    zippedArchive: true,
    json: true
  });
}