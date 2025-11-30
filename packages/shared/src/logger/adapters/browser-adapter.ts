/**
 * 统一日志系统 - 浏览器适配器
 */

import { ILogger, ITransport, LogLevel, LogMeta, OperationLog, LoggerConfig } from '../types';
import { BaseLogger } from '../base-logger';
import { ConsoleTransport } from '../transports/console-transport';
import { RemoteTransport } from '../transports/remote-transport';
import { createTransport } from '../transports/transport-factory.browser';

export interface BrowserAdapterOptions {
  config: LoggerConfig;
  remoteEndpoint?: string;
  enableLocalStorage?: boolean;
  storageKey?: string;
  maxLocalLogs?: number;
}

/**
 * 浏览器适配器 - 专为浏览器环境优化的日志器
 */
export class BrowserAdapter extends BaseLogger {
  private localStorageKey: string;
  private maxLocalLogs: number;
  private enableLocalStorage: boolean;

  constructor(options: BrowserAdapterOptions) {
    super(options.config);
    
    this.enableLocalStorage = options.enableLocalStorage ?? true;
    this.localStorageKey = options.storageKey || `logger_${this.config.appName}`;
    this.maxLocalLogs = options.maxLocalLogs || 100;

    // 初始化默认传输器
    this.initializeDefaultTransports(options.remoteEndpoint);
    
    // 设置浏览器特定的功能
    this.setupBrowserFeatures();
  }

  /**
   * 初始化默认传输器
   */
  private initializeDefaultTransports(remoteEndpoint?: string): void {
    // 添加控制台传输器
    const consoleTransport = new ConsoleTransport({
      level: this.currentLevel,
      colorize: false, // 浏览器使用 CSS 样式
      timestamp: true
    });
    this.addTransport(consoleTransport);

    // 如果提供了远程端点，添加远程传输器
    if (remoteEndpoint) {
      const remoteTransport = new RemoteTransport({
        endpoint: remoteEndpoint,
        level: 'info', // 只发送 info 及以上级别到服务器
        batchSize: 10,
        flushInterval: 5000,
        enableLocalStorage: this.enableLocalStorage,
        storageKey: `${this.localStorageKey}_remote`
      });
      this.addTransport(remoteTransport);
    }

    // 根据配置添加其他传输器
    this.config.transports.forEach(transportConfig => {
      try {
        const transport = createTransport(transportConfig);
        this.addTransport(transport);
      } catch (error) {
        console.warn('Failed to create transport:', error);
      }
    });
  }

  /**
   * 设置浏览器特定功能
   */
  private setupBrowserFeatures(): void {
    // 全局错误处理
    this.setupGlobalErrorHandling();
    
    // 未处理的 Promise 拒绝
    this.setupUnhandledRejectionHandling();
    
    // 页面可见性变化处理
    this.setupVisibilityChangeHandling();
    
    // 从本地存储恢复日志
    this.loadLogsFromStorage();
  }

