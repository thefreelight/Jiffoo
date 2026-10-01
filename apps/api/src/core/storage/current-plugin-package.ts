import { createHash } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import { prisma } from '@/config/database';
import { pluginPackageBlobStore } from './plugin-package-blob-store';
import { pluginPackageStore, type PluginPackage } from './plugin-package-store';
import { extractZipToTemp, cleanupTemp, readJsonFile, resolveExtractedPackageRoot, validatePluginManifest } from '@/core/admin/extension-installer/utils';
import type { PluginManifest } from '@/core/admin/extension-installer/types';
import { PLUGIN_MAX_ZIP_SIZE } from 'shared/plugin-signing';

type ResolutionCode = 'PLUGIN_PACKAGE_UNAVAILABLE' | 'PLUGIN_PACKAGE_CORRUPT' | 'PLUGIN_PACKAGE_MATERIALIZATION_TIMEOUT';

export class PluginPackageResolutionError extends Error {
  constructor(public readonly code: ResolutionCode, public readonly statusCode: number, slug: string) {
    super(`Plugin package resolution failed for ${slug}: ${code}`);
  }
}

const pending = new Map<string, Promise<void>>();
const waiting: Array<() => void> = [];
let active = 0;
const BUDGET_MS = 10_000;

async function limited(task: () => Promise<void>): Promise<void> {
  if (active >= 2) await new Promise<void>((resolve) => waiting.push(resolve));
  active++;
  try {
    await task();
  } finally {
    active--;
    waiting.shift()?.();
  }
}

async function materialize(slug: string, zipHash: string): Promise<void> {
  const key = `${slug}:${zipHash}`;
  let flight = pending.get(key);
  if (!flight) {
    flight = limited(async () => {
      if (await pluginPackageStore.get(slug, zipHash)) return;
      if (process.env.NODE_ENV === 'test' && process.env.JIFFOO_TEST_PLUGIN_MATERIALIZE_OBSERVE === '1' && process.send) {
        process.send({ kind: 'plugin-materialize-read', slug, zipHash });
      }
      const blob = await pluginPackageBlobStore.get(slug, zipHash);
      if (!blob) throw new PluginPackageResolutionError('PLUGIN_PACKAGE_UNAVAILABLE', 503, slug);
      const bytes = Buffer.from(blob.bytes);
      if (blob.sizeBytes > PLUGIN_MAX_ZIP_SIZE || bytes.length > PLUGIN_MAX_ZIP_SIZE
        || blob.sizeBytes !== bytes.length || createHash('sha256').update(bytes).digest('hex') !== zipHash) {
        console.error('Corrupt plugin package blob', { slug, zipHash });
        throw new PluginPackageResolutionError('PLUGIN_PACKAGE_CORRUPT', 500, slug);
      }
      let tempDir: string | null = null;
      let zipFile: { directory: string; filePath: string } | null = null;
      try {
        zipFile = await pluginPackageStore.createTemporaryFile('materialize', 'package.zip');
        await fs.writeFile(zipFile.filePath, bytes);
        tempDir = await extractZipToTemp(createReadStream(zipFile.filePath), 'plugin');
        const { rootDir, manifestPath } = await resolveExtractedPackageRoot(tempDir, 'plugin');
        const manifest = await readJsonFile<PluginManifest>(manifestPath);
        validatePluginManifest(manifest);
        if (manifest.slug !== slug) {
          console.error('Corrupt plugin package manifest', { slug, zipHash });
          throw new PluginPackageResolutionError('PLUGIN_PACKAGE_CORRUPT', 500, slug);
        }
        if (process.env.NODE_ENV === 'test' && process.env.JIFFOO_TEST_PLUGIN_MATERIALIZE_BARRIER === '1' && process.send) {
          process.send({ kind: 'plugin-materialize-ready', slug, zipHash });
          await new Promise<void>((resolve) => {
            const release = (message: unknown) => {
              if ((message as { kind?: string })?.kind !== 'plugin-materialize-release') return;
              process.off('message', release);
              process.send?.({ kind: 'plugin-materialize-released', slug, zipHash });
              resolve();
            };
            process.on('message', release);
          });
        }
        if (process.env.NODE_ENV === 'test' && process.env.JIFFOO_TEST_PLUGIN_MATERIALIZE_OBSERVE === '1' && process.send) {
          process.send({ kind: 'plugin-materialize-publish', slug, zipHash });
        }
        await pluginPackageStore.put(slug, zipHash, rootDir);
      } finally {
        if (tempDir) await cleanupTemp(tempDir);
        if (zipFile) await fs.rm(zipFile.directory, { recursive: true, force: true });
      }
    });
    pending.set(key, flight);
    void flight.finally(() => pending.delete(key)).catch(() => undefined);
  }
  await flight;
}

export async function resolveCurrentPluginPackage(slug: string, expectedHash?: string, allowDeleted = false): Promise<PluginPackage> {
  const resolve = async () => {
    const current = await prisma.pluginInstall.findUnique({ where: { slug }, select: { zipHash: true, source: true, deletedAt: true } });
    if (!current || (!allowDeleted && current.deletedAt) || !current.zipHash || (expectedHash && current.zipHash !== expectedHash))
      throw new PluginPackageResolutionError('PLUGIN_PACKAGE_UNAVAILABLE', 503, slug);
    let pkg = await pluginPackageStore.get(slug, current.zipHash);
    if (!pkg && current.source !== 'builtin') {
      await materialize(slug, current.zipHash);
      pkg = await pluginPackageStore.get(slug, current.zipHash);
    }
    if (!pkg) throw new PluginPackageResolutionError('PLUGIN_PACKAGE_UNAVAILABLE', 503, slug);
    const latest = await prisma.pluginInstall.findUnique({ where: { slug }, select: { zipHash: true, deletedAt: true } });
    if (!latest || (!allowDeleted && latest.deletedAt) || latest.zipHash !== current.zipHash)
      throw new PluginPackageResolutionError('PLUGIN_PACKAGE_UNAVAILABLE', 503, slug);
    return pkg;
  };
  let handle: NodeJS.Timeout;
  const timer = new Promise<never>((_, reject) => {
    handle = setTimeout(() => reject(new PluginPackageResolutionError('PLUGIN_PACKAGE_MATERIALIZATION_TIMEOUT', 503, slug)), BUDGET_MS);
  });
  try {
    return await Promise.race([resolve(), timer]);
  } finally {
    clearTimeout(handle!);
  }
}
