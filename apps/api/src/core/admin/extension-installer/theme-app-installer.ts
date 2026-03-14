/**
 * Theme App Installer Service
 *
 * Handles installation of Theme App ZIP files (executable Next.js standalone themes).
 *
 * Theme App format (per EXTENSIONS_BLUEPRINT.md):
 * - theme-app.json (manifest)
 * - .next/ (Next.js build output)
 * - public/ (static assets)
 * - server.js (standalone server entry)
 *
 * Constraints:
 * - Must contain valid theme-app.json with schemaVersion=1
 * - Must have runtime.kind=next-standalone
 * - Must have runtime.entry pointing to server entry file
 * - Build artifacts required: .next/static and/or public
 * - Source files (.ts/.tsx/.jsx) are prohibited
 * - Scripts and binaries are prohibited
 * - .map files are prohibited
 *
 * Installation path:
 * - extensions/themes-app/{target}/{slug}/{version}/
 */

import { Readable } from 'stream';
import path from 'path';
import { promises as fs } from 'fs';
import {
  extractZipToTemp,
  cleanupTemp,
  readJsonFile,
  resolveExtractedPackageRoot,
  moveDir,
  dirExists,
  EXTENSIONS_ROOT,
  calculateStreamHash,
  bufferToStream,
} from './utils';
import { ExtensionInstallerError } from './errors';
import type { ThemeTarget, ExtensionSource } from './types';
import { verifyPackageFromFiles, getSignatureVerifyMode } from './signature-verifier';
import {
  DEFAULT_THEME_APP_HEALTH_CHECK_PATH,
  THEME_APP_MANIFEST_FILE,
  getThemeAppManifestIssues,
} from '../theme-app-runtime/contract';
import type { ThemeAppManifest } from '../theme-app-runtime/contract';

/**
 * Installed Theme App metadata
 */
export interface InstalledThemeApp {
  slug: string;
  name: string;
  version: string;
  target: ThemeTarget;
  type: 'theme-app';
  source: ExtensionSource;
  fsPath: string;
  runtime: {
    kind: 'next-standalone';
    entry: string;
    healthPath: string;
  };
  description?: string;
  author?: string;
  authorUrl?: string;
  icon?: string;
  screenshots?: string[];
  tags?: string[];
  installedAt: string;
  signatureVerified?: boolean;
  signedBy?: string;
}

// ============================================================================
// Constants
// ============================================================================

const INSTALLED_META_FILE = '.installed.json';

async function invalidateThemeCache(target: ThemeTarget): Promise<void> {
  const { CacheService } = await import('@/core/cache/service');
  await CacheService.delete(`themes:installed:${target}`);
  await CacheService.delete(`themes:active:${target}`);
}

// File type validation rules
const ALLOWED_EXTENSIONS = [
  '.js', '.json', '.css', '.html', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp',
  '.woff', '.woff2', '.ttf', '.eot', '.ico', '.txt', '.md'
];

const PROHIBITED_EXTENSIONS = [
  '.ts', '.tsx', '.jsx', // Source files
  '.sh', '.bat', '.ps1', '.cmd', // Scripts
  '.exe', '.dll', '.so', '.dylib', // Binaries
  '.map', // Source maps
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get Theme App directory path
 */
function getThemeAppDir(target: ThemeTarget, slug: string, version: string): string {
  const baseDir = path.join(EXTENSIONS_ROOT, 'themes-app', target);
  return path.join(baseDir, slug, version);
}

/**
 * Validate Theme App file types (prohibit source files, scripts, binaries)
 */
async function validateThemeAppFileTypes(rootDir: string): Promise<void> {
  const files = await getAllFiles(rootDir);

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();

    // Check prohibited extensions
    if (PROHIBITED_EXTENSIONS.includes(ext)) {
      throw new ExtensionInstallerError(
        `Invalid Theme App: prohibited file type "${ext}" found in "${path.relative(rootDir, file)}"`,
        { code: 'PROHIBITED_FILE_TYPE', statusCode: 400 }
      );
    }

    // If not in allowed list and not prohibited, warn but allow
    if (!ALLOWED_EXTENSIONS.includes(ext) && ext !== '') {
      console.warn(`[ThemeAppInstaller] Unknown file type "${ext}" in "${path.relative(rootDir, file)}"`);
    }
  }
}

/**
 * Get all files recursively
 */
async function getAllFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await getAllFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
}
function validateThemeAppManifest(manifest: ThemeAppManifest): void {
  const issues = getThemeAppManifestIssues(manifest);
  if (issues.length > 0) {
    const issue = issues[0];
    throw new ExtensionInstallerError(
      `Invalid ${THEME_APP_MANIFEST_FILE}: ${issue.path} ${issue.message}`,
      { code: issue.code, statusCode: 400 }
    );
  }
}

/**
 * Validate Theme App build artifacts
 */
