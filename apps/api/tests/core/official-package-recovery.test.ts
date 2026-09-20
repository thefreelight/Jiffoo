import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pluginPackageStore } from '@/core/storage/plugin-package-store';

const mocks = vi.hoisted(() => ({ fetchOfficialArtifactsIndex: vi.fn(), downloadArtifactWithResume: vi.fn(), cleanupDownloadedArtifact: vi.fn(), verifyOfficialArtifact: vi.fn(), installFromZip: vi.fn(), pluginInstallUpdate: vi.fn() }));
vi.mock('@/core/admin/market/official-artifacts-client', () => ({ fetchOfficialArtifactsIndex: mocks.fetchOfficialArtifactsIndex }));
vi.mock('@/core/admin/market/resumable-downloader', () => ({ downloadArtifactWithResume: mocks.downloadArtifactWithResume, cleanupDownloadedArtifact: mocks.cleanupDownloadedArtifact }));
vi.mock('@/core/admin/market/artifact-verification', () => ({ verifyOfficialArtifact: mocks.verifyOfficialArtifact }));
vi.mock('@/core/admin/extension-installer', () => ({ extensionInstaller: { installFromZip: mocks.installFromZip } }));
vi.mock('@/config/database', () => ({ prisma: { pluginInstall: { update: mocks.pluginInstallUpdate } } }));
import { ensureOfficialMarketExtensionFiles } from '@/core/admin/market/official-package-recovery';

describe('ensureOfficialMarketExtensionFiles', () => {
  const slug = `official-recovery-${Date.now().toString(36)}`;
  let tempDir: string | undefined;

  beforeEach(() => { vi.clearAllMocks(); mocks.cleanupDownloadedArtifact.mockResolvedValue(undefined); mocks.pluginInstallUpdate.mockResolvedValue(undefined); });
  afterEach(async () => {
    await pluginPackageStore.delete(slug);
    if (tempDir) await fs.rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  });

  it('restores a verified package from the artifact index without a platform authorization', async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'official-recovery-'));
    const artifactPath = path.join(tempDir, 'stripe.jplugin');
    const sourceDirectory = path.join(tempDir, 'package');
    await fs.mkdir(sourceDirectory, { recursive: true });
    await fs.writeFile(artifactPath, 'artifact');
    await fs.writeFile(
      path.join(sourceDirectory, '.installed.json'),
      JSON.stringify({ slug, version: '1.0.0', source: 'local-zip' }),
    );
    const deployment = await pluginPackageStore.put(slug, sourceDirectory);
    await deployment.commit();
    mocks.fetchOfficialArtifactsIndex.mockResolvedValue([{ slug, kind: 'plugin', version: '1.0.0', packageUrl: 'https://artifacts.example/stripe.jplugin' }]);
    mocks.downloadArtifactWithResume.mockResolvedValue({ filePath: artifactPath });
    mocks.installFromZip.mockResolvedValue({ slug, version: '1.0.0' });
    await ensureOfficialMarketExtensionFiles({ slug, kind: 'plugin', version: '1.0.0' });
    expect(mocks.verifyOfficialArtifact).toHaveBeenCalledWith(expect.objectContaining({ packageUrl: 'https://artifacts.example/stripe.jplugin' }));
    expect(mocks.pluginInstallUpdate).toHaveBeenCalledWith({ where: { slug }, data: { source: 'official-market' } });
    const pluginPackage = await pluginPackageStore.get(slug);
    expect(JSON.parse(await pluginPackage!.readText('.installed.json'))).toMatchObject({
      slug,
      source: 'official-market',
      officialMarket: { packageUrl: 'https://artifacts.example/stripe.jplugin' },
    });
  });
});
