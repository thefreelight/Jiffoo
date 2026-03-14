/**
 * Plugin Lifecycle Hooks
 *
 * Executes lifecycle hooks declared in plugin manifests.
 * Supports two runtime types:
 * - internal-fastify: dynamically imports the plugin entry module and calls __lifecycle_{hookName}
 * - external-http: POSTs to {externalBaseUrl}/__lifecycle/{hookName}
 *
 * Failure policy:
 * - onEnable: failure rejects the enable operation (throws)
 * - onInstall / onDisable / onUninstall / onUpgrade: failure is recorded as a warning, operation continues
 *
 * Security:
 * - SSRF protection for external-http hooks (reuses validation pattern from plugin-runtime.ts)
 * - 30-second timeout for both runtime types
 */

import { prisma } from '@/config/database';
import { LoggerService } from '@/core/logger/unified-logger';
import { getPluginDir } from '@/core/admin/extension-installer/utils';
import { loadPluginEntryModule } from '@/core/admin/extension-installer/plugin-module-loader';
import path from 'path';
import { existsSync } from 'fs';
import { URL } from 'url';
import type { LifecycleHookName, PluginManifest } from '@jiffoo/shared';

// ============================================================================
// Types
// ============================================================================

/** Context passed to lifecycle hook functions / HTTP endpoints */
export interface LifecycleContext {
  installationId: string;
  pluginSlug: string;
  instanceKey: string;
  config: Record<string, unknown>;
  previousVersion?: string; // For onUpgrade
}

/** Result of a lifecycle hook execution */
export interface LifecycleResult {
  success: boolean;
  error?: string;
  durationMs: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Lifecycle hook execution timeout (30 seconds) */
const LIFECYCLE_TIMEOUT_MS = 30_000;

/** Private IP ranges for SSRF protection (mirrors plugin-runtime.ts) */
const PRIVATE_IP_PATTERNS = [
  /^127\./,                            // Loopback
  /^10\./,                             // Class A private
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,   // Class B private
  /^192\.168\./,                       // Class C private
  /^169\.254\./,                       // Link-local
  /^0\./,                              // Current network
  /^localhost$/i,                      // Localhost hostname
  /^::1$/,                             // IPv6 loopback
  /^fc00:/i,                           // IPv6 private
  /^fe80:/i,                           // IPv6 link-local
];

// ============================================================================
// SSRF Protection
// ============================================================================

/**
 * Validate URL for SSRF protection.
 * Mirrors the logic in plugin-runtime.ts validateExternalUrl().
 */
function validateExternalUrl(urlString: string): void {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error(`Invalid external URL: ${urlString}`);
  }

  const hostname = url.hostname.toLowerCase();

  // In local development, external plugins are often on localhost/private IPs.
  const allowPrivateInCurrentEnv =
    process.env.PLUGIN_ALLOW_PRIVATE_EXTERNAL_URLS === 'true' || process.env.NODE_ENV !== 'production';

  if (!allowPrivateInCurrentEnv) {
    for (const pattern of PRIVATE_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        throw new Error(`SSRF blocked: cannot access private/internal address "${hostname}"`);
      }
    }
  }

  // In production, require HTTPS
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error('SSRF blocked: external plugins must use HTTPS in production');
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Check if a manifest declares a specific lifecycle hook.
 */
export function hasLifecycleHook(manifest: PluginManifest | null | undefined, hookName: LifecycleHookName): boolean {
  return !!(manifest?.lifecycle?.[hookName]);
}

/**
 * Execute a lifecycle hook for a plugin installation.
 *
 * If the manifest does not declare the requested hook, this is a no-op that
 * returns a successful result with 0 ms duration.
 *
 * Failure policy:
 * - onEnable: failure rejects the enable — throws an Error
 * - All others: failure is logged, stored as lifecycleWarning on the installation, and the
 *   result is returned with success=false. The caller may proceed.
 */
