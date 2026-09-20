import { prisma } from '@/config/database';
import { LoggerService } from '@/core/logger/unified-logger';
import { pluginPackageStore } from '@/core/storage/plugin-package-store';
import { loadPluginEntryModule } from '@/core/admin/extension-installer/plugin-module-loader';
import type { LifecycleHookName, PluginManifest } from '@jiffoo/shared';

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
  const startTime = Date.now();
  try {
    await callInternalLifecycleHook(hookName, context, manifest);
    LoggerService.logPerformance(`lifecycle.${hookName}`, Date.now() - startTime, { pluginSlug: context.pluginSlug, installationId: context.installationId, success: true });
    return { success: true, durationMs: Date.now() - startTime };
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown error';
    const durationMs = Date.now() - startTime;
    LoggerService.logError(error instanceof Error ? error : new Error(errorMessage), { context: `Lifecycle hook ${hookName}`, pluginSlug: context.pluginSlug, installationId: context.installationId, durationMs });
    if (hookName === 'onEnable') throw new Error(`Lifecycle hook onEnable failed for plugin "${context.pluginSlug}": ${errorMessage}`);
    try { await prisma.pluginInstallation.update({ where: { id: context.installationId }, data: { lifecycleWarning: `${hookName} failed: ${errorMessage}` } }); } catch {}
    return { success: false, error: errorMessage, durationMs };
  }
}

async function callInternalLifecycleHook(hookName: LifecycleHookName, context: LifecycleContext, manifest: PluginManifest): Promise<void> {
  const entryModule = manifest.entryModule || 'server/index.js';
  const pluginPackage = await pluginPackageStore.get(context.pluginSlug);
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
