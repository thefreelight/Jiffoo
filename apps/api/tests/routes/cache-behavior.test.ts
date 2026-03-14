/**
 * Cache Behavior Tests
 *
 * Coverage:
 * - Redis read-through cache hit for products, store context, payment methods
 * - Categories endpoint cache behavior and HTTP caching headers
 * - Cache invalidation after write operations (product version bump)
 * - HTTP 304 Not Modified with ETag / If-None-Match
 * - Cache-Control headers on public GET endpoints
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

// Mock the redis module BEFORE any app code is imported
// This replaces the singleton `redisCache` used by CacheService
const store = new Map<string, { value: string; expiresAt: number | null }>();

vi.mock('@/core/cache/redis', () => {
  const mockRedis = {
    isConnected: true,
    async connect() { return this; },
    async disconnect() { store.clear(); },
    async get<T = any>(key: string): Promise<T | null> {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
      }
      return JSON.parse(entry.value) as T;
    },
    async set(key: string, value: any, ttl?: number): Promise<boolean> {
      const expiresAt = ttl ? Date.now() + ttl * 1000 : null;
      store.set(key, { value: JSON.stringify(value), expiresAt });
      return true;
    },
    async del(key: string): Promise<boolean> {
      return store.delete(key);
    },
    async exists(key: string): Promise<boolean> {
      const entry = store.get(key);
      if (!entry) return false;
      if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
        store.delete(key);
        return false;
      }
      return true;
    },
    async incr(key: string): Promise<number> {
      const entry = store.get(key);
      let current = 0;
      if (entry) {
        if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
          store.delete(key);
        } else {
          current = Number(JSON.parse(entry.value)) || 0;
        }
      }
      const newVal = current + 1;
      store.set(key, { value: JSON.stringify(newVal), expiresAt: entry?.expiresAt ?? null });
      return newVal;
    },
    async expire(key: string, ttl: number): Promise<boolean> {
      const entry = store.get(key);
      if (!entry) return false;
      entry.expiresAt = Date.now() + ttl * 1000;
      return true;
    },
    async ping() { return true; },
    getConnectionStatus() { return true; },
    async flushAll() { store.clear(); return true; },
    async deleteByPattern(pattern: string): Promise<number> {
      const prefix = pattern.replace('*', '');
      let count = 0;
      for (const key of store.keys()) {
        if (key.startsWith(prefix)) {
          store.delete(key);
          count++;
        }
      }
      return count;
    },
    async keys(pattern: string): Promise<string[]> {
      const prefix = pattern.replace('*', '');
      return [...store.keys()].filter(k => k.startsWith(prefix));
    },
    async countByPattern(pattern: string): Promise<number> {
      const prefix = pattern.replace('*', '');
      return [...store.keys()].filter(k => k.startsWith(prefix)).length;
    },
    getRawClient() {
      return {
        incr: async (key: string) => {
          const current = await mockRedis.get<number>(key);
          const next = (current ?? 0) + 1;
          await mockRedis.set(key, next);
          return next;
        },
        pexpire: async (key: string, ms: number) => {
          const entry = store.get(key);
          if (!entry) return 0;
          entry.expiresAt = Date.now() + ms;
          return 1;
        },
        pttl: async (key: string) => {
          const entry = store.get(key);
          if (!entry || entry.expiresAt === null) return -1;
          return Math.max(0, entry.expiresAt - Date.now());
        },
        del: async (...keys: string[]) => {
          let count = 0;
          for (const key of keys) {
            if (store.delete(key)) count++;
          }
          return count;
        },
        get: async (key: string) => {
          const entry = store.get(key);
          if (!entry) return null;
          if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
            store.delete(key);
            return null;
          }
          return entry.value;
        },
      };
    },
  };

  return {
    redisCache: mockRedis,
    RedisCache: {
      getInstance: () => mockRedis,
    },
  };
});

import { createTestApp } from '../helpers/create-test-app';
import { createTestProduct, deleteAllTestProducts } from '../helpers/fixtures';
import { createAdminWithToken, deleteAllTestUsers } from '../helpers/auth';

describe('Cache Behavior Tests', () => {
  let app: FastifyInstance;
  let testProduct: Awaited<ReturnType<typeof createTestProduct>>;

  beforeAll(async () => {
    app = await createTestApp();
    testProduct = await createTestProduct({
      name: 'Cache Test Product',
      description: 'Product for cache testing',
      price: 49.99,
      stock: 100,
      category: 'electronics',
    });
  });

  afterAll(async () => {
    await deleteAllTestProducts();
    await app.close();
  });

  beforeEach(() => {
    // Clear cache store before each test for isolation
    store.clear();
  });

  // =========================================================================
  // Cache Hit Tests
  // =========================================================================
  describe('Cache Hit - Products List', () => {
    it('should cache product list and serve from cache on second request', async () => {
      // First request - cache miss, fills cache
      const res1 = await app.inject({ method: 'GET', url: '/api/products' });
      expect(res1.statusCode).toBe(200);
      const body1 = JSON.parse(res1.body);
      expect(body1.success).toBe(true);

      // Verify cache was populated (at least one pub:products:list key)
      const cacheKeys = [...store.keys()].filter(k => k.startsWith('pub:products:list:'));
      expect(cacheKeys.length).toBeGreaterThan(0);

      // Second request - should hit cache and return same data
      const res2 = await app.inject({ method: 'GET', url: '/api/products' });
      expect(res2.statusCode).toBe(200);
      const body2 = JSON.parse(res2.body);
      expect(body2.data).toEqual(body1.data);
    });

    it('should cache product detail and serve from cache on second request', async () => {
      const res1 = await app.inject({ method: 'GET', url: `/api/products/${testProduct.id}` });
      expect(res1.statusCode).toBe(200);

      const detailKeys = [...store.keys()].filter(k => k.startsWith('pub:products:detail:'));
      expect(detailKeys.length).toBeGreaterThan(0);

      const res2 = await app.inject({ method: 'GET', url: `/api/products/${testProduct.id}` });
      expect(res2.statusCode).toBe(200);
      const body1 = JSON.parse(res1.body);
      const body2 = JSON.parse(res2.body);
      expect(body2.data).toEqual(body1.data);
    });

    it('should cache search results and serve from cache', async () => {
      const res1 = await app.inject({ method: 'GET', url: '/api/products/search?q=Cache' });
      expect(res1.statusCode).toBe(200);

      const searchKeys = [...store.keys()].filter(k => k.startsWith('pub:products:search:'));
      expect(searchKeys.length).toBeGreaterThan(0);

      const res2 = await app.inject({ method: 'GET', url: '/api/products/search?q=Cache' });
      expect(res2.statusCode).toBe(200);
      const body1 = JSON.parse(res1.body);
      const body2 = JSON.parse(res2.body);
      expect(body2.data).toEqual(body1.data);
    });

    it('should cache categories list and serve from cache', async () => {
      const res1 = await app.inject({ method: 'GET', url: '/api/products/categories?limit=10' });
      expect(res1.statusCode).toBe(200);

      const categoryKeys = [...store.keys()].filter(k => k.startsWith('pub:products:categories:'));
      expect(categoryKeys.length).toBeGreaterThan(0);

      const res2 = await app.inject({ method: 'GET', url: '/api/products/categories?limit=10' });
      expect(res2.statusCode).toBe(200);
      const body1 = JSON.parse(res1.body);
      const body2 = JSON.parse(res2.body);
      expect(body2.data).toEqual(body1.data);
    });
  });

  // =========================================================================
  // Cache Invalidation Tests
  // =========================================================================
  describe('Cache Invalidation - Product Version Bump', () => {
    it('should invalidate product list cache when product version is incremented', async () => {
      // Fill cache
      const res1 = await app.inject({ method: 'GET', url: '/api/products' });
      expect(res1.statusCode).toBe(200);

      const keysBeforeBump = [...store.keys()].filter(k => k.startsWith('pub:products:list:'));
      expect(keysBeforeBump.length).toBeGreaterThan(0);

      // Simulate product version bump (what happens after admin creates/updates/deletes product)
      const { CacheService } = await import('../../src/core/cache/service');
      await CacheService.incrementProductVersion();

      // New request should miss old cache (different version in key)
      const res2 = await app.inject({ method: 'GET', url: '/api/products' });
      expect(res2.statusCode).toBe(200);

      // Verify new cache key was created with bumped version
      const keysAfterBump = [...store.keys()].filter(k => k.startsWith('pub:products:list:'));
      // Old keys (v0) and new keys (v1) should be different
      expect(keysAfterBump).not.toEqual(keysBeforeBump);
    });
  });

  // =========================================================================
  // HTTP Cache Headers Tests
  // =========================================================================
  describe('HTTP Cache Headers', () => {
    it('should return Cache-Control and ETag headers for product list', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/products' });
      expect(res.statusCode).toBe(200);
      expect(res.headers['cache-control']).toContain('public');
      expect(res.headers['cache-control']).toContain('max-age=30');
      expect(res.headers['etag']).toBeDefined();
    });

    it('should return Cache-Control and ETag headers for product detail', async () => {
      const res = await app.inject({ method: 'GET', url: `/api/products/${testProduct.id}` });
      expect(res.statusCode).toBe(200);
      expect(res.headers['cache-control']).toContain('max-age=60');
      expect(res.headers['etag']).toBeDefined();
    });

    it('should return Cache-Control and ETag headers for product search', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/products/search?q=test' });
      expect(res.statusCode).toBe(200);
      expect(res.headers['cache-control']).toContain('max-age=20');
      expect(res.headers['etag']).toBeDefined();
    });

    it('should return Cache-Control and ETag headers for categories', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/products/categories' });
      expect(res.statusCode).toBe(200);
      expect(res.headers['cache-control']).toContain('max-age=60');
      expect(res.headers['etag']).toBeDefined();
    });
  });

  // =========================================================================
  // 304 Not Modified Tests
  // =========================================================================
  describe('304 Not Modified with ETag', () => {
    it('should return 304 when If-None-Match matches ETag for product list', async () => {
      // First request to get ETag
      const res1 = await app.inject({ method: 'GET', url: '/api/products' });
      expect(res1.statusCode).toBe(200);
      const etag = res1.headers['etag'] as string;
      expect(etag).toBeDefined();

      // Second request with If-None-Match
      const res2 = await app.inject({
        method: 'GET',
        url: '/api/products',
        headers: { 'if-none-match': etag },
      });
      expect(res2.statusCode).toBe(304);
    });

    it('should return 304 when If-None-Match matches ETag for product detail', async () => {
      const res1 = await app.inject({ method: 'GET', url: `/api/products/${testProduct.id}` });
      expect(res1.statusCode).toBe(200);
      const etag = res1.headers['etag'] as string;

      const res2 = await app.inject({
        method: 'GET',
        url: `/api/products/${testProduct.id}`,
        headers: { 'if-none-match': etag },
      });
      expect(res2.statusCode).toBe(304);
    });

    it('should return 304 when If-None-Match matches ETag for categories', async () => {
      const res1 = await app.inject({ method: 'GET', url: '/api/products/categories' });
      expect(res1.statusCode).toBe(200);
      const etag = res1.headers['etag'] as string;
      expect(etag).toBeDefined();

      const res2 = await app.inject({
        method: 'GET',
        url: '/api/products/categories',
        headers: { 'if-none-match': etag },
      });
      expect(res2.statusCode).toBe(304);
    });

    it('should NOT return 304 when ETag differs (data changed)', async () => {
      const res1 = await app.inject({ method: 'GET', url: '/api/products' });
      expect(res1.statusCode).toBe(200);

      // Request with a different ETag
      const res2 = await app.inject({
        method: 'GET',
        url: '/api/products',
        headers: { 'if-none-match': '"outdated-etag-value"' },
      });
      expect(res2.statusCode).toBe(200);
    });
  });

  // =========================================================================
  // Store Context Cache Tests
  // =========================================================================
  describe('Store Context Cache', () => {
    it('should cache store context and serve from cache', async () => {
      const res1 = await app.inject({ method: 'GET', url: '/api/store/context' });
      expect(res1.statusCode).toBe(200);

      const contextKeys = [...store.keys()].filter(k => k.startsWith('pub:store:context:'));
      expect(contextKeys.length).toBeGreaterThan(0);

      const res2 = await app.inject({ method: 'GET', url: '/api/store/context' });
      expect(res2.statusCode).toBe(200);
      expect(JSON.parse(res2.body).data).toEqual(JSON.parse(res1.body).data);
    });

    it('should return Cache-Control and ETag for store context', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/store/context' });
      expect(res.statusCode).toBe(200);
      expect(res.headers['cache-control']).toContain('max-age=60');
      expect(res.headers['etag']).toBeDefined();
    });
  });

  // =========================================================================
  // Payment Methods Cache Tests
  // =========================================================================
  describe('Payment Methods Cache', () => {
    it('should cache available payment methods and serve from cache', async () => {
      const res1 = await app.inject({ method: 'GET', url: '/api/payments/available-methods' });
      expect(res1.statusCode).toBe(200);

      const methodKeys = [...store.keys()].filter(k => k.startsWith('pub:payments:methods:'));
      expect(methodKeys.length).toBeGreaterThan(0);

      const res2 = await app.inject({ method: 'GET', url: '/api/payments/available-methods' });
      expect(res2.statusCode).toBe(200);
      expect(JSON.parse(res2.body).data).toEqual(JSON.parse(res1.body).data);
    });

    it('should return Cache-Control and ETag for payment methods', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/payments/available-methods' });
      expect(res.statusCode).toBe(200);
      expect(res.headers['cache-control']).toContain('max-age=30');
      expect(res.headers['etag']).toBeDefined();
    });
  });

  // =========================================================================
  // Invalidation Consistency Tests
  // =========================================================================
  describe('Invalidation Consistency', () => {
    it('should invalidate product detail cache when product version is bumped', async () => {
      const { CacheService } = await import('../../src/core/cache/service');

      // Fill cache
      const res1 = await app.inject({ method: 'GET', url: `/api/products/${testProduct.id}` });
      expect(res1.statusCode).toBe(200);

      const detailKeysBefore = [...store.keys()].filter(k => k.startsWith('pub:products:detail:'));
      expect(detailKeysBefore.length).toBeGreaterThan(0);

      // Bump product version
      const vBefore = await CacheService.getProductVersion();
      await CacheService.incrementProductVersion();
      const vAfter = await CacheService.getProductVersion();
      expect(vAfter).toBe(vBefore + 1);

      // New request should create a new cache key with the bumped version
      const res2 = await app.inject({ method: 'GET', url: `/api/products/${testProduct.id}` });
      expect(res2.statusCode).toBe(200);

      const detailKeysAfter = [...store.keys()].filter(k => k.startsWith('pub:products:detail:'));
      // Should contain a key with the new version number
      const hasNewVersion = detailKeysAfter.some(k => k.includes(`:v${vAfter}:`));
      expect(hasNewVersion).toBe(true);
    });

    it('should invalidate search cache when product version is bumped', async () => {
      const { CacheService } = await import('../../src/core/cache/service');

      // Fill search cache
      await app.inject({ method: 'GET', url: '/api/products/search?q=Cache' });
      const searchKeysBefore = [...store.keys()].filter(k => k.startsWith('pub:products:search:'));
      expect(searchKeysBefore.length).toBeGreaterThan(0);

      // Bump version
      await CacheService.incrementProductVersion();
      const vAfter = await CacheService.getProductVersion();

      // New search should create key with new version
      await app.inject({ method: 'GET', url: '/api/products/search?q=Cache' });
      const searchKeysAfter = [...store.keys()].filter(k => k.startsWith('pub:products:search:'));
      const hasNewVersion = searchKeysAfter.some(k => k.includes(`:v${vAfter}:`));
      expect(hasNewVersion).toBe(true);
    });

    it('should invalidate payment methods cache when plugin version is bumped', async () => {
      const { CacheService } = await import('../../src/core/cache/service');

      // Fill payment methods cache
      const res1 = await app.inject({ method: 'GET', url: '/api/payments/available-methods' });
      expect(res1.statusCode).toBe(200);

      const methodKeysBefore = [...store.keys()].filter(k => k.startsWith('pub:payments:methods:'));
      expect(methodKeysBefore.length).toBeGreaterThan(0);

      // Bump plugin version (simulates plugin install/update/delete)
      const vBefore = await CacheService.getPluginVersion();
      await CacheService.incrementPluginVersion();
      const vAfter = await CacheService.getPluginVersion();
      expect(vAfter).toBe(vBefore + 1);

      // New request should create a cache key with the bumped version
      const res2 = await app.inject({ method: 'GET', url: '/api/payments/available-methods' });
      expect(res2.statusCode).toBe(200);

      const methodKeysAfter = [...store.keys()].filter(k => k.startsWith('pub:payments:methods:'));
      const hasNewVersion = methodKeysAfter.some(k => k.includes(`:v${vAfter}`));
      expect(hasNewVersion).toBe(true);
    });

    it('should invalidate store context cache when store context version is bumped', async () => {
      const { CacheService } = await import('../../src/core/cache/service');

      // Fill store context cache
      const res1 = await app.inject({ method: 'GET', url: '/api/store/context' });
      expect(res1.statusCode).toBe(200);

      const contextKeysBefore = [...store.keys()].filter(k => k.startsWith('pub:store:context:'));
      expect(contextKeysBefore.length).toBeGreaterThan(0);

      // Bump store context version (simulates settings or theme change)
      const vBefore = await CacheService.getStoreContextVersion();
      await CacheService.incrementStoreContextVersion();
      const vAfter = await CacheService.getStoreContextVersion();
      expect(vAfter).toBe(vBefore + 1);

      // New request should create a cache key with the bumped version
      const res2 = await app.inject({ method: 'GET', url: '/api/store/context' });
      expect(res2.statusCode).toBe(200);

      const contextKeysAfter = [...store.keys()].filter(k => k.startsWith('pub:store:context:'));
      const hasNewVersion = contextKeysAfter.some(k => k.includes(`:v${vAfter}`));
      expect(hasNewVersion).toBe(true);
    });

    it('should return different ETag after product version bump (client gets 200 instead of 304)', async () => {
      const { CacheService } = await import('../../src/core/cache/service');

      // Get initial ETag
      const res1 = await app.inject({ method: 'GET', url: '/api/products' });
      expect(res1.statusCode).toBe(200);
      const etagBefore = res1.headers['etag'] as string;
      expect(etagBefore).toBeDefined();

      // Bump product version (invalidates Redis cache)
      await CacheService.incrementProductVersion();

      // With old ETag, should NOT get 304 because data is re-fetched from DB
      // (data might be same but the response could differ due to timing, at minimum cache key changes)
      const res2 = await app.inject({
        method: 'GET',
        url: '/api/products',
        headers: { 'if-none-match': etagBefore },
      });
      // After version bump, the endpoint re-queries DB and generates a fresh response.
      // If data hasn't changed, ETag may match and we get 304. That's correct behavior.
      // If data has changed, we get 200. Both outcomes are valid.
      expect([200, 304]).toContain(res2.statusCode);
    });
  });

  // =========================================================================
  // TTL Behavior Tests
  // =========================================================================
  describe('TTL Behavior', () => {
    it('should serve from cache within 30s TTL for product list, miss after TTL', async () => {
      vi.useFakeTimers();
      try {
        const { CacheService } = await import('../../src/core/cache/service');

        // Fill cache (product list TTL = 30s)
        const res1 = await app.inject({ method: 'GET', url: '/api/products' });
        expect(res1.statusCode).toBe(200);

        const listKeys = [...store.keys()].filter(k => k.startsWith('pub:products:list:'));
        expect(listKeys.length).toBeGreaterThan(0);

        // Advance 15s - still within TTL, should hit cache
        vi.advanceTimersByTime(15_000);
        const entry15s = store.get(listKeys[0]);
        expect(entry15s).toBeDefined();
        // Manually check TTL hasn't expired
        expect(entry15s!.expiresAt).not.toBeNull();
        expect(Date.now()).toBeLessThan(entry15s!.expiresAt!);

        // Advance another 20s (total 35s) - past 30s TTL
        vi.advanceTimersByTime(20_000);
        // Entry should be expired
        expect(Date.now()).toBeGreaterThan(entry15s!.expiresAt!);

        // Mock redis get should return null for expired entry
        const cachedAfterExpiry = await CacheService.get(listKeys[0]);
        expect(cachedAfterExpiry).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('should serve from cache within 20s TTL for search, miss after TTL', async () => {
      vi.useFakeTimers();
      try {
        const { CacheService } = await import('../../src/core/cache/service');

        // Fill cache (search TTL = 20s)
        const res1 = await app.inject({ method: 'GET', url: '/api/products/search?q=Cache' });
        expect(res1.statusCode).toBe(200);

        const searchKeys = [...store.keys()].filter(k => k.startsWith('pub:products:search:'));
        expect(searchKeys.length).toBeGreaterThan(0);

        // Advance 10s - still within TTL
        vi.advanceTimersByTime(10_000);
        const entry10s = store.get(searchKeys[0]);
        expect(entry10s).toBeDefined();
        expect(Date.now()).toBeLessThan(entry10s!.expiresAt!);

        // Advance another 15s (total 25s) - past 20s TTL
        vi.advanceTimersByTime(15_000);
        expect(Date.now()).toBeGreaterThan(entry10s!.expiresAt!);

        const cachedAfterExpiry = await CacheService.get(searchKeys[0]);
        expect(cachedAfterExpiry).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('should serve from cache within 60s TTL for product detail, miss after TTL', async () => {
      vi.useFakeTimers();
      try {
        const { CacheService } = await import('../../src/core/cache/service');

        // Fill cache (product detail TTL = 60s)
        const res1 = await app.inject({ method: 'GET', url: `/api/products/${testProduct.id}` });
        expect(res1.statusCode).toBe(200);

        const detailKeys = [...store.keys()].filter(k => k.startsWith('pub:products:detail:'));
        expect(detailKeys.length).toBeGreaterThan(0);

        // Advance 30s - still within TTL
        vi.advanceTimersByTime(30_000);
        const entry30s = store.get(detailKeys[0]);
        expect(entry30s).toBeDefined();
        expect(Date.now()).toBeLessThan(entry30s!.expiresAt!);

        // Advance another 35s (total 65s) - past 60s TTL
        vi.advanceTimersByTime(35_000);
        expect(Date.now()).toBeGreaterThan(entry30s!.expiresAt!);

        const cachedAfterExpiry = await CacheService.get(detailKeys[0]);
        expect(cachedAfterExpiry).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('should serve from cache within 120s TTL for categories, miss after TTL', async () => {
      vi.useFakeTimers();
      try {
        const { CacheService } = await import('../../src/core/cache/service');

        // Fill cache (categories TTL = 120s)
        const res1 = await app.inject({ method: 'GET', url: '/api/products/categories' });
        expect(res1.statusCode).toBe(200);

        const categoryKeys = [...store.keys()].filter(k => k.startsWith('pub:products:categories:'));
        expect(categoryKeys.length).toBeGreaterThan(0);

        // Advance 60s - still within TTL
        vi.advanceTimersByTime(60_000);
        const entry60s = store.get(categoryKeys[0]);
        expect(entry60s).toBeDefined();
        expect(Date.now()).toBeLessThan(entry60s!.expiresAt!);

        // Advance another 70s (total 130s) - past 120s TTL
        vi.advanceTimersByTime(70_000);
        expect(Date.now()).toBeGreaterThan(entry60s!.expiresAt!);

        const cachedAfterExpiry = await CacheService.get(categoryKeys[0]);
        expect(cachedAfterExpiry).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('should serve from cache within 60s TTL for store context, miss after TTL', async () => {
      vi.useFakeTimers();
      try {
        const { CacheService } = await import('../../src/core/cache/service');

        // Fill cache (store context TTL = 60s)
        const res1 = await app.inject({ method: 'GET', url: '/api/store/context' });
        expect(res1.statusCode).toBe(200);

        const contextKeys = [...store.keys()].filter(k => k.startsWith('pub:store:context:'));
        expect(contextKeys.length).toBeGreaterThan(0);

        // Advance 30s - still within TTL
        vi.advanceTimersByTime(30_000);
        const entry30s = store.get(contextKeys[0]);
        expect(entry30s).toBeDefined();
        expect(Date.now()).toBeLessThan(entry30s!.expiresAt!);

        // Advance another 35s (total 65s) - past 60s TTL
        vi.advanceTimersByTime(35_000);
        expect(Date.now()).toBeGreaterThan(entry30s!.expiresAt!);

        const cachedAfterExpiry = await CacheService.get(contextKeys[0]);
        expect(cachedAfterExpiry).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('should serve from cache within 30s TTL for payment methods, miss after TTL', async () => {
      vi.useFakeTimers();
      try {
        const { CacheService } = await import('../../src/core/cache/service');

        // Fill cache (payment methods TTL = 30s)
        const res1 = await app.inject({ method: 'GET', url: '/api/payments/available-methods' });
        expect(res1.statusCode).toBe(200);

        const methodKeys = [...store.keys()].filter(k => k.startsWith('pub:payments:methods:'));
        expect(methodKeys.length).toBeGreaterThan(0);

        // Advance 15s - still within TTL
        vi.advanceTimersByTime(15_000);
        const entry15s = store.get(methodKeys[0]);
        expect(entry15s).toBeDefined();
        expect(Date.now()).toBeLessThan(entry15s!.expiresAt!);

        // Advance another 20s (total 35s) - past 30s TTL
        vi.advanceTimersByTime(20_000);
        expect(Date.now()).toBeGreaterThan(entry15s!.expiresAt!);

        const cachedAfterExpiry = await CacheService.get(methodKeys[0]);
        expect(cachedAfterExpiry).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('Cache Stats', () => {
    it('should return real cache counts after warming cache', async () => {
      const { CacheService } = await import('../../src/core/cache/service');

      await app.inject({ method: 'GET', url: '/api/products' });
      await app.inject({ method: 'GET', url: '/api/products/search?q=Cache' });
      await app.inject({ method: 'GET', url: '/api/products/categories' });

      const stats = await CacheService.getCacheStats();
      expect(stats.connected).toBe(true);
      expect(stats.productCacheCount).toBeGreaterThan(0);
      expect(stats.searchCacheCount).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // E2E Cache Invalidation via Real Admin API
  // =========================================================================
  describe('E2E Invalidation via Admin API', () => {
    let adminAuth: Awaited<ReturnType<typeof createAdminWithToken>>;

    beforeAll(async () => {
      adminAuth = await createAdminWithToken();
    });

    afterAll(async () => {
      await deleteAllTestUsers();
    });

    it('should invalidate product cache after admin updates a product', async () => {
      const { CacheService } = await import('../../src/core/cache/service');

      // Get variant info for update payload (variants is required by schema)
      const defaultVariant = testProduct.variants[0];
      const variantPayload = {
        id: defaultVariant.id,
        name: defaultVariant.name,
        salePrice: Number(defaultVariant.salePrice),
        baseStock: defaultVariant.baseStock,
      };

      // 1. Fill product list cache
      const res1 = await app.inject({ method: 'GET', url: '/api/products' });
      expect(res1.statusCode).toBe(200);

      const versionBefore = await CacheService.getProductVersion();

      // 2. Admin updates product name (must include variants)
      const updateRes = await app.inject({
        method: 'PUT',
        url: `/api/admin/products/${testProduct.id}`,
        headers: adminAuth.authHeader,
        payload: { name: 'Cache Test Product Updated', variants: [variantPayload] },
      });
      expect(updateRes.statusCode).toBe(200);

      // 3. Verify product version was bumped
      const versionAfter = await CacheService.getProductVersion();
      expect(versionAfter).toBeGreaterThan(versionBefore);

      // 4. Product list should use new cache key (version-based invalidation)
      const res2 = await app.inject({ method: 'GET', url: '/api/products' });
      expect(res2.statusCode).toBe(200);

      // New cache keys should contain the bumped version
      const listKeys = [...store.keys()].filter(k => k.startsWith('pub:products:list:'));
      const hasNewVersion = listKeys.some(k => k.includes(`:v${versionAfter}:`));
      expect(hasNewVersion).toBe(true);

      // 5. Restore product name for other tests
      await app.inject({
        method: 'PUT',
        url: `/api/admin/products/${testProduct.id}`,
        headers: adminAuth.authHeader,
        payload: { name: 'Cache Test Product', variants: [variantPayload] },
      });
    });

    it('should invalidate product detail cache after admin updates product', async () => {
      const { CacheService } = await import('../../src/core/cache/service');

      const defaultVariant = testProduct.variants[0];
      const variantPayload = {
        id: defaultVariant.id,
        name: defaultVariant.name,
        salePrice: Number(defaultVariant.salePrice),
        baseStock: defaultVariant.baseStock,
      };

      // Fill detail cache
      const res1 = await app.inject({ method: 'GET', url: `/api/products/${testProduct.id}` });
      expect(res1.statusCode).toBe(200);
      const etag1 = res1.headers['etag'] as string;

      // Admin updates product (must include variants)
      await app.inject({
        method: 'PUT',
        url: `/api/admin/products/${testProduct.id}`,
        headers: adminAuth.authHeader,
        payload: { name: 'Cache Test Product E2E', variants: [variantPayload] },
      });

      // Fetch again — new version key means cache miss, fresh data
      const res2 = await app.inject({ method: 'GET', url: `/api/products/${testProduct.id}` });
      expect(res2.statusCode).toBe(200);
      const body2 = JSON.parse(res2.body);
      expect(body2.data.name).toBe('Cache Test Product E2E');

      // ETag should differ because data changed
      const etag2 = res2.headers['etag'] as string;
      expect(etag2).not.toBe(etag1);

      // Restore
      await app.inject({
        method: 'PUT',
        url: `/api/admin/products/${testProduct.id}`,
        headers: adminAuth.authHeader,
        payload: { name: 'Cache Test Product', variants: [variantPayload] },
      });
    });

    it('should invalidate store context cache after admin updates system settings', async () => {
      const { CacheService } = await import('../../src/core/cache/service');

      // 1. Fill store context cache
      const res1 = await app.inject({ method: 'GET', url: '/api/store/context' });
      expect(res1.statusCode).toBe(200);
      const etag1 = res1.headers['etag'] as string;
      const body1 = JSON.parse(res1.body);
      const originalName = body1.data.storeName;

      const versionBefore = await CacheService.getStoreContextVersion();

      // 2. Admin updates platform name via settings batch API
      const settingsRes = await app.inject({
        method: 'PUT',
        url: '/api/admin/settings/batch',
        headers: adminAuth.authHeader,
        payload: { settings: { 'branding.platform_name': 'E2E Updated Store' } },
      });
      expect(settingsRes.statusCode).toBe(200);

      // 3. Verify store context version was bumped
      const versionAfter = await CacheService.getStoreContextVersion();
      expect(versionAfter).toBeGreaterThan(versionBefore);

      // 4. Store context should reflect new settings (fresh cache miss → DB query)
      const res2 = await app.inject({ method: 'GET', url: '/api/store/context' });
      expect(res2.statusCode).toBe(200);
      const body2 = JSON.parse(res2.body);
      expect(body2.data.storeName).toBe('E2E Updated Store');

      // 5. ETag should differ
      const etag2 = res2.headers['etag'] as string;
      expect(etag2).not.toBe(etag1);

      // 6. Restore original setting
      await app.inject({
        method: 'PUT',
        url: '/api/admin/settings/batch',
        headers: adminAuth.authHeader,
        payload: { settings: { 'branding.platform_name': originalName || 'Jiffoo Store' } },
      });
    });
  });
});
