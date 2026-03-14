import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getActiveTheme: vi.fn(),
  getInstalledThemes: vi.fn(),
  getAllPluginPackages: vi.fn(),
  checkConnectivity: vi.fn(),
  getOfficialCatalog: vi.fn(),
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
  },
}));

vi.mock('@/core/admin/market/market-client', () => ({
  MarketClient: {
    checkConnectivity: mocks.checkConnectivity,
    getOfficialCatalog: mocks.getOfficialCatalog,
  },
}));

vi.mock('@/core/admin/extension-installer/official-only', () => ({
  isOfficialMarketOnly: () => false,
}));

import { getOfficialCatalog } from '@/core/admin/market/official-catalog';

function makeRemoteTheme(slug: string, name: string) {
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
    currentVersion: '1.0.0',
    sellableVersion: '1.0.0',
    installState: 'not_installed',
    installCount: 0,
    entitlementCount: 0,
    activeEntitlementCount: 0,
    versions: [
      {
        version: '1.0.0',
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

describe('getOfficialCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAllPluginPackages.mockResolvedValue([]);
    mocks.checkConnectivity.mockResolvedValue({ ok: true, error: undefined });
    mocks.getOfficialCatalog.mockResolvedValue({
      items: [
        makeRemoteTheme('esim-mall', 'eSIM Mall'),
        makeRemoteTheme('yevbi', 'Yevbi'),
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
});
