import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const { prismaMock, syncUIMock, getUIMock } = vi.hoisted(() => ({
  prismaMock: {
    uITranslation: {
      upsert: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  },
  syncUIMock: vi.fn().mockResolvedValue(undefined),
  getUIMock: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('../../src/lib/redis', () => ({
  syncUIToRedis: syncUIMock,
  getUIFromRedis: getUIMock,
}));

import { UITranslationService } from '../../src/services/ui-translation.service';

describe('UITranslationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // setTranslation
  // ==========================================================================

  describe('setTranslation', () => {
    it('upserts a single UI string and syncs to Redis', async () => {
      prismaMock.uITranslation.findMany.mockResolvedValue([
        { key: 'btn.save', value: 'Save' },
      ]);

      await UITranslationService.setTranslation('en', 'common', 'btn.save', 'Save');

      expect(prismaMock.uITranslation.upsert).toHaveBeenCalledWith({
        where: { locale_namespace_key: { locale: 'en', namespace: 'common', key: 'btn.save' } },
        update: { value: 'Save' },
        create: { locale: 'en', namespace: 'common', key: 'btn.save', value: 'Save' },
      });

      expect(syncUIMock).toHaveBeenCalledWith('en', 'common', { 'btn.save': 'Save' });
    });
  });

  // ==========================================================================
  // setTranslations (bulk)
  // ==========================================================================

  describe('setTranslations', () => {
    it('upserts multiple entries in a transaction and syncs to Redis', async () => {
      prismaMock.uITranslation.upsert.mockResolvedValue({});
      prismaMock.uITranslation.findMany.mockResolvedValue([
        { key: 'btn.save', value: 'Save' },
        { key: 'btn.cancel', value: 'Cancel' },
      ]);

      await UITranslationService.setTranslations('en', 'common', {
        'btn.save': 'Save',
        'btn.cancel': 'Cancel',
      });

      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(syncUIMock).toHaveBeenCalledWith('en', 'common', {
        'btn.save': 'Save',
        'btn.cancel': 'Cancel',
      });
    });
  });

  // ==========================================================================
  // getTranslations
  // ==========================================================================

  describe('getTranslations', () => {
    it('returns a key-value map for locale+namespace', async () => {
      prismaMock.uITranslation.findMany.mockResolvedValue([
        { key: 'btn.save', value: 'Save' },
        { key: 'btn.cancel', value: 'Cancel' },
      ]);

      const result = await UITranslationService.getTranslations('en', 'common');

      expect(result).toEqual({ 'btn.save': 'Save', 'btn.cancel': 'Cancel' });
    });

    it('returns empty object when no translations exist', async () => {
      prismaMock.uITranslation.findMany.mockResolvedValue([]);

      const result = await UITranslationService.getTranslations('fr', 'shop');

      expect(result).toEqual({});
    });
  });

  // ==========================================================================
  // getAllTranslations
  // ==========================================================================

  describe('getAllTranslations', () => {
    it('returns translations grouped by namespace', async () => {
      prismaMock.uITranslation.findMany.mockResolvedValue([
        { namespace: 'common', key: 'btn.save', value: 'Save' },
        { namespace: 'common', key: 'btn.cancel', value: 'Cancel' },
        { namespace: 'shop', key: 'cart.title', value: 'Cart' },
      ]);

      const result = await UITranslationService.getAllTranslations('en');

      expect(result).toEqual({
        common: { 'btn.save': 'Save', 'btn.cancel': 'Cancel' },
        shop: { 'cart.title': 'Cart' },
      });
    });

    it('returns empty object when no translations exist', async () => {
      prismaMock.uITranslation.findMany.mockResolvedValue([]);

      const result = await UITranslationService.getAllTranslations('xx');

      expect(result).toEqual({});
    });
  });

  // ==========================================================================
  // deleteTranslation
  // ==========================================================================

  describe('deleteTranslation', () => {
    it('deletes a single translation and syncs to Redis', async () => {
      prismaMock.uITranslation.delete.mockResolvedValue({});
      prismaMock.uITranslation.findMany.mockResolvedValue([]);

      const ok = await UITranslationService.deleteTranslation('en', 'common', 'btn.save');

      expect(ok).toBe(true);
      expect(prismaMock.uITranslation.delete).toHaveBeenCalledWith({
        where: { locale_namespace_key: { locale: 'en', namespace: 'common', key: 'btn.save' } },
      });
      expect(syncUIMock).toHaveBeenCalled();
    });

    it('returns false when delete fails (record not found)', async () => {
      prismaMock.uITranslation.delete.mockRejectedValue(new Error('Not found'));

      const ok = await UITranslationService.deleteTranslation('en', 'common', 'nonexistent');

      expect(ok).toBe(false);
    });
  });

  // ==========================================================================
  // deleteAll
  // ==========================================================================

  describe('deleteAll', () => {
    it('deletes all translations for a locale+namespace', async () => {
      prismaMock.uITranslation.deleteMany.mockResolvedValue({ count: 5 });
      prismaMock.uITranslation.findMany.mockResolvedValue([]);

      const count = await UITranslationService.deleteAll('en', 'common');

      expect(count).toBe(5);
      expect(prismaMock.uITranslation.deleteMany).toHaveBeenCalledWith({
        where: { locale: 'en', namespace: 'common' },
      });
    });

    it('deletes all translations for a locale (all namespaces)', async () => {
      // First call for distinct namespaces, second call after deleteMany for sync
      prismaMock.uITranslation.findMany
        .mockResolvedValueOnce([{ namespace: 'common' }, { namespace: 'shop' }])
        .mockResolvedValueOnce([]) // sync for 'common'
        .mockResolvedValueOnce([]); // sync for 'shop'

      prismaMock.uITranslation.deleteMany.mockResolvedValue({ count: 10 });

      const count = await UITranslationService.deleteAll('en');

      expect(count).toBe(10);
      expect(prismaMock.uITranslation.deleteMany).toHaveBeenCalledWith({
        where: { locale: 'en' },
      });
    });
  });

  // ==========================================================================
  // getCachedTranslations
  // ==========================================================================

  describe('getCachedTranslations', () => {
    it('returns cached translations from Redis on cache hit', async () => {
      getUIMock.mockResolvedValue({ 'btn.save': 'Save' });

      const result = await UITranslationService.getCachedTranslations('en', 'common');

      expect(result).toEqual({ 'btn.save': 'Save' });
      expect(prismaMock.uITranslation.findMany).not.toHaveBeenCalled();
    });

    it('falls back to DB and populates Redis on cache miss', async () => {
      getUIMock.mockResolvedValue(null);
      prismaMock.uITranslation.findMany.mockResolvedValue([
        { key: 'btn.save', value: 'Save' },
      ]);

      const result = await UITranslationService.getCachedTranslations('en', 'common');

      expect(result).toEqual({ 'btn.save': 'Save' });
      expect(syncUIMock).toHaveBeenCalledWith('en', 'common', { 'btn.save': 'Save' });
    });

    it('does not sync empty results to Redis on cache miss', async () => {
      getUIMock.mockResolvedValue(null);
      prismaMock.uITranslation.findMany.mockResolvedValue([]);

      const result = await UITranslationService.getCachedTranslations('en', 'common');

      expect(result).toEqual({});
      expect(syncUIMock).not.toHaveBeenCalled();
    });
  });
});
