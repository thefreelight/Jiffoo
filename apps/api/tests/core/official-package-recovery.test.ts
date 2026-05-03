import os from 'os';
import path from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'fs';

const mocks = vi.hoisted(() => ({
  getOfficialDetail: vi.fn(),
  downloadArtifactWithResume: vi.fn(),
  cleanupDownloadedArtifact: vi.fn(),
  verifyOfficialArtifact: vi.fn(),
  installFromZip: vi.fn(),
  pluginInstallUpdate: vi.fn(),
}));

vi.mock('@/core/admin/market/market-client', () => ({
  MarketClient: {
    getOfficialDetail: mocks.getOfficialDetail,
  },
}));

vi.mock('@/core/admin/market/resumable-downloader', () => ({
  downloadArtifactWithResume: mocks.downloadArtifactWithResume,
  cleanupDownloadedArtifact: mocks.cleanupDownloadedArtifact,
}));

vi.mock('@/core/admin/market/artifact-verification', () => ({
  verifyOfficialArtifact: mocks.verifyOfficialArtifact,
}));

vi.mock('@/core/admin/extension-installer', () => ({
  extensionInstaller: {
    installFromZip: mocks.installFromZip,
  },
}));

vi.mock('@/config/database', () => ({
  prisma: {
    pluginInstall: {
      update: mocks.pluginInstallUpdate,
    },
  },
}));

import { ensureOfficialMarketExtensionFiles } from '@/core/admin/market/official-package-recovery';

describe('ensureOfficialMarketExtensionFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyOfficialArtifact.mockResolvedValue({
      sha256: 'x'.repeat(64),
      checksumVerified: true,
      signatureVerified: true,
      signedBy: 'test-key',
    });
    mocks.cleanupDownloadedArtifact.mockResolvedValue(undefined);
    mocks.pluginInstallUpdate.mockResolvedValue(undefined);
  });

  it('restores official-market plugin files and refreshes installed metadata', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'official-plugin-recovery-'));
    const artifactPath = path.join(tempDir, 'stripe.jplugin');
    const installDir = path.join(tempDir, 'extensions', 'plugins', 'stripe');
    await fs.mkdir(installDir, { recursive: true });
    await fs.writeFile(artifactPath, 'artifact', 'utf-8');
    await fs.writeFile(
      path.join(installDir, '.installed.json'),
      JSON.stringify({ slug: 'stripe', version: '1.0.0', source: 'local-zip' }, null, 2),
      'utf-8',
    );

    mocks.getOfficialDetail.mockResolvedValue({
      slug: 'stripe',
      kind: 'plugin',
      deliveryMode: 'package-managed',
      currentVersion: '1.0.0',
      versions: [
        {
          version: '1.0.0',
          packageUrl: 'https://market.example.com/plugins/stripe/1.0.0.jplugin',
          isCurrent: true,
        },
      ],
    });
    mocks.downloadArtifactWithResume.mockResolvedValue({
      filePath: artifactPath,
      workspaceDir: tempDir,
      downloadedBytes: 8,
      totalBytes: 8,
      resumed: false,
      acceptRanges: true,
    });
    mocks.installFromZip.mockResolvedValue({
      slug: 'stripe',
      version: '1.0.0',
      fsPath: installDir,
    });

    await ensureOfficialMarketExtensionFiles({
      slug: 'stripe',
      kind: 'plugin',
      version: '1.0.0',
    });

    const installedMeta = JSON.parse(await fs.readFile(path.join(installDir, '.installed.json'), 'utf-8'));
    expect(mocks.verifyOfficialArtifact).toHaveBeenCalledWith({
      filePath: artifactPath,
      packageUrl: 'https://market.example.com/plugins/stripe/1.0.0.jplugin',
      checksumUrl: 'https://market.example.com/plugins/stripe/1.0.0.jplugin.sha256',
      signatureUrl: 'https://market.example.com/plugins/stripe/1.0.0.jplugin.sig',
    });
    expect(mocks.installFromZip).toHaveBeenCalledWith(
      'plugin',
      expect.anything(),
      { skipSignatureVerification: true },
    );
    expect(mocks.pluginInstallUpdate).toHaveBeenCalledWith({
      where: { slug: 'stripe' },
      data: { source: 'official-market' },
    });
    expect(installedMeta.source).toBe('official-market');
    expect(installedMeta.officialMarket.installedVersion).toBe('1.0.0');
    expect(installedMeta.officialMarket.packageUrl).toBe('https://market.example.com/plugins/stripe/1.0.0.jplugin');
  });

  it('rebuilds installed metadata when .installed.json is missing', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'official-plugin-recovery-meta-'));
    const artifactPath = path.join(tempDir, 'i18n.jplugin');
    const installDir = path.join(tempDir, 'extensions', 'plugins', 'i18n');
    await fs.mkdir(installDir, { recursive: true });
    await fs.writeFile(artifactPath, 'artifact', 'utf-8');
    await fs.writeFile(
      path.join(installDir, 'manifest.json'),
      JSON.stringify({
        slug: 'i18n',
        name: 'i18n',
        version: '1.2.0',
        category: 'localization',
        runtimeType: 'internal-fastify',
        permissions: ['store.read'],
      }),
      'utf-8',
    );

    mocks.getOfficialDetail.mockResolvedValue({
      slug: 'i18n',
      kind: 'plugin',
      deliveryMode: 'package-managed',
      currentVersion: '1.2.0',
      versions: [
        {
          version: '1.2.0',
          packageUrl: 'https://market.example.com/plugins/i18n/1.2.0.jplugin',
          isCurrent: true,
        },
      ],
    });
    mocks.downloadArtifactWithResume.mockResolvedValue({
      filePath: artifactPath,
      workspaceDir: tempDir,
      downloadedBytes: 8,
      totalBytes: 8,
      resumed: false,
      acceptRanges: true,
    });
    mocks.installFromZip.mockResolvedValue({
      slug: 'i18n',
      version: '1.2.0',
      fsPath: installDir,
    });

    await ensureOfficialMarketExtensionFiles({
      slug: 'i18n',
      kind: 'plugin',
      version: '1.2.0',
    });

    const installedMeta = JSON.parse(await fs.readFile(path.join(installDir, '.installed.json'), 'utf-8'));
    expect(installedMeta.slug).toBe('i18n');
    expect(installedMeta.name).toBe('i18n');
    expect(installedMeta.version).toBe('1.2.0');
    expect(installedMeta.source).toBe('official-market');
    expect(installedMeta.permissions).toEqual(['store.read']);
    expect(installedMeta.officialMarket.installedVersion).toBe('1.2.0');
  });
});
