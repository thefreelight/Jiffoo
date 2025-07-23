import Redis, { RedisOptions } from 'ioredis';
import { Logger } from '../utils/Logger';
import { PluginError } from '../types/PluginTypes';

/**
 * 缓存管理器
 * 负责Redis缓存的连接、操作和管理
 */
export class CacheManager {
  private redis: Redis;
  private logger: Logger;
  private config: RedisOptions;
  private connected: boolean = false;
  private keyPrefix: string;
  private defaultTtl: number;

  constructor(config: {
    host: string;
    port: number;
    password?: string;
    username?: string;
    database?: number;
    keyPrefix?: string;
    ttl?: number;
  }) {
    this.logger = new Logger('CacheManager');
    this.keyPrefix = config.keyPrefix || 'plugin:';
    this.defaultTtl = config.ttl || 3600; // 默认1小时

    this.config = {
      host: config.host,
      port: config.port,
      password: config.password,
      username: config.username,
      db: config.database || 0,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      keepAlive: 30000,
      connectTimeout: 10000,
      commandTimeout: 5000,
      family: 4
    };

    this.redis = new Redis(this.config);
    this.setupEventHandlers();
  }

  /**
   * 设置事件处理器
   */
  private setupEventHandlers(): void {
    this.redis.on('connect', () => {
      this.logger.info('Redis connected');
      this.connected = true;
    });

    this.redis.on('ready', () => {
      this.logger.info('Redis ready');
    });

    this.redis.on('error', (error) => {
      this.logger.error('Redis error', error);
      this.connected = false;
    });

    this.redis.on('close', () => {
      this.logger.warn('Redis connection closed');
      this.connected = false;
    });

    this.redis.on('reconnecting', (delay: number) => {
      this.logger.info(`Redis reconnecting in ${delay}ms`);
    });

    this.redis.on('end', () => {
      this.logger.info('Redis connection ended');
      this.connected = false;
    });
  }

  /**
   * 连接Redis
   */
  public async connect(): Promise<void> {
    try {
      await this.redis.connect();
      
      // 测试连接
      await this.redis.ping();
      
      this.connected = true;
      this.logger.info('Cache connected successfully');
    } catch (error) {
      this.connected = false;
      this.logger.error('Failed to connect to cache', error);
      throw new PluginError('Cache connection failed', 'CACHE_CONNECTION_ERROR', 500, error);
    }
  }

  /**
   * 断开Redis连接
   */
  public async disconnect(): Promise<void> {
    try {
      await this.redis.quit();
      this.connected = false;
      this.logger.info('Cache disconnected');
    } catch (error) {
      this.logger.error('Error disconnecting from cache', error);
      throw new PluginError('Cache disconnection failed', 'CACHE_DISCONNECTION_ERROR', 500, error);
    }
  }

