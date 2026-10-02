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
import { createHash } from 'node:crypto';
import { pluginPackageBlobStore } from '@/core/storage/plugin-package-blob-store';
import { readPluginZipEntries } from 'shared/plugin-signing';
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

async function packageState(pkg: PluginInstall): Promise<InstalledExtensionMeta['packageState']> {
  if ('manifestError' in getManifestResponse(pkg)) return { status: 'corrupt', code: 'PLUGIN_PACKAGE_CORRUPT' };
  if (!pkg.zipHash) return { status: 'unavailable', code: 'PLUGIN_PACKAGE_UNAVAILABLE' };
  if (!/^[a-f0-9]{64}$/.test(pkg.zipHash)) return { status: 'corrupt', code: 'PLUGIN_PACKAGE_CORRUPT' };
  if (pkg.source === 'builtin') {
    return await pluginPackageStore.get(pkg.slug, pkg.zipHash)
      ? { status: 'available', code: null } : { status: 'unavailable', code: 'PLUGIN_PACKAGE_UNAVAILABLE' };
  }
  const blob = await pluginPackageBlobStore.get(pkg.slug, pkg.zipHash);
  if (!blob) return { status: 'unavailable', code: 'PLUGIN_PACKAGE_UNAVAILABLE' };
  try {
    const bytes = Buffer.from(blob.bytes);
    if (blob.sizeBytes !== bytes.length || createHash('sha256').update(bytes).digest('hex') !== pkg.zipHash) {
      return { status: 'corrupt', code: 'PLUGIN_PACKAGE_CORRUPT' };
    }
    readPluginZipEntries(bytes, pkg.trustLevel === 'unsigned');
    return { status: 'available', code: null };
  } catch {
    return { status: 'corrupt', code: 'PLUGIN_PACKAGE_CORRUPT' };
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
  async installFromZip(kind: ExtensionKind, zipStream: Readable, options?: import('./types').PluginInstallOptions): Promise<InstallResult> {
    switch (kind) {
      case 'plugin': {
        const plugin = await pluginFsInstaller.install(zipStream, options);
        return {
          kind,
          name: plugin.name,
          trustLevel: plugin.trustLevel,
          warnings: plugin.warnings ?? [],
          slug: plugin.slug,
          version: plugin.version,
          source: plugin.source,
          fsPath: plugin.fsPath,
          publisherId: plugin.publisherId ?? null,
          publisherName: plugin.publisherName ?? null,
          publisherVerified: plugin.signingRoot === 'official',
          signingRoot: plugin.signingRoot ?? null,
          publisherCertificateFingerprint: plugin.publisherCertificateFingerprint ?? null,
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
  async listInstalled(kind: ExtensionKind, state: 'active' | 'removed' = 'active'): Promise<InstalledExtensionMeta[]> {
    switch (kind) {
      case 'plugin': {
        // Read from DB instead of disk scan (exclude soft-uninstalled packages from admin list)
        const { PluginManagementService } = await import('@/core/admin/plugin-management/service');
        const packages = (await PluginManagementService.getAllPluginPackages({ includeDeleted: state === 'removed' }))
          .filter((pkg) => state === 'removed' ? Boolean(pkg.deletedAt) : !pkg.deletedAt);
        return Promise.all(packages.map(async (pkg) => {
          return {
          id: pkg.id,
          slug: pkg.slug,
          name: pkg.name,
          version: pkg.version,
          description: pkg.description || '',
          category: pkg.category || 'general',
          runtimeType: 'internal-fastify',
          entryModule: pkg.entryModule || undefined,
          source: pkg.source as ExtensionSource,
          packageState: await packageState(pkg),
          deletedAt: pkg.deletedAt,
          permissions: parseJsonArray(pkg.permissions),
          author: pkg.author || undefined,
          authorUrl: pkg.authorUrl || undefined,
          installedAt: pkg.installedAt,
          updatedAt: pkg.updatedAt,
          zipHash: pkg.zipHash || undefined,
          ...getManifestResponse(pkg),
          trustLevel: pkg.trustLevel,
          publisherId: pkg.publisherId,
          publisherName: pkg.publisherName,
          publisherVerified: pkg.signingRoot === 'official',
          signingRoot: pkg.signingRoot as 'official' | 'test' | null,
          publisherCertificateFingerprint: pkg.publisherCertificateFingerprint,
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
        return {
          id: pkg.id,
          slug: pkg.slug,
          name: pkg.name,
          version: pkg.version,
          description: pkg.description || '',
          category: pkg.category || 'general',
          runtimeType: 'internal-fastify',
          entryModule: pkg.entryModule || undefined,
          source: pkg.source as ExtensionSource,
          packageState: await packageState(pkg),
          deletedAt: pkg.deletedAt,
          permissions: parseJsonArray(pkg.permissions),
          author: pkg.author || undefined,
          authorUrl: pkg.authorUrl || undefined,
          installedAt: pkg.installedAt,
          updatedAt: pkg.updatedAt,
          zipHash: pkg.zipHash || undefined,
          ...getManifestResponse(pkg),
          trustLevel: pkg.trustLevel,
          publisherId: pkg.publisherId,
          publisherName: pkg.publisherName,
          publisherVerified: pkg.signingRoot === 'official',
          signingRoot: pkg.signingRoot as 'official' | 'test' | null,
          publisherCertificateFingerprint: pkg.publisherCertificateFingerprint,
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
