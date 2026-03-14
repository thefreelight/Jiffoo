import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/config/database', () => ({
  prisma: {
    store: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/core/cache/service', () => ({
  CacheService: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('@/core/logger/unified-logger', () => ({
  LoggerService: {
    log: vi.fn(),
  },
}));

import { prisma } from '@/config/database';
import { CacheService } from '@/core/cache/service';
import { LoggerService } from '@/core/logger/unified-logger';
import { storeContextMiddleware } from '@/middleware/store-context';

describe('storeContextMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (CacheService.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (CacheService.set as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  it('falls back when the default store table is unavailable', async () => {
    (prisma.store.findUnique as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('The table `public.stores` does not exist in the current database.')
    );

    const request = {
      headers: {},
    } as any;
    const reply = {
      code: vi.fn(),
      send: vi.fn(),
      status: vi.fn(),
      header: vi.fn(),
    } as any;

    await storeContextMiddleware(request, reply);

    expect(request.storeContext).toBeUndefined();
    expect(LoggerService.log).toHaveBeenCalledWith(
      'warn',
      'Store schema unavailable; continuing without store context',
      expect.objectContaining({
        context: 'storeContextMiddleware',
      })
    );
    expect(reply.code).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });

  it('falls back when the default store query hits a missing column error', async () => {
    (prisma.store.findUnique as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('The column `stores.domain` does not exist in the current database.')
    );

    const request = {
      headers: {},
    } as any;
    const reply = {
      code: vi.fn(),
      send: vi.fn(),
      status: vi.fn(),
      header: vi.fn(),
    } as any;

    await storeContextMiddleware(request, reply);

    expect(request.storeContext).toBeUndefined();
    expect(LoggerService.log).toHaveBeenCalledWith(
      'warn',
      'Store schema unavailable; continuing without store context',
      expect.objectContaining({
        context: 'storeContextMiddleware',
      })
    );
    expect(reply.code).not.toHaveBeenCalled();
    expect(reply.send).not.toHaveBeenCalled();
  });
});
