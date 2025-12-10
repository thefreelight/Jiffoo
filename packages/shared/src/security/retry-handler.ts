/**
 * Retry Handler - 重试处理器（指数退避算法）
 */

export interface RetryConfig {
  /** 最大重试次数 */
  maxRetries: number;
  /** 初始延迟（毫秒） */
  initialDelay: number;
  /** 最大延迟（毫秒） */
  maxDelay: number;
  /** 退避倍数 */
  backoffMultiplier?: number;
  /** 是否添加随机抖动 */
  jitter?: boolean;
  /** 可重试的错误类型 */
  retryableErrors?: (new (...args: unknown[]) => Error)[];
  /** 自定义重试判断函数 */
  shouldRetry?: (error: Error, attempt: number) => boolean;
  /** 重试前回调 */
  onRetry?: (error: Error, attempt: number, delay: number) => void;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalDelay: number;
}

/**
 * 计算指数退避延迟
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  multiplier: number,
  jitter: boolean
): number {
  // 指数退避: initialDelay * multiplier^attempt
  let delay = initialDelay * Math.pow(multiplier, attempt);

  // 添加随机抖动 (±25%)
  if (jitter) {
    const jitterFactor = 0.75 + Math.random() * 0.5;
    delay *= jitterFactor;
  }

  // 不超过最大延迟
  return Math.min(delay, maxDelay);
}

/**
 * 默认可重试错误类型
 */
const DEFAULT_RETRYABLE_ERRORS: (new (...args: unknown[]) => Error)[] = [];

/**
 * Retry Handler 类
 */
export class RetryHandler {
  private config: Required<RetryConfig>;

  constructor(config: RetryConfig) {
    this.config = {
      maxRetries: config.maxRetries,
      initialDelay: config.initialDelay,
      maxDelay: config.maxDelay,
      backoffMultiplier: config.backoffMultiplier ?? 2,
      jitter: config.jitter ?? true,
      retryableErrors: config.retryableErrors ?? DEFAULT_RETRYABLE_ERRORS,
      shouldRetry: config.shouldRetry ?? this.defaultShouldRetry.bind(this),
      onRetry: config.onRetry ?? (() => {}),
    };
  }

  /**
   * 执行带重试的函数
   */
  async execute<T>(fn: () => Promise<T>): Promise<RetryResult<T>> {
    let lastError: Error | undefined;
    let totalDelay = 0;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await fn();
        return { success: true, result, attempts: attempt + 1, totalDelay };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // 检查是否应该重试
        if (attempt < this.config.maxRetries && this.config.shouldRetry(lastError, attempt)) {
          const delay = calculateDelay(
            attempt,
            this.config.initialDelay,
            this.config.maxDelay,
            this.config.backoffMultiplier,
            this.config.jitter
          );
          totalDelay += delay;
          this.config.onRetry(lastError, attempt + 1, delay);
          await this.sleep(delay);
        } else {
          break;
        }
      }
    }

    return {
      success: false,
      error: lastError,
      attempts: this.config.maxRetries + 1,
      totalDelay,
    };
  }

  /**
   * 默认重试判断
   */
  private defaultShouldRetry(error: Error, _attempt: number): boolean {
    // 检查是否是可重试的错误类型
    return this.config.retryableErrors.some((ErrorClass) => error instanceof ErrorClass) ||
      this.isNetworkError(error) || this.isTimeoutError(error);
  }

  private isNetworkError(error: Error): boolean {
    const networkErrorCodes = ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN'];
    return 'code' in error && networkErrorCodes.includes((error as NodeJS.ErrnoException).code ?? '');
  }

  private isTimeoutError(error: Error): boolean {
    return error.name === 'TimeoutError' || error.message.toLowerCase().includes('timeout');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 获取计算的延迟时间（用于测试）
   */
  getDelay(attempt: number): number {
    return calculateDelay(
      attempt,
      this.config.initialDelay,
      this.config.maxDelay,
      this.config.backoffMultiplier,
      false // 不包含抖动
    );
  }
}

// 预定义配置
export const RetryPresets = {
  /** 快速重试: 3次, 100ms起始 */
  fast: { maxRetries: 3, initialDelay: 100, maxDelay: 1000 },
  /** 标准重试: 3次, 1s起始 */
  standard: { maxRetries: 3, initialDelay: 1000, maxDelay: 10000 },
  /** 耐心重试: 5次, 2s起始 */
  patient: { maxRetries: 5, initialDelay: 2000, maxDelay: 30000 },
  /** 外部服务: 4次, 500ms起始 */
  externalService: { maxRetries: 4, initialDelay: 500, maxDelay: 15000 },
} as const;

