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

vi.mock('@/utils/prisma-errors', () => ({
  isMissingDatabaseObjectError: vi.fn(() => true),
}));

vi.mock('@/utils/response', () => ({
  sendError: vi.fn(),
}));

import { prisma } from '@/config/database';
import { CacheService } from '@/core/cache/service';
import { LoggerService } from '@/core/logger/unified-logger';

// Use dynamic import so we can reset modules between tests
let storeContextMiddleware: any;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  (CacheService.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  (CacheService.set as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  const mod = await import('@/middleware/store-context');
  storeContextMiddleware = mod.storeContextMiddleware;
});

describe('storeContextMiddleware', () => {
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
