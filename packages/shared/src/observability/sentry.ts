/**
 * Sentry APM Integration
 * 
 * Provides error tracking and performance monitoring capabilities
 */

/**
 * Sentry Configuration
 */
export interface SentryConfig {
  /** Sentry DSN */
  dsn: string;
  /** Environment name */
  environment: string;
  /** Release version */
  release?: string;
  /** Trace sample rate (0-1) */
  tracesSampleRate?: number;
  /** Error sample rate (0-1) */
  sampleRate?: number;
  /** Whether to enable debug mode */
  debug?: boolean;
  /** Slow request threshold (ms) */
  slowTransactionThreshold?: number;
  /** Ignored error types */
  ignoreErrors?: (string | RegExp)[];
  /** Ignored URLs */
  denyUrls?: (string | RegExp)[];
}

/**
 * User Context
 */
export interface UserContext {
  id?: string;
  email?: string;
  username?: string;
  storeId?: string;
  role?: string;
}

/**
 * Error Context
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
 * Transaction Context
 */
export interface TransactionContext {
  name: string;
  op: string;
  description?: string;
  data?: Record<string, unknown>;
}

/**
 * Default Configuration
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
 * Sentry Client Wrapper
 * 
 * Note: @sentry/node or @sentry/nextjs is required for actual usage
 * This wrapper provides type safety
 */
export class SentryClient {
  private config: SentryConfig;
  private initialized = false;

  constructor(config: SentryConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get initialization config
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
   * Mark as initialized
   */
  markInitialized(): void {
    this.initialized = true;
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Process event before sending
   */
  private beforeSend(event: unknown): unknown {
    // Add custom logic here
    return event;
  }

  /**
   * Process transaction before sending
   */
  private beforeSendTransaction(transaction: unknown): unknown {
    // Filter slow transactions here
    return transaction;
  }

  /**
   * Create error context
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
   * Create user context
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
   * Create transaction context
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
   * Check if transaction is slow
   */
  isSlowTransaction(durationMs: number): boolean {
    return durationMs > (this.config.slowTransactionThreshold ?? 1000);
  }

  /**
   * Get slow transaction threshold
   */
  getSlowTransactionThreshold(): number {
    return this.config.slowTransactionThreshold ?? 1000;
  }
}

/**
 * Create Sentry Client
 */
export function createSentryClient(config: SentryConfig): SentryClient {
  return new SentryClient(config);
}

/**
 * Create Sentry Config (from environment variables)
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

