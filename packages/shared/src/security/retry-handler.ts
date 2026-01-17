/**
 * Retry Handler - Retry Logic with Exponential Backoff
 */

export interface RetryConfig {
  /** Max retry attempts */
  maxRetries?: number;
  /** Initial delay (ms) */
  initialDelay?: number;
  /** Max delay (ms) */
  maxDelay?: number;
  /** Backoff multiplier */
  backoffMultiplier?: number;
  /** Whether to add random jitter */
  jitter?: boolean;
  /** Retryable error types */
  retryableErrors?: Array<string | RegExp>;
  /** Custom retry predicate */
  shouldRetry?: (error: any, attempt: number) => boolean;
  /** Callback before retry */
  onRetry?: (error: any, attempt: number, delay: number) => void;
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
  totalDelay: number;
}

/**
 * Calculate exponential backoff delay
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  multiplier: number,
  jitter: boolean
): number {
  // Exponential backoff: initialDelay * multiplier^attempt
  let delay = initialDelay * Math.pow(multiplier, attempt);

  // Add jitter (±25%)
  if (jitter) {
    const jitterFactor = 0.75 + Math.random() * 0.5;
    delay *= jitterFactor;
  }

  // Do not exceed max delay
  return Math.min(delay, maxDelay);
}

/**
 * Default retryable error types
 */
const DEFAULT_RETRYABLE_ERRORS: Array<string | RegExp> = [];

/**
 * Retry Handler class
 */
export class RetryHandler {
  private config: Required<RetryConfig>;

  constructor(config: RetryConfig) {
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      initialDelay: config.initialDelay ?? 1000,
      maxDelay: config.maxDelay ?? 10000,
      backoffMultiplier: config.backoffMultiplier ?? 2,
      jitter: config.jitter ?? true,
      retryableErrors: config.retryableErrors ?? DEFAULT_RETRYABLE_ERRORS,
      shouldRetry: config.shouldRetry ?? this.defaultShouldRetry.bind(this),
      onRetry: config.onRetry ?? (() => { }),
    };
  }

  /**
   * Execute function with retry
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

        // Check if should retry
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
   * Default retry judgment
   */
  private defaultShouldRetry(error: Error, _attempt: number): boolean {
    // Check if it is a retryable error type
    const matchesRetryable = this.config.retryableErrors.some((pattern) => {
      if (typeof pattern === 'string') {
        return error.message.includes(pattern);
      }
      return pattern.test(error.message);
    });

    return matchesRetryable || this.isNetworkError(error) || this.isTimeoutError(error);
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
   * Get calculated delay (for testing)
   */
  getDelay(attempt: number): number {
    return calculateDelay(
      attempt,
      this.config.initialDelay,
      this.config.maxDelay,
      this.config.backoffMultiplier,
      false // Without jitter
    );
  }
}

// Predefined configuration
export const RetryPresets = {
  /** Fast retry: 3 attempts, 100ms start */
  fast: { maxRetries: 3, initialDelay: 100, maxDelay: 1000 },
  /** Standard retry: 3 attempts, 1s start */
  standard: { maxRetries: 3, initialDelay: 1000, maxDelay: 10000 },
  /** Patient retry: 5 attempts, 2s start */
  patient: { maxRetries: 5, initialDelay: 2000, maxDelay: 30000 },
  /** External service: 4 attempts, 500ms start */
  externalService: { maxRetries: 4, initialDelay: 500, maxDelay: 15000 },
} as const;

