import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSetting: vi.fn(),
  setSetting: vi.fn(),
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
  cacheDelete: vi.fn(),
  incrementStoreContextVersion: vi.fn(),
  getThemeAppInstance: vi.fn(),
  startThemeApp: vi.fn(),
  checkThemeAppHealth: vi.fn(),
  ensureOfficialMarketExtensionFiles: vi.fn(),
}));

vi.mock('@/core/admin/system-settings/service', () => ({
  systemSettingsService: {
    getSetting: mocks.getSetting,
    setSetting: mocks.setSetting,
  },
}));

vi.mock('@/core/cache/service', () => ({
  CacheService: {
    get: mocks.cacheGet,
    set: mocks.cacheSet,
    delete: mocks.cacheDelete,
    incrementStoreContextVersion: mocks.incrementStoreContextVersion,
  },
}));

vi.mock('@/core/admin/extension-installer/official-only', () => ({
  isAllowedExtensionSource: () => true,
  isOfficialMarketOnly: () => false,
}));

vi.mock('@/core/admin/theme-app-runtime/policy', () => ({
  getThemeAppRuntimePolicy: () => ({
    supported: true,
  }),
}));

vi.mock('@/core/admin/theme-app-runtime/manager', () => ({
  getThemeAppInstance: mocks.getThemeAppInstance,
  startThemeApp: mocks.startThemeApp,
  checkThemeAppHealth: mocks.checkThemeAppHealth,
}));

vi.mock('@/core/admin/market/official-package-recovery', () => ({
  ensureOfficialMarketExtensionFiles: mocks.ensureOfficialMarketExtensionFiles,
}));

import { getActiveTheme, restoreActiveThemeApps } from '@/core/admin/theme-management/service';

describe('ThemeManagementService', () => {
  const legacyBuiltinDefaultThemeApp = {
    slug: 'default',
    version: '1.0.0',
    source: 'local-zip',
    type: 'app',
    config: {},
    activatedAt: '2026-03-06T17:46:02.263Z',
    baseUrl: 'http://default-theme:3101',
    port: 3101,
  };
  const legacyBuiltinLaunchTheme = {
    slug: 'yevbi',
    version: '1.0.0',
    source: 'builtin',
    type: 'pack',
    config: {},
    activatedAt: '2026-03-06T17:46:02.263Z',
  };
  const installedOfficialThemePack = {
    slug: 'esim-mall',
    version: '1.0.0',
    source: 'official-market',
    type: 'pack',
    config: {},
    activatedAt: '2026-03-10T10:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cacheGet.mockResolvedValue(null);
    mocks.cacheSet.mockResolvedValue(true);
    mocks.cacheDelete.mockResolvedValue(true);
    mocks.incrementStoreContextVersion.mockResolvedValue(1);
    mocks.getThemeAppInstance.mockReturnValue(null);
    mocks.startThemeApp.mockResolvedValue(undefined);
    mocks.checkThemeAppHealth.mockResolvedValue({ success: true });
    mocks.ensureOfficialMarketExtensionFiles.mockResolvedValue(undefined);
  });

  it('normalizes builtin default themes stored with legacy app metadata', async () => {
    mocks.getSetting
      .mockResolvedValueOnce(legacyBuiltinDefaultThemeApp)
      .mockResolvedValueOnce(null);

    const theme = await getActiveTheme('shop');

    expect(theme).toMatchObject({
      slug: 'builtin-default',
      version: '1.0.0',
      source: 'builtin',
      type: 'pack',
      config: {},
    });
    expect(theme.baseUrl).toBeUndefined();
    expect(theme.port).toBeUndefined();
    expect(mocks.setSetting).toHaveBeenCalledWith(
      'theme.active.shop',
      expect.objectContaining({
        slug: 'builtin-default',
        source: 'builtin',
        type: 'pack',
      }),
    );
    expect(mocks.cacheSet).toHaveBeenCalledWith(
      'themes:active:shop',
      expect.objectContaining({
        slug: 'builtin-default',
        source: 'builtin',
        type: 'pack',
      }),
      { ttl: 60 },
    );
  });

  it('converts legacy launch themes to official-market packs', async () => {
    mocks.getSetting
      .mockResolvedValueOnce(legacyBuiltinLaunchTheme)
      .mockResolvedValueOnce(null);

    const theme = await getActiveTheme('shop');

    expect(theme.slug).toBe('yevbi');
    expect(theme.source).toBe('official-market');
    expect(theme.type).toBe('pack');
    expect(mocks.setSetting).toHaveBeenCalledWith(
      'theme.active.shop',
      expect.objectContaining({
        slug: 'yevbi',
        source: 'official-market',
        type: 'pack',
      }),
    );
    expect(mocks.ensureOfficialMarketExtensionFiles).toHaveBeenCalledWith({
      slug: 'yevbi',
      kind: 'theme-shop',
      version: '1.0.0',
    });
  });

  it('preserves installed official theme packs for builtin slugs', async () => {
    mocks.getSetting
      .mockResolvedValueOnce(installedOfficialThemePack)
      .mockResolvedValueOnce(null);

    const theme = await getActiveTheme('shop');

    expect(theme).toMatchObject({
      slug: 'esim-mall',
      version: '1.0.0',
      source: 'official-market',
      type: 'pack',
    });
    expect(mocks.setSetting).not.toHaveBeenCalled();
    expect(mocks.cacheSet).toHaveBeenCalledWith(
      'themes:active:shop',
      expect.objectContaining({
        slug: 'esim-mall',
        source: 'official-market',
        type: 'pack',
      }),
      { ttl: 60 },
    );
  });

  it('skips restoring builtin themes as theme apps', async () => {
    mocks.getSetting.mockImplementation(async (key: string) => {
      switch (key) {
        case 'theme.active.shop':
          return legacyBuiltinLaunchTheme;
        case 'theme.previous.shop':
          return null;
        case 'theme.active.admin':
          return {
            slug: 'builtin-default',
            version: '1.0.0',
            source: 'builtin',
            type: 'pack',
            config: {},
            activatedAt: '2026-03-06T04:21:45.183Z',
          };
        case 'theme.previous.admin':
          return null;
        default:
          return null;
      }
    });

    const results = await restoreActiveThemeApps();

    expect(mocks.startThemeApp).not.toHaveBeenCalled();
    expect(results.shop.restored).toBe(false);
    expect(results.admin.restored).toBe(false);
  });
});
