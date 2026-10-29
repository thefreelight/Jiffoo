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
type Transaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * The options of an instance update.
 */
export interface InstanceUpdateOptions {
  /**
   * A transaction the caller owns. The database write joins it instead of
   * opening a transaction of its own.
   *
   * A caller that owns the transaction may not use it for an update that
   * replaces the providers of a contract: the replacement runs in
   * transactions of its own, because the lifecycle hook of the replaced
   * provider has to run outside every transaction. Such an update is
   * refused; the caller plans the update with `planInstanceUpdate`, declares
   * `callerOwnsTransaction: false` and runs its prepare phase before it
   * opens its transaction.
   */
  tx?: Transaction;
  /**
   * Defer the post-commit work, so the caller runs it after its own
   * transaction resolved. A caller that owns the transaction has to defer it:
   * the post-commit work reaches into Redis and into the plugin runtime.
   */
  deferPostCommit?: boolean;
}

/**
 * The options of a planned instance update.
 */
export interface InstanceUpdatePlanOptions {
  /**
   * Declares whether the caller owns a transaction.
   *
   * The prepare phase of a plan that replaces the providers of a contract
   * replaces them in transactions of its own, which would open a second
   * connection inside a transaction the caller already owns. A plan that
   * replaces providers is therefore refused unless the caller declares
   * `callerOwnsTransaction: false`, which states that the prepare phase runs
   * outside every transaction. The default is the safe state: a caller that
   * owns no transaction has to say so explicitly.
   */
  callerOwnsTransaction?: boolean;
}

/**
 * The message of the refusal of a plan that replaces contract providers
 * inside a transaction the caller owns.
 */
const CALLER_TRANSACTION_PROVIDER_REPLACEMENT_ERROR =
  'An instance update that replaces contract providers cannot join a caller transaction; use planInstanceUpdate and run its prepare phase before the transaction opens';

/**
 * The phases of an instance update.
 *
 * The plugin-facing work (the lifecycle hook, the runtime validation) runs
 * outside every transaction, and the post-commit work (the Redis version bump,
 * the runtime reconciliation) runs after the transaction that wrote the row
 * has resolved. The database write in between joins the transaction the caller
 * supplies, so a caller can compose the update with its own rows in one
 * transaction.
 */
export interface InstanceUpdatePlan {
  installationId: string;
  /**
   * True when the prepare phase replaces the providers of a contract. The
   * replacement runs in transactions of its own, so the plan cannot be
   * prepared inside a transaction the caller already owns, and it cannot be
   * committed inside one either.
   */
  replacesProviders: boolean;
  /** The plugin-facing work. Runs outside every transaction. */
  prepare(): Promise<void>;
  /** The database write. Joins the transaction the caller supplies. */
  commit(tx: Transaction): Promise<UpdatedInstance>;
  /** The post-commit work. Runs after the transaction resolved. */
  finalize(): Promise<void>;
}

// slug validation regex: ^[a-z][a-z0-9-]{0,30}[a-z0-9]$
const SLUG_REGEX = /^[a-z][a-z0-9-]{0,30}[a-z0-9]$/;

// Reserved instance keys
const RESERVED_INSTANCE_KEYS = ['default'];

/**
 * The milliseconds a transaction waits for a free connection of the pool.
 */
const TRANSACTION_MAX_WAIT_MS = 10_000;

/**
 * The milliseconds the instance update transaction may hold its connection.
 *
 * The update transitions the tasks of one installation and writes one audit
 * row per transitioned task, so the timeout is sized for a thousand tasks of
 * an installation.
 */
const INSTANCE_UPDATE_TRANSACTION_TIMEOUT_MS = 60_000;

/**
 * The milliseconds the restore transaction may hold its connection.
 *
 * The restore fences the plugin operation lease and restores the install row,
 * its default instance and the registry version, so the timeout is sized for
 * the default instance of one slug.
 */
const RESTORE_TRANSACTION_TIMEOUT_MS = 60_000;

/**
 * The milliseconds the uninstall transaction may hold its connection.
 *
 * The uninstall transitions the tasks of every installation of the slug and
 * writes one audit row per cancelled task, so the timeout is sized for a
 * thousand tasks of an installation.
 */
const UNINSTALL_TRANSACTION_TIMEOUT_MS = 60_000;

/**
 * The milliseconds the purge transaction may hold its connection.
 *
 * The purge does the work of the uninstall and queues the cleanup of every
 * stored file of every installation of the slug.
 */
const PURGE_TRANSACTION_TIMEOUT_MS = 120_000;

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
 * Plan an instance update.
 *
 * The plan separates the update into three phases: the plugin-facing work
 * (the lifecycle hook, the runtime validation), the database write and the
 * post-commit work (the Redis version bump, the runtime reconciliation). A
 * caller can therefore run the plugin code outside every transaction, compose
 * the write with its own rows in one transaction and run the post-commit work
 * after that transaction resolved.
 *
 * A caller that owns a transaction declares it with the
 * `callerOwnsTransaction` option. A plan that replaces the providers of a
 * contract may only be prepared outside every transaction, because the
 * replacement runs in transactions of its own and would open a second
 * connection inside a transaction the caller already owns. Such a plan is
 * therefore refused unless the caller declares `callerOwnsTransaction: false`.
 */
