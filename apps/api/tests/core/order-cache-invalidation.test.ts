import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { redisCache } from '@/core/cache/redis';
import { CacheService } from '@/core/cache/service';

/** Connects the cache client when it is not connected yet. */
async function connectCache(): Promise<void> {
  if (!redisCache.getConnectionStatus()) await redisCache.connect();
}

/** Waits until a condition of the cache holds. */
async function waitFor(check: () => Promise<boolean>, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await check()) return;
    if (Date.now() >= deadline) throw new Error('The condition of the cache was not met in time');
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

afterEach(async () => {
  await connectCache();
});

describe('The invalidation of the cached order lists', () => {
  it('completes the invalidation that was lost while the cache was unreachable', async () => {
    await connectCache();

    // A list of the order cache that a reader would find stale.
    const stale = `order:list:stale-${randomUUID()}`;
    await redisCache.set(stale, { items: [] }, 600);
    expect(await redisCache.get(stale)).not.toBeNull();

    // The cache becomes unreachable: the bump fails and the invalidation
    // cannot run.
    await redisCache.disconnect();
    const version = await CacheService.incrementOrderVersion({ scope: 'test', reference: 'stale-window' });
    expect(version).toBeNull();

    // The cache is reachable again: the deferred invalidation runs and the
    // stale list is gone.
    await redisCache.connect();
    await waitFor(async () => (await redisCache.get(stale)) === null);
    expect(await redisCache.get(stale)).toBeNull();
  });

  it('bounds the staleness of a cached order list with a time to live of two minutes', async () => {
    await connectCache();
    const set = vi.spyOn(redisCache, 'set');
    try {
      await CacheService.setOrderList(1, 20, { items: [], page: 1, limit: 20, total: 0, totalPages: 0 }, { status: undefined });
      // The time to live is the upper bound of the staleness a reader can
      // see when a write lost its bump.
      expect(set.mock.calls[0][2]).toBe(120);
    } finally {
      set.mockRestore();
    }
  });
});
