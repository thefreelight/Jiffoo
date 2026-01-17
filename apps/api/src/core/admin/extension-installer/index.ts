/**
 * Extension Installer Service
 * 
 * Unified extension installer entry point, supporting ZIP installation for themes and plugins
 * Based on .kiro/specs/single-tenant-core-architecture/design.md
 */

import { Readable } from 'stream';
import {
  IExtensionInstaller,
  ExtensionKind,
  InstallResult,
  UninstallResult,
  InstalledExtensionMeta,
  ThemeTarget,
} from './types';
import { themeInstaller } from './theme-installer';
import { pluginFsInstaller } from './plugin-fs-installer';

// Re-export types
export * from './types';

/**
 * Unified extension installer implementation
 */
export class ExtensionInstaller implements IExtensionInstaller {
  /**
   * Install extension from ZIP
   * 
   * Internally performs three steps:
   * 1. Extract to correct directory - destination path determined by kind
   * 2. Read and validate manifest - theme.json / manifest.json
   * 3. Save metadata - .installed.json
   */
  async installFromZip(kind: ExtensionKind, zipStream: Readable): Promise<InstallResult> {
    switch (kind) {
      case 'theme-shop': {
        const theme = await themeInstaller.install('shop', zipStream);
        return {
          kind,
          slug: theme.slug,
          version: theme.version,
          source: theme.source,
          fsPath: theme.fsPath,
        };
      }
      case 'theme-admin': {
        const theme = await themeInstaller.install('admin', zipStream);
        return {
          kind,
          slug: theme.slug,
          version: theme.version,
          source: theme.source,
          fsPath: theme.fsPath,
        };
      }
      case 'plugin': {
        const plugin = await pluginFsInstaller.install(zipStream);
        return {
          kind,
          slug: plugin.slug,
          version: plugin.version,
          source: plugin.source,
          fsPath: plugin.fsPath,
        };
      }
      default:
        throw new Error(`Unknown extension kind: ${kind}`);
    }
  }

  /**
   * Uninstall extension
   */
  async uninstall(kind: ExtensionKind, slug: string): Promise<UninstallResult> {
    try {
      switch (kind) {
        case 'theme-shop':
          await themeInstaller.uninstall('shop', slug);
          break;
        case 'theme-admin':
          await themeInstaller.uninstall('admin', slug);
          break;
        case 'plugin':
          await pluginFsInstaller.uninstall(slug);
          break;
        default:
          throw new Error(`Unknown extension kind: ${kind}`);
      }
      return { kind, slug, success: true };
    } catch (error) {
      throw error;
    }
  }

  /**
   * List installed extensions
   */
  async listInstalled(kind: ExtensionKind): Promise<InstalledExtensionMeta[]> {
    switch (kind) {
      case 'theme-shop':
        return themeInstaller.list('shop');
      case 'theme-admin':
        return themeInstaller.list('admin');
      case 'plugin':
        return pluginFsInstaller.list();
      default:
        throw new Error(`Unknown extension kind: ${kind}`);
    }
  }

  /**
   * Get extension details
   */
  async getInstalled(kind: ExtensionKind, slug: string): Promise<InstalledExtensionMeta | null> {
    switch (kind) {
      case 'theme-shop':
        return themeInstaller.get('shop', slug);
      case 'theme-admin':
        return themeInstaller.get('admin', slug);
      case 'plugin':
        return pluginFsInstaller.get(slug);
      default:
        throw new Error(`Unknown extension kind: ${kind}`);
    }
  }
}

/** Singleton instance */
export const extensionInstaller = new ExtensionInstaller();

// Export sub-installers (for direct invocation)
export { themeInstaller } from './theme-installer';
export { pluginFsInstaller } from './plugin-fs-installer';

// Export plugin dynamic loader
export {
  loadPlugin,
  loadAllPlugins,
  getLoadedPlugins,
  getLoadedPlugin,
  isPluginLoaded,
  type LoadedPluginInfo,
  type PluginLoadOptions,
} from './plugin-loader';
