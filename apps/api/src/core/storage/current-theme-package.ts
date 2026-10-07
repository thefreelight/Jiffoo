import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { prisma } from '@/config/database';
import { ApiError } from '@/utils/api-errors';
import { validateThemeZip } from '@/core/admin/extension-installer/theme-validator';
import { ExtensionInstallerError } from '@/core/admin/extension-installer/errors';
import { themePackageBlobStore } from './theme-package-blob-store';
import { themePackageStore, type PluginPackage } from './plugin-package-store';
import { themeTestBarrier } from './theme-test-hooks';

type Code = 'THEME_PACKAGE_UNAVAILABLE' | 'THEME_PACKAGE_CORRUPT' | 'THEME_PACKAGE_MATERIALIZATION_TIMEOUT';
export class ThemePackageResolutionError extends ApiError {
  constructor(code: Code) { super(code); }
}
export type ThemeFiles = Pick<PluginPackage, 'exists'>;
const pending = new Map<string, Promise<PluginPackage>>();
const waiting: Array<() => void> = [];
let active = 0;

async function materialize(slug: string, packageHash: string, target: string): Promise<PluginPackage> {
  if (active >= 2) {
    if (process.env.NODE_ENV === 'test' && process.env.JIFFOO_TEST_THEME_BARRIER === 'materialize' && process.send)
      process.send({ kind: 'theme-materialize-queued', slug, packageHash });
    await new Promise<void>(resolve => waiting.push(resolve));
  }
  active++;
  let directory: string | undefined;
  try {
    const local = await themePackageStore.get(slug, packageHash);
    if (local) return local;
    const blob = await themePackageBlobStore.get(slug, packageHash);
    if (!blob) throw new ThemePackageResolutionError('THEME_PACKAGE_UNAVAILABLE');
    const bytes = Buffer.from(blob.bytes);
    if (bytes.length > 20 * 1024 * 1024 || bytes.length !== blob.sizeBytes || createHash('sha256').update(bytes).digest('hex') !== packageHash)
      throw new ThemePackageResolutionError('THEME_PACKAGE_CORRUPT');
    let validated: ReturnType<typeof validateThemeZip>;
    try { validated = validateThemeZip(bytes); }
    catch (error) {
      if (error instanceof ExtensionInstallerError) throw new ThemePackageResolutionError('THEME_PACKAGE_CORRUPT');
      throw error;
    }
    if (validated.manifest.slug !== slug || validated.manifest.target !== target)
      throw new ThemePackageResolutionError('THEME_PACKAGE_CORRUPT');
    await themeTestBarrier('materialize', slug, packageHash);
    directory = await themePackageStore.createTemporaryDirectory('materialize');
    for (const [name, content] of validated.files) {
      const file = path.join(directory, name);
      await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, content);
    }
    return (await themePackageStore.put(slug, packageHash, directory)).package;
  } finally {
    if (directory) await fs.rm(directory, { recursive: true, force: true });
    active--; waiting.shift()?.();
  }
}

export async function resolveThemePackage(slug: string, packageHash: string): Promise<PluginPackage> {
  const theme = await prisma.theme.findUnique({ where: { slug }, select: { target: true } });
  if (!theme || !/^[a-f0-9]{64}$/.test(packageHash)) throw new ThemePackageResolutionError('THEME_PACKAGE_UNAVAILABLE');
  // Check durable ownership even for a warm cache; uninstall must not revive it.
  if (!await prisma.themePackageBlob.count({ where: { themeSlug: slug, packageHash } }))
    throw new ThemePackageResolutionError('THEME_PACKAGE_UNAVAILABLE');
  let flight = pending.get(`${slug}:${packageHash}`);
  if (!flight) {
    flight = materialize(slug, packageHash, theme.target);
    pending.set(`${slug}:${packageHash}`, flight);
    void flight.finally(() => pending.delete(`${slug}:${packageHash}`)).catch(() => undefined);
  }
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([flight, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new ThemePackageResolutionError('THEME_PACKAGE_MATERIALIZATION_TIMEOUT')), 10000);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}
