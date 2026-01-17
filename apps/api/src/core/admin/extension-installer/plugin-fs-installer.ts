/**
 * Plugin File System Installer Service
 * 
 * Handles ZIP installation of plugins to the file system, uninstallation, and listing
 * Note: This is file system level installation, complementing the existing plugin-installer.ts (database level)
 */

import { Readable } from 'stream';
import path from 'path';
import { promises as fs } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import {
  IPluginInstaller,
  InstalledPlugin,
  PluginManifest,
} from './types';
import {
  extractZipToTemp,
  cleanupTemp,
  readJsonFile,
  validatePluginManifest,
  getPluginDir,
  moveDir,
  dirExists,
  removeDir,
  ensureDir,
} from './utils';

/** Metadata filename for installed plugins */
const INSTALLED_META_FILE = '.installed.json';

/**
 * Plugin file system installer implementation
 */
export class PluginFsInstaller implements IPluginInstaller {
  /**
   * Install plugin from ZIP to file system
   */
  async install(zipStream: Readable): Promise<InstalledPlugin> {
    let tempDir: string | null = null;

    try {
      // 1. Extract to temporary directory
      tempDir = await extractZipToTemp(zipStream);

      // 2. Read manifest.json
      const manifestPath = path.join(tempDir, 'manifest.json');
      const manifest = await readJsonFile<PluginManifest>(manifestPath);

      // 3. Validate manifest
      validatePluginManifest(manifest);

      // 4. Determine target directory
      const targetDir = getPluginDir(manifest.slug);

      // 5. Check if it already exists (update scenario)
      const exists = await dirExists(targetDir);
      const now = new Date();

      // 6. Move to target directory
      await moveDir(tempDir, targetDir);
      tempDir = null; // Already moved, no need to cleanup

      // 7. Create installed metadata
      const installedPlugin: InstalledPlugin = {
        id: uuidv4(),
        slug: manifest.slug,
        name: manifest.name,
        version: manifest.version,
        description: manifest.description || '',
        category: manifest.category || 'general',
        runtimeType: manifest.runtimeType,
        entryModule: manifest.entryModule,
        externalBaseUrl: manifest.externalBaseUrl,
        source: 'local-zip',
        fsPath: targetDir,
        permissions: manifest.permissions,
        author: manifest.author,
        authorUrl: manifest.authorUrl,
        installedAt: exists ? now : now, // TODO: Maintain original installation time
        updatedAt: now,
      };

      // 8. Write metadata file
      await this.saveInstalledMeta(manifest.slug, installedPlugin);

      return installedPlugin;
    } finally {
      // Clean up temporary directory
      if (tempDir) {
        await cleanupTemp(tempDir);
      }
    }
  }

  /**
   * Uninstall plugin
   */
  async uninstall(slug: string): Promise<void> {
    const targetDir = getPluginDir(slug);

    if (!(await dirExists(targetDir))) {
      throw new Error(`Plugin "${slug}" is not installed`);
    }

    await removeDir(targetDir);
  }

  /**
   * List installed plugins
   */
  async list(): Promise<InstalledPlugin[]> {
    const pluginsDir = getPluginDir();

    // Ensure directory exists
    await ensureDir(pluginsDir);

    const entries = await fs.readdir(pluginsDir, { withFileTypes: true });
    const plugins: InstalledPlugin[] = [];

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const plugin = await this.get(entry.name);
        if (plugin) {
          plugins.push(plugin);
        }
      }
    }

    return plugins;
  }

  /**
   * Get installed plugin details
   */
  async get(slug: string): Promise<InstalledPlugin | null> {
    const targetDir = getPluginDir(slug);

    if (!(await dirExists(targetDir))) {
      return null;
    }

    // Prefer reading .installed.json
    const metaPath = path.join(targetDir, INSTALLED_META_FILE);
    try {
      return await readJsonFile<InstalledPlugin>(metaPath);
    } catch {
      // If no metadata file exists, rebuild from manifest.json
      return this.rebuildMetaFromManifest(slug, targetDir);
    }
  }

  /**
   * Save installed metadata
   */
  private async saveInstalledMeta(slug: string, meta: InstalledPlugin): Promise<void> {
    const targetDir = getPluginDir(slug);
    const metaPath = path.join(targetDir, INSTALLED_META_FILE);
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
  }

  /**
   * Rebuild metadata from manifest
   */
  private async rebuildMetaFromManifest(
    slug: string,
    targetDir: string
  ): Promise<InstalledPlugin | null> {
    try {
      const manifestPath = path.join(targetDir, 'manifest.json');
      const manifest = await readJsonFile<PluginManifest>(manifestPath);
      const stat = await fs.stat(targetDir);

      return {
        id: uuidv4(),
        slug: manifest.slug || slug,
        name: manifest.name || slug,
        version: manifest.version || '0.0.0',
        description: manifest.description || '',
        category: manifest.category || 'general',
        runtimeType: manifest.runtimeType || 'internal-fastify',
        entryModule: manifest.entryModule,
        externalBaseUrl: manifest.externalBaseUrl,
        source: 'local-zip',
        fsPath: targetDir,
        permissions: manifest.permissions,
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
export const pluginFsInstaller = new PluginFsInstaller();
