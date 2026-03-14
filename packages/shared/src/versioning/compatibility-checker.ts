import type {
  ApiVersion,
  CompatibilityCheck,
  PluginCompatibility,
  VersionRange,
  VersionMetadata,
} from './types';
import {
  isValidVersion,
  compareVersions,
  isVersionInRange,
  normalizeVersion,
} from './version-parser';
import { isSunset } from './deprecation-tracker';

/**
 * Check if a specific API version is compatible with a version range
 * @param currentVersion - The current API version
 * @param requiredRange - The required version range
 * @returns True if the current version satisfies the range
 * @throws Error if version format is invalid
 * @example
 * isVersionCompatible('v2', { min: 'v1', max: 'v3' }) // returns true
 * isVersionCompatible('v1', { exact: 'v2' }) // returns false
 */
export function isVersionCompatible(
  currentVersion: ApiVersion,
  requiredRange: VersionRange
): boolean {
  if (!isValidVersion(currentVersion)) {
    throw new Error(`Invalid current version format: ${currentVersion}`);
  }

  // Check for exact version match
  if (requiredRange.exact) {
    if (!isValidVersion(requiredRange.exact)) {
      throw new Error(`Invalid exact version format: ${requiredRange.exact}`);
    }
    return compareVersions(currentVersion, requiredRange.exact) === 0;
  }

  // Check for range (min/max)
  const min = requiredRange.min || null;
  const max = requiredRange.max || null;

  if (min && !isValidVersion(min)) {
    throw new Error(`Invalid min version format: ${min}`);
  }

  if (max && !isValidVersion(max)) {
    throw new Error(`Invalid max version format: ${max}`);
  }

  return isVersionInRange(currentVersion, min, max);
}

/**
 * Check plugin compatibility with current API version
 * @param pluginCompat - Plugin compatibility requirements
 * @param currentVersion - Current API version
 * @returns CompatibilityCheck result with detailed information
 * @example
 * checkPluginCompatibility(
 *   { pluginId: 'my-plugin', pluginVersion: '1.0.0', requiredApiVersion: { min: 'v1', max: 'v2' } },
 *   'v2'
 * ) // returns { isCompatible: true, ... }
 */
export function checkPluginCompatibility(
  pluginCompat: PluginCompatibility,
  currentVersion: ApiVersion
): CompatibilityCheck {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Validate current version
  if (!isValidVersion(currentVersion)) {
    errors.push(`Invalid API version format: ${currentVersion}`);
    return {
      isCompatible: false,
      currentVersion,
      requiredVersion: JSON.stringify(pluginCompat.requiredApiVersion),
      message: `Plugin ${pluginCompat.pluginId} cannot be loaded due to invalid API version`,
      warnings,
      errors,
    };
  }

  // Check if required API version is compatible
  try {
    const isCompatible = isVersionCompatible(
      currentVersion,
      pluginCompat.requiredApiVersion
    );

    if (!isCompatible) {
      errors.push(
        `Plugin requires API version ${JSON.stringify(pluginCompat.requiredApiVersion)} but current version is ${currentVersion}`
      );
      return {
        isCompatible: false,
        currentVersion,
        requiredVersion: JSON.stringify(pluginCompat.requiredApiVersion),
        message: `Plugin ${pluginCompat.pluginId} v${pluginCompat.pluginVersion} is not compatible with API ${currentVersion}`,
        warnings,
        errors,
      };
    }

    // Check supportedApiVersions if provided
    if (
      pluginCompat.supportedApiVersions &&
      pluginCompat.supportedApiVersions.length > 0
    ) {
      const isInSupportedList = pluginCompat.supportedApiVersions.some(
        (version) => {
          try {
            return compareVersions(currentVersion, version) === 0;
          } catch {
            return false;
          }
        }
      );

      if (!isInSupportedList) {
        warnings.push(
          `Current version ${currentVersion} is not in the explicitly supported versions list: ${pluginCompat.supportedApiVersions.join(', ')}`
        );
      }
    }

    return {
      isCompatible: true,
      currentVersion,
      requiredVersion: JSON.stringify(pluginCompat.requiredApiVersion),
      message: `Plugin ${pluginCompat.pluginId} v${pluginCompat.pluginVersion} is compatible with API ${currentVersion}`,
      warnings,
      errors,
    };
  } catch (error) {
    errors.push(
      error instanceof Error ? error.message : 'Unknown compatibility error'
    );
    return {
      isCompatible: false,
      currentVersion,
      requiredVersion: JSON.stringify(pluginCompat.requiredApiVersion),
      message: `Error checking compatibility for plugin ${pluginCompat.pluginId}`,
      warnings,
      errors,
    };
  }
}

