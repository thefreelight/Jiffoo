/**
 * Theme App Runtime Manager
 *
 * Manages Theme App (L4) lifecycle: start, stop, health check, and process monitoring.
 * Theme Apps are standalone Next.js applications that can serve as complete storefronts.
 */

import path from 'path';
import { promises as fs } from 'fs';
import type {
  ThemeAppManifest,
  ThemeAppInstance,
  ThemeAppStartOptions,
  ThemeAppStopOptions,
  HealthCheckResult,
} from './types';
import {
  THEME_APP_MANIFEST_FILE,
  getThemeAppManifestIssues,
} from './contract';
import { assertThemeAppRuntimeSupported } from './policy';
import { validatePathTraversal } from '../extension-installer/security';
import { localProcessThemeAppRuntimeAdapter, type ThemeAppRuntimeAdapter, type ThemeAppRuntimeHandle } from './adapters';

// ============================================================================
// Constants
// ============================================================================

// ============================================================================
// Manager State
// ============================================================================

/** Running Theme App instances */
const runningInstances = new Map<string, {
  adapter: ThemeAppRuntimeAdapter;
  handle: ThemeAppRuntimeHandle;
  instance: ThemeAppInstance;
}>();

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get extensions root directory
 */
function getExtensionsRoot(): string {
  const envPath = process.env.EXTENSIONS_PATH || 'extensions';
  return path.isAbsolute(envPath) ? envPath : path.join(process.cwd(), envPath);
}

/**
 * Get Theme App directory
 * Path: extensions/themes-app/{target}/{slug}/{version}
 */
function getThemeAppDir(target: 'shop' | 'admin', slug: string, version?: string): string {
  if (version) {
    return path.join(getExtensionsRoot(), 'themes-app', target, slug, version);
  }
  // Fallback: read latest version from slug directory
  return path.join(getExtensionsRoot(), 'themes-app', target, slug);
}

/**
 * Get instance key
 */
function getInstanceKey(target: 'shop' | 'admin', slug: string): string {
  return `${target}:${slug}`;
}

/**
 * Read Theme App manifest
 * Only supports theme-app.json
 */
async function readThemeAppManifest(
  target: 'shop' | 'admin',
  slug: string,
  version: string
): Promise<ThemeAppManifest> {
  const themeDir = getThemeAppDir(target, slug, version);
  const themeAppJsonPath = path.join(themeDir, THEME_APP_MANIFEST_FILE);
  try {
    const content = await fs.readFile(themeAppJsonPath, 'utf-8');
    const manifest = JSON.parse(content) as unknown;
    const issues = getThemeAppManifestIssues(manifest);
    if (issues.length > 0) {
      throw new Error(`Invalid ${THEME_APP_MANIFEST_FILE}: ${issues[0].path} ${issues[0].message}`);
    }

    return manifest as ThemeAppManifest;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw new Error(`Theme App manifest not found: ${THEME_APP_MANIFEST_FILE} is required for "${slug}"`);
    }
    throw error;
  }
}

