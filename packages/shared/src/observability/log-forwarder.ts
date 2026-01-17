/**
 * Log Forwarder
 * 
 * Batch send logs to centralized logging system (e.g. Loki)
 */

/**
 * Log level
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Log entry
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  labels?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

/**
 * Loki push payload
 */
export interface LokiPushPayload {
  streams: Array<{
    stream: Record<string, string>;
    values: Array<[string, string]>;
  }>;
}

/**
 * Log Forwarder configuration
 */
export interface LogForwarderConfig {
  /** Loki push URL */
  lokiUrl: string;
  /** Batch size */
  batchSize?: number;
  /** Flush interval (ms) */
  flushInterval?: number;
  /** Retry attempts */
  maxRetries?: number;
  /** Retry delay (ms) */
  retryDelay?: number;
  /** Default labels */
  defaultLabels?: Record<string, string>;
  /** Whether enabled */
  enabled?: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Partial<LogForwarderConfig> = {
  batchSize: 100,
  flushInterval: 5000,
  maxRetries: 3,
  retryDelay: 1000,
  defaultLabels: {},
  enabled: true,
};

/**
 * Log Forwarder class
 */
export class LogForwarder {
  private config: Required<LogForwarderConfig>;
  private buffer: LogEntry[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private isFlushing = false;

  constructor(config: LogForwarderConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config } as Required<LogForwarderConfig>;

    if (this.config.enabled) {
      this.startFlushTimer();
    }
  }

  /**
   * Add log entry
   */
  log(entry: LogEntry): void {
    if (!this.config.enabled) return;

    this.buffer.push({
      ...entry,
      labels: { ...this.config.defaultLabels, ...entry.labels },
    });

    if (this.buffer.length >= this.config.batchSize) {
      this.flush();
    }
  }

  /**
   * Shortcut methods
   */
  debug(message: string, metadata?: Record<string, unknown>): void {
    this.log({ timestamp: new Date().toISOString(), level: 'debug', message, metadata });
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.log({ timestamp: new Date().toISOString(), level: 'info', message, metadata });
  }

  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log({ timestamp: new Date().toISOString(), level: 'warn', message, metadata });
  }

  error(message: string, metadata?: Record<string, unknown>): void {
    this.log({ timestamp: new Date().toISOString(), level: 'error', message, metadata });
  }

  /**
   * Flush buffer
   */
  async flush(): Promise<void> {
    if (this.isFlushing || this.buffer.length === 0) return;

    this.isFlushing = true;
    const entries = [...this.buffer];
    this.buffer = [];

    try {
      await this.sendToLoki(entries);
    } catch (error) {
      // Send failed, put logs back to buffer
      this.buffer = [...entries, ...this.buffer];
      console.error('Failed to forward logs to Loki:', error);
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * Send logs to Loki
   */
  private async sendToLoki(entries: LogEntry[]): Promise<void> {
    const payload = this.buildLokiPayload(entries);

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const response = await fetch(this.config.lokiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (response.ok) return;

        if (response.status >= 500) {
          // Server error, can retry
          await this.delay(this.config.retryDelay * Math.pow(2, attempt));
          continue;
        }

        throw new Error(`Loki returned ${response.status}`);
      } catch (error) {
        if (attempt === this.config.maxRetries - 1) throw error;
        await this.delay(this.config.retryDelay * Math.pow(2, attempt));
      }
    }
  }

  /**
   * Build Loki push payload
   */
  private buildLokiPayload(entries: LogEntry[]): LokiPushPayload {
    // Group by labels
    const streamMap = new Map<string, Array<[string, string]>>();

    for (const entry of entries) {
      const labels = { level: entry.level, ...entry.labels };
      const labelKey = JSON.stringify(labels);

      if (!streamMap.has(labelKey)) {
        streamMap.set(labelKey, []);
      }

      const logLine = JSON.stringify({
        message: entry.message,
        ...entry.metadata,
      });

      // Loki timestamp format: nanosecond string
      const timestamp = (new Date(entry.timestamp).getTime() * 1000000).toString();
      streamMap.get(labelKey)!.push([timestamp, logLine]);
    }

    const streams: LokiPushPayload['streams'] = [];
    for (const [labelKey, values] of streamMap) {
      streams.push({
        stream: JSON.parse(labelKey),
        values,
      });
    }

    return { streams };
  }

  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  /**
   * Stop forwarder
   */
  async stop(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }

  /**
   * Delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get buffer size
   */
  getBufferSize(): number {
    return this.buffer.length;
  }
}

/**
 * Create Log Forwarder
 */
export function createLogForwarder(config: LogForwarderConfig): LogForwarder {
  return new LogForwarder(config);
}

/**
 * Create Log Forwarder configuration (from env)
 */
export function createLogForwarderConfigFromEnv(): LogForwarderConfig | null {
  const lokiUrl = process.env.LOKI_URL;
  if (!lokiUrl) return null;

  return {
    lokiUrl,
    batchSize: parseInt(process.env.LOG_BATCH_SIZE ?? '100', 10),
    flushInterval: parseInt(process.env.LOG_FLUSH_INTERVAL ?? '5000', 10),
    maxRetries: parseInt(process.env.LOG_MAX_RETRIES ?? '3', 10),
    defaultLabels: {
      app: process.env.APP_NAME ?? 'jiffoo-mall',
      env: process.env.NODE_ENV ?? 'development',
    },
    enabled: process.env.LOG_FORWARDING_ENABLED !== 'false',
  };
}

