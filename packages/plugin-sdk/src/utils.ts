/**
 * Jiffoo Plugin SDK - Utilities
 *
 * Common utility functions for plugin development.
 */

/**
 * Logger interface
 */
export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * Create a logger instance for a plugin
 *
 * @param pluginSlug - Plugin slug for log prefix
 * @param options - Logger options
 * @returns Logger instance
 *
 * @example
 * ```typescript
 * const logger = createLogger('my-plugin');
 * logger.info('Plugin initialized');
 * logger.error('Something went wrong', { error: err });
 * ```
 */
export function createLogger(
  pluginSlug: string,
  options: { level?: 'debug' | 'info' | 'warn' | 'error' } = {}
): Logger {
  const { level = 'info' } = options;
  const levels = ['debug', 'info', 'warn', 'error'];
  const minLevel = levels.indexOf(level);

  const prefix = `[${pluginSlug}]`;

  const shouldLog = (logLevel: string): boolean => {
    return levels.indexOf(logLevel) >= minLevel;
  };

  const formatArgs = (args: unknown[]): string => {
    return args
      .map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(' ');
  };

  return {
    debug(message: string, ...args: unknown[]) {
      if (shouldLog('debug')) {
        console.debug(`${prefix} [DEBUG] ${message}`, ...args);
      }
    },

    info(message: string, ...args: unknown[]) {
      if (shouldLog('info')) {
        console.info(`${prefix} [INFO] ${message}`, ...args);
      }
    },

    warn(message: string, ...args: unknown[]) {
      if (shouldLog('warn')) {
        console.warn(`${prefix} [WARN] ${message}`, ...args);
      }
    },

    error(message: string, ...args: unknown[]) {
      if (shouldLog('error')) {
        console.error(`${prefix} [ERROR] ${message}`, ...args);
      }
    },
  };
}

/**
 * Format an error for API response
 *
 * @param error - Error object or message
 * @param includeStack - Include stack trace (only in development)
 * @returns Formatted error object
 *
 * @example
 * ```typescript
 * try {
 *   await processPayment();
 * } catch (error) {
 *   res.status(500).json(formatError(error));
 * }
 * ```
 */
export function formatError(
  error: unknown,
  includeStack = process.env.NODE_ENV === 'development'
): { error: string; code?: string; details?: unknown; stack?: string } {
  if (error instanceof Error) {
    const result: { error: string; code?: string; details?: unknown; stack?: string } = {
      error: error.message,
    };

    // Extract error code if available
    if ('code' in error && typeof error.code === 'string') {
      result.code = error.code;
    }

    // Extract details if available
    if ('details' in error) {
      result.details = error.details;
    }

    // Include stack trace in development
    if (includeStack && error.stack) {
      result.stack = error.stack;
    }

    return result;
  }

  if (typeof error === 'string') {
    return { error };
  }

  return { error: 'An unknown error occurred' };
}

/**
 * Retry a function with exponential backoff
 *
 * @param fn - Function to retry
 * @param options - Retry options
 * @returns Result of the function
 *
 * @example
 * ```typescript
 * const result = await retry(
 *   () => fetchExternalAPI(),
 *   { maxAttempts: 3, delay: 1000 }
 * );
 * ```
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delay?: number;
    backoff?: number;
    onRetry?: (error: Error, attempt: number) => void;
  } = {}
): Promise<T> {
  const { maxAttempts = 3, delay = 1000, backoff = 2, onRetry } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxAttempts) {
        if (onRetry) {
          onRetry(lastError, attempt);
        }

        const waitTime = delay * Math.pow(backoff, attempt - 1);
        await sleep(waitTime);
      }
    }
  }

  throw lastError;
}

/**
 * Sleep for a specified duration
 *
 * @param ms - Milliseconds to sleep
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a unique ID
 *
 * @param prefix - Optional prefix
 * @returns Unique ID string
 */
export function generateId(prefix?: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}

/**
 * Safely parse JSON
 *
 * @param json - JSON string
 * @param fallback - Fallback value if parsing fails
 * @returns Parsed value or fallback
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Deep merge objects
 *
 * @param target - Target object
 * @param sources - Source objects
 * @returns Merged object
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  ...sources: Partial<T>[]
): T {
  if (!sources.length) return target;

  const source = sources.shift();
  if (!source) return target;

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = target[key];

      if (isObject(sourceValue) && isObject(targetValue)) {
        target[key] = deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        ) as T[Extract<keyof T, string>];
      } else {
        target[key] = sourceValue as T[Extract<keyof T, string>];
      }
    }
  }

  return deepMerge(target, ...sources);
}

function isObject(item: unknown): item is Record<string, unknown> {
  return item !== null && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Debounce a function
 *
 * @param fn - Function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function (this: unknown, ...args: Parameters<T>) {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      fn.apply(this, args);
    }, wait);
  };
}

/**
 * Throttle a function
 *
 * @param fn - Function to throttle
 * @param limit - Time limit in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;

  return function (this: unknown, ...args: Parameters<T>) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}
