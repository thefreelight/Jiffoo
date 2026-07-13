import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  getActiveTheme: vi.fn(),
  getInstalledThemes: vi.fn(),
  getOfficialCatalog: vi.fn(),
  fetchOfficialArtifactsIndex: vi.fn(),
  buildOfficialArtifactMap: vi.fn(),
  cacheSet: vi.fn(),
  cacheGet: vi.fn(),
  logSystem: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('@/config/database', () => ({
  prisma: {
    pluginInstall: {
      findMany: mocks.findMany,
    },
  },
}));

vi.mock('@/core/admin/theme-management/service', () => ({
  ThemeManagementService: {
    getActiveTheme: mocks.getActiveTheme,
    getInstalledThemes: mocks.getInstalledThemes,
  },
}));

vi.mock('@/core/admin/market/market-client', () => ({
  MarketClient: {
    getOfficialCatalog: mocks.getOfficialCatalog,
  },
}));

vi.mock('@/core/admin/market/official-artifacts-client', () => ({
  fetchOfficialArtifactsIndex: mocks.fetchOfficialArtifactsIndex,
  buildOfficialArtifactMap: mocks.buildOfficialArtifactMap,
}));

vi.mock('@/core/cache/service', () => ({
  CacheService: {
    set: mocks.cacheSet,
    get: mocks.cacheGet,
  },
}));

vi.mock('@/core/logger/unified-logger', () => ({
  LoggerService: {
    logSystem: mocks.logSystem,
    logError: mocks.logError,
  },
}));

import { UpdateChecker } from '@/core/admin/market/update-checker';

describe('UpdateChecker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([]);
    mocks.getActiveTheme.mockResolvedValue({
      slug: 'builtin-default',
      version: '1.0.0',
      source: 'builtin',
      type: 'pack',
      config: {},
    });
    mocks.getInstalledThemes.mockResolvedValue({ items: [], total: 0 });
    mocks.getOfficialCatalog.mockResolvedValue({ items: [] });
    mocks.fetchOfficialArtifactsIndex.mockResolvedValue([]);
    mocks.buildOfficialArtifactMap.mockImplementation((items: Array<{ slug: string; kind: string }>) => {
      return new Map(items.map((item) => [`${item.kind}:${item.slug}`, item]));
    });
    mocks.cacheSet.mockResolvedValue(true);
    mocks.cacheGet.mockResolvedValue(null);
  });

  it('prefers the artifact index version for active official-market themes even when local installed file entries are missing', async () => {
    mocks.getActiveTheme.mockResolvedValue({
      slug: 'modelsfind',
      version: '0.1.3',
      source: 'official-market',
      type: 'pack',
      config: {},
    });
    mocks.getOfficialCatalog.mockResolvedValue({
      items: [
        {
          slug: 'modelsfind',
          currentVersion: '0.1.4',
          sellableVersion: '0.1.4',
        },
      ],
    });
    mocks.fetchOfficialArtifactsIndex.mockResolvedValue([
      {
        slug: 'modelsfind',
        kind: 'theme',
        version: '0.1.5',
        packageUrl: 'https://market.jiffoo.com/artifacts/themes/modelsfind/0.1.5.jtheme',
      },
    ]);

    const result = await UpdateChecker.check();

    expect(result).toContainEqual({
      kind: 'theme',
      slug: 'modelsfind',
      currentVersion: '0.1.3',
      latestVersion: '0.1.5',
      hasUpdate: true,
    });
    expect(mocks.cacheSet).toHaveBeenCalledWith(
      'market:update-check:results',
      expect.stringContaining('"kind":"theme"'),
      { ttl: 86400 },
    );
  });
});
