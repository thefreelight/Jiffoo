import http from 'http';
import express from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const {
  languageServiceMock,
  contentServiceMock,
  uiServiceMock,
  importExportServiceMock,
  autoTranslateServiceMock,
} = vi.hoisted(() => ({
  languageServiceMock: {
    listLanguages: vi.fn().mockResolvedValue([]),
    upsertLanguage: vi.fn().mockResolvedValue(undefined),
    deleteLanguage: vi.fn().mockResolvedValue(true),
  },
  contentServiceMock: {
    getTranslations: vi.fn().mockResolvedValue({}),
    setTranslations: vi.fn().mockResolvedValue(undefined),
    deleteTranslations: vi.fn().mockResolvedValue(0),
    listTranslatedEntities: vi.fn().mockResolvedValue({ items: [], page: 1, limit: 50, total: 0, totalPages: 0 }),
    getCompleteness: vi.fn().mockResolvedValue({ entityType: 'product', locale: 'en', translatedEntities: 0 }),
  },
  uiServiceMock: {
    getAllTranslations: vi.fn().mockResolvedValue({}),
    getCachedTranslations: vi.fn().mockResolvedValue({}),
    setTranslations: vi.fn().mockResolvedValue(undefined),
  },
  importExportServiceMock: {
    exportContentCSV: vi.fn().mockResolvedValue('csv-data'),
    exportContentJSON: vi.fn().mockResolvedValue({}),
    exportUICSV: vi.fn().mockResolvedValue('csv-data'),
    exportUIJSON: vi.fn().mockResolvedValue({}),
    importContentCSV: vi.fn().mockResolvedValue({ imported: 0, skipped: 0, errors: [] }),
    importContentJSON: vi.fn().mockResolvedValue({ imported: 0, skipped: 0, errors: [] }),
    importUICSV: vi.fn().mockResolvedValue({ imported: 0, skipped: 0, errors: [] }),
    importUIJSON: vi.fn().mockResolvedValue({ imported: 0, skipped: 0, errors: [] }),
  },
  autoTranslateServiceMock: {
    startJob: vi.fn().mockResolvedValue('job-1'),
    listJobs: vi.fn().mockResolvedValue({ items: [], page: 1, limit: 20, total: 0, totalPages: 0 }),
    getJob: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('../../src/services/language.service', () => ({
  LanguageService: languageServiceMock,
}));
vi.mock('../../src/services/content-translation.service', () => ({
  ContentTranslationService: contentServiceMock,
}));
vi.mock('../../src/services/ui-translation.service', () => ({
  UITranslationService: uiServiceMock,
}));
vi.mock('../../src/services/import-export.service', () => ({
  ImportExportService: importExportServiceMock,
}));
vi.mock('../../src/services/auto-translate.service', () => ({
  AutoTranslateService: autoTranslateServiceMock,
}));
vi.mock('../../src/services/translation-provider', () => ({
  getAvailableProviders: vi.fn().mockReturnValue([]),
}));
vi.mock('../../src/lib/prisma', () => ({
  prisma: {},
}));
vi.mock('../../src/lib/redis', () => ({
  syncContentToRedis: vi.fn(),
  removeContentFromRedis: vi.fn(),
  syncUIToRedis: vi.fn(),
  getUIFromRedis: vi.fn(),
  syncLocalesToRedis: vi.fn(),
}));

import { apiRoutes } from '../../src/routes/api';

type JsonResponse = { status: number; json: any };

async function withServer(run: (baseUrl: string) => Promise<void>): Promise<void> {
  const app = express();
  app.use(express.json());
  app.use('/', apiRoutes);

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve()))
    );
  }
}

async function requestJson(
  baseUrl: string,
  path: string,
  init: RequestInit = {}
): Promise<JsonResponse> {
  const res = await fetch(`${baseUrl}${path}`, init);
  const json = await res.json();
  return { status: res.status, json };
}

