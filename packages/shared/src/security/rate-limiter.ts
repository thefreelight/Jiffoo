/**
 * Rate Limiter - Sliding Window Algorithm Implementation
 * Supports memory storage and Redis storage (distributed rate limiting)
 */

export interface RateLimitConfig {
  /** Window size (ms) */
  windowMs: number;
  /** Max requests allowed in window */
  maxRequests: number;
  /** Rate limit key prefix */
  keyPrefix?: string;
  /** Skip counting successful requests */
  skipSuccessfulRequests?: boolean;
  /** Skip counting failed requests */
  skipFailedRequests?: boolean;
  /** Custom key generator */
  keyGenerator?: (identifier: string) => string;
}

export interface RateLimitResult {
  /** Is limited */
  limited: boolean;
  /** Remaining requests */
  remaining: number;
  /** Reset time (ms timestamp) */
  resetTime: number;
  /** Total limit */
  limit: number;
  /** Retry after (seconds) */
  retryAfter?: number;
}

export interface RateLimitStore {
  /** Increment count and get current status */
  increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }>;
  /** Get current count */
  get(key: string): Promise<{ count: number; resetTime: number } | null>;
  /** Reset count */
  reset(key: string): Promise<void>;
}

/**
 * Memory storage implementation
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, { count: number; resetTime: number }>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(cleanupIntervalMs = 60000) {
    // Periodically clean up expired records
    this.cleanupInterval = setInterval(() => this.cleanup(), cleanupIntervalMs);
  }

  async increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }> {
    const now = Date.now();
    const existing = this.store.get(key);

    if (existing && existing.resetTime > now) {
      existing.count++;
      return { count: existing.count, resetTime: existing.resetTime };
    }

    const resetTime = now + windowMs;
    this.store.set(key, { count: 1, resetTime });
    return { count: 1, resetTime };
  }

  async get(key: string): Promise<{ count: number; resetTime: number } | null> {
    const existing = this.store.get(key);
    if (!existing || existing.resetTime <= Date.now()) {
      return null;
    }
    return existing;
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.store.entries()) {
      if (value.resetTime <= now) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }
}

/**
 * Redis storage implementation
 */
export class RedisRateLimitStore implements RateLimitStore {
  private redis: {
    incr(key: string): Promise<number>;
    pexpire(key: string, ms: number): Promise<number>;
    pttl(key: string): Promise<number>;
    del(key: string): Promise<number>;
    get(key: string): Promise<string | null>;
  };

  constructor(redisClient: RedisRateLimitStore['redis']) {
    this.redis = redisClient;
  }

  async increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }> {
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.pexpire(key, windowMs);
    }
    const ttl = await this.redis.pttl(key);
    const resetTime = Date.now() + (ttl > 0 ? ttl : windowMs);
    return { count, resetTime };
  }

  async get(key: string): Promise<{ count: number; resetTime: number } | null> {
    const count = await this.redis.get(key);
    if (!count) return null;
    const ttl = await this.redis.pttl(key);
    if (ttl <= 0) return null;
    return { count: parseInt(count, 10), resetTime: Date.now() + ttl };
  }

  async reset(key: string): Promise<void> {
    await this.redis.del(key);
  }
}

/**
 * Rate Limiter core class
 */
export class RateLimiter {
  private config: Required<RateLimitConfig>;
  private store: RateLimitStore;

  constructor(config: RateLimitConfig, store?: RateLimitStore) {
    this.config = {
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
      keyPrefix: config.keyPrefix ?? 'rl:',
      skipSuccessfulRequests: config.skipSuccessfulRequests ?? false,
      skipFailedRequests: config.skipFailedRequests ?? false,
      keyGenerator: config.keyGenerator ?? ((id) => `${this.config.keyPrefix}${id}`),
    };
    this.store = store ?? new MemoryRateLimitStore();
  }

  /**
   * Check if limited
   */
  async check(identifier: string): Promise<RateLimitResult> {
    const key = this.config.keyGenerator(identifier);
    const { count, resetTime } = await this.store.increment(key, this.config.windowMs);
    const limited = count > this.config.maxRequests;
    const remaining = Math.max(0, this.config.maxRequests - count);
    const retryAfter = limited ? Math.ceil((resetTime - Date.now()) / 1000) : undefined;

    return {
      limited,
      remaining,
      resetTime,
      limit: this.config.maxRequests,
      retryAfter,
    };
  }

  /**
   * Reset rate limit count
   */
  async reset(identifier: string): Promise<void> {
    const key = this.config.keyGenerator(identifier);
    await this.store.reset(key);
  }

  /**
   * Get current status (without incrementing)
   */
  async getStatus(identifier: string): Promise<RateLimitResult> {
    const key = this.config.keyGenerator(identifier);
    const result = await this.store.get(key);

    if (!result) {
      return {
        limited: false,
        remaining: this.config.maxRequests,
        resetTime: Date.now() + this.config.windowMs,
        limit: this.config.maxRequests,
      };
    }

    const limited = result.count >= this.config.maxRequests;
    const remaining = Math.max(0, this.config.maxRequests - result.count);

    return {
      limited,
      remaining,
      resetTime: result.resetTime,
      limit: this.config.maxRequests,
      retryAfter: limited ? Math.ceil((result.resetTime - Date.now()) / 1000) : undefined,
    };
  }
}

// Predefined rate limit presets
export const RateLimitPresets = {
  /** Default API rate limit: 100 req/min */
  default: { windowMs: 60_000, maxRequests: 100 },
  /** Login rate limit: 5 req/5min */
  login: { windowMs: 300_000, maxRequests: 5, keyPrefix: 'rl:login:' },
  /** Register rate limit: 3 req/hour */
  register: { windowMs: 3_600_000, maxRequests: 3, keyPrefix: 'rl:register:' },
  /** API write rate limit: 30 req/min */
  write: { windowMs: 60_000, maxRequests: 30, keyPrefix: 'rl:write:' },
  /** Strict rate limit: 10 req/min */
  strict: { windowMs: 60_000, maxRequests: 10, keyPrefix: 'rl:strict:' },
} as const;

