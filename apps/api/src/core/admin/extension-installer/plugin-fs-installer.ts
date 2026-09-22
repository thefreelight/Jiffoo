/**
 * Plugin File System Installer Service
 *
 * Handles ZIP installation of plugins to the file system, uninstallation, and listing.
 * Integrates with PluginManagementService for database records and default instance creation.
 *
 * Key features:
 * - Idempotent installation based on ZIP SHA-256 hash
 * - Automatic database record creation (PluginInstall + default PluginInstallation)
 * - Atomic directory replacement with rollback on failure
 */

import { Readable } from 'stream';
import { createReadStream } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '@/config/database';
import {
  IPluginInstaller,
  InstalledPlugin,
  PluginManifest,
} from './types';
import { CacheService } from '@/core/cache/service';
import {
  extractZipToTemp,
  cleanupTemp,
  readJsonFile,
  validatePluginManifest,
  resolveExtractedPackageRoot,
  spoolStreamToTempFileAndHash,
} from './utils';
import { pluginPackageStore, type PluginPackageDeployment } from '@/core/storage/plugin-package-store';
import { incrementPluginRegistryVersion } from './plugin-registry-version';
import { evaluatePluginConfigReadiness } from './config-readiness';
import {
  deriveTrustLevel,
} from './trust-level';
import {
  executeLifecycleHook,
  hasLifecycleHook,
} from '@/core/admin/plugin-management/lifecycle-hooks';
import { WebhookSubscriptionService } from '@/core/webhooks/subscription-service';

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

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Metadata filename for installed plugins */
const INSTALLED_META_FILE = '.installed.json';

/**
 * Plugin file system installer implementation
 */
