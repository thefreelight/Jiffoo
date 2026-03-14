/**
 * Bundle Installer Service
 *
 * Handles installation of Bundle ZIP files containing multiple extensions.
 *
 * Bundle format (per EXTENSIONS_BLUEPRINT.md v1):
 * - bundle.json (installation plan with install.plugins[] and install.theme)
 * - Plugin ZIPs referenced by install.plugins[].zip
 * - Theme ZIP referenced by install.theme.zip
 *
 * Constraints:
 * - Bundle only supports single target (shop OR admin), not both simultaneously
 * - Installation is atomic: if any step fails, active theme is NOT changed
 * - Idempotency: re-uploading same bundle (by hash) skips redundant installs
 * - Plugin instances: must have "default" instance, supports multiple instances
 * - Instance config: max 64KB, max 10 layers deep
 *
 * Installation order (fixed):
 * 1. Install plugins in order (following install.plugins[] array order)
 * 2. Create/configure plugin instances (following instances[] array order)
 * 3. Enable plugins (if enable=true)
 * 4. Install theme (if install.theme exists)
 * 5. Activate theme (if install.theme.enable=true, includes health check for Theme App)
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
  /** Target: shop or admin (Bundle only supports single target) */
  target: 'shop' | 'admin';
  /** Bundle description */
  description?: string;
  /** Author */
  author?: string;
  /** Installation plan */
  install: {
    /** Plugins to install (in order) */
    plugins?: BundlePluginEntry[];
    /** Theme to install */
    theme?: BundleThemeEntry;
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
 * Theme entry in bundle install plan
 */
interface BundleThemeEntry {
  /** Theme type: 'pack' or 'app' */
  type: 'pack' | 'app';
  /** ZIP file path (relative to bundle root, e.g., "theme-pack/aurora.zip" or "theme-app/travelpass.zip") */
  zip: string;
  /** Expected slug (for validation, optional) */
  slug?: string;
  /** Whether to activate this theme after installation (default: false) */
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
  /** Whether theme was activated */
  themeActivated?: {
    target: 'shop' | 'admin';
    slug: string;
  };
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

    // Validate bundle structure: theme-pack/ and theme-app/ cannot coexist
    const themePackDir = path.join(tempDir, 'theme-pack');
    const themeAppDir = path.join(tempDir, 'theme-app');
    
    const hasThemePack = await fs.access(themePackDir).then(() => true).catch(() => false);
    const hasThemeApp = await fs.access(themeAppDir).then(() => true).catch(() => false);
    
    if (hasThemePack && hasThemeApp) {
      throw new ExtensionInstallerError(
        'Invalid bundle structure: theme-pack/ and theme-app/ cannot coexist in the same bundle (ambiguous)',
        { code: 'INVALID_BUNDLE_STRUCTURE', statusCode: 400 }
      );
    }

    // Read bundle manifest
    const manifestPath = path.join(tempDir, 'bundle.json');
    const manifest = await readJsonFile<BundleManifest>(manifestPath);

    // Validate manifest
    validateBundleManifest(manifest);

    const installed: BundleInstallResult['installed'] = [];
    const target = manifest.target;

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
              await prisma.pluginInstallation.update({
                where: { id: existingInstance.id },
                data: {
                  configJson: instanceEntry.config ?? null,
                  enabled: instanceEntry.enable ?? existingInstance.enabled,
                },
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
          await prisma.pluginInstallation.updateMany({
            where: { pluginSlug: result.slug },
            data: { enabled: true },
          });
          await CacheService.incrementPluginVersion();
          console.log(`[BundleInstaller] Enabled plugin "${result.slug}"`);
        }
      }
    }

    // Step 2: Install theme (if specified)
    let themeSlug: string | null = null;
    let themeActivated: BundleInstallResult['themeActivated'];

    if (manifest.install.theme) {
      const themeEntry = manifest.install.theme;
      console.log(`[BundleInstaller] Installing theme (type=${themeEntry.type}) from ${themeEntry.zip}`);

      // Determine theme kind based on type and target
      let themeKind: ExtensionKind;
      if (themeEntry.type === 'pack') {
        themeKind = target === 'shop' ? 'theme-shop' : 'theme-admin';
      } else if (themeEntry.type === 'app') {
        themeKind = target === 'shop' ? 'theme-app-shop' : 'theme-app-admin';
      } else {
        throw new ExtensionInstallerError(
          `Invalid theme type: "${themeEntry.type}"`,
          { code: 'INVALID_BUNDLE', statusCode: 400 }
        );
      }

      // Read theme ZIP
      const themeZipPath = path.join(tempDir, themeEntry.zip);
      const themeZipContent = await fs.readFile(themeZipPath);
      const themeStream = bufferToStream(themeZipContent);

      // Install theme
      const result = await extensionInstaller.installFromZip(themeKind, themeStream);
      themeSlug = result.slug;

      // Validate slug matches (if specified)
      if (themeEntry.slug && result.slug !== themeEntry.slug) {
        throw new ExtensionInstallerError(
          `Theme slug mismatch: expected "${themeEntry.slug}", got "${result.slug}"`,
          { code: 'BUNDLE_INSTALL_FAILED', statusCode: 400 }
        );
      }

      installed.push({
        kind: themeKind,
        slug: result.slug,
        version: result.version,
        success: true,
      });

      // Step 2.1: Activate theme if enable=true (atomic guarantee)
      if (themeEntry.enable) {
        console.log(`[BundleInstaller] Activating theme "${result.slug}"`);

        // Import ThemeManagementService dynamically to avoid circular dependency
        const { ThemeManagementService } = await import('../theme-management/service');

        try {
          // Atomic activation: includes Theme App health check if type=app
          // If health check fails, activateTheme will throw error and active theme won't change
          await ThemeManagementService.activateTheme(result.slug, target);
          themeActivated = { target, slug: result.slug };
          console.log(`[BundleInstaller] Theme "${result.slug}" activated successfully`);
        } catch (error: any) {
          // Activation failure is FATAL for bundle installation (atomic guarantee)
          throw new ExtensionInstallerError(
            `Bundle installation failed: theme activation failed for "${result.slug}": ${error.message}`,
            { code: 'BUNDLE_INSTALL_FAILED', statusCode: 400, cause: error }
          );
        }
      }
    }

    // Prepare result
    const result: BundleInstallResult = {
      manifest,
      bundleHash,
      installed,
      themeActivated,
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
    // Active theme will NOT be changed due to atomic guarantee
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

  // Required: target
  if (!manifest.target || !['shop', 'admin'].includes(manifest.target)) {
    throw new ExtensionInstallerError(
      'Invalid bundle manifest: "target" must be "shop" or "admin"',
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

  // Validate install.theme (if specified)
  if (manifest.install.theme) {
    const theme = manifest.install.theme;

    // Required: type
    if (!theme.type || !['pack', 'app'].includes(theme.type)) {
      throw new ExtensionInstallerError(
        'Invalid bundle manifest: theme.type must be "pack" or "app"',
        { code: 'INVALID_BUNDLE', statusCode: 400 }
      );
    }

    // Required: zip
    if (!theme.zip || typeof theme.zip !== 'string') {
      throw new ExtensionInstallerError(
        'Invalid bundle manifest: theme.zip is required',
        { code: 'INVALID_BUNDLE', statusCode: 400 }
      );
    }
  }
}

// ============================================================================
// Export
// ============================================================================

export const bundleInstaller = {
  install: installBundle,
};
