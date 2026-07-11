import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const {
  languageServiceMock,
  contentServiceMock,
  uiServiceMock,
  connectRedisMock,
  disconnectRedisMock,
  prismaMock,
} = vi.hoisted(() => ({
  languageServiceMock: {
    seedDefaults: vi.fn().mockResolvedValue(undefined),
    fullSyncToRedis: vi.fn().mockResolvedValue(undefined),
    listLanguages: vi.fn().mockResolvedValue([]),
  },
  contentServiceMock: {
    fullSyncToRedis: vi.fn().mockResolvedValue(0),
  },
  uiServiceMock: {
    fullSyncToRedis: vi.fn().mockResolvedValue(0),
  },
  connectRedisMock: vi.fn().mockResolvedValue(undefined),
  disconnectRedisMock: vi.fn().mockResolvedValue(undefined),
  prismaMock: {},
}));

vi.mock('../src/services/language.service', () => ({
  LanguageService: languageServiceMock,
}));
vi.mock('../src/services/content-translation.service', () => ({
  ContentTranslationService: contentServiceMock,
}));
vi.mock('../src/services/ui-translation.service', () => ({
  UITranslationService: uiServiceMock,
}));
vi.mock('../src/lib/redis', () => ({
  connectRedis: connectRedisMock,
  disconnectRedis: disconnectRedisMock,
  syncContentToRedis: vi.fn(),
  removeContentFromRedis: vi.fn(),
  syncUIToRedis: vi.fn(),
  getUIFromRedis: vi.fn(),
  syncLocalesToRedis: vi.fn(),
}));
vi.mock('../src/lib/prisma', () => ({
  prisma: prismaMock,
}));
// Mock additional imports used in routes
vi.mock('../src/services/auto-translate.service', () => ({
  AutoTranslateService: {
    startJob: vi.fn(),
    listJobs: vi.fn(),
    getJob: vi.fn(),
  },
}));
vi.mock('../src/services/translation-provider', () => ({
  getAvailableProviders: vi.fn().mockReturnValue([]),
}));
vi.mock('../src/services/import-export.service', () => ({
  ImportExportService: {
    exportContentCSV: vi.fn(),
    exportContentJSON: vi.fn(),
    exportUICSV: vi.fn(),
    exportUIJSON: vi.fn(),
    importContentCSV: vi.fn(),
    importContentJSON: vi.fn(),
    importUICSV: vi.fn(),
    importUIJSON: vi.fn(),
  },
}));

import i18nPlugin from '../src/index';

describe('i18n internal-fastify runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes health endpoint through the internal-fastify entry', async () => {
    const app = Fastify();
    await app.register(i18nPlugin as any);

    const health = await app.inject({
      method: 'GET',
      url: '/health',
    });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({
      status: 'healthy',
      plugin: 'i18n',
    });

    await app.close();
  });

  it('exposes manifest endpoint with correct plugin metadata', async () => {
    const app = Fastify();
    await app.register(i18nPlugin as any);

    const manifest = await app.inject({
      method: 'GET',
      url: '/manifest',
    });
    expect(manifest.statusCode).toBe(200);
    const body = manifest.json();
    expect(body).toMatchObject({
      slug: 'i18n',
      runtimeType: 'internal-fastify',
    });

    await app.close();
  });

  it('connects Redis and seeds defaults during plugin registration', async () => {
    const app = Fastify();
    await app.register(i18nPlugin as any);

    expect(connectRedisMock).toHaveBeenCalledTimes(1);
    expect(languageServiceMock.seedDefaults).toHaveBeenCalledTimes(1);

    await app.close();
  });

  it('forwards gateway-style GET requests into the express app', async () => {
    const app = Fastify();
    await app.register(i18nPlugin as any);

    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: {
        'x-platform-id': 'plat_1',
        'x-plugin-slug': 'i18n',
        'x-installation-id': 'ins_internal',
      },
    });
    expect(res.statusCode).toBe(200);

    await app.close();
  });

  // ==========================================================================
  // __lifecycle_onEnable
  // ==========================================================================

  describe('__lifecycle_onEnable', () => {
    it('is a function attached to the plugin', () => {
      expect(typeof (i18nPlugin as any).__lifecycle_onEnable).toBe('function');
    });

    it('connects Redis, seeds defaults, and performs full sync', async () => {
      contentServiceMock.fullSyncToRedis.mockResolvedValue(10);
      uiServiceMock.fullSyncToRedis.mockResolvedValue(5);

      await (i18nPlugin as any).__lifecycle_onEnable();

      expect(connectRedisMock).toHaveBeenCalled();
      expect(languageServiceMock.seedDefaults).toHaveBeenCalled();
      expect(contentServiceMock.fullSyncToRedis).toHaveBeenCalled();
      expect(uiServiceMock.fullSyncToRedis).toHaveBeenCalled();
      expect(languageServiceMock.fullSyncToRedis).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // __lifecycle_onInstall
  // ==========================================================================

  it('__lifecycle_onInstall returns success', async () => {
    const hook = (i18nPlugin as any).__lifecycle_onInstall;
    expect(hook).toBeDefined();
    const result = await hook();
    expect(result.success).toBe(true);
  });

  // ==========================================================================
  // __lifecycle_onDisable
  // ==========================================================================

  it('__lifecycle_onDisable disconnects Redis and returns success', async () => {
    const hook = (i18nPlugin as any).__lifecycle_onDisable;
    expect(hook).toBeDefined();
    const result = await hook();
    expect(result.success).toBe(true);
    expect(disconnectRedisMock).toHaveBeenCalled();
  });

  // ==========================================================================
  // __lifecycle_onUninstall
  // ==========================================================================

  it('__lifecycle_onUninstall returns success', async () => {
    const hook = (i18nPlugin as any).__lifecycle_onUninstall;
    expect(hook).toBeDefined();
    const result = await hook();
    expect(result.success).toBe(true);
  });
});
