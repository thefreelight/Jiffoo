/**
 * Jiffoo Plugin SDK - Version Checker
 *
 * Version compatibility checking utilities for plugins.
 * Validates plugin compatibility with platform API versions.
 */

import type {
  PluginManifest,
  VersionCompatibilityResult,
  VersionRequirement,
  PlatformHeaders
} from './types';

// SDK version constants (defined here to avoid circular dependency with index)
const SDK_VERSION = '1.0.0';
const PLATFORM_COMPATIBILITY = '>=0.2.0';

/**
 * Parse semantic version string (e.g., "1.0.0" or "v1.0.0")
 */
function parseSemVer(version: string): { major: number; minor: number; patch: number } | null {
  const normalized = version.startsWith('v') ? version.slice(1) : version;
  const match = normalized.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * Compare two semantic versions
 * @returns -1 if a < b, 0 if a === b, 1 if a > b
 */
function compareSemVer(a: string, b: string): -1 | 0 | 1 {
  const aParsed = parseSemVer(a);
  const bParsed = parseSemVer(b);

  if (!aParsed || !bParsed) {
    throw new Error(`Invalid version format: ${!aParsed ? a : b}`);
  }

  if (aParsed.major !== bParsed.major) {
    return aParsed.major > bParsed.major ? 1 : -1;
  }
  if (aParsed.minor !== bParsed.minor) {
    return aParsed.minor > bParsed.minor ? 1 : -1;
  }
  if (aParsed.patch !== bParsed.patch) {
    return aParsed.patch > bParsed.patch ? 1 : -1;
  }
  return 0;
}

/**
 * Check if a version satisfies a requirement
 * @param version - Version to check (e.g., "1.0.0")
 * @param requirement - Version requirement (e.g., ">=1.0.0", "1.0.0", "^1.0.0")
 * @returns True if version satisfies requirement
 */
export function satisfiesVersion(version: string, requirement: string): boolean {
  const normalized = version.startsWith('v') ? version.slice(1) : version;
  const reqMatch = requirement.match(/^(>=|>|<=|<|=|\^|~)?(.+)$/);

  if (!reqMatch) {
    throw new Error(`Invalid version requirement: ${requirement}`);
  }

  const operator = reqMatch[1] || '=';
  const targetVersion = reqMatch[2].startsWith('v') ? reqMatch[2].slice(1) : reqMatch[2];

  try {
    const comparison = compareSemVer(normalized, targetVersion);

    switch (operator) {
      case '>=':
        return comparison >= 0;
      case '>':
        return comparison > 0;
      case '<=':
        return comparison <= 0;
      case '<':
        return comparison < 0;
      case '=':
        return comparison === 0;
      case '^': {
        // Caret range: compatible with version (same major)
        const current = parseSemVer(normalized)!;
        const target = parseSemVer(targetVersion)!;
        return current.major === target.major && comparison >= 0;
      }
      case '~': {
        // Tilde range: compatible with version (same major.minor)
        const current = parseSemVer(normalized)!;
        const target = parseSemVer(targetVersion)!;
        return (
          current.major === target.major &&
          current.minor === target.minor &&
          comparison >= 0
        );
      }
      default:
        return false;
    }
  } catch (error) {
    throw new Error(
      `Error comparing versions: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Check if plugin is compatible with platform version
 * @param pluginManifest - Plugin manifest with version requirements
 * @param platformVersion - Platform API version (e.g., "0.2.0")
 * @returns Compatibility check result
 */
export function checkPluginCompatibility(
  pluginManifest: PluginManifest,
  platformVersion: string
): VersionCompatibilityResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  // Check if plugin has version requirements
  const requirement = pluginManifest.requiredApiVersion as VersionRequirement | undefined;

  if (!requirement) {
    warnings.push('Plugin does not specify required API version. Compatibility cannot be guaranteed.');
    return {
      compatible: true,
      pluginVersion: pluginManifest.version,
      platformVersion,
      sdkVersion: SDK_VERSION,
      warnings,
      errors,
      message: 'Plugin compatibility check passed with warnings'
    };
  }

  try {
    // Validate platform version format
    if (!parseSemVer(platformVersion)) {
      errors.push(`Invalid platform version format: ${platformVersion}`);
      return {
        compatible: false,
        pluginVersion: pluginManifest.version,
        platformVersion,
        sdkVersion: SDK_VERSION,
        warnings,
        errors,
        message: 'Invalid platform version format'
      };
    }

    // Check exact version match
    if (requirement.exact) {
      const matches = compareSemVer(platformVersion, requirement.exact) === 0;
      if (!matches) {
        errors.push(
          `Plugin requires exact platform version ${requirement.exact}, but current version is ${platformVersion}`
        );
        return {
          compatible: false,
          pluginVersion: pluginManifest.version,
          platformVersion,
          sdkVersion: SDK_VERSION,
          warnings,
          errors,
          message: `Platform version ${platformVersion} does not match required version ${requirement.exact}`
        };
      }
    }

    // Check minimum version
    if (requirement.min) {
      const meetsMin = compareSemVer(platformVersion, requirement.min) >= 0;
      if (!meetsMin) {
        errors.push(
          `Plugin requires minimum platform version ${requirement.min}, but current version is ${platformVersion}`
        );
        return {
          compatible: false,
          pluginVersion: pluginManifest.version,
          platformVersion,
          sdkVersion: SDK_VERSION,
          warnings,
          errors,
          message: `Platform version ${platformVersion} is below minimum required version ${requirement.min}`
        };
      }
    }

    // Check maximum version
    if (requirement.max) {
      const meetsMax = compareSemVer(platformVersion, requirement.max) <= 0;
      if (!meetsMax) {
        errors.push(
          `Plugin exceeds maximum required version ${requirement.max}; current platform version is ${platformVersion}`
        );
        return {
          compatible: false,
          pluginVersion: pluginManifest.version,
          platformVersion,
          sdkVersion: SDK_VERSION,
          warnings,
          errors,
          message: `Platform version ${platformVersion} exceeds maximum required version ${requirement.max}`
        };
      }
    }

    // Check if plugin was built with a compatible SDK version
    const pluginSdkVersion = pluginManifest.sdkVersion;
    if (pluginSdkVersion) {
      try {
        const comparison = compareSemVer(pluginSdkVersion, SDK_VERSION);
        if (comparison > 0) {
          warnings.push(
            `Plugin was built with SDK version ${pluginSdkVersion}, which is newer than current SDK version ${SDK_VERSION}. Some features may not be available.`
          );
        } else if (comparison < 0) {
          const sdkParsed = parseSemVer(SDK_VERSION)!;
          const pluginSdkParsed = parseSemVer(pluginSdkVersion)!;

          // Warn if plugin SDK is more than 1 major version behind
          if (sdkParsed.major - pluginSdkParsed.major >= 1) {
            warnings.push(
              `Plugin was built with SDK version ${pluginSdkVersion}, which is significantly older than current SDK version ${SDK_VERSION}. Consider rebuilding with latest SDK.`
            );
          }
        }
      } catch {
        warnings.push(`Invalid SDK version format in plugin manifest: ${pluginSdkVersion}`);
      }
    }

    return {
      compatible: true,
      pluginVersion: pluginManifest.version,
      platformVersion,
      sdkVersion: SDK_VERSION,
      warnings,
      errors,
      message: `Plugin ${pluginManifest.slug} v${pluginManifest.version} is compatible with platform version ${platformVersion}`
    };
  } catch (error) {
    errors.push(
      `Error checking compatibility: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    return {
      compatible: false,
      pluginVersion: pluginManifest.version,
      platformVersion,
      sdkVersion: SDK_VERSION,
      warnings,
      errors,
      message: 'Compatibility check failed due to error'
    };
  }
}

/**
 * Extract platform version from request headers
 * @param headers - Platform headers from request
 * @returns Platform version string or null if not found
 */
export function getPlatformVersion(headers: PlatformHeaders | Record<string, string | string[] | undefined>): string | null {
  const versionHeader = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === 'x-platform-version'
  )?.[1];

  if (!versionHeader) {
    return null;
  }

  // Handle array of headers (shouldn't happen but be safe)
  if (Array.isArray(versionHeader)) {
    return versionHeader[0] || null;
  }

  return versionHeader;
}

/**
 * Check if current plugin is compatible with platform from request
 * @param pluginManifest - Plugin manifest with version requirements
 * @param headers - Platform headers from request
 * @returns Compatibility check result
 */
export function checkRequestCompatibility(
  pluginManifest: PluginManifest,
  headers: PlatformHeaders | Record<string, string | string[] | undefined>
): VersionCompatibilityResult {
  const platformVersion = getPlatformVersion(headers);

  if (!platformVersion) {
    return {
      compatible: false,
      pluginVersion: pluginManifest.version,
      platformVersion: 'unknown',
      sdkVersion: SDK_VERSION,
      warnings: [],
      errors: ['Platform version not found in request headers'],
      message: 'Cannot verify compatibility: platform version missing from request'
    };
  }

  return checkPluginCompatibility(pluginManifest, platformVersion);
}

/**
 * Validate plugin manifest version requirements
 * @param requirement - Version requirement to validate
 * @returns True if requirement is valid
 */
export function isValidVersionRequirement(requirement: VersionRequirement): boolean {
  try {
    // Check exact version
    if (requirement.exact) {
      if (!parseSemVer(requirement.exact)) {
        return false;
      }
    }

    // Check min version
    if (requirement.min) {
      if (!parseSemVer(requirement.min)) {
        return false;
      }
    }

    // Check max version
    if (requirement.max) {
      if (!parseSemVer(requirement.max)) {
        return false;
      }
    }

    // Ensure min <= max if both specified
    if (requirement.min && requirement.max) {
      return compareSemVer(requirement.min, requirement.max) <= 0;
    }

    // At least one constraint must be specified
    return !!(requirement.exact || requirement.min || requirement.max);
  } catch {
    return false;
  }
}

/**
 * Get SDK version
 * @returns Current SDK version
 */
export function getSdkVersion(): string {
  return SDK_VERSION;
}

/**
 * Get platform compatibility requirement
 * @returns Platform compatibility requirement string
 */
export function getPlatformCompatibility(): string {
  return PLATFORM_COMPATIBILITY;
}

/**
 * Check if current SDK is compatible with a platform version
 * @param platformVersion - Platform version to check
 * @returns True if SDK is compatible with platform version
 */
export function isSdkCompatibleWithPlatform(platformVersion: string): boolean {
  try {
    return satisfiesVersion(platformVersion, PLATFORM_COMPATIBILITY);
  } catch {
    return false;
  }
}
