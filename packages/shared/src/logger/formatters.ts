/**
 * 统一日志系统 - 格式化器
 */

import { LogEntry, LogFormat } from './types';

/**
 * 基础日志格式化器
 */
export class LogFormatter {
  private formatConfig: LogFormat;

  constructor(format: LogFormat = {}) {
    this.formatConfig = {
      timestamp: true,
      colorize: false,
      json: false,
      prettyPrint: false,
      ...format
    };
  }

  /**
   * 格式化日志条目
   */
  format(entry: LogEntry): string {
    if (this.formatConfig.json) {
      return this.formatJson(entry);
    }
    
    return this.formatText(entry);
  }

  /**
   * JSON 格式化
   */
  private formatJson(entry: LogEntry): string {
    const formatted = { ...entry };
    
    if (this.formatConfig.prettyPrint) {
      return JSON.stringify(formatted, null, 2);
    }
    
    return JSON.stringify(formatted);
  }

  /**
   * 文本格式化
   */
  private formatText(entry: LogEntry): string {
    let output = '';
    
    // 时间戳
    if (this.formatConfig.timestamp) {
      const timestamp = new Date(entry.timestamp).toLocaleString();
      output += `[${timestamp}] `;
    }
    
    // 日志级别
    const level = this.formatConfig.colorize ? 
      this.colorizeLevel(entry.level) : 
      entry.level.toUpperCase();
    output += `${level}: `;
    
    // 应用名称
    output += `[${entry.appName}] `;
    
    // 消息
    output += entry.message;
    
    // 元数据
    if (Object.keys(entry.meta).length > 0) {
      const metaStr = this.formatConfig.prettyPrint ? 
        JSON.stringify(entry.meta, null, 2) : 
        JSON.stringify(entry.meta);
      output += ` ${metaStr}`;
    }
    
    return output;
  }

  /**
   * 为日志级别添加颜色
   */
  private colorizeLevel(level: string): string {
    const colors: Record<string, string> = {
      debug: '\x1b[36m', // cyan
      info: '\x1b[32m',  // green
      warn: '\x1b[33m',  // yellow
      error: '\x1b[31m'  // red
    };
    
    const reset = '\x1b[0m';
    const color = colors[level] || '';
    
    return `${color}${level.toUpperCase()}${reset}`;
  }
}

/**
 * 控制台格式化器 - 适用于浏览器和 Node.js
 */
export class ConsoleFormatter extends LogFormatter {
  private isBrowser: boolean;

  constructor(format: LogFormat = {}) {
    super({
      timestamp: true,
      colorize: typeof window === 'undefined', // Node.js 环境启用颜色
      json: false,
      prettyPrint: false,
      ...format
    });
    
    this.isBrowser = typeof window !== 'undefined';
  }

  /**
   * 格式化用于控制台输出
   */
  formatForConsole(entry: LogEntry): { message: string; args: any[] } {
    if (this.isBrowser) {
      return this.formatForBrowser(entry);
    }
    
    return {
      message: this.format(entry),
      args: []
    };
  }

  /**
   * 浏览器格式化 - 使用 CSS 样式
   */
  private formatForBrowser(entry: LogEntry): { message: string; args: any[] } {
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const levelStyles = this.getBrowserLevelStyles(entry.level);
    
    let message = `%c[${timestamp}] %c${entry.level.toUpperCase()}%c [${entry.appName}] ${entry.message}`;
    const args: any[] = [
      'color: #666;', // timestamp style
      levelStyles,    // level style
      'color: inherit;' // reset style
    ];
    
    // 添加元数据
    if (Object.keys(entry.meta).length > 0) {
      message += '\n%o';
      args.push(entry.meta);
    }
    
    return { message, args };
  }

  /**
   * 获取浏览器日志级别样式
   */
  private getBrowserLevelStyles(level: string): string {
    const styles: Record<string, string> = {
      debug: 'color: #00bcd4; font-weight: bold;',
      info: 'color: #4caf50; font-weight: bold;',
      warn: 'color: #ff9800; font-weight: bold;',
      error: 'color: #f44336; font-weight: bold;'
    };
    
    return styles[level] || 'color: inherit; font-weight: bold;';
  }
}

/**
 * 文件格式化器 - 适用于文件输出
 */
export class FileFormatter extends LogFormatter {
  constructor(format: LogFormat = {}) {
    super({
      timestamp: true,
      colorize: false,
      json: true,
      prettyPrint: false,
      ...format
    });
  }
}

/**
 * 远程格式化器 - 适用于远程传输
 */
export class RemoteFormatter extends LogFormatter {
  constructor(format: LogFormat = {}) {
    super({
      timestamp: true,
      colorize: false,
      json: true,
      prettyPrint: false,
      ...format
    });
  }

  /**
   * 格式化用于远程传输
   */
  formatForRemote(entry: LogEntry): any {
    return {
      ...entry,
      // 确保时间戳格式正确
      timestamp: new Date(entry.timestamp).toISOString(),
      // 添加客户端信息
      clientTimestamp: Date.now()
    };
  }
}