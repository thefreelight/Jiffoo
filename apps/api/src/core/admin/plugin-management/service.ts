import { PluginPageService } from "@/core/plugin-pages/service";
import { PluginStorageService } from '@/core/plugin-storage/service';
/**
 * Plugin Management Service
 *
 * Manages plugin installations and instances using database as the single source of truth.
 * Stores one default configuration instance per plugin.
 */

import { prisma } from '@/config/database';
import { assertTaskPolicy, lockTaskScheduler, transitionInstallationTasks } from '@/core/plugins/tasks';
import { ApiError } from '@/utils/api-errors';
import { CacheService } from '@/core/cache/service';
import type { PluginMeta, PluginState, PluginConfig, InstalledPluginsResponse } from './types';
import { validateInstanceConfig, validateInstanceKeyFormat } from '@/core/extensions/shared/utils';
import { pluginPackageStore } from '@/core/storage/plugin-package-store';
import { resolveCurrentPluginPackage, PluginPackageResolutionError } from '@/core/storage/current-plugin-package';
import { assertPluginSigningAllowed } from '@/core/extensions/runtime/plugin-signing-policy';
import { pluginPackageBlobStore } from '@/core/storage/plugin-package-blob-store';
import { acquirePluginOperationLease, fencePluginOperationLease, releasePluginOperationLease } from '@/core/storage/plugin-operation-lease';
import { assertPluginOperationAvailable } from '@/core/extensions/runtime/plugin-migration-gate';
import { systemSettingsService } from '@/core/settings/service';
import { assertPluginConfigReadyForEnable } from '@/core/admin/extension-installer/config-readiness';
import type { PluginInstall, PluginInstallation } from '@prisma/client';
import { executeLifecycleHook, hasLifecycleHook } from './lifecycle-hooks';
import { mergeSecretConfigForUpdate } from './config-secrets';
import { decryptPluginConfig, encryptPluginConfig, redactPluginText, PluginConfigDecryptionError } from './config-crypto';
import { readStoredPluginManifest } from '@/core/admin/extension-installer/stored-manifest';
import { getPluginManifestIssues, parsePluginConfigSchema, validatePluginConfig } from '@jiffoo/shared';
import { ExtensionInstallerError } from '@/core/extensions/shared/errors';
import { writePluginAudit } from '@/core/admin/extension-installer/plugin-audit';
import { inspectPluginUpload } from '@/core/admin/extension-installer/plugin-upload';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { declaresContract, getDefaultInstance, type PluginInstanceProjection } from '@/core/extensions/registry';

type UpdatedInstance = PluginInstallation & { replacedPlugins: string[] };

// slug validation regex: ^[a-z][a-z0-9-]{0,30}[a-z0-9]$
const SLUG_REGEX = /^[a-z][a-z0-9-]{0,30}[a-z0-9]$/;

// Reserved instance keys
const RESERVED_INSTANCE_KEYS = ['default'];

async function waitForLifecycleLease(slug: string, operation: string): Promise<void> {
  if (process.env.NODE_ENV !== 'test' || process.env.JIFFOO_TEST_PLUGIN_LEASE_BARRIER !== 'acquired' || !process.send) return;
  process.send({ kind: 'plugin-lease-ready', slug, operation });
  await new Promise<void>((resolve) => {
    const receive = (message: unknown) => {
      if ((message as { kind?: string })?.kind !== 'plugin-lease-release') return;
      process.off('message', receive);
      resolve();
    };
    process.on('message', receive);
  });
}

async function reconcilePluginState(slug: string): Promise<void> {
  const { reconcilePluginState: reconcile } = await import('@/core/admin/extension-installer/plugin-reconciliation');
  await reconcile(slug);
}

async function warmPluginInstanceRuntime(
  slug: string,
  installationId: string,
  config?: Record<string, unknown>,
): Promise<void> {
  const { warmPluginInstanceRuntime: warm } = await import('@/core/extensions/runtime/plugin-runtime');
  await warm(slug, installationId, config);
}

/**
 * Validate instanceKey format (delegates to utils for consistency)
 */
function validateInstanceKey(instanceKey: string): void {
  if (instanceKey !== 'default') {
    throw Object.assign(new ApiError('UPDATE_ERROR'), { message: 'Only the default plugin instance is supported' });
  }
  try {
    validateInstanceKeyFormat(instanceKey);
  } catch (error: any) {
    throw error;
  }
}

