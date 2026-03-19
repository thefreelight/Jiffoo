// @ts-nocheck
/**
 * Plugin Management Service
 *
 * Manages plugin installations and instances using database as the single source of truth.
 * Supports multi-instance per plugin (installationId/instanceKey model).
 */

import { promises as fs } from 'fs';
import path from 'path';
import { prisma } from '@/config/database';
import { CacheService } from '@/core/cache/service';
import type { PluginMeta, PluginState, PluginConfig, InstalledPluginsResponse } from './types';
import { getPluginDir, validateInstanceConfig, validateInstanceKeyFormat } from '@/core/admin/extension-installer/utils';
import { assertPluginConfigReadyForEnable } from '@/core/admin/extension-installer/config-readiness';
import type { PluginInstall, PluginInstallation } from '@prisma/client';
import { executeLifecycleHook, hasLifecycleHook } from './lifecycle-hooks';
import { isAllowedExtensionSource, isOfficialMarketOnly } from '@/core/admin/extension-installer/official-only';
import { ensureOfficialMarketExtensionFiles } from '@/core/admin/market/official-package-recovery';
import { mergeSecretConfigForUpdate } from './config-secrets';

const EXTENSIONS_DIR = getPluginDir();

// instanceKey validation regex: ^[a-z0-9-]{1,32}$
const INSTANCE_KEY_REGEX = /^[a-z0-9-]{1,32}$/;
// slug validation regex: ^[a-z][a-z0-9-]{0,30}[a-z0-9]$
const SLUG_REGEX = /^[a-z][a-z0-9-]{0,30}[a-z0-9]$/;

// Reserved instance keys
const RESERVED_INSTANCE_KEYS = ['default'];

/**
 * Validate instanceKey format (delegates to utils for consistency)
 */
