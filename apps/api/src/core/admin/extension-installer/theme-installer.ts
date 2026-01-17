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
import {
  extractZipToTemp,
  cleanupTemp,
  readJsonFile,
  validateThemeManifest,
  getThemeDir,
  moveDir,
  dirExists,
  removeDir,
  ensureDir,
} from './utils';

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
      // 1. Extract to temporary directory
      tempDir = await extractZipToTemp(zipStream);

      // 2. Read theme.json
      const manifestPath = path.join(tempDir, 'theme.json');
      const manifest = await readJsonFile<ThemeManifest>(manifestPath);

      // 3. Validate manifest
      validateThemeManifest(manifest);

      // 4. Determine target directory
      const targetDir = getThemeDir(target, manifest.slug);

      // 5. Check if it already exists (update scenario)
      const exists = await dirExists(targetDir);
      const now = new Date();

      // 6. Move to target directory
      await moveDir(tempDir, targetDir);
      tempDir = null; // Already moved, no need to cleanup

      // 7. Create installed metadata
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
        installedAt: exists ? now : now, // TODO: Maintain original installation time
        updatedAt: now,
      };

      // 8. Write metadata file
      await this.saveInstalledMeta(target, manifest.slug, installedTheme);

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

    await removeDir(targetDir);
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
