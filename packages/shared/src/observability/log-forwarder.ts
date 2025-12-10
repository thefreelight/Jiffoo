/**
 * Log Forwarder - 日志转发器
 * 
 * 将日志批量发送到集中日志系统（如 Loki）
 */

/**
 * 日志级别
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * 日志条目
 */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  labels?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

/**
 * Loki 推送格式
 */
export interface LokiPushPayload {
  streams: Array<{
    stream: Record<string, string>;
    values: Array<[string, string]>;
  }>;
}

/**
 * 日志转发配置
 */
export interface LogForwarderConfig {
  /** Loki 推送 URL */
  lokiUrl: string;
  /** 批量大小 */
  batchSize?: number;
  /** 刷新间隔（毫秒） */
  flushInterval?: number;
  /** 重试次数 */
  maxRetries?: number;
  /** 重试延迟（毫秒） */
  retryDelay?: number;
  /** 默认标签 */
  defaultLabels?: Record<string, string>;
  /** 是否启用 */
  enabled?: boolean;
}

/**
 * 默认配置
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
 * Log Forwarder 类
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
   * 添加日志条目
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
   * 快捷方法
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
   * 刷新缓冲区
   */
  async flush(): Promise<void> {
    if (this.isFlushing || this.buffer.length === 0) return;

    this.isFlushing = true;
    const entries = [...this.buffer];
    this.buffer = [];

    try {
      await this.sendToLoki(entries);
    } catch (error) {
      // 发送失败，将日志放回缓冲区
      this.buffer = [...entries, ...this.buffer];
      console.error('Failed to forward logs to Loki:', error);
    } finally {
      this.isFlushing = false;
    }
  }

  /**
   * 发送日志到 Loki
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
          // 服务器错误，可以重试
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
   * 构建 Loki 推送 payload
   */
  private buildLokiPayload(entries: LogEntry[]): LokiPushPayload {
    // 按标签分组
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

      // Loki 时间戳格式：纳秒字符串
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
   * 启动定时刷新
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  /**
   * 停止转发器
   */
  async stop(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }

  /**
   * 延迟
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取缓冲区大小
   */
  getBufferSize(): number {
    return this.buffer.length;
  }
}

/**
 * 创建 Log Forwarder
 */
export function createLogForwarder(config: LogForwarderConfig): LogForwarder {
  return new LogForwarder(config);
}

/**
 * 创建 Log Forwarder 配置（从环境变量）
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

