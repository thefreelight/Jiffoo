import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const { prismaMock, syncContentMock, removeContentMock } = vi.hoisted(() => ({
  prismaMock: {
    contentTranslation: {
      upsert: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  },
  syncContentMock: vi.fn().mockResolvedValue(undefined),
  removeContentMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('../../src/lib/redis', () => ({
  syncContentToRedis: syncContentMock,
  removeContentFromRedis: removeContentMock,
}));

import { ContentTranslationService } from '../../src/services/content-translation.service';

describe('ContentTranslationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // setTranslation
  // ==========================================================================

  describe('setTranslation', () => {
    it('upserts a single field translation and syncs to Redis', async () => {
      prismaMock.contentTranslation.findMany.mockResolvedValue([
        { field: 'name', value: 'Test Product' },
      ]);

      await ContentTranslationService.setTranslation({
        entityType: 'product',
        entityId: 'prod-1',
        locale: 'zh-Hant',
        field: 'name',
        value: 'Test Product',
      });

      expect(prismaMock.contentTranslation.upsert).toHaveBeenCalledWith({
        where: {
          entityType_entityId_locale_field: {
            entityType: 'product',
            entityId: 'prod-1',
            locale: 'zh-Hant',
            field: 'name',
          },
        },
        update: { value: 'Test Product', sourceDigest: null },
        create: {
          entityType: 'product',
          entityId: 'prod-1',
          locale: 'zh-Hant',
          field: 'name',
          value: 'Test Product',
          sourceDigest: null,
        },
      });

      expect(syncContentMock).toHaveBeenCalledWith(
        'product',
        'prod-1',
        'zh-Hant',
        { name: 'Test Product' }
      );
    });

    it('stores sourceDigest when provided', async () => {
      prismaMock.contentTranslation.findMany.mockResolvedValue([]);

      await ContentTranslationService.setTranslation({
        entityType: 'product',
        entityId: 'prod-1',
        locale: 'en',
        field: 'name',
        value: 'Hello',
        sourceDigest: 'abc123',
      });

      expect(prismaMock.contentTranslation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ sourceDigest: 'abc123' }),
          create: expect.objectContaining({ sourceDigest: 'abc123' }),
        })
      );
    });
  });

  // ==========================================================================
  // setTranslations (bulk)
  // ==========================================================================

  describe('setTranslations', () => {
    it('upserts multiple fields in a transaction and syncs to Redis', async () => {
      prismaMock.contentTranslation.upsert.mockResolvedValue({});
      prismaMock.contentTranslation.findMany.mockResolvedValue([
        { field: 'name', value: 'Name' },
        { field: 'description', value: 'Desc' },
      ]);

      await ContentTranslationService.setTranslations({
        entityType: 'product',
        entityId: 'prod-1',
        locale: 'zh-Hant',
        fields: { name: 'Name', description: 'Desc' },
      });

      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(syncContentMock).toHaveBeenCalledWith(
        'product',
        'prod-1',
        'zh-Hant',
        { name: 'Name', description: 'Desc' }
      );
    });

    it('uses sourceDigests for individual fields', async () => {
      prismaMock.contentTranslation.upsert.mockResolvedValue({});
      prismaMock.contentTranslation.findMany.mockResolvedValue([]);

      await ContentTranslationService.setTranslations({
        entityType: 'product',
        entityId: 'prod-1',
        locale: 'zh-Hant',
        fields: { name: 'Name' },
        sourceDigests: { name: 'digest123' },
      });

      // Verify the upsert was called with the digest
      expect(prismaMock.contentTranslation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ sourceDigest: 'digest123' }),
        })
      );
    });
  });

  // ==========================================================================
  // getTranslations
  // ==========================================================================

  describe('getTranslations', () => {
    it('returns a field-value map for an entity+locale', async () => {
      prismaMock.contentTranslation.findMany.mockResolvedValue([
        { field: 'name', value: 'Product Name' },
        { field: 'description', value: 'Product Desc' },
      ]);

      const result = await ContentTranslationService.getTranslations(
        'product',
        'prod-1',
        'zh-Hant'
      );

      expect(result).toEqual({ name: 'Product Name', description: 'Product Desc' });
      expect(prismaMock.contentTranslation.findMany).toHaveBeenCalledWith({
        where: { entityType: 'product', entityId: 'prod-1', locale: 'zh-Hant' },
      });
    });

    it('returns empty object when no translations exist', async () => {
      prismaMock.contentTranslation.findMany.mockResolvedValue([]);

      const result = await ContentTranslationService.getTranslations(
        'product',
        'prod-999',
        'en'
      );

      expect(result).toEqual({});
    });
  });

  // ==========================================================================
  // deleteTranslations
  // ==========================================================================

  describe('deleteTranslations', () => {
    it('deletes by entityType+entityId and removes from Redis', async () => {
      prismaMock.contentTranslation.deleteMany.mockResolvedValue({ count: 3 });

      const count = await ContentTranslationService.deleteTranslations(
        'product',
        'prod-1'
      );

      expect(count).toBe(3);
      expect(prismaMock.contentTranslation.deleteMany).toHaveBeenCalledWith({
        where: { entityType: 'product', entityId: 'prod-1' },
      });
      expect(removeContentMock).toHaveBeenCalledWith('product', 'prod-1', undefined);
    });

    it('filters by locale when provided', async () => {
      prismaMock.contentTranslation.deleteMany.mockResolvedValue({ count: 1 });

      const count = await ContentTranslationService.deleteTranslations(
        'product',
        'prod-1',
        'zh-Hant'
      );

      expect(count).toBe(1);
      expect(prismaMock.contentTranslation.deleteMany).toHaveBeenCalledWith({
        where: { entityType: 'product', entityId: 'prod-1', locale: 'zh-Hant' },
      });
      expect(removeContentMock).toHaveBeenCalledWith('product', 'prod-1', 'zh-Hant');
    });
  });

  // ==========================================================================
  // computeDigest
  // ==========================================================================

  describe('computeDigest', () => {
    it('returns a 16-character hex string', () => {
      const digest = ContentTranslationService.computeDigest('hello world');
      expect(digest).toHaveLength(16);
      expect(digest).toMatch(/^[a-f0-9]{16}$/);
    });

    it('returns the same digest for the same input', () => {
      const a = ContentTranslationService.computeDigest('test');
      const b = ContentTranslationService.computeDigest('test');
      expect(a).toBe(b);
    });

    it('returns different digests for different inputs', () => {
      const a = ContentTranslationService.computeDigest('hello');
      const b = ContentTranslationService.computeDigest('world');
      expect(a).not.toBe(b);
    });
  });

  // ==========================================================================
  // getBatchTranslations
  // ==========================================================================

  describe('getBatchTranslations', () => {
    it('returns a Map of entityId to field-value maps', async () => {
      prismaMock.contentTranslation.findMany.mockResolvedValue([
        { entityId: 'prod-1', field: 'name', value: 'Product 1' },
        { entityId: 'prod-1', field: 'description', value: 'Desc 1' },
        { entityId: 'prod-2', field: 'name', value: 'Product 2' },
      ]);

      const result = await ContentTranslationService.getBatchTranslations(
        'product',
        ['prod-1', 'prod-2'],
        'zh-Hant'
      );

      expect(result).toBeInstanceOf(Map);
      expect(result.get('prod-1')).toEqual({ name: 'Product 1', description: 'Desc 1' });
      expect(result.get('prod-2')).toEqual({ name: 'Product 2' });
    });
  });

  // ==========================================================================
  // listTranslatedEntities
  // ==========================================================================

  describe('listTranslatedEntities', () => {
    it('returns paginated entity IDs', async () => {
      prismaMock.contentTranslation.findMany.mockResolvedValue([
        { entityId: 'prod-1' },
        { entityId: 'prod-2' },
      ]);
      prismaMock.contentTranslation.groupBy.mockResolvedValue([
        { entityId: 'prod-1' },
        { entityId: 'prod-2' },
      ]);

      const result = await ContentTranslationService.listTranslatedEntities(
        'product',
        'zh-Hant',
        1,
        50
      );

      expect(result.items).toEqual(['prod-1', 'prod-2']);
      expect(result.total).toBe(2);
      expect(result.totalPages).toBe(1);
    });
  });

  // ==========================================================================
  // getCompleteness
  // ==========================================================================

  describe('getCompleteness', () => {
    it('returns entity count for a type+locale', async () => {
      prismaMock.contentTranslation.groupBy.mockResolvedValue([
        { entityId: 'prod-1' },
        { entityId: 'prod-2' },
        { entityId: 'prod-3' },
      ]);

      const result = await ContentTranslationService.getCompleteness('product', 'zh-Hant');

      expect(result).toEqual({
        entityType: 'product',
        locale: 'zh-Hant',
        translatedEntities: 3,
      });
    });
  });
});