function resolveRuntimeAdapter(_manifest: ThemeAppManifest): ThemeAppRuntimeAdapter {
  return localProcessThemeAppRuntimeAdapter;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Start a Theme App
 * @param target - Target platform (shop or admin)
 * @param slug - Theme slug
 * @param version - Theme version to start (required)
 * @param options - Start options
 */
export async function startThemeApp(
  target: 'shop' | 'admin',
  slug: string,
  version: string,
  options: ThemeAppStartOptions = {}
): Promise<ThemeAppInstance> {
  assertThemeAppRuntimeSupported(`start Theme App "${slug}" for ${target}`);
  const instanceKey = getInstanceKey(target, slug);

  // Check if already running
  const existing = runningInstances.get(instanceKey);
  if (existing) {
    if (options.forceRestart) {
      await stopThemeApp(target, slug);
    } else if (existing.instance.status === 'healthy') {
      return existing.instance;
    }
  }

  // Read manifest (with version)
  const manifest = await readThemeAppManifest(target, slug, version);
  const themeDir = getThemeAppDir(target, slug, version);

  // Validate theme directory is within extensions root (path traversal protection)
  const extensionsRoot = getExtensionsRoot();
  validatePathTraversal(themeDir, extensionsRoot);

  const adapter = resolveRuntimeAdapter(manifest);
  const { instance, handle } = await adapter.start({
    instanceKey,
    slug,
    target,
    themeDir,
    manifest,
    options,
    onProcessError: (error, runtimeInstance) => {
      console.error(`[ThemeAppManager] Process error for ${instanceKey}:`, error);
      runtimeInstance.status = 'crashed';
      runtimeInstance.error = error.message;
      runtimeInstance.stoppedAt = new Date().toISOString();
    },
    onProcessExit: (code, signal, runtimeInstance) => {
      console.log(`[ThemeAppManager] Process exited for ${instanceKey}: code=${code}, signal=${signal}`);
      if (runtimeInstance.status !== 'stopping') {
        runtimeInstance.status = 'crashed';
        runtimeInstance.error = `Process exited with code ${code}`;
      } else {
        runtimeInstance.status = 'stopped';
      }
      runtimeInstance.stoppedAt = new Date().toISOString();
      runningInstances.delete(instanceKey);
    },
  });

  runningInstances.set(instanceKey, { adapter, handle, instance });
  return instance;
}

/**
 * Stop a Theme App
 */
export async function stopThemeApp(
  target: 'shop' | 'admin',
  slug: string,
  options: ThemeAppStopOptions = {}
): Promise<void> {
  const instanceKey = getInstanceKey(target, slug);
  const running = runningInstances.get(instanceKey);

  if (!running) {
    return; // Already stopped
  }

  await running.adapter.stop({
    instanceKey,
    instance: running.instance,
    handle: running.handle,
    options,
  });
}

/**
 * Get Theme App instance status
 */
export function getThemeAppInstance(
  target: 'shop' | 'admin',
  slug: string
): ThemeAppInstance | null {
  const instanceKey = getInstanceKey(target, slug);
  const running = runningInstances.get(instanceKey);
  return running?.instance || null;
}

/**
 * Get all running Theme App instances
 */
export function getAllRunningInstances(): ThemeAppInstance[] {
  return Array.from(runningInstances.values()).map((r) => r.instance);
}

/**
 * Check health of a running Theme App.
 */
export async function checkThemeAppHealth(
  target: 'shop' | 'admin',
  slug: string
): Promise<HealthCheckResult | null> {
  const instanceKey = getInstanceKey(target, slug);
  const running = runningInstances.get(instanceKey);
  const instance = running?.instance;

  if (!instance || !instance.baseUrl) {
    return null;
  }

  const result = await running.adapter.checkHealth({ instance });

  if (!result) {
    return null;
  }

  // Update instance status
  running.instance.lastHealthCheck = {
    success: result.success,
    timestamp: new Date().toISOString(),
    latencyMs: result.latencyMs,
    error: result.error,
  };

  if (result.success) {
    running.instance.status = 'healthy';
  } else {
    running.instance.status = 'unhealthy';
  }

  return result;
}

/**
 * Shutdown all running Theme Apps
 */
export async function shutdownAllThemeApps(): Promise<void> {
  const instances = Array.from(runningInstances.keys());

  await Promise.all(
    instances.map(async (key) => {
      const [target, slug] = key.split(':') as ['shop' | 'admin', string];
      await stopThemeApp(target, slug);
    })
  );
}

// ============================================================================
// Export Service Object
// ============================================================================

export const ThemeAppRuntimeManager = {
  startThemeApp,
  stopThemeApp,
  getThemeAppInstance,
  getAllRunningInstances,
  checkThemeAppHealth,
  shutdownAllThemeApps,
};
