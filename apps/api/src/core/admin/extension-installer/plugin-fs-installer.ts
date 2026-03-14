// @ts-nocheck
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
import { promises as fs } from 'fs';
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
  getPluginDir,
  moveDir,
  dirExists,
  removeDir,
  ensureDir,
  spoolStreamToTempFileAndHash,
} from './utils';
import { evaluatePluginConfigReadiness } from './config-readiness';
import {
  verifyPackageFromZipFile,
  getSignatureVerifyMode,
  type SignatureVerifyResult,
} from './signature-verifier';
import {
  executeLifecycleHook,
  hasLifecycleHook,
} from '@/core/admin/plugin-management/lifecycle-hooks';
import { WebhookSubscriptionService } from '@/core/webhooks/subscription-service';
import { ThemeExtensionsService } from '@/core/admin/plugin-management/theme-extensions-service';

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
  async install(zipStream: Readable): Promise<InstalledPlugin> {
    let tempDir: string | null = null;
    let targetDir: string | null = null;
    let backupDir: string | null = null;
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
      const existingDir = getPluginDir(existingByHash.slug);
      return {
        id: existingByHash.id,
        slug: existingByHash.slug,
        name: existingByHash.name,
        version: existingByHash.version,
        description: existingByHash.description || '',
        category: existingByHash.category || 'general',
        runtimeType: existingByHash.runtimeType as 'internal-fastify' | 'external-http',
        entryModule: existingByHash.entryModule || undefined,
        externalBaseUrl: existingByHash.externalBaseUrl || undefined,
        source: 'local-zip',
        fsPath: existingDir,
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

      // 5b. Signature verification (Phase 5, Section 4.8)
      const sigFilePath = path.join(rootDir, 'package.sig');
      let signatureResult: SignatureVerifyResult;
      try {
        await fs.access(sigFilePath);
        signatureResult = await verifyPackageFromZipFile(zipFilePath, sigFilePath);
      } catch {
        // No .sig file found in the package
        signatureResult = await verifyPackageFromZipFile(zipFilePath);
      }

      if (getSignatureVerifyMode() === 'required' && !signatureResult.verified) {
        throw new Error(`Signature verification failed: ${signatureResult.error}`);
      }

      // 6. Determine target directory
      targetDir = getPluginDir(manifest.slug);

      // 7. Check if slug already exists (update/restore scenario)
      const existingBySlug = await prisma.pluginInstall.findUnique({
        where: { slug: manifest.slug },
      });
      const now = new Date();

      // 8. TWO-PHASE COMMIT WITH WARM VALIDATION
      // Phase 1: Backup existing directory if exists
      const targetExists = await dirExists(targetDir);
      if (targetExists) {
        backupDir = `${targetDir}.__backup_${Date.now()}`;
        await fs.rename(targetDir, backupDir);
      }

      // Phase 2: Move new directory to target
      await ensureDir(path.dirname(targetDir));
      await fs.rename(rootDir, targetDir);
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
          const pluginInstall = await prisma.pluginInstall.update({
            where: { slug: manifest.slug },
            data: {
              name: manifest.name,
              version: manifest.version,
              description: manifest.description,
              author: manifest.author,
              authorUrl: manifest.authorUrl,
              category: manifest.category,
              runtimeType: manifest.runtimeType,
              entryModule: manifest.entryModule,
              externalBaseUrl: manifest.externalBaseUrl,
              zipHash,
              manifestJson: manifest,
              permissions: manifest.permissions ?? null,
              deletedAt: null, // CRITICAL: Restore visibility
              updatedAt: now,
            },
          });

          // If previously soft-deleted, ensure default instance is enabled
          const wasSoftDeleted = existingBySlug.deletedAt !== null;
          if (wasSoftDeleted) {
            const defaultInstance = await prisma.pluginInstallation.findUnique({
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
              // Re-enable default instance after restore
              await prisma.pluginInstallation.update({
                where: { id: defaultInstance.id },
                data: {
                  enabled: restoredReadiness.ready,
                  deletedAt: null, // Clear soft delete
                },
              });
              await CacheService.incrementPluginVersion();
            }
          }

          // Re-register webhook subscriptions and theme extensions on upgrade (§4.7, §10)
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
              await ThemeExtensionsService.registerFromManifest(defaultInstance.id, manifest);
            }
          } catch (integrationError: any) {
            console.warn(
              `Non-fatal: Failed to re-register webhooks/theme-extensions on upgrade for ${manifest.slug}:`,
              integrationError.message
            );
          }

          // Success: cleanup backup
          if (backupDir) {
            await removeDir(backupDir).catch((err) =>
              console.warn(`Failed to cleanup backup dir ${backupDir}:`, err)
            );
            backupDir = null;
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
            entryModule: manifest.entryModule,
            externalBaseUrl: manifest.externalBaseUrl,
            source: 'local-zip',
            fsPath: targetDir,
            permissions: manifest.permissions,
            author: manifest.author,
            authorUrl: manifest.authorUrl,
            signatureVerified: signatureResult?.verified ?? false,
            signedBy: signatureResult?.signedBy,
            installedAt: existingBySlug.installedAt,
            updatedAt: now,
            zipHash,
          };

          await this.saveInstalledMeta(manifest.slug, installedPlugin);
          return installedPlugin;

        } catch (warmError: any) {
          // WARM FAILED: Rollback file system, keep old version
          console.error(`Warm failed for plugin ${manifest.slug}, rolling back:`, warmError);

          // Remove new directory
          if (targetDir && (await dirExists(targetDir))) {
            await removeDir(targetDir).catch(() => {});
          }

          // Restore backup
          if (backupDir && (await dirExists(backupDir))) {
            await fs.rename(backupDir, targetDir).catch(() => {});
            backupDir = null;
          }

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
                externalBaseUrl: manifest.externalBaseUrl,
                source: 'local-zip',
                installPath: `extensions/plugins/${manifest.slug}`,
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
            await prisma.pluginInstallation.updateMany({
              where: {
                pluginSlug: manifest.slug,
                instanceKey: 'default',
              },
              data: { enabled: false },
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

          if (defaultInstance && hasLifecycleHook(manifest, 'onInstall')) {
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
              await ThemeExtensionsService.registerFromManifest(defaultInstance.id, manifest);
            }
          } catch (integrationError: any) {
            console.warn(
              `Non-fatal: Failed to register webhooks/theme-extensions for ${manifest.slug}:`,
              integrationError.message
            );
          }

          // Cleanup backup if exists
          if (backupDir) {
            await removeDir(backupDir).catch((err) =>
              console.warn(`Failed to cleanup backup dir ${backupDir}:`, err)
            );
            backupDir = null;
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
            entryModule: manifest.entryModule,
            externalBaseUrl: manifest.externalBaseUrl,
            source: 'local-zip',
            fsPath: targetDir,
            permissions: manifest.permissions,
            author: manifest.author,
            authorUrl: manifest.authorUrl,
            signatureVerified: signatureResult?.verified ?? false,
            signedBy: signatureResult?.signedBy,
            installedAt: pluginInstall.installedAt,
            updatedAt: now,
            zipHash,
          };

          await this.saveInstalledMeta(manifest.slug, installedPlugin);
          await CacheService.incrementPluginVersion();
          return installedPlugin;

        } catch (dbError) {
          // DB transaction failed: ROLLBACK file system changes
          if (targetDir && (await dirExists(targetDir))) {
            await removeDir(targetDir).catch(() => {});
          }

          if (backupDir && (await dirExists(backupDir))) {
            await fs.rename(backupDir, targetDir).catch(() => {});
            backupDir = null;
          }

          throw dbError;
        }
      }
    } catch (error) {
      // Ensure backup is restored if still exists
      if (backupDir && targetDir) {
        try {
          const targetStillExists = await dirExists(targetDir);
          if (targetStillExists) {
            await removeDir(targetDir);
          }
          await fs.rename(backupDir, targetDir);
        } catch (rollbackError) {
          console.error('Failed to rollback file system after install failure:', rollbackError);
        }
      }

      throw error;
    } finally {
      if (tempZipCleanup) {
        await tempZipCleanup().catch(() => {});
      }

      // Clean up temporary directory
      if (tempDir) {
        await cleanupTemp(tempDir);
      }

      // Clean up backup directory if still exists (shouldn't happen, but safety)
      if (backupDir) {
        await removeDir(backupDir).catch(() => {});
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
