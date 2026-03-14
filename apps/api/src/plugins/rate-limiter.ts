/**
 * Fastify Rate Limiter Plugin
 */

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import {
  RateLimiter,
  RateLimitConfig,
  RateLimitPresets,
  MemoryRateLimitStore,
  RedisRateLimitStore,
  RateLimitStore
} from '@shared/security';
import { redisCache } from '@/core/cache/redis';

export interface RateLimiterPluginOptions {
  /** Global configuration */
  global?: Partial<RateLimitConfig>;
  /** Route-specific configuration */
  routes?: Record<string, Partial<RateLimitConfig>>;
  /** Storage instance */
  store?: RateLimitStore;
  /** Whether enabled */
  enabled?: boolean;
  /** Skipped paths */
  skipPaths?: string[];
  /** Key generator */
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
  // Prefer User ID, then IP
  const userId = (request as unknown as { user?: { id: string } }).user?.id;
  if (userId) return `user:${userId}`;

  const ip = request.ip || request.headers['x-forwarded-for'] || 'unknown';
  return `ip:${Array.isArray(ip) ? ip[0] : ip}`;
};

const rateLimiterPlugin: FastifyPluginAsync<RateLimiterPluginOptions> = async (fastify, options) => {
  const {
    global = RateLimitPresets.default,
    routes = {},
    store: customStore,
    enabled = true,
    skipPaths = ['/health', '/metrics', '/api/health'],
    keyGenerator = defaultKeyGenerator,
  } = options;

  const defaultRouteLimits: Record<string, Partial<RateLimitConfig>> = {
    '/api/auth/login': RateLimitPresets.login,
    '/api/auth/register': RateLimitPresets.register,
    '/login': RateLimitPresets.login,
    '/register': RateLimitPresets.register,
  };
  const routeLimits = { ...defaultRouteLimits, ...routes };

  const store: RateLimitStore = customStore ?? (() => {
    if (redisCache.getConnectionStatus()) {
      return new RedisRateLimitStore({
        incr: (key: string) => redisCache.getRawClient().incr(key),
        pexpire: (key: string, ms: number) => redisCache.getRawClient().pexpire(key, ms),
        pttl: (key: string) => redisCache.getRawClient().pttl(key),
        del: (key: string) => redisCache.getRawClient().del(key),
        get: (key: string) => redisCache.getRawClient().get(key),
      });
    }
    fastify.log.warn('Rate limiter is using in-memory store (Redis unavailable)');
    return new MemoryRateLimitStore();
  })();

  // Create rate limiter instance cache
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

  // Decorate fastify instance
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

  // Add global hook
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip specified paths
    if (skipPaths.some((p) => request.url.startsWith(p))) return;

    const routeUrl = request.routeOptions?.url ?? '';
    const requestPath = request.url.split('?')[0];
    const routeConfig =
      routeLimits[routeUrl] ??
      routeLimits[requestPath] ??
      {};
    const config = { ...global, ...routeConfig } as RateLimitConfig;
    const limiter = getLimiter(config);

    // Generate rate limit key
    const identifier = keyGenerator(request);
    const result = await limiter.check(identifier);

    // Store results in request object
    request.rateLimit = result;

    // Set response headers
    reply.header('X-RateLimit-Limit', result.limit);
    reply.header('X-RateLimit-Remaining', result.remaining);
    reply.header('X-RateLimit-Reset', result.resetTime);

    // If rate limited
    if (result.limited) {
      reply.header('Retry-After', result.retryAfter);
      return reply.code(429).send({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Rate limit exceeded. Please try again later.',
          details: {
            retryAfter: result.retryAfter,
          },
        },
      });
    }
  });
};

export default fp(rateLimiterPlugin, {
  name: 'rate-limiter',
  fastify: '5.x',
});

// Login rate limit configuration
export const LoginRateLimitConfig: RateLimitConfig = {
  ...RateLimitPresets.login,
  keyGenerator: (id) => `rl:login:${id}`,
};

// Register rate limit configuration
export const RegisterRateLimitConfig: RateLimitConfig = {
  ...RateLimitPresets.register,
  keyGenerator: (id) => `rl:register:${id}`,
};