async function validateBuildArtifacts(rootDir: string, manifest: ThemeAppManifest): Promise<void> {
  // Check runtime.entry exists
  const entryPath = path.join(rootDir, manifest.runtime.entry);
  try {
    await fs.access(entryPath);
  } catch {
    throw new ExtensionInstallerError(
      `Invalid Theme App: runtime.entry "${manifest.runtime.entry}" not found`,
      { code: 'MISSING_ENTRY_FILE', statusCode: 400 }
    );
  }

  // Check for at least one of: .next/static or public
  const nextStaticDir = path.join(rootDir, '.next', 'static');
  const publicDir = path.join(rootDir, 'public');

  const hasNextStatic = await dirExists(nextStaticDir);
  const hasPublic = await dirExists(publicDir);

  if (!hasNextStatic && !hasPublic) {
    throw new ExtensionInstallerError(
      'Invalid Theme App: must contain either .next/static or public directory',
      { code: 'MISSING_BUILD_ARTIFACTS', statusCode: 400 }
    );
  }
}

// ============================================================================
// Theme App Installer Implementation
// ============================================================================

/**
 * Theme App installer implementation
 */
export class ThemeAppInstaller {
  /**
   * Install Theme App from ZIP
   */
  async install(target: ThemeTarget, zipStream: Readable): Promise<InstalledThemeApp> {
    let tempDir: string | null = null;

    try {
      // 1. Buffer ZIP and extract to temporary directory with security validation
      const hashResult = await calculateStreamHash(zipStream);
      const zipBuffer = hashResult.buffer;
      const bufferStream = bufferToStream(zipBuffer);
      tempDir = await extractZipToTemp(bufferStream, target === 'shop' ? 'theme-app-shop' : 'theme-app-admin');

      // 2. Resolve package root & read theme-app.json
      const { rootDir } = await resolveExtractedPackageRoot(
        tempDir,
        target === 'shop' ? 'theme-app-shop' : 'theme-app-admin'
      );

      let manifest: ThemeAppManifest;
      const themeAppJsonPath = path.join(rootDir, THEME_APP_MANIFEST_FILE);

      try {
        manifest = await readJsonFile<ThemeAppManifest>(themeAppJsonPath);
      } catch {
        throw new ExtensionInstallerError(
          `Theme App must contain ${THEME_APP_MANIFEST_FILE}`,
          { code: 'MISSING_MANIFEST', statusCode: 400 }
        );
      }

      // 3. Validate manifest
      validateThemeAppManifest(manifest);

      // 3b. Signature verification (Phase 5, Section 4.8)
      const sigFilePath = path.join(rootDir, 'package.sig');
      let signatureResult;
      try {
        await fs.access(sigFilePath);
        signatureResult = await verifyPackageFromFiles(zipBuffer, sigFilePath);
      } catch {
        signatureResult = await verifyPackageFromFiles(zipBuffer);
      }

      if (getSignatureVerifyMode() === 'required' && !signatureResult.verified) {
        throw new ExtensionInstallerError(
          `Signature verification failed: ${signatureResult.error}`,
          { code: 'SIGNATURE_REQUIRED', statusCode: 400 }
        );
      }

      // 4. Validate target matches
      if (manifest.target !== target) {
        throw new ExtensionInstallerError(
          `Theme App target mismatch: manifest declares "${manifest.target}" but installing as "${target}"`,
          { code: 'TARGET_MISMATCH', statusCode: 400 }
        );
      }

      // 5. Validate build artifacts
      await validateBuildArtifacts(rootDir, manifest);

      // 6. Validate file types (prohibit source files, scripts, binaries)
      await validateThemeAppFileTypes(rootDir);

      // 7. Determine target directory
      const targetDir = getThemeAppDir(target, manifest.slug, manifest.version);

      // 8. Move to target directory (atomic with backup)
      await moveDir(rootDir, targetDir);

      // 9. Write metadata file
      const installedMeta: InstalledThemeApp = {
        slug: manifest.slug,
        name: manifest.name,
        version: manifest.version,
        target,
        type: 'theme-app',
        source: 'local-zip',
        fsPath: targetDir,
        runtime: {
          kind: manifest.runtime.kind,
          entry: manifest.runtime.entry,
          healthPath: manifest.runtime.healthPath || DEFAULT_THEME_APP_HEALTH_CHECK_PATH,
        },
        description: manifest.description,
        author: manifest.author,
        authorUrl: manifest.authorUrl,
        icon: manifest.icon,
        screenshots: manifest.screenshots,
        tags: manifest.tags,
        installedAt: new Date().toISOString(),
        signatureVerified: signatureResult?.verified ?? false,
        signedBy: signatureResult?.signedBy,
      };

      const metaPath = path.join(targetDir, INSTALLED_META_FILE);
      await fs.writeFile(metaPath, JSON.stringify(installedMeta, null, 2), 'utf-8');

      console.log(`[ThemeAppInstaller] Theme App "${manifest.slug}" v${manifest.version} installed successfully for ${target}`);

      // Invalidate theme caches so admin UI reflects new installs immediately
      await invalidateThemeCache(target);

      return installedMeta;
    } finally {
      // Clean up temp directory
      if (tempDir) {
        await cleanupTemp(tempDir);
      }
    }
  }

