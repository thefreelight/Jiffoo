/**
 * Extension Installer Service
 * 
 * Unified extension installer entry point, supporting ZIP installation for plugins.
 * Based on docs/agentra-001-core-v1-product-charter.md
 */

import { Readable } from 'stream';
import {
  IExtensionInstaller,
  ExtensionKind,
  ExtensionSource,
  InstallResult,
  UninstallResult,
  InstalledExtensionMeta,
} from './types';
import { pluginFsInstaller } from './plugin-fs-installer';
import { pluginPackageStore } from '@/core/storage/plugin-package-store';
import { InvalidStoredManifestError, readStoredPluginManifest } from './stored-manifest';
import type { PluginInstall } from '@prisma/client';

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

function getManifestResponse(pkg: PluginInstall) {
  try {
    return { manifestJson: readStoredPluginManifest(pkg) };
  } catch (error) {
    if (error instanceof InvalidStoredManifestError) {
      return { manifestError: { issues: error.issues } };
    }
    throw error;
  }
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
   * 2. Read and validate manifest.json
   * 3. Save metadata - .installed.json
   */
  async installFromZip(kind: ExtensionKind, zipStream: Readable, options?: { source?: string; confirmUnsigned?: boolean; actorUserId?: string }): Promise<InstallResult> {
    switch (kind) {
      case 'plugin': {
        const plugin = await pluginFsInstaller.install(zipStream, options);
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
    switch (kind) {
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
  }

  /**
   * List installed extensions
   */
  async listInstalled(kind: ExtensionKind): Promise<InstalledExtensionMeta[]> {
    switch (kind) {
      case 'plugin': {
        // Read from DB instead of disk scan (exclude soft-uninstalled packages from admin list)
        const { PluginManagementService } = await import('@/core/admin/plugin-management/service');
        const packages = await PluginManagementService.getAllPluginPackages();
        return Promise.all(packages.map(async (pkg) => {
          const pluginPackage = await pluginPackageStore.get(pkg.slug);
          if (!pluginPackage) throw new Error(`Plugin package files are missing for "${pkg.slug}"`);
          return {
          id: pkg.id,
          slug: pkg.slug,
          name: pkg.name,
          version: pkg.version,
          description: pkg.description || '',
          category: pkg.category || 'general',
          runtimeType: 'internal-fastify',
          entryModule: pkg.entryModule || undefined,
          source: (pkg.source === 'builtin' || pkg.source === 'local-zip'
            ? pkg.source 
            : 'local-zip') as ExtensionSource, // Map DB source to ExtensionSource
          fsPath: pluginPackage.getEntryPath(''),
          permissions: parseJsonArray(pkg.permissions),
          author: pkg.author || undefined,
          authorUrl: pkg.authorUrl || undefined,
          installedAt: pkg.installedAt,
          updatedAt: pkg.updatedAt,
          zipHash: pkg.zipHash || undefined,
          ...getManifestResponse(pkg),
          trustLevel: pkg.trustLevel,
          };
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
      case 'plugin': {
        // Read from DB instead of disk (filters deletedAt=null)
        const { PluginManagementService } = await import('@/core/admin/plugin-management/service');
        const pkg = await PluginManagementService.getPluginPackage(slug);
        if (!pkg) {
          return null;
        }
        const pluginPackage = await pluginPackageStore.get(pkg.slug);
        if (!pluginPackage) throw new Error(`Plugin package files are missing for "${pkg.slug}"`);
        return {
          id: pkg.id,
          slug: pkg.slug,
          name: pkg.name,
          version: pkg.version,
          description: pkg.description || '',
          category: pkg.category || 'general',
          runtimeType: 'internal-fastify',
          entryModule: pkg.entryModule || undefined,
          source: (pkg.source === 'builtin' || pkg.source === 'local-zip'
            ? pkg.source 
            : 'local-zip') as ExtensionSource, // Map DB source to ExtensionSource
          fsPath: pluginPackage.getEntryPath(''),
          permissions: parseJsonArray(pkg.permissions),
          author: pkg.author || undefined,
          authorUrl: pkg.authorUrl || undefined,
          installedAt: pkg.installedAt,
          updatedAt: pkg.updatedAt,
          zipHash: pkg.zipHash || undefined,
          ...getManifestResponse(pkg),
          trustLevel: pkg.trustLevel,
        };
      }
      default:
        throw new Error(`Unknown extension kind: ${kind}`);
    }
  }
}

/** Singleton instance */
export const extensionInstaller = new ExtensionInstaller();

// Export sub-installer for direct invocation.
export { pluginFsInstaller } from './plugin-fs-installer';
