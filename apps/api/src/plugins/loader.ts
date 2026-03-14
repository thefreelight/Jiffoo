// @ts-nocheck
/**
 * Plugin Loader with Runtime Version Checking
 *
 * Provides plugin loading functionality with API version compatibility validation.
 * Prevents incompatible plugins from loading and provides clear error messages.
 */

import { isVersionCompatible } from '@jiffoo/shared/versioning/compatibility-checker';
import { compareVersions, isValidVersion } from '@jiffoo/shared/versioning/version-parser';
import { isValidSemver } from '@jiffoo/shared/utils/validation';
import { apiVersionConfig } from '@/config/api-versions';
import type { PluginManifest } from '@/core/admin/extension-installer/types';

/**
 * Plugin loader error codes
 */
export type PluginLoaderErrorCode =
  | 'INCOMPATIBLE_API_VERSION'
  | 'INVALID_VERSION_FORMAT'
  | 'MISSING_VERSION_INFO'
  | 'VERSION_CHECK_FAILED';

/**
 * Plugin loader error class
 */
export class PluginLoaderError extends Error {
  public readonly code: PluginLoaderErrorCode;
  public readonly pluginSlug: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: PluginLoaderErrorCode,
    pluginSlug: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'PluginLoaderError';
    this.code = code;
    this.pluginSlug = pluginSlug;
    this.details = details;
  }
}

/**
 * Version compatibility check result
 */
export interface VersionCheckResult {
  compatible: boolean;
  currentApiVersion: string;
  requiredApiVersion?: string;
  reason?: string;
}

/**
 * Get current API version
 * Returns the latest active version from the API configuration
 */
export function getCurrentApiVersion(): string {
  // Get the default version from configuration
  const defaultVersion = apiVersionConfig.defaultVersion;

  // Ensure it's in the format "v1", "v2", etc.
  return defaultVersion.startsWith('v') ? defaultVersion : `v${defaultVersion}`;
}

/**
 * Validate plugin manifest version information
 * Checks that the version fields are properly formatted
 *
 * @param manifest - Plugin manifest to validate
 * @throws {PluginLoaderError} If version information is invalid
 */
export function validateManifestVersionInfo(manifest: PluginManifest): void {
  // Check plugin version format
  if (!manifest.version || !isValidSemver(manifest.version)) {
    throw new PluginLoaderError(
      `Invalid plugin version format: "${manifest.version}". Must be semantic version (e.g., "1.0.0")`,
      'INVALID_VERSION_FORMAT',
      manifest.slug,
      { version: manifest.version }
    );
  }

  // If minApiVersion is specified, validate its format
  if (manifest.minApiVersion) {
    if (!isValidVersion(manifest.minApiVersion)) {
      throw new PluginLoaderError(
        `Invalid minApiVersion format: "${manifest.minApiVersion}". Must be semantic version (e.g., "v1", "v2")`,
        'INVALID_VERSION_FORMAT',
        manifest.slug,
        { minApiVersion: manifest.minApiVersion }
      );
    }
  }
}

/**
 * Check if plugin is compatible with current API version
 *
 * @param manifest - Plugin manifest containing version requirements
 * @returns Version check result with compatibility status and details
 */
export function checkPluginApiCompatibility(manifest: PluginManifest): VersionCheckResult {
  const currentApiVersion = getCurrentApiVersion();
  const minApiVersion = manifest.minApiVersion;

  // If no minApiVersion specified, assume compatible with all versions
  if (!minApiVersion) {
    return {
      compatible: true,
      currentApiVersion,
      reason: 'No minimum API version specified, assuming compatible'
    };
  }

  try {
    // Check if current version satisfies minimum requirement
    const compatible = isVersionCompatible(currentApiVersion, { min: minApiVersion });

    if (!compatible) {
      return {
        compatible: false,
        currentApiVersion,
        requiredApiVersion: minApiVersion,
        reason: `Plugin requires API version ${minApiVersion} or higher, but current version is ${currentApiVersion}`
      };
    }

    return {
      compatible: true,
      currentApiVersion,
      requiredApiVersion: minApiVersion,
      reason: `Plugin is compatible with current API version ${currentApiVersion}`
    };
  } catch (error: any) {
    // Handle compatibility check errors
    throw new PluginLoaderError(
      `Failed to check version compatibility: ${error.message}`,
      'VERSION_CHECK_FAILED',
      manifest.slug,
      {
        currentApiVersion,
        minApiVersion,
        error: error.message
      }
    );
  }
}

