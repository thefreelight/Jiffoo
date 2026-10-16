import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createHash, randomUUID } from 'node:crypto';
import { createTestApp } from '../helpers/create-test-app';
import { getTestPrisma } from '../helpers/db';
import { createTestProduct } from '../helpers/fixtures';
import { redisCache } from '@/core/cache/redis';
import { CacheService } from '@/core/cache/service';

describe('Public product ordering with real Redis caching', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await createTestApp({ disableRedis: false });
    await redisCache.connect();
  });
  afterAll(async () => { await app.close(); await redisCache.disconnect(); });

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
