import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const { prismaMock, contentServiceMock, uiServiceMock } = vi.hoisted(() => ({
  prismaMock: {
    contentTranslation: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    uITranslation: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
    },
  },
  contentServiceMock: {
    setTranslation: vi.fn().mockResolvedValue(undefined),
    setTranslations: vi.fn().mockResolvedValue(undefined),
    getTranslations: vi.fn().mockResolvedValue({}),
  },
  uiServiceMock: {
    setTranslation: vi.fn().mockResolvedValue(undefined),
    setTranslations: vi.fn().mockResolvedValue(undefined),
    getTranslations: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('../../src/services/content-translation.service', () => ({
  ContentTranslationService: contentServiceMock,
}));

vi.mock('../../src/services/ui-translation.service', () => ({
  UITranslationService: uiServiceMock,
}));

// Mock redis to prevent actual connections
vi.mock('../../src/lib/redis', () => ({
  syncContentToRedis: vi.fn(),
  removeContentFromRedis: vi.fn(),
  syncUIToRedis: vi.fn(),
  getUIFromRedis: vi.fn(),
  syncLocalesToRedis: vi.fn(),
}));

import { ImportExportService } from '../../src/services/import-export.service';

describe('ImportExportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Content CSV Export
  // ==========================================================================

  describe('exportContentCSV', () => {
    it('exports with BOM prefix and correct header', async () => {
      prismaMock.contentTranslation.findMany.mockResolvedValue([]);

      const csv = await ImportExportService.exportContentCSV();

      expect(csv.startsWith('\uFEFF')).toBe(true);
      expect(csv).toContain('entityType,entityId,locale,field,value,sourceDigest');
    });

    it('exports data rows with proper escaping', async () => {
      prismaMock.contentTranslation.findMany
        .mockResolvedValueOnce([
          {
            id: '1',
            entityType: 'product',
            entityId: 'prod-1',
            locale: 'zh-Hant',
            field: 'name',
            value: 'Test, "Product"',
            sourceDigest: 'abc',
          },
        ])
        .mockResolvedValueOnce([]);

      const csv = await ImportExportService.exportContentCSV();
      const lines = csv.split('\n');

      expect(lines).toHaveLength(2);
      // Value should be quote-escaped: "Test, ""Product"""
      expect(lines[1]).toContain('"Test, ""Product"""');
    });

    it('filters by entityType and locale', async () => {
      prismaMock.contentTranslation.findMany.mockResolvedValue([]);

      await ImportExportService.exportContentCSV('product', 'zh-Hant');

      expect(prismaMock.contentTranslation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { entityType: 'product', locale: 'zh-Hant' },
        })
      );
    });
  });

  // ==========================================================================
  // Content CSV Import
  // ==========================================================================

  describe('importContentCSV', () => {
    it('returns error when CSV has no data rows', async () => {
      const result = await ImportExportService.importContentCSV('entityType');

      expect(result.imported).toBe(0);
      expect(result.errors).toContain('CSV has no data rows');
    });

    it('returns error when required columns are missing', async () => {
      const csv = 'col1,col2\nval1,val2';

      const result = await ImportExportService.importContentCSV(csv);

      expect(result.imported).toBe(0);
      expect(result.errors[0]).toContain('Missing required columns');
    });

    it('imports valid rows successfully', async () => {
      const csv =
        'entityType,entityId,locale,field,value,sourceDigest\n' +
        'product,prod-1,zh-Hant,name,Product Name,abc123';

      const result = await ImportExportService.importContentCSV(csv, { overwrite: true });

      expect(result.imported).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(contentServiceMock.setTranslation).toHaveBeenCalledWith({
        entityType: 'product',
        entityId: 'prod-1',
        locale: 'zh-Hant',
        field: 'name',
        value: 'Product Name',
        sourceDigest: 'abc123',
      });
    });

    it('skips existing translations when overwrite is false', async () => {
      prismaMock.contentTranslation.findUnique.mockResolvedValue({ id: 'existing' });

      const csv =
        'entityType,entityId,locale,field,value\n' +
        'product,prod-1,zh-Hant,name,New Name';

      const result = await ImportExportService.importContentCSV(csv);

      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(1);
    });

    it('handles BOM in header', async () => {
      const csv =
        '\uFEFFentityType,entityId,locale,field,value\n' +
        'product,prod-1,zh-Hant,name,Name';

      const result = await ImportExportService.importContentCSV(csv, { overwrite: true });

      expect(result.imported).toBe(1);
    });

    it('reports rows with missing fields as errors', async () => {
      const csv =
        'entityType,entityId,locale,field,value\n' +
        'product,,zh-Hant,name,Name';

      const result = await ImportExportService.importContentCSV(csv, { overwrite: true });

      expect(result.imported).toBe(0);
      expect(result.errors[0]).toContain('missing required field');
    });
  });

  // ==========================================================================
  // Content JSON Export
  // ==========================================================================

  describe('exportContentJSON', () => {
    it('returns structured JSON grouped by entity and locale', async () => {
      prismaMock.contentTranslation.findMany
        .mockResolvedValueOnce([
          { id: '1', entityType: 'product', entityId: 'prod-1', locale: 'zh-Hant', field: 'name', value: 'Name' },
          { id: '2', entityType: 'product', entityId: 'prod-1', locale: 'zh-Hant', field: 'description', value: 'Desc' },
        ])
        .mockResolvedValueOnce([]);

      const result = await ImportExportService.exportContentJSON();

      expect(result).toEqual({
        'product:prod-1': {
          'zh-Hant': { name: 'Name', description: 'Desc' },
        },
      });
    });
  });

  // ==========================================================================
  // Content JSON Import
  // ==========================================================================

  describe('importContentJSON', () => {
    it('imports valid JSON data with overwrite', async () => {
      const data = {
        'product:prod-1': {
          'zh-Hant': { name: 'Name', description: 'Desc' },
        },
      };

      const result = await ImportExportService.importContentJSON(data, { overwrite: true });

      expect(result.imported).toBe(2);
      expect(contentServiceMock.setTranslations).toHaveBeenCalledWith({
        entityType: 'product',
        entityId: 'prod-1',
        locale: 'zh-Hant',
        fields: { name: 'Name', description: 'Desc' },
      });
    });

    it('skips existing fields when overwrite is false', async () => {
      contentServiceMock.getTranslations.mockResolvedValue({ name: 'Old Name' });

      const data = {
        'product:prod-1': {
          'zh-Hant': { name: 'New Name', description: 'New Desc' },
        },
      };

      const result = await ImportExportService.importContentJSON(data);

      expect(result.imported).toBe(1); // only description
      expect(result.skipped).toBe(1); // name was skipped
    });

    it('reports error for invalid composite keys', async () => {
      const data = {
        'invalid-key': {
          en: { name: 'Name' },
        },
      } as any;

      const result = await ImportExportService.importContentJSON(data);

      expect(result.errors[0]).toContain('Invalid key');
    });
  });

  // ==========================================================================
  // UI CSV Export
  // ==========================================================================

  describe('exportUICSV', () => {
    it('exports with BOM prefix and correct header', async () => {
      prismaMock.uITranslation.findMany.mockResolvedValue([]);

      const csv = await ImportExportService.exportUICSV();

      expect(csv.startsWith('\uFEFF')).toBe(true);
      expect(csv).toContain('locale,namespace,key,value');
    });

    it('exports UI translation rows', async () => {
      prismaMock.uITranslation.findMany
        .mockResolvedValueOnce([
          { id: '1', locale: 'en', namespace: 'common', key: 'btn.save', value: 'Save' },
        ])
        .mockResolvedValueOnce([]);

      const csv = await ImportExportService.exportUICSV();
      const lines = csv.split('\n');

      expect(lines).toHaveLength(2);
      expect(lines[1]).toBe('en,common,btn.save,Save');
    });
  });

  // ==========================================================================
  // UI CSV Import
  // ==========================================================================

  describe('importUICSV', () => {
    it('imports valid UI CSV rows', async () => {
      const csv =
        'locale,namespace,key,value\n' +
        'zh-Hant,common,btn.save,Save';

      const result = await ImportExportService.importUICSV(csv, { overwrite: true });

      expect(result.imported).toBe(1);
      expect(uiServiceMock.setTranslation).toHaveBeenCalledWith(
        'zh-Hant',
        'common',
        'btn.save',
        'Save'
      );
    });

    it('skips existing when overwrite is false', async () => {
      prismaMock.uITranslation.findUnique.mockResolvedValue({ id: 'existing' });

      const csv =
        'locale,namespace,key,value\n' +
        'en,common,btn.save,Save';

      const result = await ImportExportService.importUICSV(csv);

      expect(result.skipped).toBe(1);
      expect(result.imported).toBe(0);
    });

    it('returns error when required columns are missing', async () => {
      const csv = 'locale,key\nen,btn.save';

      const result = await ImportExportService.importUICSV(csv);

      expect(result.errors[0]).toContain('Missing required columns');
    });
  });

  // ==========================================================================
  // UI JSON Export
  // ==========================================================================

  describe('exportUIJSON', () => {
    it('returns structured JSON grouped by locale:namespace', async () => {
      prismaMock.uITranslation.findMany
        .mockResolvedValueOnce([
          { id: '1', locale: 'en', namespace: 'common', key: 'btn.save', value: 'Save' },
          { id: '2', locale: 'en', namespace: 'shop', key: 'cart.title', value: 'Cart' },
        ])
        .mockResolvedValueOnce([]);

      const result = await ImportExportService.exportUIJSON();

      expect(result).toEqual({
        'en:common': { 'btn.save': 'Save' },
        'en:shop': { 'cart.title': 'Cart' },
      });
    });
  });

  // ==========================================================================
  // UI JSON Import
  // ==========================================================================

  describe('importUIJSON', () => {
    it('imports valid UI JSON data with overwrite', async () => {
      const data = {
        'en:common': { 'btn.save': 'Save', 'btn.cancel': 'Cancel' },
      };

      const result = await ImportExportService.importUIJSON(data, { overwrite: true });

      expect(result.imported).toBe(2);
      expect(uiServiceMock.setTranslations).toHaveBeenCalledWith(
        'en',
        'common',
        { 'btn.save': 'Save', 'btn.cancel': 'Cancel' }
      );
    });

    it('skips existing keys when overwrite is false', async () => {
      uiServiceMock.getTranslations.mockResolvedValue({ 'btn.save': 'Old' });

      const data = {
        'en:common': { 'btn.save': 'New Save', 'btn.cancel': 'Cancel' },
      };

      const result = await ImportExportService.importUIJSON(data);

      expect(result.imported).toBe(1); // only btn.cancel
      expect(result.skipped).toBe(1); // btn.save skipped
    });

    it('reports error for invalid composite keys', async () => {
      const data = {
        'invalid-key': { 'btn.save': 'Save' },
      } as any;

      const result = await ImportExportService.importUIJSON(data);

      expect(result.errors[0]).toContain('Invalid key');
    });
  });
});
