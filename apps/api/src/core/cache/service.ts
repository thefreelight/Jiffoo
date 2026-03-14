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
    const version = await this.getProductVersion();
    const filterKey = filters ? JSON.stringify(filters) : 'all';
    const listKey = `${this.PREFIXES.PRODUCT}list:v${version}:${page}:${limit}:${Buffer.from(filterKey).toString('base64')}`;
    return await redisCache.get(listKey);
  }

  static async setProductList(page: number, limit: number, data: any, filters?: any, ttl: number = 600): Promise<boolean> {
    const version = await this.getProductVersion();
    const filterKey = filters ? JSON.stringify(filters) : 'all';
    const listKey = `${this.PREFIXES.PRODUCT}list:v${version}:${page}:${limit}:${Buffer.from(filterKey).toString('base64')}`;
    return await redisCache.set(listKey, data, ttl);
  }

  // Order list cache
  static async getOrderList(page: number, limit: number, filters?: any): Promise<any | null> {
    const version = await this.getOrderVersion();
    const filterKey = filters ? JSON.stringify(filters) : 'all';
    const listKey = `${this.PREFIXES.ORDER}list:v${version}:${page}:${limit}:${Buffer.from(filterKey).toString('base64')}`;
    return await redisCache.get(listKey);
  }

  static async setOrderList(page: number, limit: number, data: any, filters?: any, ttl: number = 600): Promise<boolean> {
    const version = await this.getOrderVersion();
    const filterKey = filters ? JSON.stringify(filters) : 'all';
    const listKey = `${this.PREFIXES.ORDER}list:v${version}:${page}:${limit}:${Buffer.from(filterKey).toString('base64')}`;
    return await redisCache.set(listKey, data, ttl);
  }

  // Search results cache
  static async getSearchResults(query: string, filters: any, page: number, limit: number): Promise<any | null> {
    const version = await this.getProductVersion();
    const searchKey = JSON.stringify({ query, filters, page, limit });
    const key = `${this.PREFIXES.SEARCH}v${version}:${Buffer.from(searchKey).toString('base64')}`;
    return await redisCache.get(key);
  }

  static async setSearchResults(query: string, filters: any, page: number, limit: number, results: any, ttl: number = 300): Promise<boolean> {
    const version = await this.getProductVersion();
    const searchKey = JSON.stringify({ query, filters, page, limit });
    const key = `${this.PREFIXES.SEARCH}v${version}:${Buffer.from(searchKey).toString('base64')}`;
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
  static async clearAll(): Promise<boolean> {
    return await redisCache.flushAll();
  }

  // Clear cache by prefix
  static async clearByPrefix(prefix: string): Promise<number> {
    return await redisCache.deleteByPattern(`${prefix}*`);
  }

  // Get cache stats
  static async getCacheStats(): Promise<{
    connected: boolean;
    productCacheCount: number;
    searchCacheCount: number;
    userCacheCount: number;
  }> {
    const connected = redisCache.getConnectionStatus();
    if (!connected) {
      return {
        connected,
        productCacheCount: 0,
        searchCacheCount: 0,
        userCacheCount: 0
      };
    }

    const [
      productCoreCount,
      productPublicListCount,
      productPublicDetailCount,
      productPublicCategoryCount,
      searchCoreCount,
      searchPublicCount,
      userCount
    ] = await Promise.all([
      redisCache.countByPattern(`${this.PREFIXES.PRODUCT}*`),
      redisCache.countByPattern('pub:products:list:*'),
      redisCache.countByPattern('pub:products:detail:*'),
      redisCache.countByPattern('pub:products:categories:*'),
      redisCache.countByPattern(`${this.PREFIXES.SEARCH}*`),
      redisCache.countByPattern('pub:products:search:*'),
      redisCache.countByPattern(`${this.PREFIXES.USER}*`)
    ]);

    return {
      connected,
      productCacheCount: productCoreCount + productPublicListCount + productPublicDetailCount + productPublicCategoryCount,
      searchCacheCount: searchCoreCount + searchPublicCount,
      userCacheCount: userCount
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
  static async clearProductCache(): Promise<number> {
    return await this.clearByPrefix(this.PREFIXES.PRODUCT);
  }

  // Clear search cache
  static async clearSearchCache(): Promise<number> {
    return await this.clearByPrefix(this.PREFIXES.SEARCH);
  }

  // Product Versioning for Cache Invalidation
  static async getProductVersion(): Promise<number> {
    const key = `${this.PREFIXES.PRODUCT}version`;
    const version = await redisCache.get<number | string>(key);
    return version ? Number(version) : 0;
  }

  static async incrementProductVersion(): Promise<number> {
    const key = `${this.PREFIXES.PRODUCT}version`;
    return await redisCache.incr(key);
  }

  // Order Versioning for Cache Invalidation
  static async getOrderVersion(): Promise<number> {
    const key = `${this.PREFIXES.ORDER}version`;
    const version = await redisCache.get<number | string>(key);
    return version ? Number(version) : 0;
  }

  static async incrementOrderVersion(): Promise<number> {
    const key = `${this.PREFIXES.ORDER}version`;
    return await redisCache.incr(key);
  }

  // User list cache (similar to order list)
  static async getUserList(page: number, limit: number, filters?: any): Promise<any | null> {
    const version = await this.getUserVersion();
    const filterKey = filters ? JSON.stringify(filters) : 'all';
    const listKey = `${this.PREFIXES.USER}list:v${version}:${page}:${limit}:${Buffer.from(filterKey).toString('base64')}`;
    return await redisCache.get(listKey);
  }

  static async setUserList(page: number, limit: number, data: any, filters?: any, ttl: number = 30): Promise<boolean> {
    const version = await this.getUserVersion();
    const filterKey = filters ? JSON.stringify(filters) : 'all';
    const listKey = `${this.PREFIXES.USER}list:v${version}:${page}:${limit}:${Buffer.from(filterKey).toString('base64')}`;
    return await redisCache.set(listKey, data, ttl);
  }

  // User Versioning for Cache Invalidation
  static async getUserVersion(): Promise<number> {
    const key = `${this.PREFIXES.USER}version`;
    const version = await redisCache.get<number | string>(key);
    return version ? Number(version) : 0;
  }

  static async incrementUserVersion(): Promise<number> {
    const key = `${this.PREFIXES.USER}version`;
    return await redisCache.incr(key);
  }

  // Plugin Versioning for Cache Invalidation (payment methods, etc.)
  static async getPluginVersion(): Promise<number> {
    const key = 'plugin:version';
    const version = await redisCache.get<number | string>(key);
    return version ? Number(version) : 0;
  }

  static async incrementPluginVersion(): Promise<number> {
    const key = 'plugin:version';
    return await redisCache.incr(key);
  }

  // Store Context Versioning for Cache Invalidation
  static async getStoreContextVersion(): Promise<number> {
    const key = 'store:context:version';
    const version = await redisCache.get<number | string>(key);
    return version ? Number(version) : 0;
  }

  static async incrementStoreContextVersion(): Promise<number> {
    const key = 'store:context:version';
    return await redisCache.incr(key);
  }

  /**
   * Get the underlying Redis client for advanced operations
   * Use with caution - primarily for health monitoring and diagnostics
   */
  static getRedisClient() {
    return redisCache.getClient();
  }
}
