import { promises as fs } from 'fs';
import path from 'path';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { prisma } from '@/config/database';
import { installBuiltinTheme } from './theme-service';
import { activateTheme } from './theme-runtime';
import { validateThemeManifest, validateThemeZip } from './theme-validator';
import { ExtensionInstallerError } from './errors';
import { ThemePackageResolutionError } from '@/core/storage/current-theme-package';

const LOCK = 824_301_552;

export async function syncBuiltinThemes(root: string): Promise<void> {
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${LOCK})::text`;
    const builtins = new Map<string, string>();
    for (const entry of (await fs.readdir(root, { withFileTypes: true })).filter((item) => item.isDirectory())) {
      const installed = await installBuiltinTheme(path.join(root, entry.name));
      if (installed.slug === `default-${installed.target}`) builtins.set(installed.target, installed.slug);
      await activateTheme(installed.target as 'shop' | 'admin', installed.slug, 'system', 'theme.activate', true);
    }
    for (const target of ['admin', 'shop'] as const) {
      const fallback = builtins.get(target);
      if (!fallback) continue;
      const active = await prisma.themeActive.findUnique({ where: { target } });
      if (!active) continue;
      try {
        const stored = await prisma.theme.findUniqueOrThrow({ where: { slug: active.slug } });
        const manifest = validateThemeManifest(stored.manifestJson);
        const blob = await prisma.themePackageBlob.findUnique({ where: { themeSlug_packageHash: { themeSlug: active.slug, packageHash: active.packageHash } } });
        if (stored.target !== target || manifest.target !== target || stored.packageHash !== active.packageHash || !blob)
          throw new ThemePackageResolutionError('THEME_PACKAGE_UNAVAILABLE');
        const bytes = Buffer.from(blob.bytes);
        if (bytes.length !== blob.sizeBytes || createHash('sha256').update(bytes).digest('hex') !== active.packageHash)
          throw new ThemePackageResolutionError('THEME_PACKAGE_CORRUPT');
        const packaged = validateThemeZip(bytes).manifest;
        if (packaged.slug !== stored.slug || packaged.target !== target || packaged.version !== stored.version
          || !isDeepStrictEqual(packaged, manifest))
          throw new ThemePackageResolutionError('THEME_PACKAGE_CORRUPT');
      } catch (cause) {
        if (!(cause instanceof ExtensionInstallerError) && !(cause instanceof ThemePackageResolutionError)) throw cause;
        // Preserve invalid packages and configuration for inspection; only the active pointer changes.
        await activateTheme(target, fallback, 'system', 'theme.startup_fallback');
      }
    }
  }, { timeout: 120000 });
}
