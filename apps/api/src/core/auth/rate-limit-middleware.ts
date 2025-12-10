/**
 * Rate Limit Middleware (单商户版本)
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { redisCache } from '@/core/cache/redis';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const defaultConfig: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100
};

export function createRateLimiter(config: Partial<RateLimitConfig> = {}) {
  const { windowMs, maxRequests } = { ...defaultConfig, ...config };

  return async function rateLimitMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    const ip = request.ip;
    const key = `rate_limit:${ip}`;

    try {
      const current = await redisCache.get<number>(key);
      const count = current || 0;

      if (count >= maxRequests) {
        return reply.code(429).send({
          success: false,
          error: 'Too many requests, please try again later'
        });
      }

      await redisCache.set(key, count + 1, Math.ceil(windowMs / 1000));
    } catch (error) {
      // If Redis fails, allow the request
      console.error('Rate limit error:', error);
    }
  };
}

export const rateLimitMiddleware = createRateLimiter();
