/**
 * Rate Limit Middleware Tests
 *
 * Coverage:
 * - Normal Redis operation with rate limiting
 * - Redis failure with fail-closed mode (in-memory fallback)
 * - Redis failure with fail-open mode (allows requests)
 * - In-memory limiter enforcement
 * - X-RateLimit-Source header verification
 * - Redis reconnection handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createMinimalTestApp } from '../helpers/create-test-app';
import { createRateLimiter } from '../../src/core/auth/rate-limit-middleware';
import { redisCache } from '../../src/core/cache/redis';
import { inMemoryRateLimiter } from '../../src/core/auth/in-memory-rate-limiter';
import { env } from '../../src/config/env';

describe('Rate Limit Middleware', () => {
  let app: FastifyInstance | null = null;
  const originalFailClosed = env.RATE_LIMITER_FAIL_CLOSED;

  beforeEach(async () => {
    app = await createMinimalTestApp();
    // Clear in-memory rate limiter before each test
    inMemoryRateLimiter.clear();
    // Reset all mocks
    vi.clearAllMocks();
    env.RATE_LIMITER_FAIL_CLOSED = originalFailClosed;
  });

  afterEach(async () => {
    if (app) {
      await app.close();
      app = null;
    }
    env.RATE_LIMITER_FAIL_CLOSED = originalFailClosed;
    delete process.env.RATE_LIMITER_FAIL_CLOSED;
  });

  describe('Normal Redis Operation', () => {
    beforeEach(() => {
      // Mock Redis as connected
      vi.spyOn(redisCache, 'getConnectionStatus').mockReturnValue(true);
    });

    it('should allow requests under rate limit', async () => {
      const rateLimiter = createRateLimiter({ maxRequests: 5, windowMs: 60000 });

      // Mock Redis operations
      let count = 0;
      vi.spyOn(redisCache, 'get').mockResolvedValue(count);
      vi.spyOn(redisCache, 'set').mockImplementation(async (key, value) => {
        count = value as number;
        return true;
      });

      // Register test route with rate limiter
      app!.get('/test-rate-limit', { preHandler: rateLimiter }, async () => {
        return { success: true };
      });

      // Make requests under the limit
      for (let i = 0; i < 5; i++) {
        const response = await app!.inject({
          method: 'GET',
          url: '/test-rate-limit',
          remoteAddress: '127.0.0.1',
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers['x-ratelimit-source']).toBe('redis');
        const body = response.json();
        expect(body.success).toBe(true);
      }
    });

    it('should block requests over rate limit', async () => {
      const rateLimiter = createRateLimiter({ maxRequests: 3, windowMs: 60000 });

      // Mock Redis to return count at limit
      vi.spyOn(redisCache, 'get').mockResolvedValue(3);
      vi.spyOn(redisCache, 'set').mockResolvedValue(true);

      // Register test route
      app!.get('/test-rate-limit-exceeded', { preHandler: rateLimiter }, async () => {
        return { success: true };
      });

      const response = await app!.inject({
        method: 'GET',
        url: '/test-rate-limit-exceeded',
        remoteAddress: '127.0.0.1',
      });

      expect(response.statusCode).toBe(429);
      expect(response.headers['x-ratelimit-source']).toBe('redis');
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain('Too many requests');
    });

    it('should enforce rate limits per IP address', async () => {
      const rateLimiter = createRateLimiter({ maxRequests: 2, windowMs: 60000 });

      const counts: Record<string, number> = {};
      vi.spyOn(redisCache, 'get').mockImplementation(async (key) => {
        return counts[key] || 0;
      });
      vi.spyOn(redisCache, 'set').mockImplementation(async (key, value) => {
        counts[key] = value as number;
        return true;
      });

      // Register test route
      app!.get('/test-per-ip', { preHandler: rateLimiter }, async () => {
        return { success: true };
      });

      // IP 1 makes 2 requests (under limit)
      for (let i = 0; i < 2; i++) {
        const response = await app!.inject({
          method: 'GET',
          url: '/test-per-ip',
          remoteAddress: '192.168.1.1',
        });
        expect(response.statusCode).toBe(200);
      }

      // IP 1 makes 3rd request (over limit)
      const response1 = await app!.inject({
        method: 'GET',
        url: '/test-per-ip',
        remoteAddress: '192.168.1.1',
      });
      expect(response1.statusCode).toBe(429);

      // IP 2 makes request (should succeed, different IP)
      const response2 = await app!.inject({
        method: 'GET',
        url: '/test-per-ip',
        remoteAddress: '192.168.1.2',
      });
      expect(response2.statusCode).toBe(200);
    });
  });

  describe('Redis Failure with Fail-Closed Mode (Default)', () => {
    beforeEach(() => {
      // Mock Redis as disconnected
      vi.spyOn(redisCache, 'getConnectionStatus').mockReturnValue(false);
      // Set fail-closed mode
      process.env.RATE_LIMITER_FAIL_CLOSED = 'true';
    });

    it('should use in-memory fallback when Redis is disconnected', async () => {
      const rateLimiter = createRateLimiter({ maxRequests: 3, windowMs: 60000 });

      // Register test route
      app!.get('/test-fallback', { preHandler: rateLimiter }, async () => {
        return { success: true };
      });

      const response = await app!.inject({
        method: 'GET',
        url: '/test-fallback',
        remoteAddress: '127.0.0.1',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-ratelimit-source']).toBe('memory');
      const body = response.json();
      expect(body.success).toBe(true);
    });

    it('should enforce rate limits with in-memory fallback', async () => {
      const rateLimiter = createRateLimiter({ maxRequests: 3, windowMs: 60000 });

      // Register test route
      app!.get('/test-fallback-limit', { preHandler: rateLimiter }, async () => {
        return { success: true };
      });

      // Make requests up to the limit
      for (let i = 0; i < 3; i++) {
        const response = await app!.inject({
          method: 'GET',
          url: '/test-fallback-limit',
          remoteAddress: '127.0.0.1',
        });
        expect(response.statusCode).toBe(200);
        expect(response.headers['x-ratelimit-source']).toBe('memory');
      }

      // 4th request should be blocked
      const response = await app!.inject({
        method: 'GET',
        url: '/test-fallback-limit',
        remoteAddress: '127.0.0.1',
      });

      expect(response.statusCode).toBe(429);
      expect(response.headers['x-ratelimit-source']).toBe('memory');
      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error).toContain('Too many requests');
    });

    it('should handle Redis operation errors gracefully', async () => {
      // Mock Redis as connected but operations fail
      vi.spyOn(redisCache, 'getConnectionStatus').mockReturnValue(true);
      vi.spyOn(redisCache, 'get').mockRejectedValue(new Error('Redis connection lost'));
      vi.spyOn(redisCache, 'set').mockRejectedValue(new Error('Redis connection lost'));

      const rateLimiter = createRateLimiter({ maxRequests: 3, windowMs: 60000 });

      // Register test route
      app!.get('/test-redis-error', { preHandler: rateLimiter }, async () => {
        return { success: true };
      });

      const response = await app!.inject({
        method: 'GET',
        url: '/test-redis-error',
        remoteAddress: '127.0.0.1',
      });

      // Should fall back to in-memory limiter
      expect(response.statusCode).toBe(200);
      expect(response.headers['x-ratelimit-source']).toBe('memory');
    });
  });

  describe('Redis Failure with Fail-Open Mode', () => {
    beforeEach(() => {
      // Mock Redis as disconnected
      vi.spyOn(redisCache, 'getConnectionStatus').mockReturnValue(false);
      // Set fail-open mode
      env.RATE_LIMITER_FAIL_CLOSED = false;
    });

    it('should allow requests when Redis is disconnected in fail-open mode', async () => {
      const rateLimiter = createRateLimiter({ maxRequests: 1, windowMs: 60000 });

      // Register test route
      app!.get('/test-fail-open', { preHandler: rateLimiter }, async () => {
        return { success: true };
      });

      // Make multiple requests - all should succeed even though limit is 1
      for (let i = 0; i < 5; i++) {
        const response = await app!.inject({
          method: 'GET',
          url: '/test-fail-open',
          remoteAddress: '127.0.0.1',
        });

        expect(response.statusCode).toBe(200);
        expect(response.headers['x-ratelimit-source']).toBe('disabled');
        const body = response.json();
        expect(body.success).toBe(true);
      }
    });
  });

  describe('In-Memory Rate Limiter Behavior', () => {
    beforeEach(() => {
      // Mock Redis as disconnected
      vi.spyOn(redisCache, 'getConnectionStatus').mockReturnValue(false);
      // Set fail-closed mode
      env.RATE_LIMITER_FAIL_CLOSED = true;
    });

    it('should correctly track counts across multiple requests', async () => {
      const rateLimiter = createRateLimiter({ maxRequests: 5, windowMs: 60000 });

      // Register test route
      app!.get('/test-count-tracking', { preHandler: rateLimiter }, async () => {
        return { success: true };
      });

      // Make 5 requests - all should succeed
      for (let i = 1; i <= 5; i++) {
        const response = await app!.inject({
          method: 'GET',
          url: '/test-count-tracking',
          remoteAddress: '127.0.0.1',
        });
        expect(response.statusCode).toBe(200);

        // Verify count is being tracked
        const count = inMemoryRateLimiter.getCount('rate_limit:127.0.0.1');
        expect(count).toBe(i);
      }

      // 6th request should be blocked
      const response = await app!.inject({
        method: 'GET',
        url: '/test-count-tracking',
        remoteAddress: '127.0.0.1',
      });
      expect(response.statusCode).toBe(429);
    });

    it('should isolate rate limits by IP address', async () => {
      const rateLimiter = createRateLimiter({ maxRequests: 2, windowMs: 60000 });

      // Register test route
      app!.get('/test-ip-isolation', { preHandler: rateLimiter }, async () => {
        return { success: true };
      });

      // IP 1 makes 2 requests
      for (let i = 0; i < 2; i++) {
        const response = await app!.inject({
          method: 'GET',
          url: '/test-ip-isolation',
          remoteAddress: '10.0.0.1',
        });
        expect(response.statusCode).toBe(200);
      }

      // IP 1's 3rd request should be blocked
      const response1 = await app!.inject({
        method: 'GET',
        url: '/test-ip-isolation',
        remoteAddress: '10.0.0.1',
      });
      expect(response1.statusCode).toBe(429);

      // IP 2's requests should succeed
      const response2 = await app!.inject({
        method: 'GET',
        url: '/test-ip-isolation',
        remoteAddress: '10.0.0.2',
      });
      expect(response2.statusCode).toBe(200);

      // Verify both IPs are tracked separately
      expect(inMemoryRateLimiter.getCount('rate_limit:10.0.0.1')).toBe(3);
      expect(inMemoryRateLimiter.getCount('rate_limit:10.0.0.2')).toBe(1);
    });

    it('should reset counts after window expires', async () => {
      const shortWindow = 100; // 100ms
      const rateLimiter = createRateLimiter({ maxRequests: 2, windowMs: shortWindow });

      // Register test route
      app!.get('/test-window-reset', { preHandler: rateLimiter }, async () => {
        return { success: true };
      });

      // Make 2 requests (reach limit)
      for (let i = 0; i < 2; i++) {
        const response = await app!.inject({
          method: 'GET',
          url: '/test-window-reset',
          remoteAddress: '127.0.0.1',
        });
        expect(response.statusCode).toBe(200);
      }

      // 3rd request should be blocked
      const blockedResponse = await app!.inject({
        method: 'GET',
        url: '/test-window-reset',
        remoteAddress: '127.0.0.1',
      });
      expect(blockedResponse.statusCode).toBe(429);

      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, shortWindow + 50));

      // New request should succeed after window expires
      const newResponse = await app!.inject({
        method: 'GET',
        url: '/test-window-reset',
        remoteAddress: '127.0.0.1',
      });
      expect(newResponse.statusCode).toBe(200);
    });
  });

  describe('Redis Reconnection Handling', () => {
    it('should switch back to Redis when it reconnects', async () => {
      const rateLimiter = createRateLimiter({ maxRequests: 5, windowMs: 60000 });

      // Start with Redis disconnected
      const getConnectionStatusSpy = vi.spyOn(redisCache, 'getConnectionStatus')
        .mockReturnValue(false);

      // Set fail-closed mode
      process.env.RATE_LIMITER_FAIL_CLOSED = 'true';

      // Register test route
      app!.get('/test-reconnect', { preHandler: rateLimiter }, async () => {
        return { success: true };
      });

      // First request uses in-memory fallback
      const response1 = await app!.inject({
        method: 'GET',
        url: '/test-reconnect',
        remoteAddress: '127.0.0.1',
      });
      expect(response1.statusCode).toBe(200);
      expect(response1.headers['x-ratelimit-source']).toBe('memory');

      // Simulate Redis reconnection
      getConnectionStatusSpy.mockReturnValue(true);
      vi.spyOn(redisCache, 'get').mockResolvedValue(0);
      vi.spyOn(redisCache, 'set').mockResolvedValue(true);

      // Next request should use Redis
      const response2 = await app!.inject({
        method: 'GET',
        url: '/test-reconnect',
        remoteAddress: '127.0.0.1',
      });
      expect(response2.statusCode).toBe(200);
      expect(response2.headers['x-ratelimit-source']).toBe('redis');
    });
  });

  describe('X-RateLimit-Source Header', () => {
    it('should set correct header for Redis source', async () => {
      vi.spyOn(redisCache, 'getConnectionStatus').mockReturnValue(true);
      vi.spyOn(redisCache, 'get').mockResolvedValue(0);
      vi.spyOn(redisCache, 'set').mockResolvedValue(true);

      const rateLimiter = createRateLimiter({ maxRequests: 5, windowMs: 60000 });

      app!.get('/test-header-redis', { preHandler: rateLimiter }, async () => {
        return { success: true };
      });

      const response = await app!.inject({
        method: 'GET',
        url: '/test-header-redis',
        remoteAddress: '127.0.0.1',
      });

      expect(response.headers['x-ratelimit-source']).toBe('redis');
    });

    it('should set correct header for memory source', async () => {
      vi.spyOn(redisCache, 'getConnectionStatus').mockReturnValue(false);
      env.RATE_LIMITER_FAIL_CLOSED = true;

      const rateLimiter = createRateLimiter({ maxRequests: 5, windowMs: 60000 });

      app!.get('/test-header-memory', { preHandler: rateLimiter }, async () => {
        return { success: true };
      });

      const response = await app!.inject({
        method: 'GET',
        url: '/test-header-memory',
        remoteAddress: '127.0.0.1',
      });

      expect(response.headers['x-ratelimit-source']).toBe('memory');
    });

    it('should set correct header for disabled source', async () => {
      vi.spyOn(redisCache, 'getConnectionStatus').mockReturnValue(false);
      env.RATE_LIMITER_FAIL_CLOSED = false;

      const rateLimiter = createRateLimiter({ maxRequests: 5, windowMs: 60000 });

      app!.get('/test-header-disabled', { preHandler: rateLimiter }, async () => {
        return { success: true };
      });

      const response = await app!.inject({
        method: 'GET',
        url: '/test-header-disabled',
        remoteAddress: '127.0.0.1',
      });

      expect(response.headers['x-ratelimit-source']).toBe('disabled');
    });
  });

  describe('Custom Rate Limit Configuration', () => {
    beforeEach(() => {
      vi.spyOn(redisCache, 'getConnectionStatus').mockReturnValue(true);
    });

    it('should respect custom maxRequests configuration', async () => {
      const customLimit = 10;
      const rateLimiter = createRateLimiter({ maxRequests: customLimit, windowMs: 60000 });

      let count = 0;
      vi.spyOn(redisCache, 'get').mockImplementation(async () => count);
      vi.spyOn(redisCache, 'set').mockImplementation(async (key, value) => {
        count = value as number;
        return true;
      });

      app!.get('/test-custom-limit', { preHandler: rateLimiter }, async () => {
        return { success: true };
      });

      // Make requests up to custom limit
      for (let i = 0; i < customLimit; i++) {
        const response = await app!.inject({
          method: 'GET',
          url: '/test-custom-limit',
          remoteAddress: '127.0.0.1',
        });
        expect(response.statusCode).toBe(200);
      }

      // Next request should be blocked
      const response = await app!.inject({
        method: 'GET',
        url: '/test-custom-limit',
        remoteAddress: '127.0.0.1',
      });
      expect(response.statusCode).toBe(429);
    });

    it('should use default configuration when no config provided', async () => {
      const rateLimiter = createRateLimiter(); // Uses defaults: 100 requests/minute

      let count = 0;
      vi.spyOn(redisCache, 'get').mockImplementation(async () => count);
      vi.spyOn(redisCache, 'set').mockImplementation(async (key, value) => {
        count = value as number;
        return true;
      });

      app!.get('/test-default-config', { preHandler: rateLimiter }, async () => {
        return { success: true };
      });

      // Should allow many requests (default is 100)
      for (let i = 0; i < 50; i++) {
        const response = await app!.inject({
          method: 'GET',
          url: '/test-default-config',
          remoteAddress: '127.0.0.1',
        });
        expect(response.statusCode).toBe(200);
      }
    });
  });
});
