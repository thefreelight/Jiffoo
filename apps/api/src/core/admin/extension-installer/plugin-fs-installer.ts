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
import { promises as fs } from 'fs';
import { packBuiltinPlugin } from './builtin-package';
import path from 'path';
import { prisma } from '@/config/database';
import { ExtensionInstallerError } from './errors';
import {
  IPluginInstaller,
  InstalledPlugin,
  PluginManifest,
  type PluginInstallOptions,
  type ExtensionSource,
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
import {
  deriveTrustLevel,
} from './trust-level';
import {
  executeLifecycleHook,
  hasLifecycleHook,
} from '@/core/admin/plugin-management/lifecycle-hooks';
import { syncEventSubscriptions } from '@/infra/events/emit';
import { decryptPluginConfig } from '@/core/admin/plugin-management/config-crypto';
import { redactPluginFailure } from './plugin-failure';
import { verifyPluginZip } from 'shared/plugin-signing';
import { PLUGIN_MAX_ZIP_SIZE } from 'shared/plugin-signing';
import { pluginPackageBlobStore } from '@/core/storage/plugin-package-blob-store';
import { resolveCurrentPluginPackage } from '@/core/storage/current-plugin-package';
import { acquirePluginOperationLease, fencePluginOperationLease, releasePluginOperationLease } from '@/core/storage/plugin-operation-lease';
import { assertUploadPreview, assertUploadSnapshot, inspectPluginUpload, PluginUploadError, uploadOperation, writePluginInstallAudit, type UploadInspection, type UploadSnapshot } from './plugin-upload';
import { checkPluginApiCompatibility } from './plugin-compatibility';
import { startPluginInstallOperation, waitPluginInstallOperation, publishPluginMigrationOperation } from './plugin-migration-operation';

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

const BUILTIN_PLUGIN_SLUGS = new Set([
  'manual-payment',
  'free-shipping',
  'zero-tax',
  'manual-fulfillment',
  'console-email',
]);

/**
 * Plugin file system installer implementation
 */
export class PluginFsInstaller implements IPluginInstaller {
  async installFromDirectory(
    directory: string,
    options: PluginInstallOptions = {},
  ): Promise<InstalledPlugin> {
    const { bytes } = await packBuiltinPlugin(directory);
    return this.install(Readable.from(bytes), options);
  }

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
  async install(zipStream: Readable, options?: PluginInstallOptions): Promise<InstalledPlugin> {
    if (options?.source !== 'builtin' && !options?.operationId) {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of zipStream) {
        const bytes = Buffer.from(chunk); size += bytes.length;
        if (size > PLUGIN_MAX_ZIP_SIZE) throw new PluginUploadError('PAYLOAD_TOO_LARGE', 413);
        chunks.push(bytes);
      }
      const operation = await startPluginInstallOperation(Buffer.concat(chunks), options ?? {});
      return waitPluginInstallOperation(operation.operationId);
    }
    let tempDir: string | null = null;
    let deployment: PluginPackageDeployment | null = null;
    let tempZipCleanup: (() => Promise<void>) | null = null;
    let wasNewInstall = false;
    let lease: { slug: string; token: string } | null = null;
    let inspection: UploadInspection | undefined;
    let snapshot: UploadSnapshot | undefined;
    let operation: 'install' | 'upgrade' | 'unchanged' = 'install';

    // 1. Stream the ZIP to disk while calculating its hash to avoid buffering large packages in memory.
    const {
      hash: zipHash,
      filePath: zipFilePath,
      cleanup: cleanupTempZip,
    } = await spoolStreamToTempFileAndHash(zipStream, 'plugin-install', PLUGIN_MAX_ZIP_SIZE);
    tempZipCleanup = cleanupTempZip;

    try {
    const publisher = await verifyPluginZip(zipFilePath);
    if (options?.source === 'marketplace' && !publisher) {
      throw new ExtensionInstallerError('Marketplace packages must be signed', { code: 'MARKETPLACE_SIGNATURE_REQUIRED' });
    }
    tempDir = await extractZipToTemp(createReadStream(zipFilePath), 'plugin');
    const { rootDir, manifestPath } = await resolveExtractedPackageRoot(tempDir, 'plugin');
    const manifest = await readJsonFile<PluginManifest>(manifestPath);
    validatePluginManifest(manifest);
    if (options?.source === 'builtin' && manifest.database) {
      throw new ExtensionInstallerError('Builtin plugin database declarations require an explicit bootstrap', { code: 'PLUGIN_MIGRATION_MANIFEST_INVALID' });
    }
    if (options?.source === 'marketplace') {
      if (!options.lease || !options.expectedMarketplaceIdentity) throw new Error('Marketplace install requires a lease and expected identity');
      if (manifest.slug !== options.lease.slug ||
        manifest.version !== options.expectedMarketplaceIdentity.version ||
        publisher!.publisherId !== options.expectedMarketplaceIdentity.publisherId) {
        throw new ExtensionInstallerError('Marketplace package identity differs from the catalog', {
          code: 'MARKETPLACE_IDENTITY_MISMATCH',
        });
      }
    }
    if (options?.source !== 'builtin' && BUILTIN_PLUGIN_SLUGS.has(manifest.slug)) {
      throw new ExtensionInstallerError(`Plugin slug "${manifest.slug}" is reserved for a built-in plugin`, { code: 'SLUG_RESERVED' });
    }
    if (options?.source !== 'builtin') {
      lease = options?.lease ?? { slug: manifest.slug, token: await acquirePluginOperationLease(manifest.slug, 'install') };
      await testLeaseBarrier('acquired', manifest.slug, zipHash);
      inspection = await inspectPluginUpload(await fs.readFile(zipFilePath));
      const current = await prisma.pluginInstall.findUnique({ where: { slug: manifest.slug } });
      if (options?.operationId) {
        const owned = await prisma.pluginMigrationOperation.findUniqueOrThrow({ where: { id: options.operationId } });
        if (owned.slug !== manifest.slug || owned.packageHash !== zipHash || owned.actorId !== options.actorUserId || owned.leaseToken !== lease.token || owned.phase !== 'PUBLISHING') throw new PluginUploadError('PLUGIN_OPERATION_LEASE_LOST', 409);
        snapshot = owned.expectedInstall as UploadSnapshot;
      } else if (options?.source !== 'marketplace') snapshot = assertUploadPreview(options?.previewToken, options?.actorUserId, inspection, current);
      operation = uploadOperation(inspection, current);
      if (!checkPluginApiCompatibility(manifest).compatible) throw new PluginUploadError('INCOMPATIBLE_API_VERSION', 422);
      if (!options?.actorUserId) throw new PluginUploadError('PLUGIN_PREVIEW_REQUIRED', 409);
      if (!publisher) {
        if (!options.confirmUnsigned || options.confirmationSlug !== manifest.slug)
          throw new PluginUploadError('UNSIGNED_CONFIRMATION_REQUIRED', 400, 'Confirm the unsigned warning and type the plugin slug');
        if (!options.operationId) await prisma.$transaction(async (tx) => {
          await fencePluginOperationLease(tx, lease!.slug, lease!.token);
          await assertUploadSnapshot(tx, manifest.slug, snapshot!);
          await writePluginInstallAudit(tx, options.actorUserId!, 'PLUGIN_UNSIGNED_INSTALL_CONFIRMED', inspection!, operation, current?.version ?? null, options?.source ?? 'local-zip');
        });
      }
    }
    // 2. Check if same hash already installed (idempotency)
    // CRITICAL: Must filter deletedAt=null, otherwise soft-deleted plugins will be treated as installed
    const existingByHash = await prisma.pluginInstall.findFirst({
      where: { 
        zipHash,
        deletedAt: null, // Only consider non-deleted plugins
      },
    });

    if (existingByHash) {
      if (publisher?.publisherId !== (existingByHash.publisherId ?? undefined)) {
        throw new ExtensionInstallerError('Publisher change forbidden', { code: publisher ? 'PUBLISHER_CHANGE_FORBIDDEN' : 'SIGNED_UPGRADE_REQUIRED' });
      }
      // Same ZIP already installed and not deleted - return existing plugin info
      let existingPackage = await pluginPackageStore.get(existingByHash.slug, zipHash);
      if (!existingPackage) {
        existingPackage = (await pluginPackageStore.put(existingByHash.slug, zipHash, rootDir)).package;
      }
      if (manifest.slug !== existingByHash.slug || manifest.version !== existingByHash.version)
        throw new Error('Installed package identity does not match the uploaded ZIP');
      if (lease) {
        const bytes = await fs.readFile(zipFilePath);
        await prisma.$transaction(async (tx) => {
          await fencePluginOperationLease(tx, lease!.slug, lease!.token);
          if (snapshot !== undefined) await assertUploadSnapshot(tx, manifest.slug, snapshot);
          await pluginPackageBlobStore.put(tx, manifest.slug, zipHash, bytes);
          await pluginPackageBlobStore.deleteExcept(tx, manifest.slug, zipHash);
          await tx.pluginInstall.update({ where: { slug: manifest.slug }, data: {
            signingRoot: publisher?.signingRoot ?? null,
            updatedAt: new Date(Math.max(Date.now(), existingByHash.updatedAt.getTime() + 1)),
            ...(options?.source === 'marketplace' ? { source: 'marketplace' } : {}),
          } });
          await tx.pluginInstallation.upsert({
            where: { pluginSlug_instanceKey: { pluginSlug: manifest.slug, instanceKey: 'default' } },
            create: { pluginSlug: manifest.slug, instanceKey: 'default', enabled: false, configJson: {}, grantedPermissions: manifest.permissions ?? [] },
            update: { protectionGeneration: { increment: 1 } },
          });
          await writePluginInstallAudit(tx, options!.actorUserId!, 'PLUGIN_INSTALLED', inspection!, operation, existingByHash.version, options?.source ?? 'local-zip');
          await publishPluginMigrationOperation(tx, options?.operationId);
          await incrementPluginRegistryVersion(tx);
        });
      }
      return {
        id: existingByHash.id,
        slug: existingByHash.slug,
        name: existingByHash.name,
        version: existingByHash.version,
        description: existingByHash.description || '',
        category: existingByHash.category || 'general',
        runtimeType: 'internal-fastify',
        trustLevel: existingByHash.trustLevel,
        publisherId: existingByHash.publisherId,
        publisherName: existingByHash.publisherName,
        publisherVerified: publisher?.signingRoot === 'official',
        signingRoot: publisher?.signingRoot ?? null,
        publisherCertificateFingerprint: existingByHash.publisherCertificateFingerprint,
        entryModule: existingByHash.entryModule || undefined,
        source: (options?.source === 'marketplace' ? 'marketplace' : existingByHash.source) as ExtensionSource,
        fsPath: existingPackage.getEntryPath(''),
        permissions: parseJsonArray(existingByHash.permissions),
        author: existingByHash.author || undefined,
        authorUrl: existingByHash.authorUrl || undefined,
        installedAt: existingByHash.installedAt,
        updatedAt: existingByHash.updatedAt,
        zipHash,
      };
    }

      // Uploaded packages always use the established unsigned confirmation and audit flow.
      const trustLevel = publisher ? 'signed' : deriveTrustLevel(options?.source || 'local-zip');

      const existingBySlug = await prisma.pluginInstall.findUnique({
        where: { slug: manifest.slug },
      });
      if (existingBySlug?.trustLevel === 'signed' && !publisher) {
        throw new ExtensionInstallerError('Signed upgrade required', { code: 'SIGNED_UPGRADE_REQUIRED' });
      }
      if (existingBySlug?.publisherId && publisher && existingBySlug.publisherId !== publisher.publisherId) {
        throw new ExtensionInstallerError('Publisher change forbidden', { code: 'PUBLISHER_CHANGE_FORBIDDEN' });
      }

      // 7. Check if slug already exists (update/restore scenario)
      const now = new Date(Math.max(Date.now(), (existingBySlug?.updatedAt.getTime() ?? 0) + 1));

      // 8. TWO-PHASE COMMIT WITH WARM VALIDATION
      // Phase 1: atomically replace the package through the storage boundary.
      deployment = await pluginPackageStore.put(manifest.slug, zipHash, rootDir);
      if (lease) await testLeaseBarrier('published', manifest.slug, zipHash);
      const targetDir = deployment.package.getEntryPath('');
      wasNewInstall = !existingBySlug;

      // Phase 3: For UPGRADE scenario, warm all enabled instances BEFORE DB commit
      if (existingBySlug) {
        try {
          const { validateCandidateRuntime } = await import('./plugin-runtime');

          // Get all enabled, non-deleted instances
          const enabledInstances = options?.operationId ? [] : await prisma.pluginInstallation.findMany({
            where: {
              pluginSlug: manifest.slug,
              enabled: true,
              deletedAt: null,
            },
          });

          // Warm each instance (will throw if any fails)
          for (const instance of enabledInstances) {
            await validateCandidateRuntime(manifest.slug, zipHash, manifest, instance.id, decryptPluginConfig(manifest, parseJsonObject(instance.configJson)));
          }

          // All instances warmed successfully - proceed with DB update
          // CRITICAL: Set deletedAt=null to restore visibility (in case of re-install after soft delete)
          const pluginInstall = await prisma.$transaction(async (tx) => {
            if (lease) await fencePluginOperationLease(tx, lease.slug, lease.token);
            if (snapshot !== undefined) await assertUploadSnapshot(tx, manifest.slug, snapshot);
            if (lease) {
              await pluginPackageBlobStore.put(tx, manifest.slug, zipHash, await fs.readFile(zipFilePath));
              await pluginPackageBlobStore.deleteExcept(tx, manifest.slug, zipHash);
            }
            const updatedInstall = await tx.pluginInstall.update({
              where: { slug: manifest.slug },
              data: {
                name: manifest.name, version: manifest.version, source: options?.source || 'local-zip', description: manifest.description,
                author: manifest.author, authorUrl: manifest.authorUrl, category: manifest.category,
                runtimeType: manifest.runtimeType, entryModule: manifest.entryModule, zipHash,
                manifestJson: manifest, permissions: manifest.permissions ?? null, trustLevel, deletedAt: null, updatedAt: now,
                signingRoot: publisher?.signingRoot ?? null,
                publisherId: publisher?.publisherId ?? null,
                publisherName: publisher?.publisherName ?? null,
                publisherCertificateFingerprint: publisher?.publisherCertificateFingerprint ?? null,
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
                await tx.pluginInstallation.update({
                where: { id: defaultInstance.id },
                data: {
                  enabled: false,
                  deletedAt: null, // Clear soft delete
                },
              });
              }
            }
            await syncEventSubscriptions(tx, manifest.slug, manifest.subscriptions);
            await tx.pluginInstallation.upsert({
              where: { pluginSlug_instanceKey: { pluginSlug: manifest.slug, instanceKey: 'default' } },
              create: { pluginSlug: manifest.slug, instanceKey: 'default', enabled: false, configJson: {}, grantedPermissions: manifest.permissions ?? [] },
              update: { protectionGeneration: { increment: 1 } },
            });
            if (inspection && options?.actorUserId) await writePluginInstallAudit(tx, options.actorUserId, operation === 'upgrade' ? 'PLUGIN_UPGRADED' : 'PLUGIN_INSTALLED', inspection, operation, existingBySlug.version, options?.source ?? 'local-zip');
            await publishPluginMigrationOperation(tx, options?.operationId);
            await incrementPluginRegistryVersion(tx);
            return updatedInstall;
          });


          // Create installed metadata
          const installedPlugin: InstalledPlugin = {
            id: pluginInstall.id,
            slug: manifest.slug,
            name: manifest.name,
            version: manifest.version,
            description: manifest.description || '',
            category: manifest.category || 'general',
            runtimeType: manifest.runtimeType,
            trustLevel: pluginInstall.trustLevel,
            publisherId: pluginInstall.publisherId,
            publisherName: pluginInstall.publisherName,
            publisherVerified: pluginInstall.signingRoot === 'official',
            signingRoot: pluginInstall.signingRoot as 'official' | 'test' | null,
            publisherCertificateFingerprint: pluginInstall.publisherCertificateFingerprint,
            entryModule: manifest.entryModule,
            source: (options?.source || 'local-zip') as ExtensionSource,
            fsPath: targetDir,
            permissions: manifest.permissions,
            author: manifest.author,
            authorUrl: manifest.authorUrl,
            installedAt: existingBySlug.installedAt,
            updatedAt: now,
            zipHash,
          };

          const warnings: string[] = [];
          try {
          await deployment.commit();
          deployment = null;
          const { reconcilePluginState } = await import('./plugin-reconciliation');
          await reconcilePluginState(manifest.slug);
          const upgradedDefaultInstance = await prisma.pluginInstallation.findUnique({
            where: { pluginSlug_instanceKey: { pluginSlug: manifest.slug, instanceKey: 'default' } },
          });
          if (existingBySlug.version !== manifest.version && upgradedDefaultInstance && hasLifecycleHook(manifest, 'onUpgrade')) {
            const hook = await executeLifecycleHook('onUpgrade', {
              installationId: upgradedDefaultInstance.id,
              pluginSlug: manifest.slug,
              instanceKey: upgradedDefaultInstance.instanceKey,
              config: decryptPluginConfig(manifest, parseJsonObject(upgradedDefaultInstance.configJson)),
              previousVersion: existingBySlug.version,
            }, manifest);
            if (!hook.success) warnings.push('PLUGIN_UPGRADE_HOOK_WARNING');
          }
          } catch { warnings.push('PLUGIN_POST_COMMIT_WARNING'); deployment = null; }
          return { ...installedPlugin, warnings };

        } catch (warmError: any) {
          // WARM FAILED: Rollback file system, keep old version
          const safeFailure = await redactPluginFailure(manifest.slug, warmError);
          console.error(`Warm failed for plugin ${manifest.slug}, rolling back:`, safeFailure);

          // Remove new directory
          await deployment?.rollback().catch(() => {});
          deployment = null;


          if (warmError?.code === 'PLUGIN_OPERATION_LEASE_LOST') throw warmError;
          throw new Error(`Plugin upgrade failed before the package transaction committed: ${safeFailure}`);
        }
      } else {
        // NEW INSTALL: Create a disabled instance; enablement is a separate transition.
        try {
          const result = await prisma.$transaction(async (tx) => {
            if (lease) await fencePluginOperationLease(tx, lease.slug, lease.token);
            if (snapshot !== undefined) await assertUploadSnapshot(tx, manifest.slug, snapshot);
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
                source: options?.source || 'local-zip',
                trustLevel,
                signingRoot: publisher?.signingRoot ?? null,
                publisherId: publisher?.publisherId ?? null,
                publisherName: publisher?.publisherName ?? null,
                publisherCertificateFingerprint: publisher?.publisherCertificateFingerprint ?? null,
                zipHash,
                manifestJson: manifest,
                permissions: manifest.permissions ?? null,
              },
            });
            if (lease) {
              await pluginPackageBlobStore.put(tx, manifest.slug, zipHash, await fs.readFile(zipFilePath));
              await pluginPackageBlobStore.deleteExcept(tx, manifest.slug, zipHash);
            }

            await tx.pluginInstallation.create({
              data: {
                pluginSlug: manifest.slug,
                instanceKey: 'default',
                enabled: false,
                configJson: null,
                grantedPermissions: manifest.permissions ?? null,
              },
            });

            await syncEventSubscriptions(tx, manifest.slug, manifest.subscriptions);
            if (inspection && options?.actorUserId) await writePluginInstallAudit(tx, options.actorUserId, 'PLUGIN_INSTALLED', inspection, operation, null, options?.source ?? 'local-zip');
            await publishPluginMigrationOperation(tx, options?.operationId);
            await incrementPluginRegistryVersion(tx);

            return install;
          });

          const pluginInstall = result;
          const defaultInstance = await prisma.pluginInstallation.findUnique({
            where: {
              pluginSlug_instanceKey: {
                pluginSlug: manifest.slug,
                instanceKey: 'default',
              },
            },
          });

          const warnings: string[] = [];
          if (defaultInstance && hasLifecycleHook(manifest, 'onInstall')) {
            try {
            const hook = await executeLifecycleHook('onInstall', {
              installationId: defaultInstance.id,
              pluginSlug: manifest.slug,
              instanceKey: defaultInstance.instanceKey,
              config: decryptPluginConfig(manifest, parseJsonObject(defaultInstance.configJson)),
            }, manifest);
            if (!hook.success) warnings.push('PLUGIN_INSTALL_HOOK_WARNING');
            } catch { warnings.push('PLUGIN_POST_COMMIT_WARNING'); }
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
            trustLevel: pluginInstall.trustLevel,
            publisherId: pluginInstall.publisherId,
            publisherName: pluginInstall.publisherName,
            publisherVerified: pluginInstall.signingRoot === 'official',
            signingRoot: pluginInstall.signingRoot as 'official' | 'test' | null,
            publisherCertificateFingerprint: pluginInstall.publisherCertificateFingerprint,
            entryModule: manifest.entryModule,
            source: (options?.source || 'local-zip') as ExtensionSource,
            fsPath: targetDir,
            permissions: manifest.permissions,
            author: manifest.author,
            authorUrl: manifest.authorUrl,
            installedAt: pluginInstall.installedAt,
            updatedAt: now,
            zipHash,
          };

          await deployment.commit();
          deployment = null;
          try {
          await CacheService.incrementPluginVersion();
          const { reconcilePluginState } = await import('./plugin-reconciliation');
          await reconcilePluginState(manifest.slug);
          } catch { warnings.push('PLUGIN_POST_COMMIT_WARNING'); }
          return { ...installedPlugin, warnings };

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
      if (lease && !options?.lease) await releasePluginOperationLease(lease.slug, lease.token);
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
    const installed = await prisma.pluginInstall.findUnique({ where: { slug } });
    if (!installed) throw new Error(`Plugin "${slug}" is not installed`);
  }

  /**
   * List installed plugins
   */
  async list(): Promise<InstalledPlugin[]> {
    const plugins: InstalledPlugin[] = [];
    const rows = await prisma.pluginInstall.findMany({ where: { deletedAt: null }, select: { slug: true } });
    for (const { slug } of rows) {
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
    const installed = await prisma.pluginInstall.findUnique({ where: { slug } });
    if (!installed || installed.deletedAt || !installed.zipHash) return null;
    const pluginPackage = await resolveCurrentPluginPackage(slug, installed.zipHash);
    return this.rebuildMetaFromManifest(slug, pluginPackage, installed);
  }

  /**
   * Rebuild metadata from manifest
   */
  private async rebuildMetaFromManifest(
    slug: string,
    pluginPackage: Awaited<ReturnType<typeof pluginPackageStore.get>>,
    installed: Awaited<ReturnType<typeof prisma.pluginInstall.findUnique>>,
  ): Promise<InstalledPlugin | null> {
    try {
      if (!pluginPackage || !installed) return null;
      const manifest = JSON.parse(await pluginPackage.readText('manifest.json')) as PluginManifest;
      return {
        id: installed.id,
        slug: manifest.slug || slug,
        name: manifest.name || slug,
        version: manifest.version || '0.0.0',
        description: manifest.description || '',
        category: manifest.category || 'general',
        runtimeType: manifest.runtimeType || 'internal-fastify',
        entryModule: manifest.entryModule,
        source: installed.source as ExtensionSource,
        trustLevel: installed.trustLevel,
        publisherId: installed.publisherId,
        publisherName: installed.publisherName,
        publisherVerified: installed.signingRoot === 'official',
        signingRoot: installed.signingRoot as 'official' | 'test' | null,
        publisherCertificateFingerprint: installed.publisherCertificateFingerprint,
        fsPath: pluginPackage.getEntryPath(''),
        permissions: manifest.permissions,
        author: manifest.author,
        authorUrl: manifest.authorUrl,
        installedAt: installed.installedAt,
        updatedAt: installed.updatedAt,
        zipHash: installed.zipHash ?? undefined,
      };
    } catch {
      return null;
    }
  }
}

async function testLeaseBarrier(stage: 'acquired' | 'published', slug: string, zipHash: string): Promise<void> {
  if (process.env.NODE_ENV !== 'test' || process.env.JIFFOO_TEST_PLUGIN_LEASE_BARRIER !== stage || !process.send) return;
  process.send({ kind: 'plugin-lease-ready', stage, slug, zipHash });
  await new Promise<void>((resolve) => {
    const release = (message: unknown) => {
      if ((message as { kind?: string })?.kind !== 'plugin-lease-release') return;
      process.off('message', release);
      resolve();
    };
    process.on('message', release);
  });
}

/** Singleton instance */
export const pluginFsInstaller = new PluginFsInstaller();