describe('i18n API routes', () => {
  beforeEach(() => vi.clearAllMocks());

  // ==========================================================================
  // Languages
  // ==========================================================================

  describe('GET /api/languages', () => {
    it('returns list of languages', async () => {
      const langs = [
        { locale: 'en', name: 'English', isDefault: true },
        { locale: 'fr', name: 'French', isDefault: false },
      ];
      languageServiceMock.listLanguages.mockResolvedValue(langs);

      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/languages');
        expect(res.status).toBe(200);
        expect(res.json.success).toBe(true);
        expect(res.json.data).toEqual(langs);
      });
    });

    it('returns 500 on service error', async () => {
      languageServiceMock.listLanguages.mockRejectedValue(new Error('DB down'));

      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/languages');
        expect(res.status).toBe(500);
        expect(res.json.error.code).toBe('LANGUAGE_LIST_FAILED');
      });
    });
  });

  describe('POST /api/languages', () => {
    it('creates a language', async () => {
      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/languages', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ locale: 'fr', name: 'French', nativeName: 'Francais' }),
        });
        expect(res.status).toBe(200);
        expect(res.json.success).toBe(true);
        expect(languageServiceMock.upsertLanguage).toHaveBeenCalledWith(
          expect.objectContaining({ locale: 'fr', name: 'French', nativeName: 'Francais' })
        );
      });
    });

    it('returns 400 when required fields are missing', async () => {
      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/languages', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ locale: 'fr' }),
        });
        expect(res.status).toBe(400);
        expect(res.json.error.code).toBe('VALIDATION_ERROR');
      });
    });
  });

  describe('DELETE /api/languages/:locale', () => {
    it('deletes a language', async () => {
      languageServiceMock.deleteLanguage.mockResolvedValue(true);

      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/languages/fr', {
          method: 'DELETE',
        });
        expect(res.status).toBe(200);
        expect(res.json.success).toBe(true);
      });
    });

    it('returns 400 when deleting the default language', async () => {
      languageServiceMock.deleteLanguage.mockResolvedValue(false);

      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/languages/en', {
          method: 'DELETE',
        });
        expect(res.status).toBe(400);
        expect(res.json.error.code).toBe('DELETE_FAILED');
      });
    });
  });

  // ==========================================================================
  // Content Translations
  // ==========================================================================

  describe('GET /api/content/:entityType/:entityId/:locale', () => {
    it('returns translations for an entity', async () => {
      contentServiceMock.getTranslations.mockResolvedValue({
        name: 'Product Name',
      });

      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/content/product/prod-1/zh-Hant');
        expect(res.status).toBe(200);
        expect(res.json.data).toEqual({ name: 'Product Name' });
      });
    });
  });

  describe('PUT /api/content/:entityType/:entityId/:locale', () => {
    it('updates translations for an entity', async () => {
      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/content/product/prod-1/zh-Hant', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ fields: { name: 'New Name' } }),
        });
        expect(res.status).toBe(200);
        expect(contentServiceMock.setTranslations).toHaveBeenCalledWith(
          expect.objectContaining({
            entityType: 'product',
            entityId: 'prod-1',
            locale: 'zh-Hant',
            fields: { name: 'New Name' },
          })
        );
      });
    });

    it('returns 400 when fields is missing', async () => {
      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/content/product/prod-1/zh-Hant', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        });
        expect(res.status).toBe(400);
        expect(res.json.error.code).toBe('VALIDATION_ERROR');
      });
    });
  });

  describe('DELETE /api/content/:entityType/:entityId', () => {
    it('deletes translations', async () => {
      contentServiceMock.deleteTranslations.mockResolvedValue(5);

      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/content/product/prod-1', {
          method: 'DELETE',
        });
        expect(res.status).toBe(200);
        expect(res.json.data.deleted).toBe(5);
      });
    });
  });

  // ==========================================================================
  // UI Translations
  // ==========================================================================

  describe('GET /api/messages/:locale', () => {
    it('returns all UI translations for a locale', async () => {
      uiServiceMock.getAllTranslations.mockResolvedValue({
        common: { 'btn.save': 'Save' },
      });

      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/messages/en');
        expect(res.status).toBe(200);
        expect(res.json.data).toEqual({ common: { 'btn.save': 'Save' } });
      });
    });
  });

  describe('GET /api/ui/:locale/:namespace', () => {
    it('returns cached UI translations', async () => {
      uiServiceMock.getCachedTranslations.mockResolvedValue({
        'btn.save': 'Save',
      });

      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/ui/en/common');
        expect(res.status).toBe(200);
        expect(res.json.data).toEqual({ 'btn.save': 'Save' });
      });
    });
  });

  describe('PUT /api/ui/:locale/:namespace', () => {
    it('updates UI translations', async () => {
      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/ui/en/common', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ 'btn.save': 'Save', 'btn.cancel': 'Cancel' }),
        });
        expect(res.status).toBe(200);
        expect(uiServiceMock.setTranslations).toHaveBeenCalledWith('en', 'common', {
          'btn.save': 'Save',
          'btn.cancel': 'Cancel',
        });
      });
    });
  });

  // ==========================================================================
  // Import / Export endpoints
  // ==========================================================================

  describe('POST /api/import/content/csv', () => {
    it('imports content CSV', async () => {
      importExportServiceMock.importContentCSV.mockResolvedValue({
        imported: 2,
        skipped: 0,
        errors: [],
      });

      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/import/content/csv', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ csv: 'entityType,entityId,locale,field,value\n...', overwrite: true }),
        });
        expect(res.status).toBe(200);
        expect(res.json.data.imported).toBe(2);
      });
    });

    it('returns 400 when csv is missing', async () => {
      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/import/content/csv', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        });
        expect(res.status).toBe(400);
        expect(res.json.error.code).toBe('VALIDATION_ERROR');
      });
    });
  });

  describe('POST /api/import/ui/json', () => {
    it('imports UI JSON', async () => {
      importExportServiceMock.importUIJSON.mockResolvedValue({
        imported: 3,
        skipped: 0,
        errors: [],
      });

      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/import/ui/json', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ data: { 'en:common': { key: 'val' } }, overwrite: true }),
        });
        expect(res.status).toBe(200);
        expect(res.json.data.imported).toBe(3);
      });
    });

    it('returns 400 when data is missing', async () => {
      await withServer(async (baseUrl) => {
        const res = await requestJson(baseUrl, '/import/ui/json', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        });
        expect(res.status).toBe(400);
        expect(res.json.error.code).toBe('VALIDATION_ERROR');
      });
    });
  });
});
