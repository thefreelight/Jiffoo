import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getActiveTheme: vi.fn(),
  getInstalledThemes: vi.fn(),
  getAllPluginPackages: vi.fn(),
  getDefaultInstance: vi.fn(),
  checkConnectivity: vi.fn(),
  getOfficialCatalog: vi.fn(),
  getManagedStatus: vi.fn(),
  checkOfficialArtifactReachable: vi.fn(),
  getCachedResults: vi.fn(),
}));

vi.mock('@/core/admin/theme-management/service', () => ({
  ThemeManagementService: {
    getActiveTheme: mocks.getActiveTheme,
    getInstalledThemes: mocks.getInstalledThemes,
  },
}));

vi.mock('@/core/admin/plugin-management/service', () => ({
  PluginManagementService: {
    getAllPluginPackages: mocks.getAllPluginPackages,
    getDefaultInstance: mocks.getDefaultInstance,
  },
}));

vi.mock('@/core/admin/market/market-client', () => ({
  MarketClient: {
    checkConnectivity: mocks.checkConnectivity,
    getOfficialCatalog: mocks.getOfficialCatalog,
  },
}));

vi.mock('@/core/admin/managed-package/service', () => ({
  managedPackageService: {
    getStatus: mocks.getManagedStatus,
  },
}));

vi.mock('@/core/admin/extension-installer/official-only', () => ({
  isOfficialMarketOnly: () => false,
}));

vi.mock('@/core/admin/market/official-artifact-health', () => ({
  checkOfficialArtifactReachable: mocks.checkOfficialArtifactReachable,
}));

vi.mock('@/core/admin/market/update-checker', () => ({
  UpdateChecker: {
    getCachedResults: mocks.getCachedResults,
  },
}));

import { getOfficialCatalog } from '@/core/admin/market/official-catalog';

