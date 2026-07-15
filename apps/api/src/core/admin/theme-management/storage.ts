import path from 'path';
import { promises as fs } from 'fs';
import type { ThemeTarget } from '@/core/admin/extension-installer/types';

function getThemeDir(target: ThemeTarget, slug?: string): string {
  const extensionsPath = process.env.EXTENSIONS_PATH || 'extensions';
  const root = path.isAbsolute(extensionsPath)
    ? extensionsPath
    : path.join(process.cwd(), extensionsPath);
  const base = path.join(root, 'themes', target);
  return slug ? path.join(base, slug) : base;
}

function assertPathSegment(value: string, label: string): void {
  if (!value || value === '.' || value === '..' || value.includes('/') || value.includes('\\')) {
    throw new Error(`Invalid theme ${label}: ${value}`);
  }
}

export function getThemeVersionDir(target: ThemeTarget, slug: string, version: string): string {
  assertPathSegment(slug, 'slug');
  assertPathSegment(version, 'version');
  return path.join(getThemeDir(target), '.versions', slug, version);
}

export async function hasThemeManifest(directory: string): Promise<boolean> {
  try {
    await fs.access(path.join(directory, 'theme.json'));
    return true;
  } catch {
    return false;
  }
}

export async function ensureThemeVersionSnapshot(
  target: ThemeTarget,
  slug: string,
  version: string,
): Promise<string> {
  const sourceDir = getThemeDir(target, slug);
  const versionDir = getThemeVersionDir(target, slug, version);

  if (await hasThemeManifest(versionDir)) {
    return versionDir;
  }
  if (!(await hasThemeManifest(sourceDir))) {
    throw new Error(`Theme source is missing theme.json: ${sourceDir}`);
  }

  const versionsRoot = path.dirname(versionDir);
  await fs.mkdir(versionsRoot, { recursive: true });
  const tempDir = path.join(versionsRoot, `.${version}.tmp-${process.pid}-${Date.now()}`);

  try {
    await fs.cp(sourceDir, tempDir, { recursive: true, force: false, errorOnExist: true });
    try {
      await fs.rename(tempDir, versionDir);
    } catch (error) {
      if (await hasThemeManifest(versionDir)) {
        await fs.rm(tempDir, { recursive: true, force: true });
      } else {
        throw error;
      }
    }
  } catch (error) {
    await fs.rm(tempDir, { recursive: true, force: true });
    throw error;
  }

  return versionDir;
}

export async function removeThemeVersionSnapshots(target: ThemeTarget, slug: string): Promise<void> {
  assertPathSegment(slug, 'slug');
  await fs.rm(path.join(getThemeDir(target), '.versions', slug), { recursive: true, force: true });
}
