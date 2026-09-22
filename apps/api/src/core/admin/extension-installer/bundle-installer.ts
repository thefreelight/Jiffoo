/**
 * Bundle Installer Service
 *
 * Handles installation of Bundle ZIP files containing multiple extensions.
 *
 * Bundle format (per EXTENSIONS_BLUEPRINT.md v1):
 * - bundle.json (installation plan with install.plugins[])
 * - Plugin ZIPs referenced by install.plugins[].zip
 *
 * Constraints:
 * - Idempotency: re-uploading same bundle (by hash) skips redundant installs
 * - Plugin instances: must have "default" instance, supports multiple instances
 * - Instance config: max 64KB, max 10 layers deep
 *
 * Installation order (fixed):
 * 1. Install plugins in order (following install.plugins[] array order)
 * 2. Create/configure plugin instances (following instances[] array order)
 * 3. Enable plugins (if enable=true)
 */

import { Readable } from 'stream';
import path from 'path';
import { promises as fs } from 'fs';
import { createHash } from 'crypto';
import { prisma } from '@/config/database';
import { CacheService } from '@/core/cache/service';
import { extensionInstaller } from './index';
import type { ExtensionKind, InstallResult } from './types';
import {
  extractZipToTemp,
  cleanupTemp,
  readJsonFile,
  calculateStreamHash,
  bufferToStream,
} from './utils';
import { ExtensionInstallerError } from './errors';
import { incrementPluginRegistryVersion } from './plugin-registry-version';

// ============================================================================
// Types
// ============================================================================

/**
 * Bundle manifest (bundle.json) - aligned with EXTENSIONS_BLUEPRINT.md v1
 */
interface BundleManifest {
  /** Schema version, must be 1 for v1 */
  schemaVersion: number;
  /** Bundle name */
  name: string;
  /** Bundle version */
  version: string;
  /** Bundle description */
  description?: string;
  /** Author */
  author?: string;
  /** Installation plan */
  install: {
    /** Plugins to install (in order) */
    plugins?: BundlePluginEntry[];
  };
}

/**
 * Plugin entry in bundle install plan
 */
interface BundlePluginEntry {
  /** ZIP file path (relative to bundle root, e.g., "plugins/cms-blog.zip") */
  zip: string;
  /** Expected slug (for validation) */
  slug: string;
  /** Whether to enable this plugin (default: false) */
  enable?: boolean;
  /** Instances to create/configure */
  instances?: BundlePluginInstance[];
}

/**
 * Plugin instance configuration in bundle
 */
interface BundlePluginInstance {
  /** Instance key (must be unique per plugin, "default" is reserved) */
  key: string;
  /** Instance configuration (max 64KB, max 10 layers deep) */
  config?: Record<string, any>;
  /** Whether to enable this instance (default: false) */
  enable?: boolean;
}

/**
 * Bundle installation result
 */
interface BundleInstallResult {
  /** Bundle manifest */
  manifest: BundleManifest;
  /** Bundle ZIP hash */
  bundleHash: string;
  /** Installed extensions */
  installed: Array<{
    kind: ExtensionKind;
    slug: string;
    version: string;
    success: boolean;
    error?: string;
  }>;
}

// ============================================================================
// Bundle Installer Implementation
// ============================================================================

/**
 * Install bundle from ZIP stream
 */
