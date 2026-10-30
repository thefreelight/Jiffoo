import Redis from 'ioredis';
import { env } from '@/config/env';

/** The milliseconds a connection attempt to Redis may take before it is given up. */
const CACHE_CONNECT_TIMEOUT_MS = 5_000;
/** The milliseconds a command may wait for the answer of Redis before it is given up. */
const CACHE_COMMAND_TIMEOUT_MS = 5_000;
/** The milliseconds the startup connection may take before it gives up. */
const CACHE_CONNECT_BUDGET_MS = 10_000;
/** The milliseconds between two attempts of the startup connection. */
const CACHE_CONNECT_RETRY_MS = 500;

/**
 * Writes a structured record of the cache client.
 *
 * The degradation paths of the cache are recorded with the event, the scope
 * and the reason, so a record can be read by a machine and never carries a
 * free text that hides the cause.
 */
function record(level: 'info' | 'warn' | 'error', event: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ event, scope: 'cache', ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.info(line);
}

/**
 * The budget of the startup connection.
 *
 * The cache is not on the critical path of a request, so the start of the
 * process does not wait for a cache that is not there. A deployment that
 * knows its own cache adjusts the budget with the environment.
 */
export function cacheConnectBudgetMs(): number {
  const configured = Number(process.env.REDIS_CONNECT_BUDGET_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : CACHE_CONNECT_BUDGET_MS;
}

export class RedisCache {
  private static instance: RedisCache;
  private redis: Redis;
  private isConnected: boolean = false;
  /**
   * The invalidation that could not be performed while the cache was
   * unreachable. It is completed as soon as the client is reachable again.
   */
  private pendingInvalidation: (() => Promise<boolean>) | undefined;
  private static readonly SCAN_COUNT = 200;

  private constructor() {
    // Use REDIS_URL environment variable
    this.redis = new Redis(env.REDIS_URL, {
      // The cache is never on the critical path of a request: a Redis that
      // stopped answering must turn every read into a miss instead of a
      // request that hangs. The connect timeout, the command timeout and the
      // disabled offline queue are the discipline of the protection module.
      connectTimeout: CACHE_CONNECT_TIMEOUT_MS,
      commandTimeout: CACHE_COMMAND_TIMEOUT_MS,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
      autoResendUnfulfilledCommands: false,
      retryStrategy: (times) => {
        // Retry with exponential backoff, max 10 seconds
        const delay = Math.min(times * 1000, 10000);
        record('warn', 'cache_redis_retry', { attempt: times, delayMs: delay });
        return delay;
      },
      reconnectOnError: (err) => {
        // Reconnect on DNS errors (EAI_AGAIN)
        const targetError = 'EAI_AGAIN';
        if (!err.message.includes(targetError)) return false;
        record('warn', 'cache_redis_reconnect_requested', { reason: 'dns_error' });
        return true;
      },
      lazyConnect: true,
    });

    this.setupEventHandlers();
  }

  public static getInstance(): RedisCache {
    if (!RedisCache.instance) {
      RedisCache.instance = new RedisCache();
    }
    return RedisCache.instance;
  }

  private setupEventHandlers(): void {
    this.redis.on('connect', () => {
      record('info', 'cache_redis_connected');
      this.isConnected = true;
    });

    this.redis.on('ready', () => {
      this.isConnected = true;
      // The client is reachable again, so an invalidation that was lost
      // during an outage is completed now.
      void this.completePendingInvalidation();
    });

    this.redis.on('error', (error) => {
      record('error', 'cache_redis_error', { reason: error instanceof Error ? error.message : String(error) });
      this.isConnected = false;
    });

    this.redis.on('close', () => {
      record('warn', 'cache_redis_closed');
      this.isConnected = false;
    });
  }

  /**
   * Connects the client within the budget of the start.
   *
   * The budget is the total time the start may spend on the cache. When it is
   * spent, the connection is given up: a cache that is not there must not
   * hold the start of the process for a minute.
   */
  public async connect(): Promise<void> {
    const budgetMs = cacheConnectBudgetMs();
    const deadline = Date.now() + budgetMs;
    let attempt = 0;

    for (;;) {
      attempt += 1;
      try {
        await this.redis.connect();
        record('info', 'cache_redis_connected', { attempt, budgetMs });
        return;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0) {
          record('error', 'cache_redis_connect_budget_exhausted', { attempt, budgetMs, reason });
          // In development environment, if Redis is unavailable, run without cache
          if (env.NODE_ENV === 'development') {
            record('warn', 'cache_redis_disabled', { attempt, budgetMs, reason: 'development_mode' });
            return;
          }
          throw error;
        }
        record('warn', 'cache_redis_connect_failed', { attempt, budgetMs, remainingMs, reason });
        const delay = Math.min(CACHE_CONNECT_RETRY_MS * attempt, remainingMs);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Runs an invalidation and defers it while the cache is unreachable.
   *
   * An invalidation that is lost leaves a stale entry behind, so the
   * invalidation is remembered and completed as soon as the client is
   * reachable again.
   *
   * @returns true when the invalidation ran.
   */
  public async invalidateOrDefer(invalidate: () => Promise<boolean>): Promise<boolean> {
    if (await invalidate()) return true;
    this.pendingInvalidation = invalidate;
    return false;
  }

  /**
   * Completes the invalidation that was deferred.
   *
   * The invalidation is kept when the cache is still unreachable, so the next
   * attempt runs it again.
   */
  private async completePendingInvalidation(): Promise<void> {
    const invalidate = this.pendingInvalidation;
    if (!invalidate) return;
    this.pendingInvalidation = undefined;
    try {
      if (!(await invalidate())) this.pendingInvalidation = invalidate;
    } catch (error) {
      this.pendingInvalidation = invalidate;
      record('warn', 'cache_invalidation_deferred_failed', { reason: error instanceof Error ? error.message : String(error) });
    }
  }

  public async disconnect(): Promise<void> {
    this.redis.disconnect();
    this.isConnected = false;
  }

  public async set(key: string, value: any, ttl?: number): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const serializedValue = JSON.stringify(value);
      if (ttl) {
        await this.redis.setex(key, ttl, serializedValue);
      } else {
        await this.redis.set(key, serializedValue);
      }
      return true;
    } catch (error) {
      record('error', 'cache_redis_set_failed', { reason: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  public async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected) {
      return null;
    }

    try {
      const value = await this.redis.get(key);
      if (value === null) {
        return null;
      }
      return JSON.parse(value) as T;
    } catch (error) {
      record('error', 'cache_redis_get_failed', { reason: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  public async del(key: string): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const result = await this.redis.del(key);
      return result > 0;
    } catch (error) {
      record('error', 'cache_redis_del_failed', { reason: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  public async exists(key: string): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const result = await this.redis.exists(key);
      return result === 1;
    } catch (error) {
      record('error', 'cache_redis_exists_failed', { reason: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  public async expire(key: string, ttl: number): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const result = await this.redis.expire(key, ttl);
      return result === 1;
    } catch (error) {
      record('error', 'cache_redis_expire_failed', { reason: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  public async incr(key: string): Promise<number | null> {
    if (!this.isConnected) {
      return null;
    }

    try {
      return await this.redis.incr(key);
    } catch (error) {
      record('error', 'cache_redis_incr_failed', { reason: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  public async decr(key: string): Promise<number | null> {
    if (!this.isConnected) {
      return null;
    }

    try {
      return await this.redis.decr(key);
    } catch (error) {
      record('error', 'cache_redis_decr_failed', { reason: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  public async keys(pattern: string): Promise<string[]> {
    if (!this.isConnected) {
      return [];
    }

    try {
      return await this.scanKeys(pattern);
    } catch (error) {
      record('error', 'cache_redis_keys_failed', { reason: error instanceof Error ? error.message : String(error) });
      return [];
    }
  }

  public async flushdb(): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      await this.redis.flushdb();
      return true;
    } catch (error) {
      record('error', 'cache_redis_flushdb_failed', { reason: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  public async flushAll(): Promise<boolean> {
    return this.flushdb();
  }

  /**
   * Deletes the keys of a pattern.
   *
   * @returns the number of deleted keys, or null when the cache was
   * unreachable and the pattern was not scanned at all. A pattern that
   * matched no key is not the same as a pattern that was never scanned.
   */
  public async deleteByPattern(pattern: string): Promise<number | null> {
    if (!this.isConnected) {
      record('warn', 'cache_redis_delete_pattern_unavailable', { pattern });
      return null;
    }

    try {
      const keys = await this.scanKeys(pattern);
      if (keys.length === 0) {
        return 0;
      }
      let deletedCount = 0;
      const chunkSize = 200;
      for (let i = 0; i < keys.length; i += chunkSize) {
        const chunk = keys.slice(i, i + chunkSize);
        deletedCount += await this.redis.del(...chunk);
      }
      return deletedCount;
    } catch (error) {
      record('error', 'cache_redis_delete_pattern_failed', { pattern, reason: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  public async countByPattern(pattern: string): Promise<number> {
    if (!this.isConnected) {
      return 0;
    }

    try {
      let cursor = '0';
      let count = 0;
      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          RedisCache.SCAN_COUNT
        );
        cursor = nextCursor;
        count += keys.length;
      } while (cursor !== '0');

      return count;
    } catch (error) {
      record('error', 'cache_redis_count_pattern_failed', { pattern, reason: error instanceof Error ? error.message : String(error) });
      return 0;
    }
  }

  public getConnectionStatus(): boolean {
    return this.isConnected;
  }

  public getRawClient(): Redis {
    return this.redis;
  }

  public async ping(): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      record('error', 'cache_redis_ping_failed', { reason: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  // Set a value with an expiry, used for the verification code storage.
  public async setex(key: string, seconds: number, value: string): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      await this.redis.setex(key, seconds, value);
      return true;
    } catch (error) {
      record('error', 'cache_redis_setex_failed', { reason: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  // Read a string value, used for the verification code retrieval.
  public async getString(key: string): Promise<string | null> {
    if (!this.isConnected) {
      return null;
    }

    try {
      return await this.redis.get(key);
    } catch (error) {
      record('error', 'cache_redis_get_string_failed', { reason: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  // The remaining expiration of a key.
  public async ttl(key: string): Promise<number> {
    if (!this.isConnected) {
      return -2; // -2 means key does not exist
    }

    try {
      return await this.redis.ttl(key);
    } catch (error) {
      record('error', 'cache_redis_ttl_failed', { reason: error instanceof Error ? error.message : String(error) });
      return -2;
    }
  }

  private async scanKeys(pattern: string): Promise<string[]> {
    let cursor = '0';
    const keys: string[] = [];

    do {
      const [nextCursor, batch] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        RedisCache.SCAN_COUNT
      );
      cursor = nextCursor;
      if (batch.length > 0) {
        keys.push(...batch);
      }
    } while (cursor !== '0');

    return keys;
  }

  /**
   * Get the underlying Redis client for advanced operations
   * Use with caution - primarily for health monitoring and diagnostics
   */
  public getClient(): Redis {
    return this.redis;
  }
}

// Export singleton instance
export const redisCache = RedisCache.getInstance();
