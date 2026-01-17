/**
 * Sentry APM 集成
 * 
 * 提供错误追踪和性能监控能力
 */

/**
 * Sentry 配置
 */
export interface SentryConfig {
  /** Sentry DSN */
  dsn: string;
  /** 环境名称 */
  environment: string;
  /** 发布版本 */
  release?: string;
  /** 追踪采样率 (0-1) */
  tracesSampleRate?: number;
  /** 错误采样率 (0-1) */
  sampleRate?: number;
  /** 是否启用调试模式 */
  debug?: boolean;
  /** 慢请求阈值（毫秒） */
  slowTransactionThreshold?: number;
  /** 忽略的错误类型 */
  ignoreErrors?: (string | RegExp)[];
  /** 忽略的 URL */
  denyUrls?: (string | RegExp)[];
}

/**
 * 用户上下文
 */
export interface UserContext {
  id?: string;
  email?: string;
  username?: string;
  storeId?: string;
  role?: string;
}

/**
 * 错误上下文
 */
export interface ErrorContext {
  storeId?: string;
  userId?: string;
  traceId?: string;
  spanId?: string;
  requestId?: string;
  path?: string;
  method?: string;
  userAgent?: string;
  ip?: string;
  extra?: Record<string, unknown>;
}

/**
 * 事务上下文
 */
export interface TransactionContext {
  name: string;
  op: string;
  description?: string;
  data?: Record<string, unknown>;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Partial<SentryConfig> = {
  tracesSampleRate: 0.1,
  sampleRate: 1.0,
  debug: false,
  slowTransactionThreshold: 1000,
  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
  ],
  denyUrls: [
    /extensions\//i,
    /^chrome:\/\//i,
    /^moz-extension:\/\//i,
  ],
};

/**
 * Sentry 客户端包装器
 * 
 * 注意：实际使用时需要安装 @sentry/node 或 @sentry/nextjs
 * 这里提供类型安全的包装器
 */
export class SentryClient {
  private config: SentryConfig;
  private initialized = false;

  constructor(config: SentryConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 获取初始化配置
   */
  getInitConfig(): Record<string, unknown> {
    return {
      dsn: this.config.dsn,
      environment: this.config.environment,
      release: this.config.release,
      tracesSampleRate: this.config.tracesSampleRate,
      sampleRate: this.config.sampleRate,
      debug: this.config.debug,
      ignoreErrors: this.config.ignoreErrors,
      denyUrls: this.config.denyUrls,
      beforeSend: (event: unknown) => this.beforeSend(event),
      beforeSendTransaction: (transaction: unknown) =>
        this.beforeSendTransaction(transaction),
    };
  }

  /**
   * 标记为已初始化
   */
  markInitialized(): void {
    this.initialized = true;
  }

  /**
   * 检查是否已初始化
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 发送前处理事件
   */
  private beforeSend(event: unknown): unknown {
    // 可以在这里添加额外的处理逻辑
    return event;
  }

  /**
   * 发送前处理事务
   */
  private beforeSendTransaction(transaction: unknown): unknown {
    // 可以在这里过滤慢事务
    return transaction;
  }

  /**
   * 创建错误上下文
   */
  createErrorContext(context: ErrorContext): Record<string, unknown> {
    return {
      tags: {
        storeId: context.storeId,
        userId: context.userId,
        traceId: context.traceId,
        requestId: context.requestId,
      },
      extra: {
        path: context.path,
        method: context.method,
        userAgent: context.userAgent,
        ip: context.ip,
        ...context.extra,
      },
    };
  }

  /**
   * 创建用户上下文
   */
  createUserContext(user: UserContext): Record<string, unknown> {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      storeId: user.storeId,
      role: user.role,
    };
  }

  /**
   * 创建事务上下文
   */
  createTransactionContext(context: TransactionContext): Record<string, unknown> {
    return {
      name: context.name,
      op: context.op,
      description: context.description,
      data: context.data,
    };
  }

  /**
   * 检查是否为慢事务
   */
  isSlowTransaction(durationMs: number): boolean {
    return durationMs > (this.config.slowTransactionThreshold ?? 1000);
  }

  /**
   * 获取慢事务阈值
   */
  getSlowTransactionThreshold(): number {
    return this.config.slowTransactionThreshold ?? 1000;
  }
}

/**
 * 创建 Sentry 客户端
 */
export function createSentryClient(config: SentryConfig): SentryClient {
  return new SentryClient(config);
}

/**
 * 创建 Sentry 配置（从环境变量）
 */
export function createSentryConfigFromEnv(): SentryConfig | null {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    return null;
  }

  return {
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.SENTRY_RELEASE ?? process.env.npm_package_version,
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
    sampleRate: parseFloat(process.env.SENTRY_SAMPLE_RATE ?? '1.0'),
    debug: process.env.SENTRY_DEBUG === 'true',
    slowTransactionThreshold: parseInt(
      process.env.SENTRY_SLOW_TRANSACTION_THRESHOLD ?? '1000',
      10
    ),
  };
}

