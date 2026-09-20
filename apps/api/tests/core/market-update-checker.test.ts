import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ findMany: vi.fn(), getActiveTheme: vi.fn(), getInstalledThemes: vi.fn(), fetchOfficialArtifactsIndex: vi.fn(), cacheSet: vi.fn(), cacheGet: vi.fn(), logSystem: vi.fn(), logError: vi.fn() }));
vi.mock('@/config/database', () => ({ prisma: { pluginInstall: { findMany: mocks.findMany } } }));
vi.mock('@/core/admin/theme-management/service', () => ({ ThemeManagementService: { getActiveTheme: mocks.getActiveTheme, getInstalledThemes: mocks.getInstalledThemes } }));
vi.mock('@/core/admin/market/official-artifacts-client', () => ({ fetchOfficialArtifactsIndex: mocks.fetchOfficialArtifactsIndex, buildOfficialArtifactMap: (items: Array<{ kind: string; slug: string }>) => new Map(items.map((item) => [`${item.kind}:${item.slug}`, item])) }));
vi.mock('@/core/cache/service', () => ({ CacheService: { set: mocks.cacheSet, get: mocks.cacheGet } }));
vi.mock('@/core/logger/unified-logger', () => ({ LoggerService: { logSystem: mocks.logSystem, logError: mocks.logError } }));
import { UpdateChecker } from '@/core/admin/market/update-checker';

describe('UpdateChecker', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.findMany.mockResolvedValue([]); mocks.getActiveTheme.mockResolvedValue({ slug: 'builtin', version: '1.0.0', source: 'builtin', type: 'pack' }); mocks.getInstalledThemes.mockResolvedValue({ items: [], total: 0 }); mocks.fetchOfficialArtifactsIndex.mockResolvedValue([]); mocks.cacheSet.mockResolvedValue(undefined); });
  it('uses only the artifact index for installed official extension updates', async () => {
    mocks.findMany.mockResolvedValue([{ slug: 'stripe', version: '1.0.0' }]);
    mocks.fetchOfficialArtifactsIndex.mockResolvedValue([{ slug: 'stripe', kind: 'plugin', version: '1.1.0', packageUrl: 'https://artifacts.example/stripe.jplugin' }]);
    await expect(UpdateChecker.check()).resolves.toContainEqual({ kind: 'plugin', slug: 'stripe', currentVersion: '1.0.0', latestVersion: '1.1.0', hasUpdate: true });
  });
});
