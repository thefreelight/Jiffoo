/**
 * 租户感知的速率限制中间件
 * 为敏感的公共端点提供租户级别的速率限制
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { CacheService } from '@/core/cache/service';

export interface RateLimitOptions {
  windowMs: number; // 时间窗口（毫秒）
  maxRequests: number; // 最大请求数
  keyGenerator?: (request: FastifyRequest) => string; // 自定义键生成器
  skipSuccessfulRequests?: boolean; // 是否跳过成功请求
  skipFailedRequests?: boolean; // 是否跳过失败请求
}

/**
 * 创建租户感知的速率限制中间件
 */
export function createTenantRateLimit(options: RateLimitOptions) {
  const {
    windowMs,
    maxRequests,
    keyGenerator,
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;

  return async function tenantRateLimit(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      // 生成速率限制键
      const key = keyGenerator 
        ? keyGenerator(request)
        : generateDefaultKey(request);

      // 获取当前计数
      const currentCount = await getCurrentCount(key, windowMs);

      // 检查是否超过限制
      if (currentCount >= maxRequests) {
        return reply.status(429).send({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil(windowMs / 1000),
          limit: maxRequests,
          windowMs
        });
      }

      // 增加计数（在响应后处理）
      const originalSend = reply.send;
      reply.send = function(payload: any) {
        const statusCode = reply.statusCode;
        
        // 根据配置决定是否计数
        const shouldCount = 
          (!skipSuccessfulRequests || statusCode >= 400) &&
          (!skipFailedRequests || statusCode < 400);

        if (shouldCount) {
          incrementCount(key, windowMs).catch(error => {
            request.log.error({ err: error }, 'Failed to increment rate limit count');
          });
        }

        return originalSend.call(this, payload);
      };

    } catch (error) {
      request.log.error({ err: error }, 'Rate limit middleware error');
      // 在错误情况下不阻止请求
    }
  };
}

/**
 * 生成默认的速率限制键
 */
function generateDefaultKey(request: FastifyRequest): string {
  const tenantId = request.user?.tenantId || request.tenantId || 'global';
  const ip = request.ip;
  const endpoint = request.routeOptions?.url || request.url;
  
  return `rate_limit:${tenantId}:${ip}:${endpoint}`;
}

/**
 * 获取当前计数
 */
async function getCurrentCount(key: string, _windowMs: number): Promise<number> { // eslint-disable-line @typescript-eslint/no-unused-vars
  try {
    const count = await CacheService.get<string>(key);
    return count ? parseInt(count, 10) : 0;
  } catch {
    // 在缓存错误时返回0，不阻止请求
    return 0;
  }
}

/**
 * 增加计数
 */
async function incrementCount(key: string, windowMs: number): Promise<void> {
  try {
    const ttl = Math.ceil(windowMs / 1000);
    const current = await CacheService.get<string>(key);

    if (current) {
      await CacheService.set(key, (parseInt(current, 10) + 1).toString(), { ttl });
    } else {
      await CacheService.set(key, '1', { ttl });
    }
  } catch {
    // 静默失败，不影响请求处理
  }
}

/**
 * 预定义的速率限制配置
 */
export const RateLimitPresets = {
  // 搜索端点：每分钟60次请求
  SEARCH: {
    windowMs: 60 * 1000, // 1分钟
    maxRequests: 60,
    skipSuccessfulRequests: false,
    skipFailedRequests: true
  },

  // 建议端点：每分钟30次请求
  SUGGESTIONS: {
    windowMs: 60 * 1000, // 1分钟
    maxRequests: 30,
    skipSuccessfulRequests: false,
    skipFailedRequests: true
  },

  // 价格统计：每分钟20次请求
  PRICE_STATS: {
    windowMs: 60 * 1000, // 1分钟
    maxRequests: 20,
    skipSuccessfulRequests: false,
    skipFailedRequests: true
  },

  // 产品列表：每分钟100次请求
  PRODUCT_LIST: {
    windowMs: 60 * 1000, // 1分钟
    maxRequests: 100,
    skipSuccessfulRequests: false,
    skipFailedRequests: true
  },

  // 严格限制：每分钟10次请求
  STRICT: {
    windowMs: 60 * 1000, // 1分钟
    maxRequests: 10,
    skipSuccessfulRequests: false,
    skipFailedRequests: true
  }
};

/**
 * 租户特定的键生成器
 */
export const TenantKeyGenerators = {
  // 基于租户和IP
  TENANT_IP: (request: FastifyRequest) => {
    const tenantId = request.user?.tenantId || request.tenantId || 'global';
    const ip = request.ip;
    return `rate_limit:tenant_ip:${tenantId}:${ip}`;
  },

  // 基于租户和用户
  TENANT_USER: (request: FastifyRequest) => {
    const tenantId = request.user?.tenantId || request.tenantId || 'global';
    const userId = request.user?.userId || 'anonymous';
    return `rate_limit:tenant_user:${tenantId}:${userId}`;
  },

  // 基于租户和端点
  TENANT_ENDPOINT: (request: FastifyRequest) => {
    const tenantId = request.user?.tenantId || request.tenantId || 'global';
    const endpoint = request.routeOptions?.url || request.url;
    return `rate_limit:tenant_endpoint:${tenantId}:${endpoint}`;
  },

  // 全局租户限制
  TENANT_GLOBAL: (request: FastifyRequest) => {
    const tenantId = request.user?.tenantId || request.tenantId || 'global';
    return `rate_limit:tenant_global:${tenantId}`;
  }
};

/**
 * 便捷的中间件创建函数
 */
export const createSearchRateLimit = () => 
  createTenantRateLimit({
    ...RateLimitPresets.SEARCH,
    keyGenerator: TenantKeyGenerators.TENANT_IP
  });

export const createSuggestionsRateLimit = () => 
  createTenantRateLimit({
    ...RateLimitPresets.SUGGESTIONS,
    keyGenerator: TenantKeyGenerators.TENANT_IP
  });

export const createPriceStatsRateLimit = () => 
  createTenantRateLimit({
    ...RateLimitPresets.PRICE_STATS,
    keyGenerator: TenantKeyGenerators.TENANT_IP
  });

export const createProductListRateLimit = () =>
  createTenantRateLimit({
    ...RateLimitPresets.PRODUCT_LIST,
    keyGenerator: TenantKeyGenerators.TENANT_IP
  });

/**
 * 创建Webhook的速率限制中间件
 */
export const createWebhookRateLimit = () =>
  createTenantRateLimit({
    windowMs: 60 * 1000, // 1分钟
    maxRequests: 100, // 每分钟最多100次webhook请求
    keyGenerator: (request: FastifyRequest) => {
      const pluginId = (request.params as any)?.pluginId || 'unknown';
      const ip = request.ip;
      return `webhook_rate_limit:${pluginId}:${ip}`;
    }
  });