  /**
   * 检查连接状态
   */
  public async isConnectedToCache(): Promise<boolean> {
    if (!this.connected) {
      return false;
    }

    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      this.logger.error('Cache connection check failed', error);
      this.connected = false;
      return false;
    }
  }

  /**
   * 生成完整的键名
   */
  private getFullKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  /**
   * 设置缓存
   */
  public async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      const fullKey = this.getFullKey(key);
      const serializedValue = JSON.stringify(value);
      const expiration = ttl || this.defaultTtl;

      await this.redis.setex(fullKey, expiration, serializedValue);
      this.logger.debug(`Cache set: ${fullKey} (TTL: ${expiration}s)`);
    } catch (error) {
      this.logger.error(`Failed to set cache: ${key}`, error);
      throw new PluginError('Cache set failed', 'CACHE_SET_ERROR', 500, error);
    }
  }

  /**
   * 获取缓存
   */
  public async get<T = any>(key: string): Promise<T | null> {
    try {
      const fullKey = this.getFullKey(key);
      const value = await this.redis.get(fullKey);
      
      if (value === null) {
        this.logger.debug(`Cache miss: ${fullKey}`);
        return null;
      }

      this.logger.debug(`Cache hit: ${fullKey}`);
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error(`Failed to get cache: ${key}`, error);
      throw new PluginError('Cache get failed', 'CACHE_GET_ERROR', 500, error);
    }
  }

  /**
   * 删除缓存
   */
  public async del(key: string): Promise<boolean> {
    try {
      const fullKey = this.getFullKey(key);
      const result = await this.redis.del(fullKey);
      
      this.logger.debug(`Cache deleted: ${fullKey}`);
      return result > 0;
    } catch (error) {
      this.logger.error(`Failed to delete cache: ${key}`, error);
      throw new PluginError('Cache delete failed', 'CACHE_DELETE_ERROR', 500, error);
    }
  }

  /**
   * 检查键是否存在
   */
  public async exists(key: string): Promise<boolean> {
    try {
      const fullKey = this.getFullKey(key);
      const result = await this.redis.exists(fullKey);
      return result === 1;
    } catch (error) {
      this.logger.error(`Failed to check cache existence: ${key}`, error);
      throw new PluginError('Cache exists check failed', 'CACHE_EXISTS_ERROR', 500, error);
    }
  }

  /**
   * 设置过期时间
   */
  public async expire(key: string, ttl: number): Promise<boolean> {
    try {
      const fullKey = this.getFullKey(key);
      const result = await this.redis.expire(fullKey, ttl);
      return result === 1;
    } catch (error) {
      this.logger.error(`Failed to set cache expiration: ${key}`, error);
      throw new PluginError('Cache expire failed', 'CACHE_EXPIRE_ERROR', 500, error);
    }
  }

  /**
   * 获取剩余过期时间
   */
  public async ttl(key: string): Promise<number> {
    try {
      const fullKey = this.getFullKey(key);
      return await this.redis.ttl(fullKey);
    } catch (error) {
      this.logger.error(`Failed to get cache TTL: ${key}`, error);
      throw new PluginError('Cache TTL failed', 'CACHE_TTL_ERROR', 500, error);
    }
  }

  /**
   * 批量获取
   */
  public async mget<T = any>(keys: string[]): Promise<(T | null)[]> {
    try {
      const fullKeys = keys.map(key => this.getFullKey(key));
      const values = await this.redis.mget(...fullKeys);
      
      return values.map(value => {
        if (value === null) return null;
        try {
          return JSON.parse(value) as T;
        } catch {
          return null;
        }
      });
    } catch (error) {
      this.logger.error('Failed to get multiple cache values', error);
      throw new PluginError('Cache mget failed', 'CACHE_MGET_ERROR', 500, error);
    }
  }

  /**
   * 批量设置
   */
  public async mset(keyValues: Record<string, any>, ttl?: number): Promise<void> {
    try {
      const pipeline = this.redis.pipeline();
      const expiration = ttl || this.defaultTtl;

      for (const [key, value] of Object.entries(keyValues)) {
        const fullKey = this.getFullKey(key);
        const serializedValue = JSON.stringify(value);
        pipeline.setex(fullKey, expiration, serializedValue);
      }

      await pipeline.exec();
      this.logger.debug(`Cache mset: ${Object.keys(keyValues).length} keys`);
    } catch (error) {
      this.logger.error('Failed to set multiple cache values', error);
      throw new PluginError('Cache mset failed', 'CACHE_MSET_ERROR', 500, error);
    }
  }

  /**
   * 原子递增
   */
  public async incr(key: string, delta: number = 1): Promise<number> {
    try {
      const fullKey = this.getFullKey(key);
      const result = await this.redis.incrby(fullKey, delta);
      this.logger.debug(`Cache incremented: ${fullKey} by ${delta} = ${result}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to increment cache: ${key}`, error);
      throw new PluginError('Cache increment failed', 'CACHE_INCR_ERROR', 500, error);
    }
  }

  /**
   * 原子递减
   */
  public async decr(key: string, delta: number = 1): Promise<number> {
    try {
      const fullKey = this.getFullKey(key);
      const result = await this.redis.decrby(fullKey, delta);
      this.logger.debug(`Cache decremented: ${fullKey} by ${delta} = ${result}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to decrement cache: ${key}`, error);
      throw new PluginError('Cache decrement failed', 'CACHE_DECR_ERROR', 500, error);
    }
  }

  /**
   * 列表操作 - 左推入
   */
  public async lpush(key: string, ...values: any[]): Promise<number> {
    try {
      const fullKey = this.getFullKey(key);
      const serializedValues = values.map(v => JSON.stringify(v));
      const result = await this.redis.lpush(fullKey, ...serializedValues);
      return result;
    } catch (error) {
      this.logger.error(`Failed to lpush to cache: ${key}`, error);
      throw new PluginError('Cache lpush failed', 'CACHE_LPUSH_ERROR', 500, error);
    }
  }

  /**
   * 列表操作 - 右弹出
   */
  public async rpop<T = any>(key: string): Promise<T | null> {
    try {
      const fullKey = this.getFullKey(key);
      const value = await this.redis.rpop(fullKey);
      
      if (value === null) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error(`Failed to rpop from cache: ${key}`, error);
      throw new PluginError('Cache rpop failed', 'CACHE_RPOP_ERROR', 500, error);
    }
  }

  /**
   * 获取列表长度
   */
  public async llen(key: string): Promise<number> {
    try {
      const fullKey = this.getFullKey(key);
      return await this.redis.llen(fullKey);
    } catch (error) {
      this.logger.error(`Failed to get list length: ${key}`, error);
      throw new PluginError('Cache llen failed', 'CACHE_LLEN_ERROR', 500, error);
    }
  }

  /**
   * 集合操作 - 添加成员
   */
  public async sadd(key: string, ...members: any[]): Promise<number> {
    try {
      const fullKey = this.getFullKey(key);
      const serializedMembers = members.map(m => JSON.stringify(m));
      return await this.redis.sadd(fullKey, ...serializedMembers);
    } catch (error) {
      this.logger.error(`Failed to sadd to cache: ${key}`, error);
      throw new PluginError('Cache sadd failed', 'CACHE_SADD_ERROR', 500, error);
    }
  }

  /**
   * 集合操作 - 获取所有成员
   */
  public async smembers<T = any>(key: string): Promise<T[]> {
    try {
      const fullKey = this.getFullKey(key);
      const members = await this.redis.smembers(fullKey);
      return members.map(m => JSON.parse(m) as T);
    } catch (error) {
      this.logger.error(`Failed to get set members: ${key}`, error);
      throw new PluginError('Cache smembers failed', 'CACHE_SMEMBERS_ERROR', 500, error);
    }
  }

  /**
   * 模式匹配删除
   */
  public async delPattern(pattern: string): Promise<number> {
    try {
      const fullPattern = this.getFullKey(pattern);
      const keys = await this.redis.keys(fullPattern);
      
      if (keys.length === 0) return 0;
      
      const result = await this.redis.del(...keys);
      this.logger.debug(`Cache pattern deleted: ${fullPattern} (${result} keys)`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to delete cache pattern: ${pattern}`, error);
      throw new PluginError('Cache pattern delete failed', 'CACHE_DEL_PATTERN_ERROR', 500, error);
    }
  }

  /**
   * 清空所有缓存
   */
  public async flush(): Promise<void> {
    try {
      await this.redis.flushdb();
      this.logger.info('Cache flushed');
    } catch (error) {
      this.logger.error('Failed to flush cache', error);
      throw new PluginError('Cache flush failed', 'CACHE_FLUSH_ERROR', 500, error);
    }
  }

  /**
   * 健康检查
   */
  public async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    details: {
      connected: boolean;
      latency: number;
      memory: any;
    };
  }> {
    try {
      const start = Date.now();
      await this.redis.ping();
      const latency = Date.now() - start;
      
      const memory = await this.redis.memory('STATS');
      
      return {
        status: 'healthy',
        details: {
          connected: true,
          latency,
          memory
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          connected: false,
          latency: -1,
          memory: null
        }
      };
    }
  }

  /**
   * 获取缓存统计信息
   */
  public async getStats(): Promise<{
    keyCount: number;
    memoryUsage: string;
    hitRate: number;
  }> {
    try {
      const info = await this.redis.info('stats');
      const keyCount = await this.redis.dbsize();
      
      // 解析info信息
      const lines = info.split('\r\n');
      const stats: any = {};
      
      lines.forEach(line => {
        if (line.includes(':')) {
          const [key, value] = line.split(':');
          stats[key] = value;
        }
      });

      const hits = parseInt(stats.keyspace_hits || '0');
      const misses = parseInt(stats.keyspace_misses || '0');
      const hitRate = hits + misses > 0 ? hits / (hits + misses) : 0;

      return {
        keyCount,
        memoryUsage: stats.used_memory_human || 'unknown',
        hitRate: Math.round(hitRate * 100) / 100
      };
    } catch (error) {
      this.logger.error('Failed to get cache stats', error);
      return {
        keyCount: 0,
        memoryUsage: 'unknown',
        hitRate: 0
      };
    }
  }

  /**
   * 检查是否连接
   */
  public isConnected(): boolean {
    return this.connected;
  }
}
