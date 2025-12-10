/**
 * Rate Limiter - 滑动窗口算法实现
 * 支持内存存储和 Redis 存储（分布式限流）
 */

export interface RateLimitConfig {
  /** 窗口大小（毫秒） */
  windowMs: number;
  /** 窗口内允许的最大请求数 */
  maxRequests: number;
  /** 限流键前缀 */
  keyPrefix?: string;
  /** 是否跳过成功请求的计数 */
  skipSuccessfulRequests?: boolean;
  /** 是否跳过失败请求的计数 */
  skipFailedRequests?: boolean;
  /** 自定义键生成函数 */
  keyGenerator?: (identifier: string) => string;
}

export interface RateLimitResult {
  /** 是否被限流 */
  limited: boolean;
  /** 剩余请求数 */
  remaining: number;
  /** 重置时间（毫秒时间戳） */
  resetTime: number;
  /** 总限制数 */
  limit: number;
  /** 重试等待时间（秒） */
  retryAfter?: number;
}

export interface RateLimitStore {
  /** 增加计数并获取当前状态 */
  increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }>;
  /** 获取当前计数 */
  get(key: string): Promise<{ count: number; resetTime: number } | null>;
  /** 重置计数 */
  reset(key: string): Promise<void>;
}

/**
 * 内存存储实现
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, { count: number; resetTime: number }>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(cleanupIntervalMs = 60000) {
    // 定期清理过期记录
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
 * Redis 存储实现
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
 * Rate Limiter 核心类
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
   * 检查是否被限流
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
   * 重置限流计数
   */
  async reset(identifier: string): Promise<void> {
    const key = this.config.keyGenerator(identifier);
    await this.store.reset(key);
  }

  /**
   * 获取当前状态（不增加计数）
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

// 预定义的限流配置
export const RateLimitPresets = {
  /** 默认 API 限流：100 req/min */
  default: { windowMs: 60_000, maxRequests: 100 },
  /** 登录限流：5 req/5min */
  login: { windowMs: 300_000, maxRequests: 5, keyPrefix: 'rl:login:' },
  /** 注册限流：3 req/hour */
  register: { windowMs: 3_600_000, maxRequests: 3, keyPrefix: 'rl:register:' },
  /** API 写操作：30 req/min */
  write: { windowMs: 60_000, maxRequests: 30, keyPrefix: 'rl:write:' },
  /** 严格限流：10 req/min */
  strict: { windowMs: 60_000, maxRequests: 10, keyPrefix: 'rl:strict:' },
} as const;

