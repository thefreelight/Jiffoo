/**
 * 统一日志系统 - 控制台传输器
 */

import { ITransport, LogEntry, LogLevel } from '../types';
import { ConsoleFormatter } from '../formatters';
import { shouldLog } from '../utils';

export interface ConsoleTransportOptions {
  level?: LogLevel;
  colorize?: boolean;
  timestamp?: boolean;
  json?: boolean;
  prettyPrint?: boolean;
}

/**
 * 控制台传输器 - 支持浏览器和 Node.js 环境
 */
export class ConsoleTransport implements ITransport {
  private level: LogLevel;
  private formatter: ConsoleFormatter;
  private isBrowser: boolean;

  constructor(options: ConsoleTransportOptions = {}) {
    this.level = options.level || 'debug';
    this.isBrowser = typeof window !== 'undefined';
    
    this.formatter = new ConsoleFormatter({
      timestamp: options.timestamp ?? true,
      colorize: options.colorize ?? !this.isBrowser,
      json: options.json ?? false,
      prettyPrint: options.prettyPrint ?? false
    });
  }

  /**
   * 记录日志
   */
  log(entry: LogEntry): void {
    // 检查日志级别
    if (!shouldLog(this.level, entry.level)) {
      return;
    }

    try {
      if (this.isBrowser) {
        this.logToBrowser(entry);
      } else {
        this.logToNode(entry);
      }
    } catch (error) {
      // 静默失败，不影响主业务
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
   * 浏览器环境日志输出
   */
  private logToBrowser(entry: LogEntry): void {
    const { message, args } = this.formatter.formatForConsole(entry);
    
    switch (entry.level) {
      case 'debug':
        console.debug(message, ...args);
        break;
      case 'info':
        console.info(message, ...args);
        break;
      case 'warn':
        console.warn(message, ...args);
        break;
      case 'error':
        console.error(message, ...args);
        break;
      default:
        console.log(message, ...args);
    }
  }

  /**
   * Node.js 环境日志输出
   */
  private logToNode(entry: LogEntry): void {
    const formattedMessage = this.formatter.format(entry);
    
    switch (entry.level) {
      case 'debug':
      case 'info':
        process.stdout.write(formattedMessage + '\n');
        break;
      case 'warn':
      case 'error':
        process.stderr.write(formattedMessage + '\n');
        break;
      default:
        process.stdout.write(formattedMessage + '\n');
    }
  }

  /**
   * 处理内部错误
   */
  private handleError(error: Error): void {
    // 在开发环境下输出错误信息
    if (process.env.NODE_ENV === 'development') {
      console.error('ConsoleTransport error:', error);
    }
  }
}

/**
 * 创建控制台传输器的工厂函数
 */
export function createConsoleTransport(options: ConsoleTransportOptions = {}): ConsoleTransport {
  return new ConsoleTransport(options);
}