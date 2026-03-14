import Redis from 'ioredis';
import { env } from '@/config/env';

export class RedisCache {
  private static instance: RedisCache;
  private redis: Redis;
  private isConnected: boolean = false;
  private static readonly SCAN_COUNT = 200;

  private constructor() {
    // Use REDIS_URL environment variable
    this.redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        // Retry with exponential backoff, max 10 seconds
        const delay = Math.min(times * 1000, 10000);
        console.log(`Redis retry attempt ${times}, waiting ${delay}ms...`);
        return delay;
      },
      reconnectOnError: (err) => {
        // Reconnect on DNS errors (EAI_AGAIN)
        const targetError = 'EAI_AGAIN';
        if (err.message.includes(targetError)) {
          console.log('Redis DNS error detected, will reconnect...');
          return true;
        }
        return false;
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
      console.log('Redis connected successfully');
      this.isConnected = true;
    });

    this.redis.on('error', (error) => {
      console.error('Redis connection error:', error);
      this.isConnected = false;
    });

    this.redis.on('close', () => {
      console.log('Redis connection closed');
      this.isConnected = false;
    });
  }

  public async connect(): Promise<void> {
    const maxRetries = 10;
    let retryCount = 0;

    while (retryCount < maxRetries) {
      try {
        console.log(`Attempting to connect to Redis (attempt ${retryCount + 1}/${maxRetries})...`);
        await this.redis.connect();
        console.log('✅ Redis connected successfully');
        return;
      } catch (error: any) {
        retryCount++;
        console.error(`❌ Failed to connect to Redis (attempt ${retryCount}/${maxRetries}):`, error.message);

        if (retryCount >= maxRetries) {
          console.error('❌ Max Redis connection retries reached');
          // In development environment, if Redis is unavailable, run without cache
          if (env.NODE_ENV === 'development') {
            console.warn('⚠️ Running without Redis cache in development mode');
            return;
          } else {
            throw error;
          }
        }

        // Wait before retrying (exponential backoff)
        const delay = Math.min(retryCount * 2000, 10000);
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  public async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.redis.disconnect();
    }
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
      console.error('Redis set error:', error);
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
      console.error('Redis get error:', error);
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
      console.error('Redis del error:', error);
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
      console.error('Redis exists error:', error);
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
      console.error('Redis expire error:', error);
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
      console.error('Redis incr error:', error);
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
      console.error('Redis decr error:', error);
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
      console.error('Redis keys error:', error);
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
      console.error('Redis flushdb error:', error);
      return false;
    }
  }

  public async flushAll(): Promise<boolean> {
    return this.flushdb();
  }

  public async deleteByPattern(pattern: string): Promise<number> {
    if (!this.isConnected) {
      return 0;
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
      console.error('Redis deleteByPattern error:', error);
      return 0;
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
      console.error('Redis countByPattern error:', error);
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
      console.error('Redis ping error:', error);
      return false;
    }
  }

  // 🆕 Add setex method (for verification code storage)
  public async setex(key: string, seconds: number, value: string): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      await this.redis.setex(key, seconds, value);
      return true;
    } catch (error) {
      console.error('Redis setex error:', error);
      return false;
    }
  }

  // 🆕 Add get method (string version, for verification code retrieval)
  public async getString(key: string): Promise<string | null> {
    if (!this.isConnected) {
      return null;
    }

    try {
      return await this.redis.get(key);
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  // 🆕 Add ttl method (get remaining expiration time)
  public async ttl(key: string): Promise<number> {
    if (!this.isConnected) {
      return -2; // -2 means key does not exist
    }

    try {
      return await this.redis.ttl(key);
    } catch (error) {
      console.error('Redis ttl error:', error);
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
