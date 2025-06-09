import { redisCache } from './redis';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
}

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
    const key = `${this.PREFIXES.PRODUCT}list:${page}:${limit}:${Buffer.from(filterKey).toString('base64')}`;
    return await redisCache.get(key);
  }

  static async setProductList(page: number, limit: number, data: any, filters?: any, ttl: number = 600): Promise<boolean> {
    const filterKey = filters ? JSON.stringify(filters) : 'all';
    const key = `${this.PREFIXES.PRODUCT}list:${page}:${limit}:${Buffer.from(filterKey).toString('base64')}`;
    return await redisCache.set(key, data, ttl);
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

  // 会话缓存
  static async getSession(sessionId: string): Promise<any | null> {
    const key = `${this.PREFIXES.SESSION}${sessionId}`;
    return await redisCache.get(key);
  }

  static async setSession(sessionId: string, sessionData: any, ttl: number = 86400): Promise<boolean> {
    const key = `${this.PREFIXES.SESSION}${sessionId}`;
    return await redisCache.set(key, sessionData, ttl);
  }

  static async deleteSession(sessionId: string): Promise<boolean> {
    const key = `${this.PREFIXES.SESSION}${sessionId}`;
    return await redisCache.del(key);
  }

  // 统计数据缓存
  static async getStats(statsType: string): Promise<any | null> {
    const key = `${this.PREFIXES.STATS}${statsType}`;
    return await redisCache.get(key);
  }

  static async setStats(statsType: string, stats: any, ttl: number = 1800): Promise<boolean> {
    const key = `${this.PREFIXES.STATS}${statsType}`;
    return await redisCache.set(key, stats, ttl);
  }

  // 限流缓存
  static async getRateLimit(identifier: string): Promise<number | null> {
    const key = `${this.PREFIXES.RATE_LIMIT}${identifier}`;
    return await redisCache.get(key);
  }

  static async incrementRateLimit(identifier: string, ttl: number = 3600): Promise<number | null> {
    const key = `${this.PREFIXES.RATE_LIMIT}${identifier}`;
    const current = await redisCache.incr(key);
    if (current === 1) {
      await redisCache.expire(key, ttl);
    }
    return current;
  }

  // 通用缓存方法
  static async get<T>(key: string, prefix?: string): Promise<T | null> {
    const fullKey = prefix ? `${prefix}${key}` : key;
    return await redisCache.get<T>(fullKey);
  }

  static async set(key: string, value: any, options: CacheOptions = {}): Promise<boolean> {
    const { ttl = this.DEFAULT_TTL, prefix } = options;
    const fullKey = prefix ? `${prefix}${key}` : key;
    return await redisCache.set(fullKey, value, ttl);
  }

  static async delete(key: string, prefix?: string): Promise<boolean> {
    const fullKey = prefix ? `${prefix}${key}` : key;
    return await redisCache.del(fullKey);
  }

  // 批量删除
  static async deletePattern(pattern: string): Promise<number> {
    const keys = await redisCache.keys(pattern);
    if (keys.length === 0) {
      return 0;
    }

    let deletedCount = 0;
    for (const key of keys) {
      const deleted = await redisCache.del(key);
      if (deleted) deletedCount++;
    }
    return deletedCount;
  }

  // 清除所有商品相关缓存
  static async clearProductCache(): Promise<number> {
    return await this.deletePattern(`${this.PREFIXES.PRODUCT}*`);
  }

  // 清除所有搜索缓存
  static async clearSearchCache(): Promise<number> {
    return await this.deletePattern(`${this.PREFIXES.SEARCH}*`);
  }

  // 获取缓存统计信息
  static async getCacheStats(): Promise<{
    connected: boolean;
    productKeys: number;
    searchKeys: number;
    userKeys: number;
    totalKeys: number;
  }> {
    const connected = redisCache.getConnectionStatus();
    
    if (!connected) {
      return {
        connected: false,
        productKeys: 0,
        searchKeys: 0,
        userKeys: 0,
        totalKeys: 0
      };
    }

    const [productKeys, searchKeys, userKeys, allKeys] = await Promise.all([
      redisCache.keys(`${this.PREFIXES.PRODUCT}*`),
      redisCache.keys(`${this.PREFIXES.SEARCH}*`),
      redisCache.keys(`${this.PREFIXES.USER}*`),
      redisCache.keys('*')
    ]);

    return {
      connected: true,
      productKeys: productKeys.length,
      searchKeys: searchKeys.length,
      userKeys: userKeys.length,
      totalKeys: allKeys.length
    };
  }

  // 健康检查
  static async healthCheck(): Promise<boolean> {
    return await redisCache.ping();
  }
}