/**
 * Check if multiple plugins are compatible with the current API version
 * @param plugins - Array of plugin compatibility requirements
 * @param currentVersion - Current API version
 * @returns Array of compatibility check results
 * @example
 * checkMultiplePluginsCompatibility([plugin1, plugin2], 'v2')
 * // returns [{ isCompatible: true, ... }, { isCompatible: false, ... }]
 */
export function checkMultiplePluginsCompatibility(
  plugins: PluginCompatibility[],
  currentVersion: ApiVersion
): CompatibilityCheck[] {
  return plugins.map((plugin) =>
    checkPluginCompatibility(plugin, currentVersion)
  );
}

/**
 * Get compatible plugins from a list
 * @param plugins - Array of plugin compatibility requirements
 * @param currentVersion - Current API version
 * @returns Array of compatible plugins
 * @example
 * getCompatiblePlugins([plugin1, plugin2, plugin3], 'v2')
 * // returns [plugin1, plugin3]
 */
export function getCompatiblePlugins(
  plugins: PluginCompatibility[],
  currentVersion: ApiVersion
): PluginCompatibility[] {
  return plugins.filter((plugin) => {
    const result = checkPluginCompatibility(plugin, currentVersion);
    return result.isCompatible;
  });
}

/**
 * Get incompatible plugins from a list
 * @param plugins - Array of plugin compatibility requirements
 * @param currentVersion - Current API version
 * @returns Array of incompatible plugins with their compatibility check results
 * @example
 * getIncompatiblePlugins([plugin1, plugin2, plugin3], 'v2')
 * // returns [{ plugin: plugin2, check: { isCompatible: false, ... } }]
 */
export function getIncompatiblePlugins(
  plugins: PluginCompatibility[],
  currentVersion: ApiVersion
): Array<{ plugin: PluginCompatibility; check: CompatibilityCheck }> {
  return plugins
    .map((plugin) => ({
      plugin,
      check: checkPluginCompatibility(plugin, currentVersion),
    }))
    .filter((result) => !result.check.isCompatible);
}

/**
 * Check if a version is available and not sunset
 * @param version - The version to check
 * @param versionMetadata - Metadata about the version
 * @param currentDate - The current date to check against (defaults to now)
 * @returns True if the version is available (not sunset)
 * @example
 * isVersionAvailable('v1', versionMetadata, new Date())
 */
export function isVersionAvailable(
  version: ApiVersion,
  versionMetadata: VersionMetadata,
  currentDate: Date = new Date()
): boolean {
  // Check if version is sunset
  if (versionMetadata.status === 'sunset') {
    return false;
  }

  // Check if version has reached sunset date
  if (versionMetadata.deprecationInfo) {
    if (isSunset(versionMetadata.deprecationInfo, currentDate)) {
      return false;
    }
  }

  return true;
}

/**
 * Find the best compatible version for a plugin from available versions
 * @param plugin - Plugin compatibility requirements
 * @param availableVersions - Array of available version metadata
 * @returns The best compatible version, or null if none found
 * @example
 * findBestCompatibleVersion(plugin, [v1Metadata, v2Metadata, v3Metadata])
 * // returns v3Metadata (if compatible and not sunset)
 */
export function findBestCompatibleVersion(
  plugin: PluginCompatibility,
  availableVersions: VersionMetadata[]
): VersionMetadata | null {
  // Filter available (non-sunset) versions
  const activeVersions = availableVersions.filter((versionMeta) =>
    isVersionAvailable(versionMeta.version, versionMeta)
  );

  // Find compatible versions
  const compatibleVersions = activeVersions.filter((versionMeta) => {
    const check = checkPluginCompatibility(plugin, versionMeta.version);
    return check.isCompatible;
  });

  if (compatibleVersions.length === 0) {
    return null;
  }

  // Return the highest compatible version (prefer active over deprecated)
  compatibleVersions.sort((a, b) => {
    // Prefer active versions
    if (a.status === 'active' && b.status !== 'active') return -1;
    if (a.status !== 'active' && b.status === 'active') return 1;

    // Then sort by version number (descending)
    try {
      return compareVersions(b.version, a.version);
    } catch {
      return 0;
    }
  });

  return compatibleVersions[0];
}

