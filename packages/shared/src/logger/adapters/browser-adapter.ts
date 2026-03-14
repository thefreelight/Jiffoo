/**
 * Unified Logging System - Browser Adapter
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
 * Browser Adapter - Logger optimized for browser environment
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

    // Initialize default transports
    this.initializeDefaultTransports(options.remoteEndpoint);
    
    // Setup browser-specific features
    this.setupBrowserFeatures();
  }

  /**
   * Initialize default transports
   */
  private initializeDefaultTransports(remoteEndpoint?: string): void {
    // Add console transport
    const consoleTransport = new ConsoleTransport({
      level: this.currentLevel,
      colorize: false, // Browser uses CSS styles
      timestamp: true
    });
    this.addTransport(consoleTransport);

    // If remote endpoint provided, add remote transport
    if (remoteEndpoint) {
      const remoteTransport = new RemoteTransport({
        endpoint: remoteEndpoint,
        level: 'info', // Only send info and above levels to server
        batchSize: 10,
        flushInterval: 5000,
        enableLocalStorage: this.enableLocalStorage,
        storageKey: `${this.localStorageKey}_remote`
      });
      this.addTransport(remoteTransport);
    }

    // Add other transports based on configuration
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
   * Setup browser-specific features
   */
  private setupBrowserFeatures(): void {
    // Global error handling
    this.setupGlobalErrorHandling();
    
    // Unhandled Promise rejection
    this.setupUnhandledRejectionHandling();
    
    // Page visibility change handling
    this.setupVisibilityChangeHandling();
    
    // Restore logs from local storage
    this.loadLogsFromStorage();
  }

  /**
   * Setup global error handling
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
   * Setup unhandled Promise rejection handling
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
   * Setup page visibility change handling
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
   * Override log method to add browser-specific metadata
   */
  protected log(level: LogLevel, message: string, meta: LogMeta = {}): void {
    // Add browser-specific metadata
    const browserMeta = {
      ...meta,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      timestamp: new Date().toISOString()
    };

    // Call parent method
    super.log(level, message, browserMeta);

    // Save to local storage
    if (this.enableLocalStorage) {
      this.saveLogToStorage(level, message, browserMeta);
    }
  }

  /**
   * Log user interaction events
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
   * Log page performance metrics
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
   * Log network requests
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
   * Get First Paint time
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
   * Get First Contentful Paint time
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
   * Save log to local storage
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

      // Limit number of logs in local storage
      if (logs.length > this.maxLocalLogs) {
        logs.splice(0, logs.length - this.maxLocalLogs);
      }

      localStorage.setItem(this.localStorageKey, JSON.stringify(logs));
    } catch (error) {
      // Local storage may be full, fail silently
    }
  }

  /**
   * Get logs from local storage
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
   * Load logs from local storage
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
   * Clear logs in local storage
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
   * Get logs in local storage
   */
  getLocalLogs(): any[] {
    return this.getLogsFromStorage();
  }

  /**
   * Export local logs
   */
  exportLocalLogs(): string {
    const logs = this.getLogsFromStorage();
    return JSON.stringify(logs, null, 2);
  }
}

/**
 * Factory function to create browser adapter
 */
export function createBrowserAdapter(options: BrowserAdapterOptions): BrowserAdapter {
  return new BrowserAdapter(options);
}

/**
 * Create default browser adapter
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