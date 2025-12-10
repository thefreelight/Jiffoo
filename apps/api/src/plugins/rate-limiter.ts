/**
 * Fastify Rate Limiter Plugin
 */

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { RateLimiter, RateLimitConfig, RateLimitPresets, MemoryRateLimitStore, RateLimitStore } from '@shared/security';

export interface RateLimiterPluginOptions {
  /** 全局配置 */
  global?: Partial<RateLimitConfig>;
  /** 路由特定配置 */
  routes?: Record<string, Partial<RateLimitConfig>>;
  /** 存储实例 */
  store?: RateLimitStore;
  /** 是否启用 */
  enabled?: boolean;
  /** 跳过的路径 */
  skipPaths?: string[];
  /** 键生成器 */
  keyGenerator?: (request: FastifyRequest) => string;
}

declare module 'fastify' {
  interface FastifyInstance {
    rateLimiter: {
      check: (key: string, config?: Partial<RateLimitConfig>) => Promise<import('@shared/security').RateLimitResult>;
      reset: (key: string) => Promise<void>;
    };
  }

  interface FastifyRequest {
    rateLimit?: import('@shared/security').RateLimitResult;
  }
}

const defaultKeyGenerator = (request: FastifyRequest): string => {
  // 优先使用用户 ID，然后是 IP
  const userId = (request as unknown as { user?: { id: string } }).user?.id;
  if (userId) return `user:${userId}`;
  
  const ip = request.ip || request.headers['x-forwarded-for'] || 'unknown';
  return `ip:${Array.isArray(ip) ? ip[0] : ip}`;
};

const rateLimiterPlugin: FastifyPluginAsync<RateLimiterPluginOptions> = async (fastify, options) => {
  const {
    global = RateLimitPresets.default,
    routes = {},
    store = new MemoryRateLimitStore(),
    enabled = true,
    skipPaths = ['/health', '/metrics', '/api/health'],
    keyGenerator = defaultKeyGenerator,
  } = options;

  // 创建限流器实例缓存
  const limiters = new Map<string, RateLimiter>();

  const getLimiter = (config: RateLimitConfig): RateLimiter => {
    const key = `${config.windowMs}:${config.maxRequests}:${config.keyPrefix ?? ''}`;
    let limiter = limiters.get(key);
    if (!limiter) {
      limiter = new RateLimiter(config, store);
      limiters.set(key, limiter);
    }
    return limiter;
  };

  // 装饰 fastify 实例
  fastify.decorate('rateLimiter', {
    check: async (key: string, config?: Partial<RateLimitConfig>) => {
      const finalConfig = { ...global, ...config } as RateLimitConfig;
      const limiter = getLimiter(finalConfig);
      return limiter.check(key);
    },
    reset: async (key: string) => {
      const limiter = getLimiter(global as RateLimitConfig);
      return limiter.reset(key);
    },
  });

  if (!enabled) return;

  // 添加全局钩子
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // 跳过指定路径
    if (skipPaths.some((p) => request.url.startsWith(p))) return;

    // 获取路由特定配置
    const routeConfig = routes[request.routeOptions?.url ?? ''] ?? {};
    const config = { ...global, ...routeConfig } as RateLimitConfig;
    const limiter = getLimiter(config);

    // 生成限流键
    const identifier = keyGenerator(request);
    const result = await limiter.check(identifier);

    // 存储结果到请求对象
    request.rateLimit = result;

    // 设置响应头
    reply.header('X-RateLimit-Limit', result.limit);
    reply.header('X-RateLimit-Remaining', result.remaining);
    reply.header('X-RateLimit-Reset', result.resetTime);

    // 如果被限流
    if (result.limited) {
      reply.header('Retry-After', result.retryAfter);
      reply.code(429).send({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: result.retryAfter,
      });
    }
  });
};

export default fp(rateLimiterPlugin, {
  name: 'rate-limiter',
  fastify: '5.x',
});

// 登录限流配置
export const LoginRateLimitConfig: RateLimitConfig = {
  ...RateLimitPresets.login,
  keyGenerator: (id) => `rl:login:${id}`,
};

// 注册限流配置
export const RegisterRateLimitConfig: RateLimitConfig = {
  ...RateLimitPresets.register,
  keyGenerator: (id) => `rl:register:${id}`,
};

