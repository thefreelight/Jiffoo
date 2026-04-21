/**
 * Theme Installer Service
 * 
 * Handles ZIP installation, uninstallation, and listing of themes
 */

import { Readable } from 'stream';
import path from 'path';
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import {
  IThemeInstaller,
  ThemeTarget,
  InstalledTheme,
  ThemeManifest,
} from './types';
import { ExtensionInstallerError } from './errors';
import {
  extractZipToTemp,
  cleanupTemp,
  readJsonFile,
  validateThemeManifest,
  resolveExtractedPackageRoot,
  getThemeDir,
  ensureInstalledThemeVersionAlias,
  moveDir,
  dirExists,
  removeDir,
  ensureDir,
  calculateStreamHash,
  bufferToStream,
} from './utils';
import { verifyPackageFromFiles, getSignatureVerifyMode } from './signature-verifier';

/** Metadata filename for installed themes */
const INSTALLED_META_FILE = '.installed.json';

/**
 * Theme installer implementation
 */
export class ThemeInstaller implements IThemeInstaller {
  /**
   * Install theme from ZIP
   */
  async install(target: ThemeTarget, zipStream: Readable): Promise<InstalledTheme> {
    let tempDir: string | null = null;

    try {
      // 1. Buffer ZIP and extract to temporary directory with security validation
      const hashResult = await calculateStreamHash(zipStream);
      const zipBuffer = hashResult.buffer;
      const bufferStream = bufferToStream(zipBuffer);
      tempDir = await extractZipToTemp(bufferStream, target === 'shop' ? 'theme-shop' : 'theme-admin');

      // 2. Resolve package root & read theme.json
      const { rootDir, manifestPath } = await resolveExtractedPackageRoot(
        tempDir,
        target === 'shop' ? 'theme-shop' : 'theme-admin'
      );
      const manifest = await readJsonFile<ThemeManifest>(manifestPath);

      // 3. Validate manifest (with target validation)
      validateThemeManifest(manifest, target);

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

      // 4. Determine target directory
      const targetDir = getThemeDir(target, manifest.slug);

      // 5. Check if it already exists (update scenario)
      const exists = await dirExists(targetDir);
      let originalInstalledAt: Date | null = null;
      if (exists) {
        const installedMetaPath = path.join(targetDir, INSTALLED_META_FILE);
        try {
          const installedMeta = await readJsonFile<InstalledTheme>(installedMetaPath);
          originalInstalledAt = new Date(installedMeta.installedAt as unknown as string);
        } catch {
          // Fall through - will use current time
        }
      }
      
      // 6. Version comparison for upgrade scenario
      if (exists) {
        // Read installed version
        const installedMetaPath = path.join(targetDir, INSTALLED_META_FILE);
        let installedVersion: string | null = null;
        
        try {
          const installedMeta = await readJsonFile<InstalledTheme>(installedMetaPath);
          installedVersion = installedMeta.version;
        } catch {
          // If reading .installed.json fails, try reading theme.json
          try {
            const installedManifestPath = path.join(targetDir, 'theme.json');
            const installedManifest = await readJsonFile<ThemeManifest>(installedManifestPath);
            installedVersion = installedManifest.version;
          } catch {
            // Cannot read version, allow overwrite (compatibility with old versions)
          }
        }
        
        // Compare versions: new > old to allow overwrite
        if (installedVersion) {
          const { compareVersions, validateVersionFormat } = await import('./version-utils');
          
          // Check if installed version is valid semver format
          // If not valid, allow overwrite (compatibility with old non-semver versions)
          try {
            validateVersionFormat(installedVersion);
            
            // Both versions are valid semver, compare them
            const comparison = compareVersions(manifest.version, installedVersion);
            
            if (comparison <= 0) {
              throw new ExtensionInstallerError(
                `Cannot install version ${manifest.version}: installed version ${installedVersion} is equal or newer`,
                { code: 'VERSION_CONFLICT', statusCode: 409 }
              );
            }
          } catch (versionError: any) {
            // If installed version is not valid semver, allow overwrite
            if (versionError.code === 'INVALID_VERSION_FORMAT') {
              console.warn(`[ThemeInstaller] Installed version "${installedVersion}" is not valid semver, allowing overwrite for compatibility`);
            } else {
              // Re-throw other errors (like VERSION_CONFLICT)
              throw versionError;
            }
          }
        }
      }
      
      const now = new Date();

      // 7. Move to target directory
      await moveDir(rootDir, targetDir);

      // 8. Create installed metadata
      const installedTheme: InstalledTheme = {
        id: uuidv4(),
        slug: manifest.slug,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description || '',
        category: manifest.category || 'general',
        target,
        source: 'local-zip',
        fsPath: targetDir,
        thumbnail: manifest.thumbnail,
        author: manifest.author,
        authorUrl: manifest.authorUrl,
        installedAt: originalInstalledAt || now,
        updatedAt: now,
        signatureVerified: signatureResult?.verified ?? false,
        signedBy: signatureResult?.signedBy,
      };

      // 9. Write metadata file
      await this.saveInstalledMeta(target, manifest.slug, installedTheme);
      await ensureInstalledThemeVersionAlias(target, manifest.slug, manifest.version);

      // 10. Invalidate theme cache to ensure immediate visibility
      const { CacheService } = await import('@/core/cache/service');
      await CacheService.delete(`themes:installed:${target}`);
      await CacheService.delete(`themes:active:${target}`);

      return installedTheme;
    } finally {
      // Clean up temporary directory
      if (tempDir) {
        await cleanupTemp(tempDir);
      }
    }
  }

