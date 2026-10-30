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
    PRODUCT: 'product:v2:',
    USER: 'user:',
    ORDER: 'order:',
    SEARCH: 'search:',
    STATS: 'stats:',
    SESSION: 'session:',
    RATE_LIMIT: 'rate_limit:',
    PLUGIN: 'plugin:',
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
  static async getProductList(page: number, limit: number, filters?: any, version?: number): Promise<any | null> {
    const listVersion = version ?? await this.getProductVersion();
    const filterKey = filters ? JSON.stringify(filters) : 'all';
    const listKey = `${this.PREFIXES.PRODUCT}list:v${listVersion}:${page}:${limit}:${Buffer.from(filterKey).toString('base64')}`;
    return await redisCache.get(listKey);
  }

  static async setProductList(page: number, limit: number, data: any, filters?: any, ttl: number = 600, version?: number): Promise<boolean> {
    const listVersion = version ?? await this.getProductVersion();
    const filterKey = filters ? JSON.stringify(filters) : 'all';
    const listKey = `${this.PREFIXES.PRODUCT}list:v${listVersion}:${page}:${limit}:${Buffer.from(filterKey).toString('base64')}`;
    return await redisCache.set(listKey, data, ttl);
  }

  // Order list cache
  //
  // The version is captured once by the reader and handed to both the read and
  // the write. A write that commits while the reader queries bumps the version,
  // so the entry the reader stores lands under the old key, which no reader
  // asks for any more, instead of under the new key of the fresh data.
  static async getOrderList(page: number, limit: number, filters?: any, version?: number): Promise<any | null> {
    const listVersion = version ?? await this.getOrderVersion();
    const filterKey = filters ? JSON.stringify(filters) : 'all';
    const listKey = `${this.PREFIXES.ORDER}list:order-number-v1:v${listVersion}:${page}:${limit}:${Buffer.from(filterKey).toString('base64')}`;
    return await redisCache.get(listKey);
  }

  /**
   * Stores the cached order list.
   *
   * The time to live of a list is the upper bound of the staleness a reader
   * can see: the version of the list is bumped by every write, and a write
   * that lost its bump - because the cache was unreachable - leaves the list
   * alive until this bound. Two minutes is the window of that degradation.
   */
  static async setOrderList(page: number, limit: number, data: any, filters?: any, ttl: number = 120, version?: number): Promise<boolean> {
    const listVersion = version ?? await this.getOrderVersion();
    const filterKey = filters ? JSON.stringify(filters) : 'all';
    const listKey = `${this.PREFIXES.ORDER}list:order-number-v1:v${listVersion}:${page}:${limit}:${Buffer.from(filterKey).toString('base64')}`;
    return await redisCache.set(listKey, data, ttl);
  }

  // Search results cache
  static async getSearchResults(query: string, filters: any, page: number, limit: number, version?: number): Promise<any | null> {
    const listVersion = version ?? await this.getProductVersion();
    const searchKey = JSON.stringify({ query, filters, page, limit });
    const key = `${this.PREFIXES.SEARCH}v${listVersion}:${Buffer.from(searchKey).toString('base64')}`;
    return await redisCache.get(key);
  }

  static async setSearchResults(query: string, filters: any, page: number, limit: number, results: any, ttl: number = 300, version?: number): Promise<boolean> {
    const listVersion = version ?? await this.getProductVersion();
    const searchKey = JSON.stringify({ query, filters, page, limit });
    const key = `${this.PREFIXES.SEARCH}v${listVersion}:${Buffer.from(searchKey).toString('base64')}`;
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

  /**
   * Counts a request against a budget.
   *
   * A counter that cannot be read is not a counter of zero: the caller gets
   * a null and has to treat the budget as unknown, so a cache that is not
   * there can never be read as a budget that was never spent.
   *
   * @returns the new count, or null when the counter could not be read.
   */
  static async incrementRateLimit(identifier: string, ttl: number = 60): Promise<number | null> {
    const key = `${this.PREFIXES.RATE_LIMIT}${identifier}`;
    const result = await redisCache.incr(key);
    if (result === null) {
      console.warn(JSON.stringify({ event: 'rate_limit_counter_unavailable', scope: 'cache', key }));
      return null;
    }
    if (result === 1) {
      await redisCache.expire(key, ttl);
    }
    return result;
  }

  // Clear all cache
  static async clearAll(): Promise<boolean> {
    return await redisCache.flushAll();
  }

  /**
   * Clears the cache entries of a prefix.
   *
   * @returns the number of cleared entries, or null when the cache was
   * unreachable and the prefix was not cleared at all.
   */
  static async clearByPrefix(prefix: string): Promise<number | null> {
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

  /**
   * Bumps the version of the cached order lists.
   *
   * The version is the invalidation signal of the cached order lists: a
   * reader asks for the list of the current version, so a bump makes every
   * reader read the database again. The bump fails when the cache is not
   * available, and a silently lost bump keeps the stale lists alive for
   * their time to live, so the failure is reported to the caller as a null,
   * recorded with the context of the caller, and the stale lists are dropped
   * as soon as the cache is reachable again.
   *
   * @param context the write that asked for the bump, recorded with the
   * failure.
   * @returns the new version, or null when the bump did not happen.
   */
  static async incrementOrderVersion(context?: { scope?: string; reference?: string }): Promise<number | null> {
    const key = `${this.PREFIXES.ORDER}version`;
    const version = await redisCache.incr(key);
    if (version !== null) return version;
    // The bump did not happen, so the cached lists would survive their time
    // to live. They are dropped now, and the drop is completed as soon as
    // the cache is reachable again.
    const dropped = await redisCache.invalidateOrDefer(async () => (await this.clearByPrefix(this.PREFIXES.ORDER)) !== null);
    console.warn(JSON.stringify({
      event: 'order_cache_version_increment_failed', scope: 'cache', key,
      deferred: !dropped, context: context ?? null,
    }));
    return null;
  }

  // User list cache (similar to order list)
  static async getUserList(page: number, limit: number, filters?: any, version?: number): Promise<any | null> {
    const listVersion = version ?? await this.getUserVersion();
    const filterKey = filters ? JSON.stringify(filters) : 'all';
    const listKey = `${this.PREFIXES.USER}list:v${listVersion}:${page}:${limit}:${Buffer.from(filterKey).toString('base64')}`;
    return await redisCache.get(listKey);
  }

  static async setUserList(page: number, limit: number, data: any, filters?: any, ttl: number = 30, version?: number): Promise<boolean> {
    const listVersion = version ?? await this.getUserVersion();
    const filterKey = filters ? JSON.stringify(filters) : 'all';
    const listKey = `${this.PREFIXES.USER}list:v${listVersion}:${page}:${limit}:${Buffer.from(filterKey).toString('base64')}`;
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

  // Plugin registry cache
  //
  // The generation identifies the state of the registry an entry was read at.
  // The caller builds it from the plugin cache version and from the freshness
  // marker of the plugin tables, so an entry is read again as soon as the
  // registry changed, no matter whether the change came through the
  // application or straight through the database. The time to live is the
  // backstop for an entry whose generation never changed.
  static async getPluginRegistry<T>(generation: string, key: string): Promise<T | null> {
    return await redisCache.get(`${this.PREFIXES.PLUGIN}registry:${generation}:${key}`);
  }

  static async setPluginRegistry(generation: string, key: string, value: unknown, ttl: number = 30): Promise<boolean> {
    return await redisCache.set(`${this.PREFIXES.PLUGIN}registry:${generation}:${key}`, value, ttl);
  }

  /**
   * Get the underlying Redis client for advanced operations
   * Use with caution - primarily for health monitoring and diagnostics
   */
  static getRedisClient() {
    return redisCache.getClient();
  }
}