/**
 * Validate slug format
 */
function validateSlug(slug: string): void {
  if (!SLUG_REGEX.test(slug)) {
    throw new ApiError('UPDATE_ERROR');
  }
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

async function assertNotLastEnabledProvider(pluginSlug: string, enabled: boolean, manifestJson: unknown, database: Pick<typeof prisma, 'pluginInstallation'> = prisma): Promise<void> {
  if (!enabled || getPluginManifestIssues(manifestJson).length > 0) return;
  const contracts = (['payment', 'shipping', 'tax', 'fulfillment', 'notification'] as const)
    .filter((contract) => declaresContract(manifestJson, contract));
  for (const contract of contracts) {
    const providers = await database.pluginInstallation.findMany({
      where: { enabled: true, deletedAt: null, plugin: { deletedAt: null } },
      include: { plugin: true },
    });
    const validProviders = providers.filter((provider) =>
      declaresContract(provider.plugin.manifestJson, contract)
      && getPluginManifestIssues(provider.plugin.manifestJson).length === 0,
    );
    if (validProviders.length === 1 && validProviders[0].pluginSlug === pluginSlug) {
      throw Object.assign(new ApiError('LAST_PROVIDER_REQUIRED'), { contract });
    }
  }
}


// ============================================================================
// Plugin Package Operations (PluginInstall table)
// ============================================================================

/**
 * Get plugin package by slug (excludes soft-deleted)
 */
async function getPluginPackage(slug: string): Promise<PluginInstall | null> {
  let plugin = await prisma.pluginInstall.findUnique({
    where: { slug },
  });
  
  // Filter out soft-deleted plugins
  if (plugin && plugin.deletedAt) {
    return null;
  }

  return plugin;
}

// ============================================================================
// Plugin Instance Operations (PluginInstallation table)
// ============================================================================

/**
 * Get plugin instance by installationId
 */
async function getInstanceById(installationId: string): Promise<PluginInstallation | null> {
  return prisma.pluginInstallation.findUnique({
    where: { id: installationId },
  });
}

/**
 * Get plugin instance by slug and instanceKey
 */
async function getInstanceByKey(slug: string, instanceKey: string): Promise<PluginInstallation | null> {
  validateInstanceKey(instanceKey);
  return prisma.pluginInstallation.findUnique({
    where: {
      pluginSlug_instanceKey: {
        pluginSlug: slug,
        instanceKey,
      },
    },
  });
}

/**
 * Get all instances for a plugin (excluding soft-deleted)
 */
async function getPluginInstances(slug: string): Promise<PluginInstallation[]> {
  return prisma.pluginInstallation.findMany({
    where: {
      pluginSlug: slug,
      instanceKey: 'default',
      deletedAt: null,
    },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Create the default plugin instance during installation.
 */
async function createDefaultInstance(
  slug: string,
  options?: {
    enabled?: boolean;
    config?: Record<string, unknown>;
    grantedPermissions?: string[];
  }
): Promise<PluginInstallation> {
  validateSlug(slug);
  const instanceKey = 'default';

  // Validate config size and depth (Blueprint 5.4: 64KB max, 10 layers max)
  if (options?.config !== undefined) {
    try {
      validateInstanceConfig(options.config);
    } catch (error: any) {
      throw error;
    }
  }

  // CRITICAL: Verify plugin package exists and is not soft-deleted
  const pluginPackage = await getPluginPackage(slug);
  if (!pluginPackage) {
    throw new ApiError('UPDATE_ERROR');
  }

  const effectiveEnabled = options?.enabled ?? true;
  if (effectiveEnabled) assertPluginSigningAllowed(pluginPackage);
  const effectiveConfig = (options?.config ?? {}) as Record<string, unknown>;
  const manifest = readStoredPluginManifest(pluginPackage);
  const storedConfig = encryptPluginConfig(manifest, effectiveConfig);
  if (effectiveEnabled) {
    try {
      assertPluginConfigReadyForEnable(slug, manifest, storedConfig);
    } catch (error: any) {
      throw error;
    }
  }

  // Check if instance already exists
  const existing = await prisma.pluginInstallation.findUnique({
    where: {
      pluginSlug_instanceKey: {
        pluginSlug: slug,
        instanceKey,
      },
    },
  });

  if (existing) {
    if (existing.deletedAt) {
      throw new ApiError('UPDATE_ERROR');
    }
    throw new ApiError('UPDATE_ERROR');
  }

  const instance = await prisma.pluginInstallation.create({
    data: {
      pluginSlug: slug,
      instanceKey,
      enabled: effectiveEnabled,
      configJson: options?.config ? storedConfig : null,
      grantedPermissions: options?.grantedPermissions ?? null,
    },
  });

  await CacheService.incrementPluginVersion();
  await reconcilePluginState(slug);
  return instance;
}

/**
 * Update plugin instance
 */
async function updateInstance(
  installationId: string,
  updates: {
    enabled?: boolean;
    config?: Record<string, unknown>;
    grantedPermissions?: string[];
    replacingProvider?: boolean;
  }
): Promise<UpdatedInstance> {

  // Validate config size and depth if being updated (Blueprint 5.4: 64KB max, 10 layers max)
  if (updates.config !== undefined) {
    try {
      validateInstanceConfig(updates.config);
    } catch (error: any) {
      if (error instanceof ExtensionInstallerError && error.code === 'INVALID_CONFIG_FORMAT') throw new ApiError('UPDATE_ERROR');
      throw error;
    }
  }

  const existing = await prisma.pluginInstallation.findUnique({
    where: { id: installationId },
  });

  if (!existing) {
    throw new ApiError('UPDATE_ERROR');
  }

  validateInstanceKey(existing.instanceKey);
  if (updates.enabled === true) await assertPluginOperationAvailable(existing.pluginSlug);

  if (existing.deletedAt) {
    throw new ApiError('UPDATE_ERROR');
  }

  // CRITICAL: Verify plugin package is not soft-deleted
  const pluginPackage = await getPluginPackage(existing.pluginSlug);
  if (!pluginPackage) {
    throw new ApiError('UPDATE_ERROR');
  }

  const existingConfig = parseJsonObject(existing.configJson);
  const manifest = readStoredPluginManifest(pluginPackage);
  const nextConfig = updates.config !== undefined
    ? mergeSecretConfigForUpdate(manifest, existingConfig, updates.config)
    : existingConfig;
  const retainedSecrets = { ...existingConfig };
  for (const [field, value] of Object.entries(updates.config ?? {})) {
    if (typeof value === 'string' && value.trim()) delete retainedSecrets[field];
  }
  const storedConfig = updates.config !== undefined ? encryptPluginConfig(manifest, nextConfig, retainedSecrets) : nextConfig;
  let runtimeConfig: Record<string, unknown>;
  try {
    runtimeConfig = decryptPluginConfig(manifest, storedConfig);
  } catch (error) {
    if (error instanceof PluginConfigDecryptionError) throw new ApiError('UPDATE_ERROR');
    throw error;
  }
  if (updates.config !== undefined && manifest.configSchema !== undefined) {
    const { schema, issues: schemaIssues } = parsePluginConfigSchema(manifest.configSchema);
    if (!schema) throw new ApiError('UPDATE_ERROR');
    const issues = validatePluginConfig(schema, runtimeConfig);
    if (issues.length) {
      throw new ExtensionInstallerError(`Invalid plugin configuration: ${issues.map((issue) => issue.path).join(', ')}`, {
        statusCode: 400,
        code: 'INVALID_PLUGIN_CONFIG',
        details: { fields: issues },
      });
    }
  }
  const nextEnabled = updates.enabled !== undefined ? updates.enabled : existing.enabled;
  if (nextEnabled) assertPluginSigningAllowed(pluginPackage);

  if (nextEnabled) {
    try {
      assertPluginConfigReadyForEnable(existing.pluginSlug, manifest, storedConfig);
    } catch (error: any) {
      if (error instanceof ExtensionInstallerError && error.code === 'PLUGIN_CONFIG_REQUIRED') throw new ApiError('UPDATE_ERROR');
      throw error;
    }
  }

  // Detect enable/disable transitions for lifecycle hooks
  const isEnabling = updates.enabled === true && !existing.enabled;
  const isDisabling = updates.enabled === false && existing.enabled;

  if (isDisabling && !updates.replacingProvider) {
    await assertNotLastEnabledProvider(existing.pluginSlug, existing.enabled, pluginPackage.manifestJson);
  }

  // Parse manifest for lifecycle hook checks
  // If enabling: execute onEnable lifecycle hook BEFORE the DB update.
  // If onEnable fails, the enable is rejected (hook throws).
  if (isEnabling && hasLifecycleHook(manifest, 'onEnable')) {
    await executeLifecycleHook('onEnable', {
      installationId,
      pluginSlug: existing.pluginSlug,
      instanceKey: existing.instanceKey,
      config: runtimeConfig,
    }, manifest);
    // If executeLifecycleHook threw, we never reach here — enable is rejected
  }

  if (isEnabling || (updates.config !== undefined && existing.enabled)) {
    try {
      if (isEnabling) {
        const { validateCandidateRuntime } = await import('@/core/extensions/runtime/plugin-runtime');
        await validateCandidateRuntime(existing.pluginSlug, pluginPackage.zipHash || '', manifest, existing.id, runtimeConfig);
      } else {
        await warmPluginInstanceRuntime(existing.pluginSlug, existing.id, runtimeConfig);
      }
    } catch (error: any) {
      if (error instanceof ApiError && ['PLUGIN_TASK_DECLARATION_INVALID','PLUGIN_TASK_LIMIT_CONFLICT'].includes(error.code)) throw error;
      throw new ExtensionInstallerError(redactPluginText(`Plugin runtime failed to load: ${error.message}`, runtimeConfig, manifest), { statusCode: 500, code: 'INTERNAL_SERVER_ERROR' });
    }
  }

  const replacedPlugins: string[] = [];
  if (isEnabling) {
    for (const contract of ['tax', 'fulfillment', 'notification'] as const) {
      if (!declaresContract(manifest, contract)) continue;
      const providers = await prisma.pluginInstallation.findMany({ where: { enabled: true, deletedAt: null, pluginSlug: { not: existing.pluginSlug }, plugin: { deletedAt: null } }, include: { plugin: true } });
      for (const provider of providers.filter((candidate) => declaresContract(candidate.plugin.manifestJson, contract))) {
        await updateInstance(provider.id, { enabled: false, replacingProvider: true });
        replacedPlugins.push(provider.pluginSlug);
      }
    }
  }

  const updateData: any = {};

  if (updates.enabled !== undefined) {
    updateData.enabled = updates.enabled;
  }

  if (updates.config !== undefined) {
    updateData.configJson = storedConfig;
  }

  if (updates.grantedPermissions !== undefined) {
    updateData.grantedPermissions = updates.grantedPermissions ?? null;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const scheduler = await lockTaskScheduler(tx);
    await tx.$queryRaw`SELECT id FROM public.plugin_installations WHERE id = ${installationId} FOR UPDATE`;
    if (isEnabling) assertTaskPolicy(manifest.tasks ?? [], scheduler.policy);
    if (isDisabling || updates.config !== undefined && existing.enabled) await transitionInstallationTasks(tx, installationId, isDisabling ? 'PAUSE' : 'UPDATE', isDisabling ? 'plugin-disabled' : 'CONFIG_UPDATED', manifest.tasks ?? []);
    if (isDisabling && !updates.replacingProvider && declaresContract(pluginPackage.manifestJson, 'payment')) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('jiffoo:payment-provider-decision', 0))`;
      await assertNotLastEnabledProvider(existing.pluginSlug, existing.enabled, pluginPackage.manifestJson, tx);
    }
    if (updates.enabled !== undefined || updates.config !== undefined) updateData.protectionGeneration = { increment: 1 };
    const next = await tx.pluginInstallation.update({ where: { id: installationId }, data: updateData });
    await systemSettingsService.incrementPluginRegistryVersion(tx);
    if (updates.enabled !== undefined || updates.config !== undefined) {
      await PluginPageService.revokeInstallationSessions(tx, installationId);
    }
    return next;
  });

  // If disabling: execute onDisable lifecycle hook AFTER the DB update.
  // Failure is non-blocking — just logs a warning.
  if (isDisabling && hasLifecycleHook(manifest, 'onDisable')) {
    await executeLifecycleHook('onDisable', {
      installationId,
      pluginSlug: existing.pluginSlug,
      instanceKey: existing.instanceKey,
      config: decryptPluginConfig(manifest, existingConfig),
    }, manifest);
  }

  await CacheService.incrementPluginVersion();
  await reconcilePluginState(existing.pluginSlug);
  return Object.assign(updated, { replacedPlugins });
}

// ============================================================================
// Instance-level Plugin Operations (Only API - No Legacy Compatibility)
// ============================================================================

/**
 * Check if plugin instance is enabled
 */
export async function isPluginEnabled(
  slug: string,
  instanceKeyOrId: string
): Promise<boolean> {
  let instance: PluginInstallation | PluginInstanceProjection | null = null;

  if (instanceKeyOrId === 'default') {
    instance = await getDefaultInstance(slug);
  } else if (instanceKeyOrId.length === 25 || instanceKeyOrId.includes('-')) {
    // Looks like a cuid or UUID - try as installationId first
    instance = await getInstanceById(instanceKeyOrId);
    if (!instance || instance.pluginSlug !== slug) {
      // Try as instanceKey
      instance = await getInstanceByKey(slug, instanceKeyOrId);
    }
  } else {
    instance = await getInstanceByKey(slug, instanceKeyOrId);
  }

  if (!instance) {
    return false;
  }

  validateInstanceKey(instance.instanceKey);

  if (!instance.enabled || instance.deletedAt) {
    return false;
  }

  const pluginPackage = await prisma.pluginInstall.findUnique({ where: { slug } });
  if (!pluginPackage?.zipHash) return false;
  const pluginPackageFiles = await resolveCurrentPluginPackage(slug, pluginPackage.zipHash);
  return await pluginPackageFiles.exists('manifest.json');
}

/**
 * Get plugin instance configuration
 */
export async function getInstanceConfig(
  slug: string,
  instanceKeyOrId: string
): Promise<Record<string, unknown> | null> {
  let instance: PluginInstallation | PluginInstanceProjection | null = null;

  if (instanceKeyOrId === 'default') {
    instance = await getDefaultInstance(slug);
  } else if (instanceKeyOrId.length === 25 || instanceKeyOrId.includes('-')) {
    instance = await getInstanceById(instanceKeyOrId);
    if (!instance || instance.pluginSlug !== slug) {
      instance = await getInstanceByKey(slug, instanceKeyOrId);
    }
  } else {
    instance = await getInstanceByKey(slug, instanceKeyOrId);
  }

  if (!instance) {
    return null;
  }

  validateInstanceKey(instance.instanceKey);

  const plugin = await getPluginPackage(slug);
  return plugin ? decryptPluginConfig(readStoredPluginManifest(plugin), parseJsonObject(instance.configJson)) : null;
}

/**
 * Uninstall plugin (soft delete - sets deletedAt on package and disables all instances)
 * Files are preserved by default for safety
 */
export async function uninstallPlugin(slug: string, actorId = 'system'): Promise<void> {
  const token = await acquirePluginOperationLease(slug, 'uninstall');
  try {
  await waitForLifecycleLease(slug, 'uninstall');
  // Check if plugin exists
  const pluginPackage = await prisma.pluginInstall.findUnique({
    where: { slug },
  });

  if (!pluginPackage) {
    throw new ExtensionInstallerError(`Plugin "${slug}" not found`, { statusCode: 404, code: 'PLUGIN_NOT_FOUND' });
  }

  if (pluginPackage.source === 'builtin') {
    throw new ExtensionInstallerError('Cannot uninstall built-in plugins', { statusCode: 400, code: 'PLUGIN_BUILTIN_PROTECTED' });
  }

  if (pluginPackage.deletedAt) {
    throw new ExtensionInstallerError(`Plugin "${slug}" is already uninstalled`, { statusCode: 409, code: 'PLUGIN_ALREADY_UNINSTALLED' });
  }

  const defaultInstance = await getDefaultInstance(slug);
  const manifest = readStoredPluginManifest(pluginPackage);
  await assertNotLastEnabledProvider(slug, Boolean(defaultInstance?.enabled), pluginPackage.manifestJson);
  if (defaultInstance && hasLifecycleHook(manifest, 'onUninstall')) {
    await executeLifecycleHook('onUninstall', {
      installationId: defaultInstance.id,
      pluginSlug: slug,
      instanceKey: defaultInstance.instanceKey,
      config: decryptPluginConfig(manifest, parseJsonObject(defaultInstance.configJson)),
    }, manifest);
  }

  // Soft delete: set deletedAt on package and disable all non-deleted instances
  await prisma.$transaction(async (tx) => {
    await lockTaskScheduler(tx);
    const taskInstallations = await tx.pluginInstallation.findMany({ where: { pluginSlug: slug }, orderBy: { id: 'asc' } });
    for (const instance of taskInstallations) {
      await tx.$queryRaw`SELECT id FROM public.plugin_installations WHERE id = ${instance.id} FOR UPDATE`;
      await transitionInstallationTasks(tx, instance.id, 'CANCEL', 'UNINSTALLED');
    }
    await fencePluginOperationLease(tx, slug, token);
    if (defaultInstance?.enabled && declaresContract(pluginPackage.manifestJson, 'payment')) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('jiffoo:payment-provider-decision', 0))`;
      await assertNotLastEnabledProvider(slug, true, pluginPackage.manifestJson, tx);
    }
    // Set deletedAt on plugin package
    await tx.pluginInstall.update({
      where: { slug },
      data: { deletedAt: new Date() },
    });

    // Disable all non-deleted instances
    await tx.pluginInstallation.updateMany({
      where: {
        pluginSlug: slug,
        deletedAt: null,
      },
      data: { enabled: false, protectionGeneration: { increment: 1 } },
    });
    await systemSettingsService.incrementPluginRegistryVersion(tx);
    await PluginPageService.revokePluginSessions(tx, slug);
    await writePluginAudit(tx, actorId, 'PLUGIN_UNINSTALLED', slug, { slug, version: pluginPackage.version });
  });

  // Files are preserved by the package store for safety and re-installation.

  await CacheService.delete('plugins:installed');
  await CacheService.delete(`plugins:config:${slug}`);
  await CacheService.incrementPluginVersion();
  await reconcilePluginState(slug);
  } finally {
    await releasePluginOperationLease(slug, token);
  }
}

