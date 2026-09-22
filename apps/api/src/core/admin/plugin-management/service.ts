/**
 * Plugin Management Service
 *
 * Manages plugin installations and instances using database as the single source of truth.
 * Stores one default configuration instance per plugin.
 */

import { prisma } from '@/config/database';
import { CacheService } from '@/core/cache/service';
import type { PluginMeta, PluginState, PluginConfig, InstalledPluginsResponse } from './types';
import { validateInstanceConfig, validateInstanceKeyFormat } from '@/core/admin/extension-installer/utils';
import { pluginPackageStore } from '@/core/storage/plugin-package-store';
import { incrementPluginRegistryVersion } from '@/core/admin/extension-installer/plugin-registry-version';
import { assertPluginConfigReadyForEnable } from '@/core/admin/extension-installer/config-readiness';
import type { PluginInstall, PluginInstallation } from '@prisma/client';
import { executeLifecycleHook, hasLifecycleHook } from './lifecycle-hooks';
import { mergeSecretConfigForUpdate } from './config-secrets';
import { readStoredPluginManifest } from '@/core/admin/extension-installer/stored-manifest';

// slug validation regex: ^[a-z][a-z0-9-]{0,30}[a-z0-9]$
const SLUG_REGEX = /^[a-z][a-z0-9-]{0,30}[a-z0-9]$/;

// Reserved instance keys
const RESERVED_INSTANCE_KEYS = ['default'];

async function reconcilePluginState(slug: string): Promise<void> {
  const { reconcilePluginState: reconcile } = await import('@/core/admin/extension-installer/plugin-reconciliation');
  await reconcile(slug);
}

async function warmPluginInstanceRuntime(
  slug: string,
  installationId: string,
  config?: Record<string, unknown>,
): Promise<void> {
  const { warmPluginInstanceRuntime: warm } = await import('@/core/admin/extension-installer/plugin-runtime');
  await warm(slug, installationId, config);
}

/**
 * Validate instanceKey format (delegates to utils for consistency)
 */
function validateInstanceKey(instanceKey: string): void {
  if (instanceKey !== 'default') {
    throw new Error('Only the default plugin instance is supported');
  }
  try {
    validateInstanceKeyFormat(instanceKey);
  } catch (error: any) {
    throw new Error(error.message);
  }
}

/**
 * Validate slug format
 */
