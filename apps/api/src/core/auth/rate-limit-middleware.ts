/**
 * Rate Limit Middleware
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { redisCache } from '@/core/cache/redis';
import { inMemoryRateLimiter } from '@/core/auth/in-memory-rate-limiter';
import { env } from '@/config/env';

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

    // Check if Redis is connected
    const isRedisConnected = redisCache.getConnectionStatus();

    if (isRedisConnected) {
      // Try to use Redis for rate limiting
      try {
        const current = await redisCache.get<number>(key);
        const count = current || 0;

        if (count >= maxRequests) {
          reply.header('X-RateLimit-Source', 'redis');
          return reply.code(429).send({
            success: false,
            error: 'Too many requests, please try again later'
          });
        }

        await redisCache.set(key, count + 1, Math.ceil(windowMs / 1000));
        reply.header('X-RateLimit-Source', 'redis');
      } catch (error) {
        console.error('Rate limit Redis error:', error);
        // Redis operation failed, fall through to fallback logic
        return handleRedisFallback(request, reply, key, windowMs, maxRequests);
      }
    } else {
      // Redis is not connected, use fallback logic
      return handleRedisFallback(request, reply, key, windowMs, maxRequests);
    }
  };
}

/**
 * Handle rate limiting when Redis is unavailable
 */
function handleRedisFallback(
  request: FastifyRequest,
  reply: FastifyReply,
  key: string,
  windowMs: number,
  maxRequests: number
) {
  if (env.RATE_LIMITER_FAIL_CLOSED) {
    // Fail-closed mode: use in-memory fallback
    console.warn(`Rate limiter using in-memory fallback for IP: ${request.ip}`);

    const count = inMemoryRateLimiter.increment(key, windowMs);

    if (count > maxRequests) {
      reply.header('X-RateLimit-Source', 'memory');
      return reply.code(429).send({
        success: false,
        error: 'Too many requests, please try again later'
      });
    }

    reply.header('X-RateLimit-Source', 'memory');
  } else {
    // Fail-open mode: allow request but log error
    console.error(`Rate limiter fail-open: allowing request without rate limiting for IP: ${request.ip}`);
    reply.header('X-RateLimit-Source', 'disabled');
  }
}

export const rateLimitMiddleware = createRateLimiter();