/**
 * Restore plugin from soft-uninstalled state.
 */
export async function restorePlugin(slug: string, actorId = 'system'): Promise<void> {
  await assertPluginOperationAvailable(slug);
  const token = await acquirePluginOperationLease(slug, 'restore');
  try {
  await waitForLifecycleLease(slug, 'restore');
  const pluginPackage = await prisma.pluginInstall.findUnique({
    where: { slug },
  });

  if (!pluginPackage) {
    throw new ExtensionInstallerError(`Plugin "${slug}" not found`, { statusCode: 404, code: 'PLUGIN_NOT_FOUND' });
  }

  if (!pluginPackage.deletedAt) {
    throw new ExtensionInstallerError(`Plugin "${slug}" is not uninstalled`, { statusCode: 409, code: 'PLUGIN_NOT_UNINSTALLED' });
  }
  assertPluginSigningAllowed(pluginPackage);

  if (pluginPackage.source !== 'builtin') {
    const blob = pluginPackage.zipHash ? await pluginPackageBlobStore.get(slug, pluginPackage.zipHash) : null;
    if (!blob) throw new PluginPackageResolutionError('PLUGIN_PACKAGE_UNAVAILABLE', 503, slug);
    const bytes = Buffer.from(blob.bytes);
    if (blob.sizeBytes !== bytes.length || createHash('sha256').update(bytes).digest('hex') !== pluginPackage.zipHash)
      throw new PluginPackageResolutionError('PLUGIN_PACKAGE_CORRUPT', 500, slug);
    const inspection = await inspectPluginUpload(bytes);
    if (inspection.manifest.slug !== slug || inspection.manifest.version !== pluginPackage.version
      || !isDeepStrictEqual(inspection.manifest, pluginPackage.manifestJson))
      throw new PluginPackageResolutionError('PLUGIN_PACKAGE_CORRUPT', 500, slug);
  }

  const pluginPackageFiles = pluginPackage.zipHash
    ? await resolveCurrentPluginPackage(slug, pluginPackage.zipHash, true) : null;
  if (!pluginPackageFiles || !await pluginPackageFiles.exists('manifest.json')) {
    throw new PluginPackageResolutionError('PLUGIN_PACKAGE_UNAVAILABLE', 503, slug);
  }

  readStoredPluginManifest(pluginPackage);
  await prisma.$transaction(async (tx) => {
    await fencePluginOperationLease(tx, slug, token);
    await tx.pluginInstall.update({
      where: { slug },
      data: { deletedAt: null },
    });

    const defaultInstance = await tx.pluginInstallation.findUnique({
      where: {
        pluginSlug_instanceKey: {
          pluginSlug: slug,
          instanceKey: 'default',
        },
      },
    });

    if (defaultInstance) {
      await tx.pluginInstallation.update({
        where: { id: defaultInstance.id },
        data: {
          deletedAt: null,
          enabled: false,
          protectionGeneration: { increment: 1 },
        },
      });
    }
    await systemSettingsService.incrementPluginRegistryVersion(tx);
    await writePluginAudit(tx, actorId, 'PLUGIN_RESTORED', slug, { slug, version: pluginPackage.version, enabled: false });
  });

  await CacheService.delete('plugins:installed');
  await CacheService.delete(`plugins:config:${slug}`);
  await CacheService.incrementPluginVersion();
  await reconcilePluginState(slug);
  } finally {
    await releasePluginOperationLease(slug, token);
  }
}