export async function executeLifecycleHook(
  hookName: LifecycleHookName,
  context: LifecycleContext,
  manifest: PluginManifest
): Promise<LifecycleResult> {
  // If manifest does not declare this hook, skip silently
  if (!hasLifecycleHook(manifest, hookName)) {
    return { success: true, durationMs: 0 };
  }

  const startTime = Date.now();
  const runtimeType: string | undefined = manifest.runtimeType;

  try {
    if (runtimeType === 'internal-fastify') {
      await callInternalLifecycleHook(hookName, context, manifest);
    } else if (runtimeType === 'external-http') {
      await callExternalLifecycleHook(hookName, context, manifest);
    } else {
      throw new Error(`Unknown runtimeType "${runtimeType}" — cannot execute lifecycle hook`);
    }

    LoggerService.logPerformance(`lifecycle.${hookName}`, Date.now() - startTime, {
      pluginSlug: context.pluginSlug,
      installationId: context.installationId,
      success: true,
    });

    return { success: true, durationMs: Date.now() - startTime };
  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error?.message || 'Unknown error';

    const result: LifecycleResult = {
      success: false,
      error: errorMessage,
      durationMs,
    };

    LoggerService.logError(error instanceof Error ? error : new Error(errorMessage), {
      context: `Lifecycle hook ${hookName}`,
      pluginSlug: context.pluginSlug,
      installationId: context.installationId,
      durationMs,
    });

    // Failure policy: onEnable rejects the operation
    if (hookName === 'onEnable') {
      throw new Error(`Lifecycle hook onEnable failed for plugin "${context.pluginSlug}": ${errorMessage}`);
    }

    // For other hooks: record warning on the installation row, then continue
    try {
      await prisma.pluginInstallation.update({
        where: { id: context.installationId },
        data: { lifecycleWarning: `${hookName} failed: ${errorMessage}` },
      });
    } catch {
      // Ignore DB update failure — the hook result is still returned
    }

    return result;
  }
}

// ============================================================================
// Internal Runtime Hook
// ============================================================================

/**
 * Call a lifecycle hook on an internal-fastify plugin.
 *
 * Loads the plugin entry module via dynamic import (file:// URL with cache-bust,
 * matching plugin-runtime.ts patterns) and looks for an exported function named
 * `__lifecycle_{hookName}`. If the function does not exist, the hook is skipped.
 *
 * The function is called with the LifecycleContext and must resolve within 30 seconds.
 */
async function callInternalLifecycleHook(
  hookName: LifecycleHookName,
  context: LifecycleContext,
  manifest: PluginManifest
): Promise<void> {
  const slug = context.pluginSlug;
  const pluginDir = getPluginDir(slug);
  const entryModule: string = manifest.entryModule || 'server/index.js';
  const entryPath = path.join(pluginDir, entryModule);

  if (!existsSync(entryPath)) {
    throw new Error(`Plugin entry module not found: ${entryPath}`);
  }

  const mod = await loadPluginEntryModule(entryPath, { version: manifest.version });

  // Look for exported function __lifecycle_{hookName}
  const fnName = `__lifecycle_${hookName}`;
  const hookFn = mod[fnName] || mod.default?.[fnName];

  if (typeof hookFn !== 'function') {
    // Hook function not exported — silently skip (manifest declared it, but code didn't implement it)
    return;
  }

  // Execute with 30-second timeout via Promise.race
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Lifecycle hook ${hookName} timed out after ${LIFECYCLE_TIMEOUT_MS}ms`));
    }, LIFECYCLE_TIMEOUT_MS);
  });

  await Promise.race([
    Promise.resolve(hookFn(context)),
    timeoutPromise,
  ]);
}

// ============================================================================
// External HTTP Hook
// ============================================================================

/**
 * Call a lifecycle hook on an external-http plugin.
 *
 * POSTs to {externalBaseUrl}/__lifecycle/{hookName} with the LifecycleContext as the
 * JSON body. Uses AbortController for a 30-second timeout.
 *
 * SSRF protection is applied before making the request.
 * The response must be 2xx; any other status is treated as a failure.
 */
async function callExternalLifecycleHook(
  hookName: LifecycleHookName,
  context: LifecycleContext,
  manifest: PluginManifest
): Promise<void> {
  const baseUrl: string | undefined = manifest.externalBaseUrl;
  if (!baseUrl) {
    throw new Error(
      `Plugin "${context.pluginSlug}" is external-http but missing externalBaseUrl in manifest`
    );
  }

  // SSRF protection
  validateExternalUrl(baseUrl);

  // Build target URL: {externalBaseUrl}/__lifecycle/{hookName}
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const targetUrl = new URL(`__lifecycle/${hookName}`, normalizedBase).toString();

  // Also validate the constructed target URL (in case the path changes the host somehow)
  validateExternalUrl(targetUrl);

  // Create abort controller for 30-second timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LIFECYCLE_TIMEOUT_MS);

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Plugin-Slug': context.pluginSlug,
        'X-Installation-Id': context.installationId,
        'X-Lifecycle-Hook': hookName,
      },
      body: JSON.stringify(context),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      // Try to read error body for diagnostics
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch {
        // Ignore body read failure
      }
      throw new Error(
        `External lifecycle hook ${hookName} returned HTTP ${response.status}: ${errorBody || response.statusText}`
      );
    }
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw new Error(
        `External lifecycle hook ${hookName} timed out after ${LIFECYCLE_TIMEOUT_MS}ms`
      );
    }

    // Re-throw if it's already our error (from the !response.ok branch)
    throw error;
  }
}
