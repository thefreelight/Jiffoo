import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('shared', () => ({
  createAdminClient: vi.fn(() => mocks.apiClient),
  getAdminClient: vi.fn(() => mocks.apiClient),
}));

import {
  marketApi,
  themesApi,
  upgradeApi,
  unwrapApiResponse,
} from '../../lib/api';

describe('Admin API productization contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps release truth fields from the upgrade version endpoint intact', async () => {
    mocks.apiClient.get.mockResolvedValueOnce({
      success: true,
      data: {
        currentVersion: '1.0.35',
        latestVersion: '1.0.35',
        updateAvailable: false,
        deliveryMode: 'image-first',
        runtimeImages: {
          api: 'ghcr.io/thefreelight/jiffoo-api:1.0.35',
          admin: 'ghcr.io/thefreelight/jiffoo-admin:1.0.35',
          shop: 'ghcr.io/thefreelight/jiffoo-shop:1.0.35',
          updater: 'ghcr.io/thefreelight/jiffoo-updater:1.0.35',
        },
        releaseTag: 'v1.0.35-opensource',
        repository: 'thefreelight/Jiffoo',
        manifestUrl: 'https://get.jiffoo.com/releases/core/manifest.json',
        manifestStatus: 'available',
        sourceArchiveUrl: 'https://get.jiffoo.com/jiffoo-source.tar.gz',
        checksumUrl: 'https://get.jiffoo.com/jiffoo-source.tar.gz.sha256',
        oneClickUpgradeSupported: true,
        oneClickUpgradeAvailable: true,
        oneClickUpgradeBlockedReason: null,
        requiresManualIntervention: false,
        recoveryMode: 'automatic-recovery',
      },
    });

    const response = await upgradeApi.getVersion();
    const data = unwrapApiResponse(response);

    expect(mocks.apiClient.get).toHaveBeenCalledWith('/upgrade/version');
    expect(data).toMatchObject({
      currentVersion: '1.0.35',
      latestVersion: '1.0.35',
      deliveryMode: 'image-first',
      runtimeImages: {
        api: 'ghcr.io/thefreelight/jiffoo-api:1.0.35',
        admin: 'ghcr.io/thefreelight/jiffoo-admin:1.0.35',
        shop: 'ghcr.io/thefreelight/jiffoo-shop:1.0.35',
        updater: 'ghcr.io/thefreelight/jiffoo-updater:1.0.35',
      },
      releaseTag: 'v1.0.35-opensource',
      repository: 'thefreelight/Jiffoo',
      manifestUrl: 'https://get.jiffoo.com/releases/core/manifest.json',
      manifestStatus: 'available',
      sourceArchiveUrl: 'https://get.jiffoo.com/jiffoo-source.tar.gz',
      checksumUrl: 'https://get.jiffoo.com/jiffoo-source.tar.gz.sha256',
      oneClickUpgradeSupported: true,
      oneClickUpgradeAvailable: true,
      oneClickUpgradeBlockedReason: null,
      requiresManualIntervention: false,
      recoveryMode: 'automatic-recovery',
    });
  });

  it('uses canonical upgrade action endpoints and target-version payloads', async () => {
    mocks.apiClient.get.mockResolvedValue({ success: true, data: {} });
    mocks.apiClient.post.mockResolvedValue({ success: true, data: {} });

    await upgradeApi.getStatus();
    await upgradeApi.resetStatus();
    await upgradeApi.perform('1.0.36');
    await upgradeApi.check('1.0.36');
    await upgradeApi.backup();

    expect(mocks.apiClient.get).toHaveBeenCalledWith('/upgrade/status');
    expect(mocks.apiClient.post).toHaveBeenCalledWith('/upgrade/status/reset', {});
    expect(mocks.apiClient.post).toHaveBeenCalledWith('/upgrade/perform', { targetVersion: '1.0.36' });
    expect(mocks.apiClient.post).toHaveBeenCalledWith('/upgrade/check', { targetVersion: '1.0.36' });
    expect(mocks.apiClient.post).toHaveBeenCalledWith('/upgrade/backup', {});
  });

  it('sends official market installs through the install handoff with version and activation intent', async () => {
    mocks.apiClient.get.mockResolvedValueOnce({ success: true, data: { items: [] } });
    mocks.apiClient.post.mockResolvedValueOnce({
      success: true,
      data: {
        kind: 'theme-shop',
        slug: 'modelsfind',
        version: '0.1.4',
        source: 'official-market',
      },
    });

    await marketApi.getOfficialCatalog();
    const response = await marketApi.installOfficialExtension('modelsfind', {
      kind: 'theme-shop',
      version: '0.1.4',
      activate: true,
    });

    expect(mocks.apiClient.get).toHaveBeenCalledWith('/admin/market/official-catalog');
    expect(mocks.apiClient.post).toHaveBeenCalledWith(
      '/admin/market/extensions/modelsfind/install',
      {
        kind: 'theme-shop',
        version: '0.1.4',
        activate: true,
      },
      {
        timeout: 120000,
      },
    );
    expect(unwrapApiResponse(response)).toMatchObject({
      slug: 'modelsfind',
      version: '0.1.4',
      source: 'official-market',
    });
  });

  it('uses active installed theme endpoints without client-side slug/version rewrites', async () => {
    mocks.apiClient.get.mockResolvedValue({ success: true, data: {} });
    mocks.apiClient.post.mockResolvedValue({ success: true, data: {} });
    mocks.apiClient.put.mockResolvedValue({ success: true, data: {} });
    mocks.apiClient.delete.mockResolvedValue({ success: true, data: {} });

    await themesApi.getInstalled('shop', 2, 50);
    await themesApi.getActive('shop');
    await themesApi.activate('modelsfind', 'shop', undefined, 'pack');
    await themesApi.updateConfig({ brand: { name: 'ModelsFind' } }, 'shop');
    await themesApi.rollback('shop');
    await themesApi.uninstall('shop', 'modelsfind', 'pack');

    expect(mocks.apiClient.get).toHaveBeenCalledWith('/admin/themes/shop/installed', {
      params: { page: 2, limit: 50 },
    });
    expect(mocks.apiClient.get).toHaveBeenCalledWith('/admin/themes/shop/active');
    expect(mocks.apiClient.post).toHaveBeenCalledWith('/admin/themes/shop/modelsfind/activate', {
      type: 'pack',
    });
    expect(mocks.apiClient.put).toHaveBeenCalledWith('/admin/themes/shop/config', {
      brand: { name: 'ModelsFind' },
    });
    expect(mocks.apiClient.post).toHaveBeenCalledWith('/admin/themes/shop/rollback', {});
    expect(mocks.apiClient.delete).toHaveBeenCalledWith('/extensions/theme-shop/modelsfind');
  });
});
