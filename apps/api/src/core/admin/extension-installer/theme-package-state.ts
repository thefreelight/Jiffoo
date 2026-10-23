import { createHash } from 'node:crypto';
import type { Theme } from '@prisma/client';
import { themePackageStore } from '@/core/storage/plugin-package-store';
import { themePackageBlobStore, type ThemePackageBlobMetadata } from '@/core/storage/theme-package-blob-store';
import { ExtensionInstallerError } from '@/core/extensions/shared/errors';
import { validateThemeManifest, validateThemeZip } from './theme-validator';

export type ThemePackageState = {
  status: 'available' | 'unavailable' | 'corrupt';
  code: 'THEME_PACKAGE_UNAVAILABLE' | 'THEME_PACKAGE_CORRUPT' | null;
};
export async function themePackageState(theme: Theme, metadata?: Map<string, ThemePackageBlobMetadata>, verifyArchive = false): Promise<ThemePackageState> {
  const available: ThemePackageState = { status: 'available', code: null };
  const unavailable: ThemePackageState = { status: 'unavailable', code: 'THEME_PACKAGE_UNAVAILABLE' };
  const corrupt: ThemePackageState = { status: 'corrupt', code: 'THEME_PACKAGE_CORRUPT' };
  try { validateThemeManifest(theme.manifestJson); }
  catch (cause) { if (cause instanceof ExtensionInstallerError) return corrupt; throw cause; }
  if (!theme.packageHash) return unavailable;
  if (!/^[a-f0-9]{64}$/.test(theme.packageHash)) return corrupt;
  if (theme.source === 'builtin' && !verifyArchive) return await themePackageStore.get(theme.slug, theme.packageHash) ? available : unavailable;
  if (metadata) {
    const blob = metadata.get(theme.slug);
    if (!blob) return unavailable;
    return blob.packageHash !== theme.packageHash || blob.sizeBytes !== blob.actualBytes
      || blob.sizeBytes <= 0 || blob.sizeBytes > 20 * 1024 * 1024 ? corrupt : available;
  }
  const blob = await themePackageBlobStore.get(theme.slug, theme.packageHash);
  if (!blob) return unavailable;
  const bytes = Buffer.from(blob.bytes);
  if (blob.sizeBytes !== bytes.length || bytes.length > 20 * 1024 * 1024
    || createHash('sha256').update(bytes).digest('hex') !== theme.packageHash) return corrupt;
  try {
    const { manifest } = validateThemeZip(bytes);
    return manifest.slug === theme.slug && manifest.target === theme.target ? available : corrupt;
  } catch (cause) { if (cause instanceof ExtensionInstallerError) return corrupt; throw cause; }
}
