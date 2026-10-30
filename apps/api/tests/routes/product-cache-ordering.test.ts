import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createHash, randomUUID } from 'node:crypto';
import { createTestApp } from '../helpers/create-test-app';
import { getTestPrisma } from '../helpers/db';
import { createTestProduct } from '../helpers/fixtures';
import { redisCache } from '@/core/cache/redis';
import { CacheService } from '@/core/cache/service';
import { AdminProductService } from '@/core/admin/product-management/service';

describe('Public product ordering with real Redis caching', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await createTestApp({ disableRedis: false });
    await redisCache.connect();
  });
  afterAll(async () => { await app.close(); await redisCache.disconnect(); });

  it('caches active category counts and refreshes them after product visibility changes', async () => {
    const db = getTestPrisma();
    const category = await db.category.create({ data: { name: 'Cached visibility', slug: `cached-visibility-${randomUUID()}`, sortOrder: -10000 } });
    const ids: string[] = [];
    const keys = new Set<string>();
    try {
      const active = await createTestProduct({ name: 'Active category count', category: category.id });
      ids.push(active.id);
      const hidden = await createTestProduct({ name: 'Hidden category count', category: category.id });
      ids.push(hidden.id);
      await AdminProductService.updateProduct(hidden.id, { isActive: false });
      const readCount = async (expected: number) => {
        const version = await CacheService.getProductVersion();
        const key = `pub:products:categories:v${version}:en:1:100`;
        keys.add(key);
        for (let attempt = 0; attempt < 2; attempt++) {
          const response = await app.inject({ method: 'GET', url: '/api/v1/products/categories?locale=en&limit=100' });
          expect(response.statusCode).toBe(200);
          expect(response.json().data.items.find((item: { id: string }) => item.id === category.id)?.productCount).toBe(expected);
          const cached = await CacheService.get<{ items: Array<{ id: string; productCount: number }> }>(key);
          expect(cached?.items.find((item) => item.id === category.id)?.productCount).toBe(expected);
        }
      };
      await readCount(1);
      await AdminProductService.updateProduct(hidden.id, { isActive: true });
      await readCount(2);
      await AdminProductService.updateProduct(active.id, { isActive: false });
      await readCount(1);
      expect(keys.size).toBe(3);
    } finally {
      await db.product.deleteMany({ where: { id: { in: ids } } });
      await db.category.delete({ where: { id: category.id } });
      await CacheService.incrementProductVersion();
      await Promise.all([...keys].map((key) => CacheService.delete(key)));
    }
  });

  it('returns both category sort orders back to back and serves each warm cache entry', async () => {
    const db = getTestPrisma();
    const category = await db.category.create({ data: { name: 'Cache ordering', slug: `cache-ordering-${randomUUID()}` } });
    await createTestProduct({ name: 'Alpha ordering', category: category.id });
    await createTestProduct({ name: 'Zeta ordering', category: category.id });
    const version = await CacheService.getProductVersion();
    const keys: string[] = [];
    try {
      for (const sortOrder of ['asc', 'desc', 'asc'] as const) {
        const filter = JSON.stringify({ category: category.id, sortBy: 'name', sortOrder });
        const key = `pub:products:list:v${version}:en:1:12:${createHash('sha256').update(filter).digest('hex')}`;
        keys.push(key);
        const expected = sortOrder === 'asc' ? ['Alpha ordering', 'Zeta ordering'] : ['Zeta ordering', 'Alpha ordering'];
        const response = await app.inject({ method: 'GET', url: `/api/v1/products/?category=${category.id}&sortBy=name&sortOrder=${sortOrder}&locale=en&limit=12` });
        expect(response.statusCode).toBe(200);
        expect(response.json().data.items.map((item: { name: string }) => item.name)).toEqual(expected);
        const cached = await CacheService.get<{ items: Array<{ name: string }> }>(key);
        expect(cached?.items.map((item) => item.name)).toEqual(expected);
      }
      expect(keys[0]).not.toBe(keys[1]); expect(keys[0]).toBe(keys[2]);
    } finally {
      await Promise.all([...new Set(keys)].map((key) => CacheService.delete(key)));
    }
  });
});