  /**
   * Uninstall theme
   */
  async uninstall(target: ThemeTarget, slug: string): Promise<void> {
    const targetDir = getThemeDir(target, slug);

    if (!(await dirExists(targetDir))) {
      throw new Error(`Theme "${slug}" is not installed for target "${target}"`);
    }

    // Check if theme is currently active
    const { getActiveTheme } = await import('../theme-management/service');
    const activeTheme = await getActiveTheme(target);
    
    if (activeTheme.slug === slug && activeTheme.source === 'installed') {
      throw new ExtensionInstallerError(
        `Cannot uninstall active theme "${slug}". Please activate another theme first.`,
        { code: 'CANNOT_UNINSTALL_ACTIVE_THEME', statusCode: 400 }
      );
    }

    await removeDir(targetDir);
    await removeDir(path.join(getThemeDir(target), '.versions', slug));

    // Invalidate theme cache to ensure immediate visibility
    const { CacheService } = await import('@/core/cache/service');
    await CacheService.delete(`themes:installed:${target}`);
    await CacheService.delete(`themes:active:${target}`);
  }

  /**
   * List installed themes
   */
  async list(target: ThemeTarget): Promise<InstalledTheme[]> {
    const themesDir = getThemeDir(target);

    // Ensure directory exists
    await ensureDir(themesDir);

    const entries = await fs.readdir(themesDir, { withFileTypes: true });
    const themes: InstalledTheme[] = [];

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const theme = await this.get(target, entry.name);
        if (theme) {
          themes.push(theme);
        }
      }
    }

    return themes;
  }

  /**
   * Get installed theme details
   */
  async get(target: ThemeTarget, slug: string): Promise<InstalledTheme | null> {
    const targetDir = getThemeDir(target, slug);

    if (!(await dirExists(targetDir))) {
      return null;
    }

    // Prefer reading .installed.json
    const metaPath = path.join(targetDir, INSTALLED_META_FILE);
    try {
      return await readJsonFile<InstalledTheme>(metaPath);
    } catch {
      // If no metadata file exists, rebuild from theme.json
      return this.rebuildMetaFromManifest(target, slug, targetDir);
    }
  }

  /**
   * Save installed metadata
   */
  private async saveInstalledMeta(
    target: ThemeTarget,
    slug: string,
    meta: InstalledTheme
  ): Promise<void> {
    const targetDir = getThemeDir(target, slug);
    const metaPath = path.join(targetDir, INSTALLED_META_FILE);
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
  }

  /**
   * Rebuild metadata from manifest
   */
  private async rebuildMetaFromManifest(
    target: ThemeTarget,
    slug: string,
    targetDir: string
  ): Promise<InstalledTheme | null> {
    try {
      const manifestPath = path.join(targetDir, 'theme.json');
      const manifest = await readJsonFile<ThemeManifest>(manifestPath);
      const stat = await fs.stat(targetDir);

      return {
        id: uuidv4(),
        slug: manifest.slug || slug,
        name: manifest.name || slug,
        version: manifest.version || '0.0.0',
        description: manifest.description || '',
        category: manifest.category || 'general',
        target,
        source: 'local-zip',
        fsPath: targetDir,
        thumbnail: manifest.thumbnail,
        author: manifest.author,
        authorUrl: manifest.authorUrl,
        installedAt: stat.birthtime,
        updatedAt: stat.mtime,
      };
    } catch {
      return null;
    }
  }
}

/** Singleton instance */
export const themeInstaller = new ThemeInstaller();
