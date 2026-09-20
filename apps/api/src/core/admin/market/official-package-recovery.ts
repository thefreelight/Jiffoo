import crypto from 'crypto';
import { createReadStream } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from '@/config/database';
import { extensionInstaller, type ExtensionKind } from '@/core/admin/extension-installer';
import { cleanupDownloadedArtifact, downloadArtifactWithResume } from './resumable-downloader';
import { verifyOfficialArtifact } from './artifact-verification';
import { fetchOfficialArtifactsIndex } from './official-artifacts-client';
import { pluginPackageStore, type PluginPackage } from '@/core/storage/plugin-package-store';

type RecoverableOfficialKind = 'plugin' | 'theme-shop';

interface EnsureOfficialMarketExtensionFilesInput {
  slug: string;
  kind: RecoverableOfficialKind;
  version?: string;
}

type RecoveryLockKey = `${RecoverableOfficialKind}:${string}:${string}`;

const recoveryLocks = new Map<RecoveryLockKey, Promise<void>>();

function toExtensionKind(kind: RecoverableOfficialKind): ExtensionKind {
  return kind;
}

function buildRecoveryLockKey(input: EnsureOfficialMarketExtensionFilesInput, version: string): RecoveryLockKey {
  return `${input.kind}:${input.slug}:${version}`;
}

async function updateInstalledMeta(
  fsPath: string,
  slug: string,
  version: string,
  packageUrl: string,
): Promise<void> {
  const metaPath = path.join(fsPath, '.installed.json');
  let current: Record<string, unknown>;

  try {
    current = JSON.parse(await fs.readFile(metaPath, 'utf-8')) as Record<string, unknown>;
  } catch {
    const manifestPath = path.join(fsPath, 'manifest.json');
    const stat = await fs.stat(fsPath);
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf-8')) as Record<string, unknown>;

    current = {
      id: crypto.randomUUID(),
      slug: typeof manifest.slug === 'string' ? manifest.slug : slug,
      name: typeof manifest.name === 'string' ? manifest.name : slug,
      version: typeof manifest.version === 'string' ? manifest.version : version,
      description: typeof manifest.description === 'string' ? manifest.description : '',
      category: typeof manifest.category === 'string' ? manifest.category : 'general',
      runtimeType: typeof manifest.runtimeType === 'string' ? manifest.runtimeType : 'internal-fastify',
      entryModule: typeof manifest.entryModule === 'string' ? manifest.entryModule : undefined,
      source: 'official-market',
      fsPath,
      permissions: Array.isArray(manifest.permissions) ? manifest.permissions : [],
      author: typeof manifest.author === 'string' ? manifest.author : undefined,
      authorUrl: typeof manifest.authorUrl === 'string' ? manifest.authorUrl : undefined,
      installedAt: stat.birthtime.toISOString(),
      updatedAt: stat.mtime.toISOString(),
    };
  }

  current.source = 'official-market';
  current.officialMarket = {
    requestedVersion: version,
    installedVersion: version,
    packageUrl,
    restoredAt: new Date().toISOString(),
  };

  await fs.writeFile(metaPath, JSON.stringify(current, null, 2), 'utf-8');
}

async function updatePluginInstalledMeta(pluginPackage: PluginPackage, slug: string, version: string, packageUrl: string): Promise<void> {
  let current: Record<string, unknown>;
  try {
    current = JSON.parse(await pluginPackage.readText('.installed.json')) as Record<string, unknown>;
  } catch {
    const manifest = JSON.parse(await pluginPackage.readText('manifest.json')) as Record<string, unknown>;
    const stat = await pluginPackage.stat();
    current = {
      id: crypto.randomUUID(), slug: typeof manifest.slug === 'string' ? manifest.slug : slug,
      name: typeof manifest.name === 'string' ? manifest.name : slug,
      version: typeof manifest.version === 'string' ? manifest.version : version,
      description: typeof manifest.description === 'string' ? manifest.description : '',
      category: typeof manifest.category === 'string' ? manifest.category : 'general',
      runtimeType: typeof manifest.runtimeType === 'string' ? manifest.runtimeType : 'internal-fastify',
      entryModule: typeof manifest.entryModule === 'string' ? manifest.entryModule : undefined,
      source: 'official-market', fsPath: pluginPackage.getEntryPath(''),
      permissions: Array.isArray(manifest.permissions) ? manifest.permissions : [],
      author: typeof manifest.author === 'string' ? manifest.author : undefined,
      authorUrl: typeof manifest.authorUrl === 'string' ? manifest.authorUrl : undefined,
      installedAt: stat.birthtime.toISOString(), updatedAt: stat.mtime.toISOString(),
    };
  }
  current.source = 'official-market';
  current.officialMarket = { requestedVersion: version, installedVersion: version, packageUrl, restoredAt: new Date().toISOString() };
  await pluginPackage.writeText('.installed.json', JSON.stringify(current, null, 2));
}

async function recoverOfficialMarketExtensionFilesInternal(
  input: EnsureOfficialMarketExtensionFilesInput,
): Promise<void> {
  const artifactKind = input.kind === 'plugin' ? 'plugin' : 'theme';
  const artifacts = await fetchOfficialArtifactsIndex({ fresh: true });
  const artifact = artifacts.find((item) =>
    item.slug === input.slug && item.kind === artifactKind && (!input.version || item.version === input.version),
  );
  if (!artifact) {
    throw new Error(`Official ${artifactKind} "${input.slug}" does not expose the requested artifact`);
  }

  const download = await downloadArtifactWithResume({
    slug: input.slug,
    version: artifact.version,
    url: artifact.packageUrl,
  });

  try {
    await verifyOfficialArtifact({
      filePath: download.filePath,
      packageUrl: artifact.packageUrl,
      checksumUrl: `${artifact.packageUrl}.sha256`,
      signatureUrl: `${artifact.packageUrl}.sig`,
    });

    const installResult = await extensionInstaller.installFromZip(
      toExtensionKind(input.kind),
      createReadStream(download.filePath),
    );

    if (input.kind === 'plugin') {
      await prisma.pluginInstall.update({
        where: { slug: installResult.slug },
        data: { source: 'official-market' },
      });
    }

    const pluginPackage = input.kind === 'plugin' ? await pluginPackageStore.get(installResult.slug) : null;
    if (input.kind === 'plugin') {
      if (!pluginPackage) throw new Error(`Plugin package files are missing for "${installResult.slug}"`);
      await updatePluginInstalledMeta(pluginPackage, installResult.slug, artifact.version, artifact.packageUrl);
    } else {
    await updateInstalledMeta(
      installResult.fsPath,
      installResult.slug,
      artifact.version,
      artifact.packageUrl,
    );
    }
  } finally {
    await cleanupDownloadedArtifact(input.slug, artifact.version);
  }
}

export async function ensureOfficialMarketExtensionFiles(
  input: EnsureOfficialMarketExtensionFilesInput,
): Promise<void> {
  const version = input.version || 'current';
  const lockKey = buildRecoveryLockKey(input, version);
  const existing = recoveryLocks.get(lockKey);
  if (existing) {
    await existing;
    return;
  }

  const recoveryPromise = recoverOfficialMarketExtensionFilesInternal(input)
    .catch((error) => {
      throw new Error(
        `Failed to restore official ${input.kind === 'plugin' ? 'plugin' : 'theme'} "${input.slug}": ${error instanceof Error ? error.message : String(error)}`,
      );
    })
    .finally(() => {
      recoveryLocks.delete(lockKey);
    });

  recoveryLocks.set(lockKey, recoveryPromise);
  await recoveryPromise;
}