function validateInstanceKey(instanceKey: string): void {
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

  if (plugin && !isAllowedExtensionSource(plugin.source)) {
    return null;
  }

  if (plugin?.source === 'official-market') {
    const manifestPath = path.join(EXTENSIONS_DIR, slug, 'manifest.json');
    try {
      await fs.access(manifestPath);
    } catch {
      await ensureOfficialMarketExtensionFiles({
        slug,
        kind: 'plugin',
        version: plugin.version,
      });

      plugin = await prisma.pluginInstall.findUnique({
        where: { slug },
      });

      if (!plugin || plugin.deletedAt || !isAllowedExtensionSource(plugin.source)) {
        return null;
      }
    }
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

  if (!isOfficialMarketOnly()) {
    return rows;
  }

  return rows.filter((row) => isAllowedExtensionSource(row.source));
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
      deletedAt: null,
    },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Create a new plugin instance
 */
async function createInstance(
  slug: string,
  instanceKey: string,
  options?: {
    enabled?: boolean;
    config?: Record<string, unknown>;
    grantedPermissions?: string[];
  }
): Promise<PluginInstallation> {
  validateSlug(slug);
  validateInstanceKey(instanceKey);

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
    try {
      assertPluginConfigReadyForEnable(slug, pluginPackage.manifestJson, effectiveConfig);
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
      throw new Error(`Instance "${instanceKey}" was deleted and cannot be recreated. Use a different key.`);
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

  if (existing.deletedAt) {
    throw new Error(`Installation "${installationId}" has been deleted`);
  }

  // CRITICAL: Verify plugin package is not soft-deleted
  const pluginPackage = await getPluginPackage(existing.pluginSlug);
  if (!pluginPackage) {
    throw new Error(`Plugin "${existing.pluginSlug}" not found`);
  }

  const existingConfig = parseJsonObject(existing.configJson);
  const nextConfig = updates.config !== undefined
    ? mergeSecretConfigForUpdate(pluginPackage.manifestJson, existingConfig, updates.config)
    : existingConfig;
  const nextEnabled = updates.enabled !== undefined ? updates.enabled : existing.enabled;

  if (nextEnabled) {
    try {
      assertPluginConfigReadyForEnable(existing.pluginSlug, pluginPackage.manifestJson, nextConfig);
    } catch (error: any) {
      throw new Error(error.message);
    }
  }

  // Detect enable/disable transitions for lifecycle hooks
  const isEnabling = updates.enabled === true && !existing.enabled;
  const isDisabling = updates.enabled === false && existing.enabled;

  // Parse manifest for lifecycle hook checks
  const manifest = Object.keys(parseJsonObject(pluginPackage.manifestJson)).length > 0
    ? parseJsonObject(pluginPackage.manifestJson)
    : null;

  // If enabling: execute onEnable lifecycle hook BEFORE the DB update.
  // If onEnable fails, the enable is rejected (hook throws).
  if (isEnabling && manifest && hasLifecycleHook(manifest, 'onEnable')) {
    await executeLifecycleHook('onEnable', {
      installationId,
      pluginSlug: existing.pluginSlug,
      instanceKey: existing.instanceKey,
      config: nextConfig,
    }, manifest);
    // If executeLifecycleHook threw, we never reach here — enable is rejected
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

  const updated = await prisma.pluginInstallation.update({
    where: { id: installationId },
    data: updateData,
  });

  // If disabling: execute onDisable lifecycle hook AFTER the DB update.
  // Failure is non-blocking — just logs a warning.
  if (isDisabling && manifest && hasLifecycleHook(manifest, 'onDisable')) {
    await executeLifecycleHook('onDisable', {
      installationId,
      pluginSlug: existing.pluginSlug,
      instanceKey: existing.instanceKey,
      config: existingConfig,
    }, manifest);
  }

  await CacheService.incrementPluginVersion();
  return updated;
}

/**
 * Soft delete plugin instance
 * Note: 'default' instance cannot be deleted
 */
async function deleteInstance(installationId: string): Promise<PluginInstallation> {

  const existing = await prisma.pluginInstallation.findUnique({
    where: { id: installationId },
  });

  if (!existing) {
    throw new Error(`Installation "${installationId}" not found`);
  }

  if (existing.instanceKey === 'default') {
    throw new Error('Cannot delete the default instance');
  }

  if (existing.deletedAt) {
    throw new Error(`Installation "${installationId}" is already deleted`);
  }

  const deleted = await prisma.pluginInstallation.update({
    where: { id: installationId },
    data: {
      enabled: false,
      deletedAt: new Date(),
    },
  });

  await CacheService.incrementPluginVersion();
  return deleted;
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

  if (!instance.enabled || instance.deletedAt) {
    return false;
  }

  // Verify plugin exists on disk
  const manifestPath = path.join(EXTENSIONS_DIR, slug, 'manifest.json');
  try {
    await fs.access(manifestPath);
    return true;
  } catch {
    return false;
  }
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
  });

  // Note: Files are preserved on disk (extensions/plugins/{slug})
  // This is intentional for safety and allows re-installation

  await CacheService.delete('plugins:installed');
  await CacheService.delete(`plugins:config:${slug}`);
  await CacheService.incrementPluginVersion();
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

  const pluginDir = getPluginDir(slug);
  const manifestPath = path.join(pluginDir, 'manifest.json');
  try {
    await fs.access(manifestPath);
  } catch {
    throw new Error(`Plugin "${slug}" files are missing. Please reinstall from ZIP.`);
  }

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
          assertPluginConfigReadyForEnable(slug, pluginPackage.manifestJson, defaultConfig);
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
  });

  await CacheService.delete('plugins:installed');
  await CacheService.delete(`plugins:config:${slug}`);
  await CacheService.incrementPluginVersion();
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

  const pluginDir = getPluginDir(slug);
  await fs.rm(pluginDir, { recursive: true, force: true }).catch(() => {});

  await prisma.pluginInstall.delete({
    where: { slug },
  });

  await CacheService.delete('plugins:installed');
  await CacheService.delete(`plugins:config:${slug}`);
  await CacheService.incrementPluginVersion();
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
  createInstance,
  updateInstance,
  deleteInstance,
  getInstanceConfig,
  isPluginEnabled,
  uninstallPlugin,
  restorePlugin,
  purgePlugin,

  // Validation helpers
  validateInstanceKey,
  validateSlug,
};
