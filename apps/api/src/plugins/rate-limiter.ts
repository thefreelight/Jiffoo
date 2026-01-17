/**
 * Fastify Rate Limiter Plugin
 */

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { RateLimiter, RateLimitConfig, RateLimitPresets, MemoryRateLimitStore, RateLimitStore } from '@shared/security';

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
    store = new MemoryRateLimitStore(),
    enabled = true,
    skipPaths = ['/health', '/metrics', '/api/health'],
    keyGenerator = defaultKeyGenerator,
  } = options;

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

    // Get route-specific configuration
    const routeConfig = routes[request.routeOptions?.url ?? ''] ?? {};
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
