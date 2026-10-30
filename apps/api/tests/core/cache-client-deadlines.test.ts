import { afterEach, describe, expect, it, vi } from 'vitest';
import { cacheConnectBudgetMs, redisCache } from '@/core/cache/redis';

/** The characters of an emoji, which the records of the project never carry. */
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;

/** Connects the cache client when it is not connected yet. */
async function connectCache(): Promise<void> {
  if (!redisCache.getConnectionStatus()) await redisCache.connect();
}

afterEach(async () => {
  await connectCache();
});

describe('The cache client', () => {
  it('bounds the wait for a Redis that stopped answering, so a read misses instead of hanging', () => {
    const options = redisCache.getRawClient().options;

    // The connect attempt and every command have a deadline.
    expect(options.connectTimeout).toBe(5_000);
    expect(options.commandTimeout).toBe(5_000);

    // The offline queue is disabled: a command that is issued while the
    // client is not connected fails at once instead of waiting for a
    // connection that may never come.
    expect(options.enableOfflineQueue).toBe(false);
    expect(options.maxRetriesPerRequest).toBe(0);
    expect(options.autoResendUnfulfilledCommands).toBe(false);
  });

  it('bounds the startup connection with a budget of ten seconds', () => {
    const original = process.env.REDIS_CONNECT_BUDGET_MS;
    try {
      delete process.env.REDIS_CONNECT_BUDGET_MS;
      expect(cacheConnectBudgetMs()).toBe(10_000);

      // A deployment that knows its own cache adjusts the budget.
      process.env.REDIS_CONNECT_BUDGET_MS = '5000';
      expect(cacheConnectBudgetMs()).toBe(5_000);

      // A budget that makes no sense never replaces the default.
      process.env.REDIS_CONNECT_BUDGET_MS = 'not-a-number';
      expect(cacheConnectBudgetMs()).toBe(10_000);
    } finally {
      if (original === undefined) delete process.env.REDIS_CONNECT_BUDGET_MS;
      else process.env.REDIS_CONNECT_BUDGET_MS = original;
    }
  });

  it('records the close of the connection as a structured record without an emoji', async () => {
    await connectCache();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      await redisCache.disconnect();
      // The close of the connection is reported on the next tick.
      await new Promise(resolve => setTimeout(resolve, 50));
      const record = warn.mock.calls.map(call => String(call[0])).find(line => line.includes('cache_redis_closed'));
      expect(record).toBeDefined();
      const parsed = JSON.parse(String(record)) as Record<string, unknown>;
      expect(parsed.event).toBe('cache_redis_closed');
      expect(parsed.scope).toBe('cache');
      expect(String(record)).not.toMatch(EMOJI);
    } finally {
      warn.mockRestore();
      await connectCache();
    }
  });

  it('tells an unreachable cache apart from a pattern that matched no key', async () => {
    await connectCache();

    // The cache is reachable and the pattern matches no key.
    const cleared = await redisCache.deleteByPattern('order:no-such-entry-*');
    expect(cleared).toBe(0);

    // The cache is unreachable: the pattern was not scanned at all, which is
    // not the same as a pattern that matched no key.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      await redisCache.disconnect();
      const unreachable = await redisCache.deleteByPattern('order:no-such-entry-*');
      expect(unreachable).toBeNull();
      const record = warn.mock.calls.map(call => String(call[0])).find(line => line.includes('cache_redis_delete_pattern_unavailable'));
      expect(record).toBeDefined();
      const parsed = JSON.parse(String(record)) as Record<string, unknown>;
      expect(parsed.event).toBe('cache_redis_delete_pattern_unavailable');
      expect(parsed.scope).toBe('cache');
      expect(String(record)).not.toMatch(EMOJI);
    } finally {
      warn.mockRestore();
      await connectCache();
    }
  });
});
