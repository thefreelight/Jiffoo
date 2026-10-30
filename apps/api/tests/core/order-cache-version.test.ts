import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/core/cache/redis', () => ({
  redisCache: {
    incr: vi.fn(),
    deleteByPattern: vi.fn(),
  },
}));

import { redisCache } from '@/core/cache/redis';
import { CacheService } from '@/core/cache/service';

const incr = vi.mocked(redisCache.incr);
const deleteByPattern = vi.mocked(redisCache.deleteByPattern);

describe('The version of the cached order lists', () => {
  beforeEach(() => {
    incr.mockReset();
    deleteByPattern.mockReset();
    deleteByPattern.mockResolvedValue(0);
  });

  it('reports a lost bump instead of pretending that the version advanced', async () => {
    incr.mockResolvedValue(null);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      const version = await CacheService.incrementOrderVersion();

      expect(version).toBeNull();
      // The stale lists are dropped, so a reader repopulates them from the
      // database instead of serving them for their whole time to live.
      expect(deleteByPattern).toHaveBeenCalledWith('order:*');
      // The failure is recorded in a structured way.
      expect(warn).toHaveBeenCalledTimes(1);
      const record = JSON.parse(String(warn.mock.calls[0][0])) as Record<string, unknown>;
      expect(record.event).toBe('order_cache_version_increment_failed');
      expect(record.key).toBe('order:version');
    } finally {
      warn.mockRestore();
    }
  });

  it('reports the new version of a bump that reached the cache', async () => {
    incr.mockResolvedValue(7);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    try {
      const version = await CacheService.incrementOrderVersion();

      expect(version).toBe(7);
      expect(deleteByPattern).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
