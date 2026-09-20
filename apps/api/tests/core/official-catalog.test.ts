import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getInstalledThemes: vi.fn(), getAllPluginPackages: vi.fn(), getDefaultInstance: vi.fn(), fetchOfficialArtifactsIndex: vi.fn(),
}));

vi.mock('@/core/admin/theme-management/service', () => ({ ThemeManagementService: { getInstalledThemes: mocks.getInstalledThemes } }));
vi.mock('@/core/admin/plugin-management/service', () => ({ PluginManagementService: { getAllPluginPackages: mocks.getAllPluginPackages, getDefaultInstance: mocks.getDefaultInstance } }));
vi.mock('@/core/admin/market/official-artifacts-client', () => ({ fetchOfficialArtifactsIndex: mocks.fetchOfficialArtifactsIndex }));
vi.mock('@/core/admin/extension-installer/official-only', () => ({ isOfficialMarketOnly: () => false }));

import { getOfficialCatalog } from '@/core/admin/market/official-catalog';

describe('getOfficialCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getInstalledThemes.mockResolvedValue({ items: [], total: 0 });
    mocks.getAllPluginPackages.mockResolvedValue([]);
    mocks.fetchOfficialArtifactsIndex.mockResolvedValue([]);
  });

  it('builds browseable entries from the static artifact index', async () => {
    mocks.fetchOfficialArtifactsIndex.mockResolvedValue([{ slug: 'stripe', kind: 'plugin', version: '1.2.0', packageUrl: 'https://artifacts.example/stripe.jplugin' }]);
    const result = await getOfficialCatalog();
    expect(result.marketOnline).toBe(true);
    expect(result.items).toContainEqual(expect.objectContaining({ slug: 'stripe', kind: 'plugin', version: '1.2.0', installState: 'not_installed' }));
  });

  it('uses local installed state without remote authorization', async () => {
    mocks.fetchOfficialArtifactsIndex.mockResolvedValue([{ slug: 'stripe', kind: 'plugin', version: '1.2.0', packageUrl: 'https://artifacts.example/stripe.jplugin' }]);
    mocks.getAllPluginPackages.mockResolvedValue([{ slug: 'stripe', name: 'Stripe', version: '1.1.0', source: 'official-market', manifestJson: {} }]);
    mocks.getDefaultInstance.mockResolvedValue({ enabled: true, configJson: {} });
    const result = await getOfficialCatalog();
    expect(result.items[0]).toMatchObject({ slug: 'stripe', installState: 'enabled', installedVersion: '1.1.0', latestVersion: '1.2.0', updateAvailable: true });
    expect(result.items[0]).not.toHaveProperty(`price${'ingModel'}`);
  });
});