function validateSlug(slug: string): void {
  if (!SLUG_REGEX.test(slug)) {
    throw new Error(`Invalid slug format: "${slug}". Must match ^[a-z][a-z0-9-]{0,30}[a-z0-9]$`);
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

/**
 * Get all plugin packages.
 * By default excludes soft-deleted packages unless includeDeleted=true.
 */
async function getAllPluginPackages(options?: { includeDeleted?: boolean }): Promise<PluginInstall[]> {
  const includeDeleted = options?.includeDeleted ?? false;
  const rows = await prisma.pluginInstall.findMany({
    where: includeDeleted ? undefined : { deletedAt: null },
    orderBy: { installedAt: 'desc' },
  });

  return rows;
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
 * Get default instance for a plugin
 */
async function getDefaultInstance(slug: string): Promise<PluginInstallation | null> {
  return getInstanceByKey(slug, 'default');
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
      throw new Error(error.message);
    }
  }

  // CRITICAL: Verify plugin package exists and is not soft-deleted
  const pluginPackage = await getPluginPackage(slug);
  if (!pluginPackage) {
    throw new Error(`Plugin "${slug}" not found`);
  }

  const effectiveEnabled = options?.enabled ?? true;
  const effectiveConfig = (options?.config ?? {}) as Record<string, unknown>;
  if (effectiveEnabled) {
    const manifest = readStoredPluginManifest(pluginPackage);
    try {
      assertPluginConfigReadyForEnable(slug, manifest, effectiveConfig);
    } catch (error: any) {
      throw new Error(error.message);
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
      throw new Error('The default plugin instance was deleted and cannot be recreated.');
    }
    throw new Error(`Instance "${instanceKey}" already exists for plugin "${slug}"`);
  }

  const instance = await prisma.pluginInstallation.create({
    data: {
      pluginSlug: slug,
      instanceKey,
      enabled: effectiveEnabled,
      configJson: options?.config ?? null,
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
  }
): Promise<PluginInstallation> {

  // Validate config size and depth if being updated (Blueprint 5.4: 64KB max, 10 layers max)
  if (updates.config !== undefined) {
    try {
      validateInstanceConfig(updates.config);
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  const existing = await prisma.pluginInstallation.findUnique({
    where: { id: installationId },
  });

  if (!existing) {
    throw new Error(`Installation "${installationId}" not found`);
  }

  validateInstanceKey(existing.instanceKey);

  if (existing.deletedAt) {
    throw new Error(`Installation "${installationId}" has been deleted`);
  }

  // CRITICAL: Verify plugin package is not soft-deleted
  const pluginPackage = await getPluginPackage(existing.pluginSlug);
  if (!pluginPackage) {
    throw new Error(`Plugin "${existing.pluginSlug}" not found`);
  }

  const existingConfig = parseJsonObject(existing.configJson);
  const manifest = readStoredPluginManifest(pluginPackage);
  const nextConfig = updates.config !== undefined
    ? mergeSecretConfigForUpdate(manifest, existingConfig, updates.config)
    : existingConfig;
  const nextEnabled = updates.enabled !== undefined ? updates.enabled : existing.enabled;

  if (nextEnabled) {
    try {
      assertPluginConfigReadyForEnable(existing.pluginSlug, manifest, nextConfig);
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  // Detect enable/disable transitions for lifecycle hooks
  const isEnabling = updates.enabled === true && !existing.enabled;
  const isDisabling = updates.enabled === false && existing.enabled;

  // Parse manifest for lifecycle hook checks
  // If enabling: execute onEnable lifecycle hook BEFORE the DB update.
  // If onEnable fails, the enable is rejected (hook throws).
  if (isEnabling && hasLifecycleHook(manifest, 'onEnable')) {
    await executeLifecycleHook('onEnable', {
      installationId,
      pluginSlug: existing.pluginSlug,
      instanceKey: existing.instanceKey,
      config: nextConfig,
    }, manifest);
    // If executeLifecycleHook threw, we never reach here — enable is rejected
  }

  if (isEnabling || (updates.config !== undefined && existing.enabled)) {
    try {
      await warmPluginInstanceRuntime(existing.pluginSlug, existing.id, nextConfig);
    } catch (error: any) {
      throw new Error(`Plugin runtime failed to load: ${error.message}`);
    }
  }

  const updateData: any = {};

  if (updates.enabled !== undefined) {
    updateData.enabled = updates.enabled;
  }

  if (updates.config !== undefined) {
    updateData.configJson = nextConfig ?? null;
  }

  if (updates.grantedPermissions !== undefined) {
    updateData.grantedPermissions = updates.grantedPermissions ?? null;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.pluginInstallation.update({ where: { id: installationId }, data: updateData });
    await incrementPluginRegistryVersion(tx);
    return next;
  });

  // If disabling: execute onDisable lifecycle hook AFTER the DB update.
  // Failure is non-blocking — just logs a warning.
  if (isDisabling && hasLifecycleHook(manifest, 'onDisable')) {
    await executeLifecycleHook('onDisable', {
      installationId,
      pluginSlug: existing.pluginSlug,
      instanceKey: existing.instanceKey,
      config: existingConfig,
    }, manifest);
  }

  await CacheService.incrementPluginVersion();
  await reconcilePluginState(existing.pluginSlug);
  return updated;
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
  let instance: PluginInstallation | null = null;

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

  const pluginPackageFiles = await pluginPackageStore.get(slug);
  return !!pluginPackageFiles && await pluginPackageFiles.exists('manifest.json');
}

/**
 * Get plugin instance configuration
 */
export async function getInstanceConfig(
  slug: string,
  instanceKeyOrId: string
): Promise<Record<string, unknown> | null> {
  let instance: PluginInstallation | null = null;

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

  return parseJsonObject(instance.configJson);
}

/**
 * Uninstall plugin (soft delete - sets deletedAt on package and disables all instances)
 * Files are preserved by default for safety
 */
export async function uninstallPlugin(slug: string): Promise<void> {
  // Check if plugin exists
  const pluginPackage = await prisma.pluginInstall.findUnique({
    where: { slug },
  });

  if (!pluginPackage) {
    throw new Error(`Plugin "${slug}" not found`);
  }

  if (pluginPackage.source === 'builtin') {
    throw new Error('Cannot uninstall built-in plugins');
  }

  if (pluginPackage.deletedAt) {
    throw new Error(`Plugin "${slug}" is already uninstalled`);
  }

  const defaultInstance = await getDefaultInstance(slug);
  const manifest = readStoredPluginManifest(pluginPackage);
  if (defaultInstance && hasLifecycleHook(manifest, 'onUninstall')) {
    await executeLifecycleHook('onUninstall', {
      installationId: defaultInstance.id,
      pluginSlug: slug,
      instanceKey: defaultInstance.instanceKey,
      config: parseJsonObject(defaultInstance.configJson),
    }, manifest);
  }

  // Soft delete: set deletedAt on package and disable all non-deleted instances
  await prisma.$transaction(async (tx) => {
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
      data: { enabled: false },
    });
    await incrementPluginRegistryVersion(tx);
  });

  // Files are preserved by the package store for safety and re-installation.

  await CacheService.delete('plugins:installed');
  await CacheService.delete(`plugins:config:${slug}`);
  await CacheService.incrementPluginVersion();
  await reconcilePluginState(slug);
}

/**
 * Restore plugin from soft-uninstalled state.
 */
export async function restorePlugin(slug: string): Promise<void> {
  const pluginPackage = await prisma.pluginInstall.findUnique({
    where: { slug },
  });

  if (!pluginPackage) {
    throw new Error(`Plugin "${slug}" not found`);
  }

  if (!pluginPackage.deletedAt) {
    throw new Error(`Plugin "${slug}" is already installed`);
  }

  const pluginPackageFiles = await pluginPackageStore.get(slug);
  if (!pluginPackageFiles || !await pluginPackageFiles.exists('manifest.json')) {
    throw new Error(`Plugin "${slug}" files are missing. Please reinstall from ZIP.`);
  }

  const manifest = readStoredPluginManifest(pluginPackage);
  await prisma.$transaction(async (tx) => {
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
      const defaultConfig = parseJsonObject(defaultInstance.configJson);
      const canEnable = (() => {
        try {
          assertPluginConfigReadyForEnable(slug, manifest, defaultConfig);
          return true;
        } catch {
          return false;
        }
      })();

      await tx.pluginInstallation.update({
        where: { id: defaultInstance.id },
        data: {
          deletedAt: null,
          enabled: canEnable,
        },
      });
    }
    await incrementPluginRegistryVersion(tx);
  });

  await CacheService.delete('plugins:installed');
  await CacheService.delete(`plugins:config:${slug}`);
  await CacheService.incrementPluginVersion();
  await reconcilePluginState(slug);
}

/**
 * Purge plugin (hard delete)
 * Removes plugin files and permanently deletes plugin package + instances records.
 */
export async function purgePlugin(slug: string): Promise<void> {
  const pluginPackage = await prisma.pluginInstall.findUnique({
    where: { slug },
  });

  if (!pluginPackage) {
    throw new Error(`Plugin "${slug}" not found`);
  }

  if (pluginPackage.source === 'builtin') {
    throw new Error('Cannot purge built-in plugins');
  }

  await pluginPackageStore.delete(slug);

  await prisma.$transaction(async (tx) => {
    await tx.pluginInstall.delete({ where: { slug } });
    await incrementPluginRegistryVersion(tx);
  });

  await CacheService.delete('plugins:installed');
  await CacheService.delete(`plugins:config:${slug}`);
  await CacheService.incrementPluginVersion();
  await reconcilePluginState(slug);
}

// ============================================================================
// Export Service Object
// ============================================================================

export const PluginManagementService = {
  // Instance-level API (Only API)
  getPluginPackage,
  getAllPluginPackages,
  getInstanceById,
  getInstanceByKey,
  getDefaultInstance,
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