/**
 * Purge plugin (hard delete)
 * Deletes Core installation records and blobs; plugin-owned data and immutable directories remain.
 */
export async function purgePlugin(slug: string, confirmationSlug?: string, actorId = 'system'): Promise<void> {
  await assertPluginOperationAvailable(slug);
  const token = await acquirePluginOperationLease(slug, 'purge');
  try {
  await waitForLifecycleLease(slug, 'purge');
  const pluginPackage = await prisma.pluginInstall.findUnique({
    where: { slug },
  });

  if (!pluginPackage) {
    throw new ExtensionInstallerError(`Plugin "${slug}" not found`, { statusCode: 404, code: 'PLUGIN_NOT_FOUND' });
  }

  if (pluginPackage.source === 'builtin') {
    throw new ExtensionInstallerError('Cannot purge built-in plugins', { statusCode: 400, code: 'PLUGIN_BUILTIN_PROTECTED' });
  }

  if (!pluginPackage.deletedAt) {
    throw new ExtensionInstallerError(`Plugin "${slug}" is not uninstalled`, { statusCode: 409, code: 'PLUGIN_NOT_UNINSTALLED' });
  }
  if (confirmationSlug !== slug) {
    throw new ExtensionInstallerError('Type the plugin slug to confirm deletion', { statusCode: 400, code: 'PLUGIN_PURGE_CONFIRMATION_REQUIRED' });
  }

  await prisma.$transaction(async (tx) => {
    await fencePluginOperationLease(tx, slug, token);
    await lockTaskScheduler(tx);
    const taskInstallations = await tx.pluginInstallation.findMany({ where: { pluginSlug: slug }, orderBy: { id: 'asc' } });
    for (const instance of taskInstallations) {
      await tx.$queryRaw`SELECT id FROM public.plugin_installations WHERE id = ${instance.id} FOR UPDATE`;
      await transitionInstallationTasks(tx, instance.id, 'CANCEL', 'PURGED');
      await PluginStorageService.purgeInstallation(tx, instance.id, actorId);
    }
    const pending = await tx.payment.count({ where: { paymentMethod: slug, status: { in: ['CREATING','PENDING','UNKNOWN','REQUIRES_REVIEW'] } } });
    if (pending) {
      throw new ExtensionInstallerError('Plugin has unfinished payment work', { statusCode: 409, code: 'PLUGIN_UNFINISHED_PAYMENTS' });
    }
    await pluginPackageBlobStore.deleteAll(tx, slug);
    await tx.pluginInstall.delete({ where: { slug } });
    await systemSettingsService.incrementPluginRegistryVersion(tx);
    await writePluginAudit(tx, actorId, 'PLUGIN_PURGED', slug, { slug, version: pluginPackage.version });
  });

  await CacheService.delete('plugins:installed');
  await CacheService.delete(`plugins:config:${slug}`);
  await CacheService.incrementPluginVersion();
  await reconcilePluginState(slug);
  } finally {
    await releasePluginOperationLease(slug, token);
  }
}

// ============================================================================
// Export Service Object
// ============================================================================

/**
 * Admin plugin-management service.
 *
 * This is the LIFECYCLE service (install / uninstall / restore / purge / audit).
 * The read-only provider registry at `@/core/extensions/registry` is the single
 * implementation of the provider reads; callers import those functions from
 * the registry directly.
 */
export const PluginManagementService = {
  // Instance-level API (Only API)
  getPluginPackage,
  getInstanceById,
  getInstanceByKey,
  getPluginInstances,
  createDefaultInstance,
  updateInstance,
  getInstanceConfig,
  isPluginEnabled,
  uninstallPlugin,
  restorePlugin,
  purgePlugin,

  // Validation helpers
  validateInstanceKey,
  validateSlug,
};
