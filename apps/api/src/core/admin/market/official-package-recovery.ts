import crypto from 'crypto';
import { createReadStream } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from '@/config/database';
import { extensionInstaller, type ExtensionKind } from '@/core/admin/extension-installer';
import { MarketClient } from './market-client';
import { cleanupDownloadedArtifact, downloadArtifactWithResume } from './resumable-downloader';
import { verifyOfficialArtifact } from './artifact-verification';

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
  deliveryMode: string,
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
      externalBaseUrl: typeof manifest.externalBaseUrl === 'string' ? manifest.externalBaseUrl : undefined,
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
    deliveryMode,
    restoredAt: new Date().toISOString(),
  };

  await fs.writeFile(metaPath, JSON.stringify(current, null, 2), 'utf-8');
}

async function recoverOfficialMarketExtensionFilesInternal(
  input: EnsureOfficialMarketExtensionFilesInput,
): Promise<void> {
  const detail = await MarketClient.getOfficialDetail(input.slug);
  const versionSummary =
    detail.versions.find((candidate) => candidate.version === input.version) ||
    detail.versions.find((candidate) => candidate.version === detail.currentVersion) ||
    detail.versions.find((candidate) => candidate.isCurrent) ||
    detail.versions[0];

  if (!versionSummary) {
    throw new Error(`Official extension "${input.slug}" does not expose a downloadable version`);
  }

  if (input.kind === 'plugin' && detail.kind !== 'plugin') {
    throw new Error(`Official extension "${input.slug}" is not a plugin`);
  }

  if (input.kind === 'theme-shop' && detail.kind !== 'theme') {
    throw new Error(`Official extension "${input.slug}" is not a shop theme`);
  }

  if (detail.deliveryMode !== 'package-managed') {
    throw new Error(
      `Official extension "${input.slug}" delivery mode "${detail.deliveryMode}" cannot be restored into local files`,
    );
  }

  const download = await downloadArtifactWithResume({
    slug: input.slug,
    version: versionSummary.version,
    url: versionSummary.packageUrl,
  });

  try {
    await verifyOfficialArtifact({
      filePath: download.filePath,
      packageUrl: versionSummary.packageUrl,
      checksumUrl: `${versionSummary.packageUrl}.sha256`,
      signatureUrl: `${versionSummary.packageUrl}.sig`,
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

    await updateInstalledMeta(
      installResult.fsPath,
      installResult.slug,
      versionSummary.version,
      versionSummary.packageUrl,
      detail.deliveryMode,
    );
  } finally {
    await cleanupDownloadedArtifact(input.slug, versionSummary.version);
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