/**
 * Validate plugin compatibility before loading
 * This is the main entry point for version validation
 *
 * @param manifest - Plugin manifest to validate
 * @throws {PluginLoaderError} If plugin is incompatible with current API version
 */
export function validatePluginCompatibility(manifest: PluginManifest): void {
  // Step 1: Validate version format
  validateManifestVersionInfo(manifest);

  // Step 2: Check API version compatibility
  const checkResult = checkPluginApiCompatibility(manifest);

  if (!checkResult.compatible) {
    throw new PluginLoaderError(
      `Plugin "${manifest.slug}" is incompatible with current API version. ${checkResult.reason}`,
      'INCOMPATIBLE_API_VERSION',
      manifest.slug,
      {
        pluginVersion: manifest.version,
        currentApiVersion: checkResult.currentApiVersion,
        requiredApiVersion: checkResult.requiredApiVersion,
        pluginName: manifest.name
      }
    );
  }
}

/**
 * Get plugin compatibility status (non-throwing version)
 * Useful for checking compatibility without throwing errors
 *
 * @param manifest - Plugin manifest to check
 * @returns Version check result with compatibility status
 */
export function getPluginCompatibilityStatus(manifest: PluginManifest): VersionCheckResult {
  try {
    validateManifestVersionInfo(manifest);
    return checkPluginApiCompatibility(manifest);
  } catch (error: any) {
    if (error instanceof PluginLoaderError) {
      return {
        compatible: false,
        currentApiVersion: getCurrentApiVersion(),
        requiredApiVersion: manifest.minApiVersion,
        reason: error.message
      };
    }
    return {
      compatible: false,
      currentApiVersion: getCurrentApiVersion(),
      requiredApiVersion: manifest.minApiVersion,
      reason: `Unexpected error: ${error.message}`
    };
  }
}

/**
 * Get detailed compatibility report for a plugin
 * Returns a human-readable compatibility report
 *
 * @param manifest - Plugin manifest to analyze
 * @returns Compatibility report string
 */
export function getCompatibilityReport(manifest: PluginManifest): string {
  const status = getPluginCompatibilityStatus(manifest);

  let report = `Plugin: ${manifest.name} (${manifest.slug})\n`;
  report += `Version: ${manifest.version}\n`;
  report += `Current API Version: ${status.currentApiVersion}\n`;

  if (manifest.minApiVersion) {
    report += `Required API Version: ${manifest.minApiVersion}\n`;
  } else {
    report += `Required API Version: None specified\n`;
  }

  report += `Compatible: ${status.compatible ? 'Yes' : 'No'}\n`;

  if (status.reason) {
    report += `Details: ${status.reason}\n`;
  }

  return report;
}

/**
 * Check multiple plugins for compatibility
 * Useful for bulk validation operations
 *
 * @param manifests - Array of plugin manifests to check
 * @returns Array of compatibility results
 */
export function checkMultiplePlugins(manifests: PluginManifest[]): Array<{
  slug: string;
  name: string;
  compatible: boolean;
  result: VersionCheckResult;
}> {
  return manifests.map(manifest => ({
    slug: manifest.slug,
    name: manifest.name,
    compatible: getPluginCompatibilityStatus(manifest).compatible,
    result: getPluginCompatibilityStatus(manifest)
  }));
}
