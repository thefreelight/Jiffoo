import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const {
  prismaMock,
  getProviderMock,
  contentTranslationServiceMock,
  uiTranslationServiceMock,
  languageServiceMock,
} = vi.hoisted(() => ({
  prismaMock: {
    translationJob: {
      create: vi.fn().mockResolvedValue({ id: 'job-1' }),
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn().mockResolvedValue({}),
    },
    contentTranslation: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
    uITranslation: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
  getProviderMock: vi.fn().mockReturnValue(null),
  contentTranslationServiceMock: {
    setTranslation: vi.fn().mockResolvedValue(undefined),
    computeDigest: vi.fn().mockReturnValue('digest123'),
  },
  uiTranslationServiceMock: {
    setTranslation: vi.fn().mockResolvedValue(undefined),
  },
  languageServiceMock: {
    getDefaultLanguage: vi.fn().mockResolvedValue({ locale: 'en', name: 'English', isDefault: true }),
  },
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: prismaMock,
}));

vi.mock('../../src/services/translation-provider', () => ({
  getProvider: getProviderMock,
}));

vi.mock('../../src/services/content-translation.service', () => ({
  ContentTranslationService: contentTranslationServiceMock,
}));

vi.mock('../../src/services/ui-translation.service', () => ({
  UITranslationService: uiTranslationServiceMock,
}));

vi.mock('../../src/services/language.service', () => ({
  LanguageService: languageServiceMock,
}));

import { AutoTranslateService } from '../../src/services/auto-translate.service';

describe('AutoTranslateService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore default mocks
    languageServiceMock.getDefaultLanguage.mockResolvedValue({
      locale: 'en',
      name: 'English',
      isDefault: true,
    });
    prismaMock.translationJob.create.mockResolvedValue({ id: 'job-1' });
  });

  // ==========================================================================
  // startJob
  // ==========================================================================

  describe('startJob', () => {
    it('creates a translation job record in DB and returns a jobId string', async () => {
      const mockProvider = {
        name: 'deepl',
        translateBatch: vi.fn().mockResolvedValue([]),
      };
      getProviderMock.mockReturnValue(mockProvider);
      prismaMock.contentTranslation.count.mockResolvedValue(5);
      // Make processJob resolve immediately (no source rows to process)
      prismaMock.contentTranslation.findMany.mockResolvedValue([]);

      const jobId = await AutoTranslateService.startJob({
        targetLocale: 'zh-Hant',
        provider: 'deepl',
        scope: 'content',
        entityType: 'product',
      });

      expect(jobId).toBe('job-1');
      expect(prismaMock.translationJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          targetLocale: 'zh-Hant',
          provider: 'deepl',
          status: 'running',
          totalKeys: 5,
          doneKeys: 0,
        }),
      });
    });

    it('supports content scope (queries contentTranslation records)', async () => {
      const mockProvider = {
        name: 'deepl',
        translateBatch: vi.fn().mockResolvedValue([]),
      };
      getProviderMock.mockReturnValue(mockProvider);
      prismaMock.contentTranslation.count.mockResolvedValue(10);
      prismaMock.contentTranslation.findMany.mockResolvedValue([]);

      await AutoTranslateService.startJob({
        targetLocale: 'fr',
        provider: 'deepl',
        scope: 'content',
        entityType: 'product',
      });

      expect(prismaMock.contentTranslation.count).toHaveBeenCalledWith({
        where: { entityType: 'product', locale: 'en' },
      });
      expect(prismaMock.translationJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          entityType: 'product',
          totalKeys: 10,
        }),
      });
    });

    it('supports ui scope (queries uITranslation records)', async () => {
      const mockProvider = {
        name: 'deepl',
        translateBatch: vi.fn().mockResolvedValue([]),
      };
      getProviderMock.mockReturnValue(mockProvider);
      prismaMock.uITranslation.count.mockResolvedValue(25);
      prismaMock.uITranslation.findMany.mockResolvedValue([]);

      await AutoTranslateService.startJob({
        targetLocale: 'fr',
        provider: 'deepl',
        scope: 'ui',
      });

      expect(prismaMock.uITranslation.count).toHaveBeenCalledWith({
        where: { locale: 'en' },
      });
      expect(prismaMock.translationJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          entityType: null,
          totalKeys: 25,
        }),
      });
    });

    it('respects overwrite option (when false, skips already-translated entries)', async () => {
      const mockProvider = {
        name: 'deepl',
        translateBatch: vi.fn().mockResolvedValue(['Bonjour']),
      };
      getProviderMock.mockReturnValue(mockProvider);
      prismaMock.contentTranslation.count.mockResolvedValue(2);

      // First call: source rows query; second call: existing translations check; third call: empty (end loop)
      prismaMock.contentTranslation.findMany
        .mockResolvedValueOnce([
          { id: 'ct-1', entityType: 'product', entityId: 'p1', locale: 'en', field: 'name', value: 'Hello' },
          { id: 'ct-2', entityType: 'product', entityId: 'p2', locale: 'en', field: 'name', value: 'World' },
        ])
        .mockResolvedValueOnce([
          // Already translated: p1.name exists in target locale
          { entityId: 'p1', field: 'name' },
        ])
        .mockResolvedValueOnce([]); // End of pagination loop

      await AutoTranslateService.startJob({
        targetLocale: 'fr',
        provider: 'deepl',
        scope: 'content',
        entityType: 'product',
        overwrite: false,
      });

      // Wait for background processing
      await vi.waitFor(() => {
        // Only p2 should be translated (p1 was skipped)
        expect(mockProvider.translateBatch).toHaveBeenCalledWith(['World'], 'en', 'fr');
      });
    });

    it('handles provider not found gracefully', async () => {
      getProviderMock.mockReturnValue(null);

      await expect(
        AutoTranslateService.startJob({
          targetLocale: 'fr',
          provider: 'unknown',
          scope: 'content',
          entityType: 'product',
        })
      ).rejects.toThrow('Provider "unknown" is not configured');
    });

    it('throws when no default language is configured', async () => {
      const mockProvider = {
        name: 'deepl',
        translateBatch: vi.fn().mockResolvedValue([]),
      };
      getProviderMock.mockReturnValue(mockProvider);
      languageServiceMock.getDefaultLanguage.mockResolvedValue(null);

      await expect(
        AutoTranslateService.startJob({
          targetLocale: 'fr',
          provider: 'deepl',
          scope: 'content',
          entityType: 'product',
        })
      ).rejects.toThrow('No default language configured');
    });

    it('throws when content scope is used without entityType', async () => {
      const mockProvider = {
        name: 'deepl',
        translateBatch: vi.fn().mockResolvedValue([]),
      };
      getProviderMock.mockReturnValue(mockProvider);

      await expect(
        AutoTranslateService.startJob({
          targetLocale: 'fr',
          provider: 'deepl',
          scope: 'content',
          // entityType is missing
        })
      ).rejects.toThrow('entityType is required for content scope');
    });
  });

  // ==========================================================================
  // getJob
  // ==========================================================================

  describe('getJob', () => {
    it('returns job details when found', async () => {
      const job = {
        id: 'job-1',
        targetLocale: 'fr',
        provider: 'deepl',
        status: 'completed',
        totalKeys: 10,
        doneKeys: 10,
      };
      prismaMock.translationJob.findUnique.mockResolvedValue(job);

      const result = await AutoTranslateService.getJob('job-1');

      expect(result).toEqual(job);
      expect(prismaMock.translationJob.findUnique).toHaveBeenCalledWith({
        where: { id: 'job-1' },
      });
    });

    it('returns null when not found', async () => {
      prismaMock.translationJob.findUnique.mockResolvedValue(null);

      const result = await AutoTranslateService.getJob('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ==========================================================================
  // listJobs
  // ==========================================================================

  describe('listJobs', () => {
    it('returns paginated job list', async () => {
      const jobs = [
        { id: 'job-2', status: 'completed' },
        { id: 'job-1', status: 'running' },
      ];
      prismaMock.translationJob.findMany.mockResolvedValue(jobs);
      prismaMock.translationJob.count.mockResolvedValue(5);

      const result = await AutoTranslateService.listJobs(1, 2);

      expect(result.items).toEqual(jobs);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(2);
      expect(prismaMock.translationJob.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 2,
      });
    });

    it('includes total count', async () => {
      prismaMock.translationJob.findMany.mockResolvedValue([]);
      prismaMock.translationJob.count.mockResolvedValue(50);

      const result = await AutoTranslateService.listJobs(3, 10);

      expect(result.total).toBe(50);
      expect(result.totalPages).toBe(5);
      expect(prismaMock.translationJob.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        skip: 20,
        take: 10,
      });
    });
  });
});