  /**
   * Uninstall Theme App
   */
  async uninstall(target: ThemeTarget, slug: string, version: string): Promise<void> {
    const targetDir = getThemeAppDir(target, slug, version);

    if (!(await dirExists(targetDir))) {
      throw new ExtensionInstallerError(
        `Theme App "${slug}" v${version} is not installed for target "${target}"`,
        { code: 'NOT_INSTALLED', statusCode: 404 }
      );
    }

    // Check if theme is currently active
    const { getActiveTheme } = await import('../theme-management/service');
    const activeTheme = await getActiveTheme(target);

    if (activeTheme.slug === slug && activeTheme.type === 'app') {
      throw new ExtensionInstallerError(
        `Cannot uninstall active Theme App "${slug}". Please activate another theme first.`,
        { code: 'CANNOT_UNINSTALL_ACTIVE_THEME', statusCode: 400 }
      );
    }

    // Remove directory
    await fs.rm(targetDir, { recursive: true, force: true });

    console.log(`[ThemeAppInstaller] Theme App "${slug}" v${version} uninstalled successfully for ${target}`);
    await invalidateThemeCache(target);
  }

  /**
   * Uninstall all versions of a Theme App (by slug)
   */
  async uninstallAll(target: ThemeTarget, slug: string): Promise<void> {
    const slugDir = path.join(EXTENSIONS_ROOT, 'themes-app', target, slug);

    if (!(await dirExists(slugDir))) {
      throw new ExtensionInstallerError(
        `Theme App "${slug}" is not installed for target "${target}"`,
        { code: 'NOT_INSTALLED', statusCode: 404 }
      );
    }

    // Check if theme is currently active
    const { getActiveTheme } = await import('../theme-management/service');
    const activeTheme = await getActiveTheme(target);

    if (activeTheme.slug === slug && activeTheme.type === 'app') {
      throw new ExtensionInstallerError(
        `Cannot uninstall active Theme App "${slug}". Please activate another theme first.`,
        { code: 'CANNOT_UNINSTALL_ACTIVE_THEME', statusCode: 400 }
      );
    }

    // Stop runtime if running (best-effort)
    try {
      const ThemeAppRuntime = await import('../theme-app-runtime/manager');
      await ThemeAppRuntime.stopThemeApp(target, slug, { force: true });
    } catch {
      // ignore stop errors
    }

    await fs.rm(slugDir, { recursive: true, force: true });
    console.log(`[ThemeAppInstaller] Theme App "${slug}" uninstalled successfully for ${target} (all versions)`);
    await invalidateThemeCache(target);
  }

  /**
   * List installed Theme Apps
   */
  async list(target: ThemeTarget): Promise<InstalledThemeApp[]> {
    const baseDir = path.join(EXTENSIONS_ROOT, 'themes-app', target);

    if (!(await dirExists(baseDir))) {
      return [];
    }

    const themes: InstalledThemeApp[] = [];
    const slugs = await fs.readdir(baseDir);

    for (const slug of slugs) {
      const slugDir = path.join(baseDir, slug);
      const stat = await fs.stat(slugDir);

      if (!stat.isDirectory()) continue;

      // Read all versions
      const versions = await fs.readdir(slugDir);

      for (const version of versions) {
        const versionDir = path.join(slugDir, version);
        const versionStat = await fs.stat(versionDir);

        if (!versionStat.isDirectory()) continue;

        // Read metadata
        const metaPath = path.join(versionDir, INSTALLED_META_FILE);
        try {
          const meta = await readJsonFile<InstalledThemeApp>(metaPath);
          themes.push(meta);
        } catch {
          // Skip if metadata file is missing or invalid
          console.warn(`[ThemeAppInstaller] Skipping ${slug}/${version}: invalid or missing metadata`);
        }
      }
    }

    return themes;
  }

  /**
   * Get installed Theme App details
   */
  async get(target: ThemeTarget, slug: string, version: string): Promise<InstalledThemeApp | null> {
    const targetDir = getThemeAppDir(target, slug, version);

    if (!(await dirExists(targetDir))) {
      return null;
    }

    const metaPath = path.join(targetDir, INSTALLED_META_FILE);
    try {
      return await readJsonFile<InstalledThemeApp>(metaPath);
    } catch {
      return null;
    }
  }
}

// ============================================================================
// Export
// ============================================================================

export const themeAppInstaller = new ThemeAppInstaller();