export async function installBundle(zipStream: Readable): Promise<BundleInstallResult> {
  let tempDir: string | null = null;

  // Calculate bundle hash first (for idempotency)
  const { hash: bundleHash, buffer: zipBuffer } = await calculateStreamHash(zipStream);

  console.log(`[BundleInstaller] Installing bundle with hash: ${bundleHash}`);

  // Check for duplicate bundle installation (idempotency via database)
  const bundleHashKey = `bundle.installed.${bundleHash}`;
  const { systemSettingsService } = await import('../system-settings/service');
  const existingBundleRecord = await systemSettingsService.getSetting(bundleHashKey);

  if (existingBundleRecord) {
    console.log(`[BundleInstaller] Bundle with hash ${bundleHash} already installed (idempotent). Skipping.`);
    return existingBundleRecord as BundleInstallResult;
  }

  try {
    // Extract bundle to temp directory
    const bufferStream = bufferToStream(zipBuffer);
    tempDir = await extractZipToTemp(bufferStream, 'bundle' as any);

    // Read bundle manifest
    const manifestPath = path.join(tempDir, 'bundle.json');
    const manifest = await readJsonFile<BundleManifest>(manifestPath);

    // Validate manifest
    validateBundleManifest(manifest);

    const installed: BundleInstallResult['installed'] = [];

    // Step 1: Install plugins in order (following install.plugins[] array order)
    if (manifest.install.plugins && manifest.install.plugins.length > 0) {
      for (const pluginEntry of manifest.install.plugins) {
        console.log(`[BundleInstaller] Installing plugin from ${pluginEntry.zip}`);

        // Read plugin ZIP
        const pluginZipPath = path.join(tempDir, pluginEntry.zip);
        const pluginZipContent = await fs.readFile(pluginZipPath);
        const pluginStream = bufferToStream(pluginZipContent);

        // Install plugin
        const result = await extensionInstaller.installFromZip('plugin', pluginStream);

        // Validate slug matches
        if (result.slug !== pluginEntry.slug) {
          throw new ExtensionInstallerError(
            `Plugin slug mismatch: expected "${pluginEntry.slug}", got "${result.slug}"`,
            { code: 'BUNDLE_INSTALL_FAILED', statusCode: 400 }
          );
        }

        installed.push({
          kind: 'plugin',
          slug: result.slug,
          version: result.version,
          success: true,
        });

        // Step 1.1: Create/configure instances (if specified)
        if (pluginEntry.instances && pluginEntry.instances.length > 0) {
          for (const instanceEntry of pluginEntry.instances) {
            console.log(`[BundleInstaller] Creating instance "${instanceEntry.key}" for plugin "${result.slug}"`);

            // Validate instance key
            if (!instanceEntry.key || typeof instanceEntry.key !== 'string') {
              throw new ExtensionInstallerError(
                `Invalid instance key for plugin "${result.slug}"`,
                { code: 'INVALID_INSTANCE_KEY', statusCode: 400 }
              );
            }

            // Validate config size and depth
            if (instanceEntry.config) {
              validateInstanceConfig(instanceEntry.config);
            }

            // Check if instance already exists
            const existingInstance = await prisma.pluginInstallation.findUnique({
              where: {
                pluginSlug_instanceKey: {
                  pluginSlug: result.slug,
                  instanceKey: instanceEntry.key,
                },
              },
            });

            if (existingInstance) {
              // Update existing instance
              await prisma.$transaction(async (tx) => {
                const enabled = instanceEntry.enable ?? existingInstance.enabled;
                await tx.pluginInstallation.update({
                  where: { id: existingInstance.id },
                  data: { configJson: instanceEntry.config ?? null, enabled },
                });
                if (enabled !== existingInstance.enabled) await incrementPluginRegistryVersion(tx);
              });
              console.log(`[BundleInstaller] Updated existing instance "${instanceEntry.key}"`);
            } else {
              // Create new instance
              await prisma.pluginInstallation.create({
                data: {
                  pluginSlug: result.slug,
                  instanceKey: instanceEntry.key,
                  configJson: instanceEntry.config ?? null,
                  enabled: instanceEntry.enable ?? false,
                },
              });
              console.log(`[BundleInstaller] Created new instance "${instanceEntry.key}"`);
            }
          }
          // Bump plugin version after instance changes
          await CacheService.incrementPluginVersion();
        }

        // Step 1.2: Enable plugin if specified (at plugin level)
        if (pluginEntry.enable) {
          // Enable all instances of this plugin
          await prisma.$transaction(async (tx) => {
            const disabledInstances = await tx.pluginInstallation.count({ where: { pluginSlug: result.slug, enabled: false } });
            await tx.pluginInstallation.updateMany({ where: { pluginSlug: result.slug }, data: { enabled: true } });
            if (disabledInstances > 0) await incrementPluginRegistryVersion(tx);
          });
          await CacheService.incrementPluginVersion();
          console.log(`[BundleInstaller] Enabled plugin "${result.slug}"`);
        }
      }
    }

    // Prepare result
    const result: BundleInstallResult = {
      manifest,
      bundleHash,
      installed,
    };

    // Save bundle installation record for idempotency (only on success)
    await systemSettingsService.setSetting(bundleHashKey, {
      ...result,
      installedAt: new Date().toISOString(),
    });

    console.log(`[BundleInstaller] Bundle ${bundleHash} installed successfully`);

    return result;
  } catch (error: any) {
    console.error(`[BundleInstaller] Bundle installation failed:`, error);
    // Re-throw to ensure caller knows installation failed
    throw error;
  } finally {
    // Clean up temp directory
    if (tempDir) {
      await cleanupTemp(tempDir);
    }
  }
}