/**
 * Generate a compatibility report for a plugin
 * @param plugin - Plugin compatibility requirements
 * @param currentVersion - Current API version
 * @param versionMetadata - Metadata about the current version
 * @returns Human-readable compatibility report
 * @example
 * generateCompatibilityReport(plugin, 'v2', v2Metadata)
 * // returns "Plugin my-plugin v1.0.0 is compatible with API v2 (active)"
 */
export function generateCompatibilityReport(
  plugin: PluginCompatibility,
  currentVersion: ApiVersion,
  versionMetadata?: VersionMetadata
): string {
  const check = checkPluginCompatibility(plugin, currentVersion);

  let report = `Plugin ${plugin.pluginId} v${plugin.pluginVersion}:\n`;
  report += `  Status: ${check.isCompatible ? '✓ Compatible' : '✗ Incompatible'}\n`;
  report += `  Required API: ${JSON.stringify(plugin.requiredApiVersion)}\n`;
  report += `  Current API: ${currentVersion}`;

  if (versionMetadata) {
    report += ` (${versionMetadata.status})`;
  }

  report += '\n';

  if (check.warnings && check.warnings.length > 0) {
    report += `  Warnings:\n`;
    check.warnings.forEach((warning) => {
      report += `    - ${warning}\n`;
    });
  }

  if (check.errors && check.errors.length > 0) {
    report += `  Errors:\n`;
    check.errors.forEach((error) => {
      report += `    - ${error}\n`;
    });
  }

  return report.trim();
}

/**
 * Validate a version range configuration
 * @param range - Version range to validate
 * @returns True if the range is valid
 * @example
 * isValidVersionRange({ min: 'v1', max: 'v3' }) // returns true
 * isValidVersionRange({ min: 'v3', max: 'v1' }) // returns false (min > max)
 */
export function isValidVersionRange(range: VersionRange): boolean {
  try {
    // Validate exact version
    if (range.exact) {
      return isValidVersion(range.exact);
    }

    // Validate min version
    if (range.min && !isValidVersion(range.min)) {
      return false;
    }

    // Validate max version
    if (range.max && !isValidVersion(range.max)) {
      return false;
    }

    // Ensure min <= max
    if (range.min && range.max) {
      return compareVersions(range.min, range.max) <= 0;
    }

    // At least one constraint must be specified
    return !!(range.min || range.max || range.exact);
  } catch {
    return false;
  }
}

/**
 * Create a version range from a string specification
 * @param spec - Version range specification (e.g., "v1", "v1-v3", ">=v2", "<=v3")
 * @returns VersionRange object
 * @throws Error if specification is invalid
 * @example
 * parseVersionRangeSpec('v2') // returns { exact: 'v2' }
 * parseVersionRangeSpec('v1-v3') // returns { min: 'v1', max: 'v3' }
 * parseVersionRangeSpec('>=v2') // returns { min: 'v2' }
 */
export function parseVersionRangeSpec(spec: string): VersionRange {
  const trimmed = spec.trim();

  // Check for range (e.g., "v1-v3")
  const rangeMatch = trimmed.match(/^(v\d+)-(v\d+)$/i);
  if (rangeMatch) {
    const min = normalizeVersion(rangeMatch[1]);
    const max = normalizeVersion(rangeMatch[2]);
    return { min, max };
  }

  // Check for >= operator
  const minMatch = trimmed.match(/^>=?\s*(v\d+)$/i);
  if (minMatch) {
    const min = normalizeVersion(minMatch[1]);
    return { min };
  }

  // Check for <= operator
  const maxMatch = trimmed.match(/^<=?\s*(v\d+)$/i);
  if (maxMatch) {
    const max = normalizeVersion(maxMatch[1]);
    return { max };
  }

  // Check for exact version (e.g., "v2")
  if (isValidVersion(trimmed)) {
    return { exact: normalizeVersion(trimmed) };
  }

  throw new Error(`Invalid version range specification: ${spec}`);
}
