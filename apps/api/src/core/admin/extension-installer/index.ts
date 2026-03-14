// @ts-nocheck
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
  ExtensionSource,
  InstallResult,
  UninstallResult,
  InstalledExtensionMeta,
  ThemeTarget,
} from './types';
import { themeInstaller } from './theme-installer';
import { themeAppInstaller } from './theme-app-installer';
import { pluginFsInstaller } from './plugin-fs-installer';

// Re-export types
export * from './types';

function parseJsonArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === 'string')
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Unified extension installer implementation
 */
export class ExtensionInstaller implements IExtensionInstaller {
  /**
   * Install extension from ZIP
   * 
   * Internally performs three steps:
   * 1. Extract to correct directory - destination path determined by kind
   * 2. Read and validate manifest - theme.json / theme-app.json / manifest.json
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
      case 'theme-app-shop': {
        const themeApp = await themeAppInstaller.install('shop', zipStream);
        return {
          kind,
          slug: themeApp.slug,
          version: themeApp.version,
          source: themeApp.source,
          fsPath: themeApp.fsPath,
        };
      }
      case 'theme-app-admin': {
        const themeApp = await themeAppInstaller.install('admin', zipStream);
        return {
          kind,
          slug: themeApp.slug,
          version: themeApp.version,
          source: themeApp.source,
          fsPath: themeApp.fsPath,
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
        case 'theme-app-shop':
          await themeAppInstaller.uninstallAll('shop', slug);
          break;
        case 'theme-app-admin':
          await themeAppInstaller.uninstallAll('admin', slug);
          break;
        case 'plugin': {
          // CRITICAL: Use soft delete (consistent with routes behavior)
          const { PluginManagementService } = await import('@/core/admin/plugin-management/service');
          await PluginManagementService.uninstallPlugin(slug);
          break;
        }
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
      case 'theme-app-shop':
        return themeAppInstaller.list('shop');
      case 'theme-app-admin':
        return themeAppInstaller.list('admin');
      case 'plugin': {
        // Read from DB instead of disk scan (exclude soft-uninstalled packages from admin list)
        const { PluginManagementService } = await import('@/core/admin/plugin-management/service');
        const packages = await PluginManagementService.getAllPluginPackages();
        return packages.map(pkg => ({
          id: pkg.id,
          slug: pkg.slug,
          name: pkg.name,
          version: pkg.version,
          description: pkg.description || '',
          category: pkg.category || 'general',
          runtimeType: pkg.runtimeType as 'internal-fastify' | 'external-http',
          entryModule: pkg.entryModule || undefined,
          externalBaseUrl: pkg.externalBaseUrl || undefined,
          source: (pkg.source === 'builtin' || pkg.source === 'local-zip' || pkg.source === 'official-market' 
            ? pkg.source 
            : 'local-zip') as ExtensionSource, // Map DB source to ExtensionSource
          fsPath: `extensions/plugins/${pkg.slug}`,
          permissions: parseJsonArray(pkg.permissions),
          author: pkg.author || undefined,
          authorUrl: pkg.authorUrl || undefined,
          installedAt: pkg.installedAt,
          updatedAt: pkg.updatedAt,
          zipHash: pkg.zipHash || undefined,
          manifestJson: pkg.manifestJson || undefined,
        }));
      }
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
      case 'theme-app-shop': {
        // Theme App get requires version, get latest version
        const shopThemeApps = await themeAppInstaller.list('shop');
        const shopThemeApp = shopThemeApps.find(t => t.slug === slug);
        return shopThemeApp || null;
      }
      case 'theme-app-admin': {
        // Theme App get requires version, get latest version
        const adminThemeApps = await themeAppInstaller.list('admin');
        const adminThemeApp = adminThemeApps.find(t => t.slug === slug);
        return adminThemeApp || null;
      }
      case 'plugin': {
        // Read from DB instead of disk (filters deletedAt=null)
        const { PluginManagementService } = await import('@/core/admin/plugin-management/service');
        const pkg = await PluginManagementService.getPluginPackage(slug);
        if (!pkg) {
          return null;
        }
        return {
          id: pkg.id,
          slug: pkg.slug,
          name: pkg.name,
          version: pkg.version,
          description: pkg.description || '',
          category: pkg.category || 'general',
          runtimeType: pkg.runtimeType as 'internal-fastify' | 'external-http',
          entryModule: pkg.entryModule || undefined,
          externalBaseUrl: pkg.externalBaseUrl || undefined,
          source: (pkg.source === 'builtin' || pkg.source === 'local-zip' || pkg.source === 'official-market' 
            ? pkg.source 
            : 'local-zip') as ExtensionSource, // Map DB source to ExtensionSource
          fsPath: `extensions/plugins/${pkg.slug}`,
          permissions: parseJsonArray(pkg.permissions),
          author: pkg.author || undefined,
          authorUrl: pkg.authorUrl || undefined,
          installedAt: pkg.installedAt,
          updatedAt: pkg.updatedAt,
          zipHash: pkg.zipHash || undefined,
          manifestJson: pkg.manifestJson || undefined,
        };
      }
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
