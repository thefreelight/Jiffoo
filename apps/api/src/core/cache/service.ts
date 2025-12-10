import { redisCache } from './redis';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
}

/**
 * 缓存服务 (单商户版本)
 * 
 * 简化版本，移除了租户隔离逻辑。
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

  // 通用缓存方法
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

  // 商品缓存
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

  // 商品列表缓存
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

  // 搜索结果缓存
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

  // 用户缓存
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

  // 订单缓存
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

  // 速率限制
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

  // 清除所有缓存
  static async clearAll(): Promise<void> {
    await redisCache.flushAll();
  }

  // 清除特定前缀的缓存
  static async clearByPrefix(prefix: string): Promise<void> {
    await redisCache.deleteByPattern(`${prefix}*`);
  }

  // 获取缓存统计
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

  // 健康检查
  static async healthCheck(): Promise<{ status: string; connected: boolean }> {
    const connected = await redisCache.ping();
    return {
      status: connected ? 'healthy' : 'unhealthy',
      connected
    };
  }

  // 清除商品缓存
  static async clearProductCache(): Promise<void> {
    await this.clearByPrefix(this.PREFIXES.PRODUCT);
  }

  // 清除搜索缓存
  static async clearSearchCache(): Promise<void> {
    await this.clearByPrefix(this.PREFIXES.SEARCH);
  }
}