/**
 * Validate instance configuration (max 64KB, max 10 layers deep)
 */
function validateInstanceConfig(config: Record<string, any>): void {
  // Import validation utilities
  const { validateInstanceConfigSize, validateInstanceConfigDepth } = require('./utils');
  
  // Validate size (max 64KB)
  validateInstanceConfigSize(config);
  
  // Validate depth (max 10 layers)
  validateInstanceConfigDepth(config);
}

/**
 * Validate bundle manifest (aligned with EXTENSIONS_BLUEPRINT.md v1)
 */
function validateBundleManifest(manifest: BundleManifest): void {
  // Required: schemaVersion must be 1
  if (manifest.schemaVersion !== 1) {
    throw new ExtensionInstallerError(
      'Invalid bundle manifest: schemaVersion must be 1',
      { code: 'INVALID_BUNDLE', statusCode: 400 }
    );
  }

  // Required: name
  if (!manifest.name || typeof manifest.name !== 'string') {
    throw new ExtensionInstallerError(
      'Invalid bundle manifest: missing or invalid "name"',
      { code: 'INVALID_BUNDLE', statusCode: 400 }
    );
  }

  // Required: version
  if (!manifest.version || typeof manifest.version !== 'string') {
    throw new ExtensionInstallerError(
      'Invalid bundle manifest: missing or invalid "version"',
      { code: 'INVALID_BUNDLE', statusCode: 400 }
    );
  }

  // Required: install object
  if (!manifest.install || typeof manifest.install !== 'object') {
    throw new ExtensionInstallerError(
      'Invalid bundle manifest: "install" object is required',
      { code: 'INVALID_BUNDLE', statusCode: 400 }
    );
  }

  // Validate install.plugins (if specified)
  if (manifest.install.plugins) {
    if (!Array.isArray(manifest.install.plugins)) {
      throw new ExtensionInstallerError(
        'Invalid bundle manifest: install.plugins must be an array',
        { code: 'INVALID_BUNDLE', statusCode: 400 }
      );
    }

    for (const plugin of manifest.install.plugins) {
      // Required: zip
      if (!plugin.zip || typeof plugin.zip !== 'string') {
        throw new ExtensionInstallerError(
          'Invalid bundle manifest: plugin.zip is required',
          { code: 'INVALID_BUNDLE', statusCode: 400 }
        );
      }

      // Required: slug
      if (!plugin.slug || typeof plugin.slug !== 'string') {
        throw new ExtensionInstallerError(
          'Invalid bundle manifest: plugin.slug is required',
          { code: 'INVALID_BUNDLE', statusCode: 400 }
        );
      }

      // Validate instances (if specified)
      if (plugin.instances) {
        if (!Array.isArray(plugin.instances)) {
          throw new ExtensionInstallerError(
            `Invalid bundle manifest: plugin "${plugin.slug}" instances must be an array`,
            { code: 'INVALID_BUNDLE', statusCode: 400 }
          );
        }

        // Check for "default" instance (must exist)
        const hasDefault = plugin.instances.some((inst) => inst.key === 'default');
        if (!hasDefault) {
          throw new ExtensionInstallerError(
            `Invalid bundle manifest: plugin "${plugin.slug}" must have a "default" instance`,
            { code: 'INVALID_BUNDLE', statusCode: 400 }
          );
        }

        // Validate each instance
        const instanceKeys = new Set<string>();
        for (const instance of plugin.instances) {
          // Required: key
          if (!instance.key || typeof instance.key !== 'string') {
            throw new ExtensionInstallerError(
              `Invalid bundle manifest: plugin "${plugin.slug}" instance.key is required`,
              { code: 'INVALID_BUNDLE', statusCode: 400 }
            );
          }

          // Check for duplicate keys
          if (instanceKeys.has(instance.key)) {
            throw new ExtensionInstallerError(
              `Invalid bundle manifest: plugin "${plugin.slug}" has duplicate instance key "${instance.key}"`,
              { code: 'INVALID_BUNDLE', statusCode: 400 }
            );
          }
          instanceKeys.add(instance.key);

          // Validate config (if specified)
          if (instance.config) {
            validateInstanceConfig(instance.config);
          }
        }
      }
    }
  }

}

// ============================================================================
// Export
// ============================================================================

export const bundleInstaller = {
  install: installBundle,
};