export class PluginFsInstaller implements IPluginInstaller {
  /**
   * Install plugin from ZIP to file system
   *
   * Process:
   * 1. Calculate ZIP SHA-256 hash for idempotency check
   * 2. Check if same hash already installed (skip if true)
   * 3. Extract to temp directory with security validation
   * 4. Validate manifest
   * 5. Move to target directory (atomic with rollback)
   * 6. Create/update database records (PluginInstall + default instance)
   * 7. Write local metadata file
   */
  async install(zipStream: Readable, options?: { source?: string; confirmUnsigned?: boolean; actorUserId?: string }): Promise<InstalledPlugin> {
    let tempDir: string | null = null;
    let deployment: PluginPackageDeployment | null = null;
    let tempZipCleanup: (() => Promise<void>) | null = null;
    let wasNewInstall = false;

    // 1. Stream the ZIP to disk while calculating its hash to avoid buffering large packages in memory.
    const {
      hash: zipHash,
      filePath: zipFilePath,
      cleanup: cleanupTempZip,
    } = await spoolStreamToTempFileAndHash(zipStream, 'plugin-install');
    tempZipCleanup = cleanupTempZip;

    // 2. Check if same hash already installed (idempotency)
    // CRITICAL: Must filter deletedAt=null, otherwise soft-deleted plugins will be treated as installed
    const existingByHash = await prisma.pluginInstall.findFirst({
      where: { 
        zipHash,
        deletedAt: null, // Only consider non-deleted plugins
      },
    });

    if (existingByHash) {
      // Same ZIP already installed and not deleted - return existing plugin info
      const existingPackage = await pluginPackageStore.get(existingByHash.slug);
      if (!existingPackage) throw new Error(`Plugin package files are missing for "${existingByHash.slug}"`);
      return {
        id: existingByHash.id,
        slug: existingByHash.slug,
        name: existingByHash.name,
        version: existingByHash.version,
        description: existingByHash.description || '',
        category: existingByHash.category || 'general',
        runtimeType: 'internal-fastify',
        entryModule: existingByHash.entryModule || undefined,
        source: 'local-zip',
        fsPath: existingPackage.getEntryPath(''),
        permissions: parseJsonArray(existingByHash.permissions),
        author: existingByHash.author || undefined,
        authorUrl: existingByHash.authorUrl || undefined,
        installedAt: existingByHash.installedAt,
        updatedAt: existingByHash.updatedAt,
        zipHash,
      };
    }

    try {
      // 3. Extract to temporary directory with security validation
      tempDir = await extractZipToTemp(createReadStream(zipFilePath), 'plugin');

      // 4. Resolve package root & read manifest.json
      const { rootDir, manifestPath } = await resolveExtractedPackageRoot(
        tempDir,
        'plugin'
      );
      const manifest = await readJsonFile<PluginManifest>(manifestPath);
      const defaultConfigReadiness = evaluatePluginConfigReadiness(manifest, {});
      const shouldEnableDefaultInstance = !defaultConfigReadiness.requiresConfiguration;

      // 5. Validate manifest
      validatePluginManifest(manifest);

      // Uploaded packages always use the established unsigned confirmation and audit flow.
      const trustLevel = deriveTrustLevel(
        options?.source || 'local-zip',
        manifest.trustLevel,
      );

      if (trustLevel === 'unsigned') {
        if (!options?.confirmUnsigned || !options.actorUserId) {
          const error: any = new Error('Unsigned packages require explicit merchant confirmation');
          error.statusCode = 400;
          error.code = 'UNSIGNED_CONFIRMATION_REQUIRED';
          throw error;
        }
        const actor = await prisma.user.findUnique({
          where: { id: options.actorUserId },
          select: { id: true, email: true, username: true },
        });
        if (!actor) throw new Error('Unsigned package confirmation actor was not found');
        await prisma.adminStaffAuditLog.create({
          data: {
            staffUserId: actor.id,
            staffEmail: actor.email,
            staffUsername: actor.username,
            actorUserId: actor.id,
            actorEmail: actor.email,
            actorUsername: actor.username,
            action: 'PLUGIN_UNSIGNED_INSTALL_CONFIRMED',
            metadata: { slug: manifest.slug, version: manifest.version, zipHash, source: options.source || 'local-zip' },
          },
        });
      }

      // 7. Check if slug already exists (update/restore scenario)
      const existingBySlug = await prisma.pluginInstall.findUnique({
        where: { slug: manifest.slug },
      });
      const now = new Date();

      // 8. TWO-PHASE COMMIT WITH WARM VALIDATION
      // Phase 1: atomically replace the package through the storage boundary.
      deployment = await pluginPackageStore.put(manifest.slug, rootDir);
      const targetDir = deployment.package.getEntryPath('');
      wasNewInstall = !existingBySlug;

      // Phase 3: For UPGRADE scenario, warm all enabled instances BEFORE DB commit
      if (existingBySlug) {
        try {
          // Import warmPluginInstanceRuntime
          const { warmPluginInstanceRuntime } = await import('./plugin-runtime');

          // Get all enabled, non-deleted instances
          const enabledInstances = await prisma.pluginInstallation.findMany({
            where: {
              pluginSlug: manifest.slug,
              enabled: true,
              deletedAt: null,
            },
          });

          // Warm each instance (will throw if any fails)
          for (const instance of enabledInstances) {
            await warmPluginInstanceRuntime(manifest.slug, instance.id);
          }

          // All instances warmed successfully - proceed with DB update
          // CRITICAL: Set deletedAt=null to restore visibility (in case of re-install after soft delete)
          const pluginInstall = await prisma.$transaction(async (tx) => {
            const updatedInstall = await tx.pluginInstall.update({
              where: { slug: manifest.slug },
              data: {
                name: manifest.name, version: manifest.version, description: manifest.description,
                author: manifest.author, authorUrl: manifest.authorUrl, category: manifest.category,
                runtimeType: manifest.runtimeType, entryModule: manifest.entryModule, zipHash,
                manifestJson: manifest, permissions: manifest.permissions ?? null, deletedAt: null, updatedAt: now,
              },
            });
            if (existingBySlug.deletedAt !== null) {
              const defaultInstance = await tx.pluginInstallation.findUnique({
              where: {
                pluginSlug_instanceKey: {
                  pluginSlug: manifest.slug,
                  instanceKey: 'default',
                },
              },
            });

              if (defaultInstance) {
                const defaultConfig = parseJsonObject(defaultInstance.configJson);
                const restoredReadiness = evaluatePluginConfigReadiness(manifest, defaultConfig);
                await tx.pluginInstallation.update({
                where: { id: defaultInstance.id },
                data: {
                  enabled: restoredReadiness.ready,
                  deletedAt: null, // Clear soft delete
                },
              });
              }
            }
            await incrementPluginRegistryVersion(tx);
            return updatedInstall;
          });

          // Re-register webhook subscriptions on upgrade.
          try {
            const defaultInstance = await prisma.pluginInstallation.findUnique({
              where: {
                pluginSlug_instanceKey: {
                  pluginSlug: manifest.slug,
                  instanceKey: 'default',
                },
              },
            });
            if (defaultInstance) {
              await WebhookSubscriptionService.createFromManifest(defaultInstance.id, manifest);
            }
          } catch (integrationError: any) {
            console.warn(
              `Non-fatal: Failed to re-register webhooks on upgrade for ${manifest.slug}:`,
              integrationError.message
            );
          }

          // Create installed metadata
          const installedPlugin: InstalledPlugin = {
            id: pluginInstall.id,
            slug: manifest.slug,
            name: manifest.name,
            version: manifest.version,
            description: manifest.description || '',
            category: manifest.category || 'general',
            runtimeType: manifest.runtimeType,
            trustLevel: trustLevel,
            entryModule: manifest.entryModule,
            source: 'local-zip',
            fsPath: targetDir,
            permissions: manifest.permissions,
            author: manifest.author,
            authorUrl: manifest.authorUrl,
            installedAt: existingBySlug.installedAt,
            updatedAt: now,
            zipHash,
          };

          await this.saveInstalledMeta(manifest.slug, installedPlugin);
          await deployment.commit();
          deployment = null;
          return installedPlugin;

        } catch (warmError: any) {
          // WARM FAILED: Rollback file system, keep old version
          console.error(`Warm failed for plugin ${manifest.slug}, rolling back:`, warmError);

          // Remove new directory
          await deployment?.rollback().catch(() => {});
          deployment = null;

          // DB is NOT updated (old version remains)
          throw new Error(
            `Plugin upgrade failed: ${warmError.message}. Old version restored.`
          );
        }
      } else {
        // NEW INSTALL: Create DB records, then warm default instance
        try {
          const result = await prisma.$transaction(async (tx) => {
            const install = await tx.pluginInstall.create({
              data: {
                slug: manifest.slug,
                name: manifest.name,
                version: manifest.version,
                description: manifest.description,
                author: manifest.author,
                authorUrl: manifest.authorUrl,
                category: manifest.category,
                runtimeType: manifest.runtimeType,
                entryModule: manifest.entryModule,
                source: 'local-zip',
                zipHash,
                manifestJson: manifest,
                permissions: manifest.permissions ?? null,
              },
            });

            await tx.pluginInstallation.create({
              data: {
                pluginSlug: manifest.slug,
                instanceKey: 'default',
                enabled: shouldEnableDefaultInstance,
                configJson: null,
                grantedPermissions: manifest.permissions ?? null,
              },
            });

            await incrementPluginRegistryVersion(tx);

            return install;
          });

          const pluginInstall = result;
          let defaultInstance = await prisma.pluginInstallation.findUnique({
            where: {
              pluginSlug_instanceKey: {
                pluginSlug: manifest.slug,
                instanceKey: 'default',
              },
            },
          });

          // Warm default instance (if warm fails, disable it but keep files/records)
          try {
            const { warmPluginInstanceRuntime } = await import('./plugin-runtime');

            if (defaultInstance) {
              if (defaultInstance.enabled) {
                await warmPluginInstanceRuntime(manifest.slug, defaultInstance.id);
              }
            }
          } catch (warmError: any) {
            // Warm failed for new install: disable default instance but keep files
            console.warn(
              `Warm failed for new plugin ${manifest.slug}, disabling default instance:`,
              warmError
            );
            await prisma.$transaction(async (tx) => {
              await tx.pluginInstallation.updateMany({
                where: { pluginSlug: manifest.slug, instanceKey: 'default' },
                data: { enabled: false },
              });
              await incrementPluginRegistryVersion(tx);
            });
            await CacheService.incrementPluginVersion();
            defaultInstance = await prisma.pluginInstallation.findUnique({
              where: {
                pluginSlug_instanceKey: {
                  pluginSlug: manifest.slug,
                  instanceKey: 'default',
                },
              },
            });
          }

          if (defaultInstance?.enabled && hasLifecycleHook(manifest, 'onInstall')) {
            await executeLifecycleHook('onInstall', {
              installationId: defaultInstance.id,
              pluginSlug: manifest.slug,
              instanceKey: defaultInstance.instanceKey,
              config: parseJsonObject(defaultInstance.configJson),
            }, manifest);
          }

          // Register webhook subscriptions from manifest (§4.7)
          try {
            if (defaultInstance) {
              await WebhookSubscriptionService.createFromManifest(defaultInstance.id, manifest);
            }
          } catch (integrationError: any) {
            console.warn(
              `Non-fatal: Failed to register webhooks for ${manifest.slug}:`,
              integrationError.message
            );
          }

          // Create installed metadata
          const installedPlugin: InstalledPlugin = {
            id: pluginInstall.id,
            slug: manifest.slug,
            name: manifest.name,
            version: manifest.version,
            description: manifest.description || '',
            category: manifest.category || 'general',
            runtimeType: manifest.runtimeType,
            trustLevel: trustLevel,
            entryModule: manifest.entryModule,
            source: 'local-zip',
            fsPath: targetDir,
            permissions: manifest.permissions,
            author: manifest.author,
            authorUrl: manifest.authorUrl,
            installedAt: pluginInstall.installedAt,
            updatedAt: now,
            zipHash,
          };

          await this.saveInstalledMeta(manifest.slug, installedPlugin);
          await deployment.commit();
          deployment = null;
          await CacheService.incrementPluginVersion();
          return installedPlugin;

        } catch (dbError) {
          // DB transaction failed: ROLLBACK file system changes
          await deployment?.rollback().catch(() => {});
          deployment = null;

          throw dbError;
        }
      }
    } catch (error) {
      // Ensure backup is restored if still exists
      await deployment?.rollback().catch((rollbackError) => console.error('Failed to rollback file system after install failure:', rollbackError));
      deployment = null;

      throw error;
    } finally {
      if (tempZipCleanup) {
        await tempZipCleanup().catch(() => {});
      }

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
    const pluginPackage = await pluginPackageStore.get(slug);
    if (!pluginPackage) {
      throw new Error(`Plugin "${slug}" is not installed`);
    }

    await pluginPackageStore.delete(slug);
  }

  /**
   * List installed plugins
   */
  async list(): Promise<InstalledPlugin[]> {
    const plugins: InstalledPlugin[] = [];
    for (const slug of await pluginPackageStore.list()) {
        const plugin = await this.get(slug);
        if (plugin) {
          plugins.push(plugin);
        }
    }

    return plugins;
  }

  /**
   * Get installed plugin details
   */
  async get(slug: string): Promise<InstalledPlugin | null> {
    const pluginPackage = await pluginPackageStore.get(slug);
    if (!pluginPackage) {
      return null;
    }

    // Prefer reading .installed.json
    try {
      return JSON.parse(await pluginPackage.readText(INSTALLED_META_FILE)) as InstalledPlugin;
    } catch {
      // If no metadata file exists, rebuild from manifest.json
      return this.rebuildMetaFromManifest(slug, pluginPackage);
    }
  }

  /**
   * Save installed metadata
   */
  private async saveInstalledMeta(slug: string, meta: InstalledPlugin): Promise<void> {
    const pluginPackage = await pluginPackageStore.get(slug);
    if (!pluginPackage) throw new Error(`Plugin "${slug}" is not installed`);
    await pluginPackage.writeText(INSTALLED_META_FILE, JSON.stringify(meta, null, 2));
  }

  /**
   * Rebuild metadata from manifest
   */
  private async rebuildMetaFromManifest(
    slug: string,
    pluginPackage: Awaited<ReturnType<typeof pluginPackageStore.get>>
  ): Promise<InstalledPlugin | null> {
    try {
      if (!pluginPackage) return null;
      const manifest = JSON.parse(await pluginPackage.readText('manifest.json')) as PluginManifest;
      const stat = await pluginPackage.stat();

      return {
        id: uuidv4(),
        slug: manifest.slug || slug,
        name: manifest.name || slug,
        version: manifest.version || '0.0.0',
        description: manifest.description || '',
        category: manifest.category || 'general',
        runtimeType: manifest.runtimeType || 'internal-fastify',
        entryModule: manifest.entryModule,
        source: 'local-zip',
        fsPath: pluginPackage.getEntryPath(''),
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
