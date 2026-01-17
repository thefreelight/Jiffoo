import { redisCache } from './redis';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
}

/**
 * Cache Service
 * 
 * Simplified version, removed tenant isolation logic.
 */
export class CacheService {
  private static readonly DEFAULT_TTL = 3600; // 1 hour
  private static readonly PREFIXES = {
    PRODUCT: 'product:',
    USER: 'user:',
    ORDER: 'order:',
    SEARCH: 'search:',
    STATS: 'stats:',
    SESSION: 'session:',
    RATE_LIMIT: 'rate_limit:',
  };

  // General cache methods
  static async get<T>(key: string): Promise<T | null> {
    return await redisCache.get(key);
  }

  static async set(key: string, value: any, options?: CacheOptions): Promise<boolean> {
    const ttl = options?.ttl || this.DEFAULT_TTL;
    return await redisCache.set(key, value, ttl);
  }

  static async delete(key: string): Promise<boolean> {
    return await redisCache.del(key);
  }

  // Product cache
  static async getProduct(productId: string): Promise<any | null> {
    const key = `${this.PREFIXES.PRODUCT}${productId}`;
    return await redisCache.get(key);
  }

  static async setProduct(productId: string, product: any, ttl: number = this.DEFAULT_TTL): Promise<boolean> {
    const key = `${this.PREFIXES.PRODUCT}${productId}`;
    return await redisCache.set(key, product, ttl);
  }

  static async deleteProduct(productId: string): Promise<boolean> {
    const key = `${this.PREFIXES.PRODUCT}${productId}`;
    return await redisCache.del(key);
  }

  // Product list cache
  static async getProductList(page: number, limit: number, filters?: any): Promise<any | null> {
    const filterKey = filters ? JSON.stringify(filters) : 'all';
    const listKey = `${this.PREFIXES.PRODUCT}list:${page}:${limit}:${Buffer.from(filterKey).toString('base64')}`;
    return await redisCache.get(listKey);
  }

  static async setProductList(page: number, limit: number, data: any, filters?: any, ttl: number = 600): Promise<boolean> {
    const filterKey = filters ? JSON.stringify(filters) : 'all';
    const listKey = `${this.PREFIXES.PRODUCT}list:${page}:${limit}:${Buffer.from(filterKey).toString('base64')}`;
    return await redisCache.set(listKey, data, ttl);
  }

  // Search results cache
  static async getSearchResults(query: string, filters: any, page: number, limit: number): Promise<any | null> {
    const searchKey = JSON.stringify({ query, filters, page, limit });
    const key = `${this.PREFIXES.SEARCH}${Buffer.from(searchKey).toString('base64')}`;
    return await redisCache.get(key);
  }

  static async setSearchResults(query: string, filters: any, page: number, limit: number, results: any, ttl: number = 300): Promise<boolean> {
    const searchKey = JSON.stringify({ query, filters, page, limit });
    const key = `${this.PREFIXES.SEARCH}${Buffer.from(searchKey).toString('base64')}`;
    return await redisCache.set(key, results, ttl);
  }

  // User cache
  static async getUser(userId: string): Promise<any | null> {
    const key = `${this.PREFIXES.USER}${userId}`;
    return await redisCache.get(key);
  }

  static async setUser(userId: string, user: any, ttl: number = this.DEFAULT_TTL): Promise<boolean> {
    const key = `${this.PREFIXES.USER}${userId}`;
    return await redisCache.set(key, user, ttl);
  }

  static async deleteUser(userId: string): Promise<boolean> {
    const key = `${this.PREFIXES.USER}${userId}`;
    return await redisCache.del(key);
  }

  // Order cache
  static async getOrder(orderId: string): Promise<any | null> {
    const key = `${this.PREFIXES.ORDER}${orderId}`;
    return await redisCache.get(key);
  }

  static async setOrder(orderId: string, order: any, ttl: number = this.DEFAULT_TTL): Promise<boolean> {
    const key = `${this.PREFIXES.ORDER}${orderId}`;
    return await redisCache.set(key, order, ttl);
  }

  static async deleteOrder(orderId: string): Promise<boolean> {
    const key = `${this.PREFIXES.ORDER}${orderId}`;
    return await redisCache.del(key);
  }

  // Rate limiting
  static async getRateLimit(identifier: string): Promise<number | null> {
    const key = `${this.PREFIXES.RATE_LIMIT}${identifier}`;
    return await redisCache.get(key);
  }

  static async setRateLimit(identifier: string, count: number, ttl: number = 60): Promise<boolean> {
    const key = `${this.PREFIXES.RATE_LIMIT}${identifier}`;
    return await redisCache.set(key, count, ttl);
  }

  static async incrementRateLimit(identifier: string, ttl: number = 60): Promise<number> {
    const key = `${this.PREFIXES.RATE_LIMIT}${identifier}`;
    const result = await redisCache.incr(key);
    if (result === 1) {
      await redisCache.expire(key, ttl);
    }
    return result || 0;
  }

  // Clear all cache
  static async clearAll(): Promise<void> {
    await redisCache.flushAll();
  }

  // Clear cache by prefix
  static async clearByPrefix(prefix: string): Promise<void> {
    await redisCache.deleteByPattern(`${prefix}*`);
  }

  // Get cache stats
  static async getCacheStats(): Promise<{
    connected: boolean;
    productCacheCount: number;
    searchCacheCount: number;
    userCacheCount: number;
  }> {
    const connected = redisCache.getConnectionStatus();
    return {
      connected,
      productCacheCount: 0,
      searchCacheCount: 0,
      userCacheCount: 0
    };
  }

  // Health check
  static async healthCheck(): Promise<{ status: string; connected: boolean }> {
    const connected = await redisCache.ping();
    return {
      status: connected ? 'healthy' : 'unhealthy',
      connected
    };
  }

  // Clear product cache
  static async clearProductCache(): Promise<void> {
    await this.clearByPrefix(this.PREFIXES.PRODUCT);
  }

  // Clear search cache
  static async clearSearchCache(): Promise<void> {
    await this.clearByPrefix(this.PREFIXES.SEARCH);
  }
}
