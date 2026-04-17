import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  const originalExtensionsPath = process.env.EXTENSIONS_PATH;
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

  let tempExtensionsRoot: string;

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
    tempExtensionsRoot = path.join(os.tmpdir(), `jiffoo-theme-management-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    process.env.EXTENSIONS_PATH = tempExtensionsRoot;
  });

  afterEach(async () => {
    if (originalExtensionsPath === undefined) {
      delete process.env.EXTENSIONS_PATH;
    } else {
      process.env.EXTENSIONS_PATH = originalExtensionsPath;
    }

    await fs.rm(tempExtensionsRoot, { recursive: true, force: true });
  });

  async function writeOfficialThemeManifest(
    slug: string,
    manifest: Record<string, unknown>,
  ): Promise<string> {
    const themeDir = path.join(tempExtensionsRoot, 'themes', 'shop', slug);
    await fs.mkdir(themeDir, { recursive: true });
    await fs.writeFile(path.join(themeDir, 'theme.json'), JSON.stringify(manifest, null, 2), 'utf-8');
    return themeDir;
  }

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

  it('restores official theme packs when packaged runtime files are missing', async () => {
    await writeOfficialThemeManifest('modelsfind', {
      slug: 'modelsfind',
      version: '0.1.4',
      entry: {
        runtimeJS: 'runtime/theme-runtime.js',
        templatesDir: 'templates',
      },
    });

    mocks.getSetting
      .mockResolvedValueOnce({
        slug: 'modelsfind',
        version: '0.1.4',
        source: 'official-market',
        type: 'pack',
        config: {},
        activatedAt: '2026-04-18T00:00:00.000Z',
      })
      .mockResolvedValueOnce(null);

    const theme = await getActiveTheme('shop');

    expect(theme.slug).toBe('modelsfind');
    expect(mocks.ensureOfficialMarketExtensionFiles).toHaveBeenCalledWith({
      slug: 'modelsfind',
      kind: 'theme-shop',
      version: '0.1.4',
    });
  });

  it('skips official theme recovery when packaged runtime files are present', async () => {
    const themeDir = await writeOfficialThemeManifest('modelsfind', {
      slug: 'modelsfind',
      version: '0.1.4',
      entry: {
        runtimeJS: 'runtime/theme-runtime.js',
        templatesDir: 'templates',
      },
    });
    await fs.mkdir(path.join(themeDir, 'runtime'), { recursive: true });
    await fs.mkdir(path.join(themeDir, 'templates'), { recursive: true });
    await fs.writeFile(path.join(themeDir, 'runtime', 'theme-runtime.js'), 'window.__JIFFOO_THEME_RUNTIME__ = {};', 'utf-8');

    mocks.getSetting
      .mockResolvedValueOnce({
        slug: 'modelsfind',
        version: '0.1.4',
        source: 'official-market',
        type: 'pack',
        config: {},
        activatedAt: '2026-04-18T00:00:00.000Z',
      })
      .mockResolvedValueOnce(null);

    const theme = await getActiveTheme('shop');

    expect(theme.slug).toBe('modelsfind');
    expect(mocks.ensureOfficialMarketExtensionFiles).not.toHaveBeenCalled();
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