  /**
   * 设置全局错误处理
   */
  private setupGlobalErrorHandling(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.error('Global error caught', {
          type: 'global_error',
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack,
          url: window.location.href,
          userAgent: navigator.userAgent
        });
      });
    }
  }

  /**
   * 设置未处理的 Promise 拒绝处理
   */
  private setupUnhandledRejectionHandling(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', (event) => {
        this.error('Unhandled promise rejection', {
          type: 'unhandled_rejection',
          reason: event.reason,
          promise: event.promise,
          url: window.location.href,
          userAgent: navigator.userAgent
        });
      });
    }
  }

  /**
   * 设置页面可见性变化处理
   */
  private setupVisibilityChangeHandling(): void {
    if (typeof document !== 'undefined' && 'visibilityState' in document) {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.debug('Page became hidden', {
            type: 'visibility_change',
            visibilityState: document.visibilityState
          });
        } else {
          this.debug('Page became visible', {
            type: 'visibility_change',
            visibilityState: document.visibilityState
          });
        }
      });
    }
  }

  /**
   * 重写日志方法以添加浏览器特定的元数据
   */
  protected log(level: LogLevel, message: string, meta: LogMeta = {}): void {
    // 添加浏览器特定的元数据
    const browserMeta = {
      ...meta,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      timestamp: new Date().toISOString()
    };

    // 调用父类方法
    super.log(level, message, browserMeta);

    // 保存到本地存储
    if (this.enableLocalStorage) {
      this.saveLogToStorage(level, message, browserMeta);
    }
  }

  /**
   * 记录用户交互事件
   */
  logUserInteraction(action: string, element?: string, details?: any): void {
    this.info('User interaction', {
      type: 'user_interaction',
      action,
      element,
      details,
      timestamp: new Date().toISOString(),
      url: window.location.href
    });
  }

  /**
   * 记录页面性能指标
   */
  logPagePerformance(): void {
    if (typeof window !== 'undefined' && 'performance' in window) {
      const navigation = (performance as any).getEntriesByType('navigation')[0];
      
      if (navigation) {
        this.logPerformance('page_load', navigation.loadEventEnd - navigation.fetchStart, {
          type: 'page_performance',
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
          firstPaint: this.getFirstPaint(),
          firstContentfulPaint: this.getFirstContentfulPaint(),
          url: window.location.href
        });
      }
    }
  }

  /**
   * 记录网络请求
   */
  logNetworkRequest(url: string, method: string, status: number, duration: number, details?: any): void {
    this.info('Network request', {
      type: 'network_request',
      url,
      method,
      status,
      duration,
      details,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 获取 First Paint 时间
   */
  private getFirstPaint(): number | undefined {
    if (typeof window !== 'undefined' && 'performance' in window) {
      const paintEntries = (performance as any).getEntriesByType('paint');
      const firstPaint = paintEntries.find((entry: any) => entry.name === 'first-paint');
      return firstPaint?.startTime;
    }
    return undefined;
  }

  /**
   * 获取 First Contentful Paint 时间
   */
  private getFirstContentfulPaint(): number | undefined {
    if (typeof window !== 'undefined' && 'performance' in window) {
      const paintEntries = (performance as any).getEntriesByType('paint');
      const firstContentfulPaint = paintEntries.find((entry: any) => entry.name === 'first-contentful-paint');
      return firstContentfulPaint?.startTime;
    }
    return undefined;
  }

  /**
   * 保存日志到本地存储
   */
  private saveLogToStorage(level: LogLevel, message: string, meta: LogMeta): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      const logs = this.getLogsFromStorage();
      const logEntry = {
        level,
        message,
        meta,
        timestamp: new Date().toISOString()
      };

      logs.push(logEntry);

      // 限制本地存储的日志数量
      if (logs.length > this.maxLocalLogs) {
        logs.splice(0, logs.length - this.maxLocalLogs);
      }

      localStorage.setItem(this.localStorageKey, JSON.stringify(logs));
    } catch (error) {
      // 本地存储可能已满，静默失败
    }
  }

  /**
   * 从本地存储获取日志
   */
  private getLogsFromStorage(): any[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    try {
      const stored = localStorage.getItem(this.localStorageKey);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      return [];
    }
  }

  /**
   * 从本地存储加载日志
   */
  private loadLogsFromStorage(): void {
    const logs = this.getLogsFromStorage();
    if (logs.length > 0) {
      this.debug(`Loaded ${logs.length} logs from local storage`, {
        type: 'storage_recovery',
        count: logs.length
      });
    }
  }

  /**
   * 清除本地存储的日志
   */
  clearLocalLogs(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(this.localStorageKey);
        this.debug('Local logs cleared', { type: 'storage_clear' });
      } catch (error) {
        this.warn('Failed to clear local logs', { errorMessage: (error as Error).message });
      }
    }
  }

  /**
   * 获取本地存储的日志
   */
  getLocalLogs(): any[] {
    return this.getLogsFromStorage();
  }

  /**
   * 导出本地日志
   */
  exportLocalLogs(): string {
    const logs = this.getLogsFromStorage();
    return JSON.stringify(logs, null, 2);
  }
}

/**
 * 创建浏览器适配器的工厂函数
 */
export function createBrowserAdapter(options: BrowserAdapterOptions): BrowserAdapter {
  return new BrowserAdapter(options);
}

/**
 * 创建默认的浏览器适配器
 */
export function createDefaultBrowserAdapter(appName: string, remoteEndpoint?: string): BrowserAdapter {
  const config: LoggerConfig = {
    appName,
    environment: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    transports: [],
    enablePerformanceLogging: true,
    enableSecurityLogging: true
  };

  return new BrowserAdapter({
    config,
    remoteEndpoint,
    enableLocalStorage: true,
    maxLocalLogs: 100
  });
}