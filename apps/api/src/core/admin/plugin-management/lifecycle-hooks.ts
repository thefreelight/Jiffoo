import { prisma } from '@/config/database';
import { LoggerService } from '@/core/logger/unified-logger';
import { pluginPackageStore } from '@/core/storage/plugin-package-store';
import { resolveCurrentPluginPackage, PluginPackageResolutionError } from '@/core/storage/current-plugin-package';
import { loadPluginEntryModule } from '@/core/admin/extension-installer/plugin-module-loader';
import type { LifecycleHookName, PluginManifest } from '@jiffoo/shared';
import { recordPluginFailure, redactPluginFailure } from '@/core/admin/extension-installer/plugin-failure';
import { assertPluginSigningAllowed } from '@/core/extensions/runtime/plugin-signing-policy';
import { ExtensionInstallerError } from '@/core/extensions/shared/errors';

export interface LifecycleContext {
  installationId: string;
  pluginSlug: string;
  instanceKey: string;
  config: Record<string, unknown>;
  previousVersion?: string;
}

export interface LifecycleResult { success: boolean; error?: string; durationMs: number; }

const LIFECYCLE_TIMEOUT_MS = 30_000;

export function hasLifecycleHook(manifest: PluginManifest | null | undefined, hookName: LifecycleHookName): boolean {
  return !!manifest?.lifecycle?.[hookName];
}

export async function executeLifecycleHook(hookName: LifecycleHookName, context: LifecycleContext, manifest: PluginManifest): Promise<LifecycleResult> {
  if (!hasLifecycleHook(manifest, hookName)) return { success: true, durationMs: 0 };
  const plugin = await prisma.pluginInstall.findUnique({ where: { slug: context.pluginSlug } });
  if (plugin) assertPluginSigningAllowed(plugin);
  const startTime = Date.now();
  try {
    await callInternalLifecycleHook(hookName, context, manifest);
    LoggerService.logPerformance(`lifecycle.${hookName}`, Date.now() - startTime, { pluginSlug: context.pluginSlug, installationId: context.installationId, success: true });
    return { success: true, durationMs: Date.now() - startTime };
  } catch (error: any) {
    const errorMessage = await redactPluginFailure(context.pluginSlug, error, context.installationId, { config: context.config, manifest });
    const durationMs = Date.now() - startTime;
    LoggerService.logError(new Error(errorMessage), { context: `Lifecycle hook ${hookName}`, pluginSlug: context.pluginSlug, installationId: context.installationId, durationMs });
    if (hookName === 'onEnable') {
      await recordPluginFailure(context.pluginSlug, error, hookName, context.installationId, { config: context.config, manifest });
      if (error instanceof PluginPackageResolutionError) throw error;
      throw new ExtensionInstallerError(`Lifecycle hook onEnable failed for plugin "${context.pluginSlug}": ${errorMessage}`, { statusCode: 500, code: 'INTERNAL_SERVER_ERROR' });
    }
    try {
      await prisma.$transaction(async tx => {
        await recordPluginFailure(context.pluginSlug, error, hookName, context.installationId, { config: context.config, manifest }, tx);
        await tx.pluginInstallation.update({ where: { id: context.installationId }, data: { lifecycleWarning: `${hookName} failed: ${errorMessage}` } });
      });
    } catch (compensationError: any) {
      // The compensating write failed: the failure is in no ledger and the
      // warning is on no installation row. The hook failure itself is already
      // reported above, so this only records that the record is missing. The
      // result of the hook does not change and nothing is retried.
      LoggerService.logError(
        compensationError instanceof Error ? compensationError : new Error(String(compensationError)),
        {
          context: 'Lifecycle hook failure record',
          pluginSlug: context.pluginSlug,
          installationId: context.installationId,
          hookName,
          failureStage: 'compensating-write',
          reason: compensationError instanceof Error ? compensationError.name : 'unknown',
          reasonMessage: compensationError instanceof Error ? compensationError.message : String(compensationError),
        },
      );
    }
    return { success: false, error: errorMessage, durationMs };
  }
}

async function callInternalLifecycleHook(hookName: LifecycleHookName, context: LifecycleContext, manifest: PluginManifest): Promise<void> {
  const entryModule = manifest.entryModule || 'server/index.js';
  const row = await prisma.pluginInstall.findUnique({ where: { slug: context.pluginSlug } });
  if (row) assertPluginSigningAllowed(row);
  const pluginPackage = row?.zipHash
    ? await resolveCurrentPluginPackage(context.pluginSlug, row.zipHash) : null;
  if (!pluginPackage || !await pluginPackage.exists(entryModule)) throw new Error(`Plugin entry module not found: ${entryModule}`);
  const entryPath = pluginPackage.getEntryPath(entryModule);
  const mod = await loadPluginEntryModule(entryPath, { version: manifest.version });
  const hookFn = mod[`__lifecycle_${hookName}`] || mod.default?.[`__lifecycle_${hookName}`];
  if (typeof hookFn !== 'function') return;
  await Promise.race([
    Promise.resolve(hookFn(context)),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Lifecycle hook ${hookName} timed out after ${LIFECYCLE_TIMEOUT_MS}ms`)), LIFECYCLE_TIMEOUT_MS)),
  ]);
}