async function planInstanceUpdate(
  installationId: string,
  updates: {
    enabled?: boolean;
    config?: Record<string, unknown>;
    grantedPermissions?: string[];
    replacingProvider?: boolean;
  },
  options?: InstanceUpdatePlanOptions,
): Promise<InstanceUpdatePlan> {

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

  if (isEnabling && options?.callerOwnsTransaction !== false) {
    // The prepare phase replaces the providers of a contract, and each
    // replacement runs in a transaction of its own on a connection of its own.
    // Inside a transaction the caller already owns, that would open a second
    // connection, so a provider-replacing plan may only be prepared outside
    // every transaction. The caller declares that with
    // `callerOwnsTransaction: false`; without that declaration the plan is
    // refused.
    throw new Error(CALLER_TRANSACTION_PROVIDER_REPLACEMENT_ERROR);
  }

  if (isDisabling && !updates.replacingProvider) {
    await assertNotLastEnabledProvider(existing.pluginSlug, existing.enabled, pluginPackage.manifestJson);
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

  if (updates.enabled !== undefined || updates.config !== undefined) {
    updateData.protectionGeneration = { increment: 1 };
  }

  const replacedPlugins: string[] = [];

  return {
    installationId,
    // The replacement of the providers of a contract runs in transactions of
    // its own, so the plan cannot be committed inside a transaction the
    // caller already owns.
    replacesProviders: isEnabling,
    // The plugin-facing work. It runs outside every transaction, so the plugin
    // code never holds a pooled connection while it runs.
    prepare: async () => {
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

      if (isEnabling) {
        // The providers of a contract are replaced in transactions of their
        // own. They run outside every transaction of the caller, so they never
        // wait for the lock of the caller's transaction.
        for (const contract of ['tax', 'fulfillment', 'notification'] as const) {
          if (!declaresContract(manifest, contract)) continue;
          const providers = await prisma.pluginInstallation.findMany({ where: { enabled: true, deletedAt: null, pluginSlug: { not: existing.pluginSlug }, plugin: { deletedAt: null } }, include: { plugin: true } });
          for (const provider of providers.filter((candidate) => declaresContract(candidate.plugin.manifestJson, contract))) {
            await updateInstance(provider.id, { enabled: false, replacingProvider: true });
            replacedPlugins.push(provider.pluginSlug);
          }
        }
      }
    },
    // The database write. It joins the transaction the caller supplies.
    commit: async (tx: Transaction) => {
      const scheduler = await lockTaskScheduler(tx);
      await tx.$queryRaw`SELECT id FROM public.plugin_installations WHERE id = ${installationId} FOR UPDATE`;
      if (isEnabling) assertTaskPolicy(manifest.tasks ?? [], scheduler.policy);
      if (isDisabling || updates.config !== undefined && existing.enabled) await transitionInstallationTasks(tx, installationId, isDisabling ? 'PAUSE' : 'UPDATE', isDisabling ? 'plugin-disabled' : 'CONFIG_UPDATED', manifest.tasks ?? []);
      if (isDisabling && !updates.replacingProvider && declaresContract(pluginPackage.manifestJson, 'payment')) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('jiffoo:payment-provider-decision', 0))`;
        await assertNotLastEnabledProvider(existing.pluginSlug, existing.enabled, pluginPackage.manifestJson, tx);
      }
      const next = await tx.pluginInstallation.update({ where: { id: installationId }, data: updateData });
      await systemSettingsService.incrementPluginRegistryVersion(tx);
      if (updates.enabled !== undefined || updates.config !== undefined) {
        await PluginPageService.revokeInstallationSessions(tx, installationId);
      }
      return Object.assign(next, { replacedPlugins });
    },
    // The post-commit work. It runs after the transaction that wrote the row
    // has resolved, so the Redis bump and the runtime reconciliation never
    // hold a connection.
    finalize: async () => {
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
    },
  };
}

/**
 * Update plugin instance
 *
 * The update runs in three phases: the plugin-facing work outside every
 * transaction, the database write in a transaction and the post-commit work
 * after that transaction resolved. A caller that owns a transaction hands it
 * over and defers the post-commit work, so the write joins its transaction
 * and the plugin code never runs while a transaction is open.
 */
async function updateInstance(
  installationId: string,
  updates: {
    enabled?: boolean;
    config?: Record<string, unknown>;
    grantedPermissions?: string[];
    replacingProvider?: boolean;
  },
  options?: InstanceUpdateOptions,
): Promise<UpdatedInstance> {
  // The wrapper owns no transaction of its own in the common case: the
  // prepare phase runs outside every transaction and the write opens one.
  // When the caller hands a transaction over, the plan refuses a
  // provider-replacing update, because the replacement would open a second
  // connection inside the caller's transaction.
  const plan = await planInstanceUpdate(installationId, updates, { callerOwnsTransaction: Boolean(options?.tx) });
  // The plugin-facing work runs outside every transaction.
  await plan.prepare();
  // The database write joins the caller's transaction, or runs in one of its own.
  const updated = options?.tx
    ? await plan.commit(options.tx)
    : await prisma.$transaction(tx => plan.commit(tx), { maxWait: TRANSACTION_MAX_WAIT_MS, timeout: INSTANCE_UPDATE_TRANSACTION_TIMEOUT_MS });
  // The post-commit work runs after the transaction resolved.
  if (!options?.deferPostCommit) await plan.finalize();
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
  }, { maxWait: TRANSACTION_MAX_WAIT_MS, timeout: UNINSTALL_TRANSACTION_TIMEOUT_MS });

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
  }, { maxWait: TRANSACTION_MAX_WAIT_MS, timeout: RESTORE_TRANSACTION_TIMEOUT_MS });

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
  }, { maxWait: TRANSACTION_MAX_WAIT_MS, timeout: PURGE_TRANSACTION_TIMEOUT_MS });

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
  planInstanceUpdate,
  getInstanceConfig,
  isPluginEnabled,
  uninstallPlugin,
  restorePlugin,
  purgePlugin,

  // Validation helpers
  validateInstanceKey,
  validateSlug,
};
