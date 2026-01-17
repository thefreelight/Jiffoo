/**
 * Unified Logging System - Remote Transport (Browser Environment)
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
 * Remote Transport - Batch send logs to backend
 * Primarily for browser environment
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
      flushInterval: 5000, // 5 seconds
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
   * Log entry
   */
  log(entry: LogEntry): void {
    // Check log level
    if (!shouldLog(this.level, entry.level)) {
      return;
    }

    try {
      // Add to buffer
      this.buffer.push(entry);

      // Check if should flush immediately
      if (this.shouldFlushImmediately(entry)) {
        this.flush();
      } else if (this.buffer.length >= this.options.batchSize!) {
        this.flush();
      }

      // Save to local storage
      if (this.options.enableLocalStorage) {
        this.saveBufferToStorage();
      }
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Close transport
   */
  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Flush remaining logs
    if (this.buffer.length > 0) {
      await this.flush();
    }
  }

  /**
   * Flush buffer immediately
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    const logsToSend = [...this.buffer];
    this.buffer = [];

    try {
      await this.sendLogs(logsToSend);

      // Clear local storage
      if (this.options.enableLocalStorage) {
        this.clearStorageBuffer();
      }
    } catch (error) {
      // Send failed, add back to buffer
      this.buffer.unshift(...logsToSend);
      this.handleError(error as Error);
    }
  }

  /**
   * Initialize browser features
   */
  private initializeBrowserFeatures(): void {
    // Monitor network status
    if ('navigator' in window && 'onLine' in navigator) {
      this.isOnline = Boolean(navigator.onLine);

      window.addEventListener('online', () => {
        this.isOnline = true;
        // Try to send cached logs when network recovers
        if (this.buffer.length > 0) {
          this.flush();
        }
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
      });
    }

    // Send remaining logs when page unloads
    window.addEventListener('beforeunload', () => {
      if (this.buffer.length > 0) {
        // Use sendBeacon to send final logs
        this.sendBeacon();
      }
    });

    // Send logs when page hidden
    if ('visibilitychange' in document) {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.buffer.length > 0) {
          this.sendBeacon();
        }
      });
    }
  }

  /**
   * Start periodic flush
   */
  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      if (this.buffer.length > 0) {
        this.flush();
      }
    }, this.options.flushInterval);
  }

  /**
   * Check if should flush immediately
   */
  private shouldFlushImmediately(entry: LogEntry): boolean {
    // Error level logs are sent immediately
    return entry.level === 'error';
  }

  /**
   * Send logs to backend
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
   * fetch request with retry
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
   * Use sendBeacon to send logs (on page unload)
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
      // Silent failure
    }
  }

  /**
   * Save buffer to local storage
   */
  private saveBufferToStorage(): void {
    if (!this.isBrowser || !this.options.enableLocalStorage) {
      return;
    }

    try {
      localStorage.setItem(this.options.storageKey!, JSON.stringify(this.buffer));
    } catch (error) {
      // Local storage might be full, silent failure
    }
  }

  /**
   * Load buffer from local storage
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
      // Parse failed, clear storage
      this.clearStorageBuffer();
    }
  }

  /**
   * Clear local storage buffer
   */
  private clearStorageBuffer(): void {
    if (this.isBrowser && this.options.enableLocalStorage) {
      try {
        localStorage.removeItem(this.options.storageKey!);
      } catch (error) {
        // Silent failure
      }
    }
  }

  /**
   * Delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Handle error
   */
  private handleError(error: Error): void {
    // Output error in development environment
    if (process.env.NODE_ENV === 'development') {
      console.error('RemoteTransport error:', error);
    }
  }
}

/**
 * Factory function for creating remote transport
 */
export function createRemoteTransport(options: RemoteTransportOptions): RemoteTransport {
  return new RemoteTransport(options);
}