function makeRemoteTheme(slug: string, name: string, version = '1.0.0') {
  return {
    id: `submission:${slug}`,
    submissionId: `submission:${slug}`,
    slug,
    name,
    kind: 'theme',
    listingDomain: 'app_marketplace',
    listingKind: 'theme',
    providerType: 'platform',
    description: `${name} description`,
    author: 'Jiffoo',
    deliveryMode: 'package-managed',
    paymentMode: 'platform_collect',
    settlementTargetType: 'platform',
    settlementTargetId: 'platform:jiffoo',
    launchWave: 'wave-1',
    publishState: 'published',
    installable: true,
    featured: true,
    recommended: true,
    pricingModel: 'free',
    price: 0,
    currency: 'USD',
    currentVersion: version,
    sellableVersion: version,
    installState: 'not_installed',
    installCount: 0,
    entitlementCount: 0,
    activeEntitlementCount: 0,
    versions: [
      {
        version,
        packageUrl: `https://market.example.com/${slug}.jtheme`,
        minCoreVersion: '0.2.0',
        isCurrent: true,
        isSellable: true,
        createdAt: new Date(0).toISOString(),
      },
    ],
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

function makeRemotePlugin(slug: string, name: string, version = '1.0.0') {
  return {
    id: `submission:${slug}`,
    submissionId: `submission:${slug}`,
    slug,
    name,
    kind: 'plugin',
    listingDomain: 'app_marketplace',
    listingKind: 'plugin',
    providerType: 'platform',
    description: `${name} description`,
    author: 'Jiffoo',
    deliveryMode: 'package-managed',
    paymentMode: 'platform_collect',
    settlementTargetType: 'platform',
    settlementTargetId: 'platform:jiffoo',
    launchWave: 'wave-1',
    publishState: 'published',
    installable: true,
    featured: true,
    recommended: true,
    pricingModel: 'free',
    price: 0,
    currency: 'USD',
    currentVersion: version,
    sellableVersion: version,
    installState: 'not_installed',
    installCount: 0,
    entitlementCount: 0,
    activeEntitlementCount: 0,
    versions: [
      {
        version,
        packageUrl: `https://market.example.com/${slug}.jplugin`,
        minCoreVersion: '0.2.0',
        isCurrent: true,
        isSellable: true,
        createdAt: new Date(0).toISOString(),
      },
    ],
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

describe('getOfficialCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAllPluginPackages.mockResolvedValue([]);
    mocks.getDefaultInstance.mockResolvedValue(null);
    mocks.checkConnectivity.mockResolvedValue({ ok: true, error: undefined });
    mocks.getManagedStatus.mockResolvedValue({ mode: 'oss', package: null });
    mocks.checkOfficialArtifactReachable.mockResolvedValue(true);
    mocks.getCachedResults.mockResolvedValue(null);
    mocks.getOfficialCatalog.mockResolvedValue({
      items: [
        makeRemoteTheme('esim-mall', 'eSIM Mall'),
        makeRemoteTheme('yevbi', 'Yevbi'),
        makeRemotePlugin('stripe', 'Stripe'),
      ],
    });
  });

  it('does not treat builtin embedded themes as installed marketplace themes', async () => {
    mocks.getActiveTheme.mockResolvedValue({
      slug: 'builtin-default',
      version: '1.0.0',
      source: 'builtin',
      type: 'pack',
      config: {},
    });
    mocks.getInstalledThemes.mockResolvedValue({
      items: [
        {
          slug: 'builtin-default',
          name: 'Default Theme',
          version: '1.0.0',
          source: 'builtin',
          type: 'pack',
          target: 'shop',
        },
        {
          slug: 'esim-mall',
          name: 'eSIM Mall',
          version: '1.0.0',
          source: 'builtin',
          type: 'pack',
          target: 'shop',
        },
      ],
      total: 2,
    });

    const response = await getOfficialCatalog();
    const esimMall = response.items.find((item) => item.slug === 'esim-mall');

    expect(esimMall).toMatchObject({
      slug: 'esim-mall',
      installState: 'not_installed',
      source: 'catalog',
    });
  });

  it('marks official-market theme packs as installed and active for official catalog actions', async () => {
    mocks.getActiveTheme.mockResolvedValue({
      slug: 'esim-mall',
      version: '1.0.0',
      source: 'official-market',
      type: 'pack',
      config: {},
    });
    mocks.getInstalledThemes.mockResolvedValue({
      items: [
        {
          slug: 'esim-mall',
          name: 'eSIM Mall',
          version: '1.0.0',
          source: 'official-market',
          type: 'pack',
          target: 'shop',
          description: 'Downloaded official theme pack',
          author: 'Jiffoo',
        },
      ],
      total: 1,
    });

    const response = await getOfficialCatalog();
    const esimMall = response.items.find((item) => item.slug === 'esim-mall');

    expect(esimMall).toMatchObject({
      slug: 'esim-mall',
      installState: 'active',
      source: 'official-market',
    });
  });

  it('surfaces theme updates when the installed official-market version is older than sellableVersion', async () => {
    mocks.getOfficialCatalog.mockResolvedValue({
      items: [
        makeRemoteTheme('modelsfind', 'ModelsFind', '0.1.3'),
      ],
    });
    mocks.getActiveTheme.mockResolvedValue({
      slug: 'modelsfind',
      version: '0.1.2',
      source: 'official-market',
      type: 'pack',
      config: {},
    });
    mocks.getInstalledThemes.mockResolvedValue({
      items: [
        {
          slug: 'modelsfind',
          name: 'ModelsFind',
          version: '0.1.2',
          source: 'official-market',
          type: 'pack',
          target: 'shop',
          description: 'Downloaded official theme pack',
          author: 'Jiffoo',
        },
      ],
      total: 1,
    });

    const response = await getOfficialCatalog();
    const modelsfind = response.items.find((item) => item.slug === 'modelsfind');

    expect(modelsfind).toMatchObject({
      slug: 'modelsfind',
      version: '0.1.2',
      latestVersion: '0.1.3',
      updateAvailable: true,
      installState: 'active',
    });
  });

  it('treats an active official-market theme as installed even when the local theme-pack file list is missing', async () => {
    mocks.getOfficialCatalog.mockResolvedValue({
      items: [
        makeRemoteTheme('modelsfind', 'ModelsFind', '0.1.4'),
      ],
    });
    mocks.getActiveTheme.mockResolvedValue({
      slug: 'modelsfind',
      version: '0.1.3',
      source: 'official-market',
      type: 'pack',
      config: {},
    });
    mocks.getInstalledThemes.mockResolvedValue({
      items: [],
      total: 0,
    });

    const response = await getOfficialCatalog();
    const modelsfind = response.items.find((item) => item.slug === 'modelsfind');

    expect(modelsfind).toMatchObject({
      slug: 'modelsfind',
      version: '0.1.3',
      latestVersion: '0.1.4',
      updateAvailable: true,
      installState: 'active',
      source: 'official-market',
    });
  });

  it('uses cached theme update results when the marketplace is temporarily offline', async () => {
    mocks.checkConnectivity.mockResolvedValue({ ok: false, error: 'offline' });
    mocks.getActiveTheme.mockResolvedValue({
      slug: 'modelsfind',
      version: '0.1.3',
      source: 'official-market',
      type: 'pack',
      config: {},
    });
    mocks.getInstalledThemes.mockResolvedValue({
      items: [],
      total: 0,
    });
    mocks.getCachedResults.mockResolvedValue([
      {
        kind: 'theme',
        slug: 'modelsfind',
        currentVersion: '0.1.3',
        latestVersion: '0.1.4',
        hasUpdate: true,
      },
    ]);

    const response = await getOfficialCatalog();
    const modelsfind = response.items.find((item) => item.slug === 'modelsfind');

    expect(modelsfind).toMatchObject({
      slug: 'modelsfind',
      version: '0.1.3',
      latestVersion: '0.1.4',
      updateAvailable: true,
      installState: 'active',
    });
    expect(response.marketOnline).toBe(false);
  });

  it('surfaces plugin updates when the installed version is older than sellableVersion', async () => {
    mocks.getInstalledThemes.mockResolvedValue({ items: [], total: 0 });
    mocks.getAllPluginPackages.mockResolvedValue([
      {
        slug: 'stripe',
        name: 'Stripe',
        version: '1.0.0',
        source: 'official-market',
        description: 'Stripe payments',
        author: 'Jiffoo',
        manifestJson: {
          configSchema: {},
        },
      },
    ]);
    mocks.getDefaultInstance.mockResolvedValue({
      enabled: true,
      configJson: {},
    });
    mocks.getOfficialCatalog.mockResolvedValue({
      items: [
        makeRemotePlugin('stripe', 'Stripe', '1.1.0'),
      ],
    });
    mocks.getActiveTheme.mockResolvedValue({
      slug: 'builtin-default',
      version: '1.0.0',
      source: 'builtin',
      type: 'pack',
      config: {},
    });

    const response = await getOfficialCatalog();
    const stripe = response.items.find((item) => item.slug === 'stripe');

    expect(stripe).toMatchObject({
      slug: 'stripe',
      version: '1.0.0',
      latestVersion: '1.1.0',
      updateAvailable: true,
      installState: 'enabled',
    });
  });
});
