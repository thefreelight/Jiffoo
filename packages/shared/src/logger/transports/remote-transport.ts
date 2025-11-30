/**
 * 统一日志系统 - 远程传输器 (浏览器环境)
 */

import { ITransport, LogEntry, LogLevel, BatchLogRequest } from '../types';
import { RemoteFormatter } from '../formatters';
import { shouldLog } from '../utils';

export interface RemoteTransportOptions {
  level?: LogLevel;
  endpoint: string;
  batchSize?: number;
  flushInterval?: number;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  headers?: Record<string, string>;
  enableLocalStorage?: boolean;
  storageKey?: string;
}

/**
 * 远程传输器 - 批量发送日志到后端
 * 主要用于浏览器环境
 */
export class RemoteTransport implements ITransport {
  private level: LogLevel;
  private formatter: RemoteFormatter;
  private options: RemoteTransportOptions;
  private buffer: LogEntry[] = [];
  private flushTimer: any = null;
  private isBrowser: boolean;
  private isOnline: boolean = true;

  constructor(options: RemoteTransportOptions) {
    this.level = options.level || 'info';
    this.options = {
      batchSize: 10,
      flushInterval: 5000, // 5秒
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 10000,
      enableLocalStorage: true,
      storageKey: 'logger_buffer',
      ...options
    };
    
    this.formatter = new RemoteFormatter({
      timestamp: true,
      colorize: false,
      json: true,
      prettyPrint: false
    });

    this.isBrowser = typeof window !== 'undefined';
    
    if (this.isBrowser) {
      this.initializeBrowserFeatures();
      this.startPeriodicFlush();
      this.loadBufferFromStorage();
    }
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
      // 添加到缓冲区
      this.buffer.push(entry);

      // 检查是否需要立即刷新
      if (this.shouldFlushImmediately(entry)) {
        this.flush();
      } else if (this.buffer.length >= this.options.batchSize!) {
        this.flush();
      }

      // 保存到本地存储
      if (this.options.enableLocalStorage) {
        this.saveBufferToStorage();
      }
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
   * 关闭传输器
   */
  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // 刷新剩余的日志
    if (this.buffer.length > 0) {
      await this.flush();
    }
  }

  /**
   * 立即刷新缓冲区
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    const logsToSend = [...this.buffer];
    this.buffer = [];

    try {
      await this.sendLogs(logsToSend);
      
      // 清除本地存储
      if (this.options.enableLocalStorage) {
        this.clearStorageBuffer();
      }
    } catch (error) {
      // 发送失败，重新加入缓冲区
      this.buffer.unshift(...logsToSend);
      this.handleError(error as Error);
    }
  }

  /**
   * 初始化浏览器特性
   */
  private initializeBrowserFeatures(): void {
    // 监听网络状态
    if ('navigator' in window && 'onLine' in navigator) {
      this.isOnline = Boolean(navigator.onLine);
      
      window.addEventListener('online', () => {
        this.isOnline = true;
        // 网络恢复时尝试发送缓存的日志
        if (this.buffer.length > 0) {
          this.flush();
        }
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
      });
    }

    // 页面卸载时发送剩余日志
    window.addEventListener('beforeunload', () => {
      if (this.buffer.length > 0) {
        // 使用 sendBeacon 发送最后的日志
        this.sendBeacon();
      }
    });

    // 页面隐藏时发送日志
    if ('visibilitychange' in document) {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.buffer.length > 0) {
          this.sendBeacon();
        }
      });
    }
  }

  /**
   * 开始定期刷新
   */
  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      if (this.buffer.length > 0) {
        this.flush();
      }
    }, this.options.flushInterval);
  }

  /**
   * 检查是否需要立即刷新
   */
  private shouldFlushImmediately(entry: LogEntry): boolean {
    // 错误级别的日志立即发送
    return entry.level === 'error';
  }

  /**
   * 发送日志到后端
   */
  private async sendLogs(logs: LogEntry[]): Promise<void> {
    if (!this.isOnline) {
      throw new Error('Network is offline');
    }

    const payload: BatchLogRequest = {
      logs: logs.map(log => this.formatter.formatForRemote(log)),
      clientInfo: {
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString()
      }
    };

    const response = await this.fetchWithRetry(this.options.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.options.headers
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
  }

  /**
   * 带重试的 fetch 请求
   */
  private async fetchWithRetry(url: string, options: RequestInit, retries: number = 0): Promise<Response> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      if (retries < this.options.maxRetries!) {
        await this.delay(this.options.retryDelay! * Math.pow(2, retries));
        return this.fetchWithRetry(url, options, retries + 1);
      }
      throw error;
    }
  }

  /**
   * 使用 sendBeacon 发送日志（页面卸载时）
   */
  private sendBeacon(): void {
    if (!('sendBeacon' in navigator) || this.buffer.length === 0) {
      return;
    }

    try {
      const payload: BatchLogRequest = {
        logs: this.buffer.map(log => this.formatter.formatForRemote(log)),
        clientInfo: {
          userAgent: navigator.userAgent,
          url: window.location.href,
          timestamp: new Date().toISOString()
        }
      };

      if (navigator.sendBeacon && typeof navigator.sendBeacon === 'function') {
        (navigator.sendBeacon as any)(this.options.endpoint, JSON.stringify(payload));
      }
      this.buffer = [];
    } catch (error) {
      // 静默失败
    }
  }

  /**
   * 保存缓冲区到本地存储
   */
  private saveBufferToStorage(): void {
    if (!this.isBrowser || !this.options.enableLocalStorage) {
      return;
    }

    try {
      localStorage.setItem(this.options.storageKey!, JSON.stringify(this.buffer));
    } catch (error) {
      // 本地存储可能已满，静默失败
    }
  }

  /**
   * 从本地存储加载缓冲区
   */
  private loadBufferFromStorage(): void {
    if (!this.isBrowser || !this.options.enableLocalStorage) {
      return;
    }

    try {
      const stored = localStorage.getItem(this.options.storageKey!);
      if (stored) {
        const logs = JSON.parse(stored);
        if (Array.isArray(logs)) {
          this.buffer.push(...logs);
        }
      }
    } catch (error) {
      // 解析失败，清除存储
      this.clearStorageBuffer();
    }
  }

  /**
   * 清除本地存储缓冲区
   */
  private clearStorageBuffer(): void {
    if (this.isBrowser && this.options.enableLocalStorage) {
      try {
        localStorage.removeItem(this.options.storageKey!);
      } catch (error) {
        // 静默失败
      }
    }
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 处理错误
   */
  private handleError(error: Error): void {
    // 在开发环境下输出错误信息
    if (process.env.NODE_ENV === 'development') {
      console.error('RemoteTransport error:', error);
    }
  }
}

/**
 * 创建远程传输器的工厂函数
 */
export function createRemoteTransport(options: RemoteTransportOptions): RemoteTransport {
  return new RemoteTransport(options);
}