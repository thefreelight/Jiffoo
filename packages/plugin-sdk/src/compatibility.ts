/**
 * Jiffoo Plugin SDK - Compatibility Matrix
 *
 * Defines compatibility between SDK versions and Platform API versions.
 * This matrix helps plugin developers understand which SDK version to use
 * for a given platform version.
 */

// SDK version constant (defined here to avoid circular dependency with index)
const SDK_VERSION = '1.0.0';

/**
 * SDK to Platform API compatibility matrix entry
 */
export interface CompatibilityMatrixEntry {
  /** SDK version */
  sdkVersion: string;
  /** Minimum supported platform version */
  minPlatformVersion: string;
  /** Maximum supported platform version (optional) */
  maxPlatformVersion?: string;
  /** Release date of this SDK version */
  releaseDate: string;
  /** Status: stable, deprecated, or sunset */
  status: 'stable' | 'deprecated' | 'sunset';
  /** Date when this version was deprecated (if applicable) */
  deprecatedDate?: string;
  /** Date when this version will be sunset (if applicable) */
  sunsetDate?: string;
  /** Migration notes for deprecated versions */
  migrationNotes?: string;
  /** Known compatibility issues or warnings */
  warnings?: string[];
}

/**
 * Platform API to SDK compatibility matrix
 * Maps platform versions to compatible SDK versions
 */
export interface PlatformCompatibilityEntry {
  /** Platform API version */
  platformVersion: string;
  /** Compatible SDK versions (in order of recommendation) */
  compatibleSdkVersions: string[];
  /** Recommended SDK version for this platform version */
  recommendedSdkVersion: string;
  /** Status of this platform version */
  status: 'active' | 'deprecated' | 'sunset';
}

/**
 * SDK version compatibility matrix
 * This defines which platform API versions each SDK version supports
 */
export const SDK_COMPATIBILITY_MATRIX: CompatibilityMatrixEntry[] = [
  {
    sdkVersion: '1.0.0',
    minPlatformVersion: '0.2.0',
    releaseDate: '2024-01-15',
    status: 'stable',
    warnings: [
      'Initial stable release',
      'Supports platform versioning and compatibility checking'
    ]
  },
  {
    sdkVersion: '0.9.0',
    minPlatformVersion: '0.1.0',
    maxPlatformVersion: '0.2.0',
    releaseDate: '2023-12-01',
    status: 'deprecated',
    deprecatedDate: '2024-01-15',
    sunsetDate: '2024-07-15',
    migrationNotes: 'Upgrade to SDK 1.0.0 for latest features and platform compatibility',
    warnings: [
      'Deprecated: Use SDK 1.0.0 or later',
      'Limited support for new platform features'
    ]
  }
];

/**
 * Platform API version compatibility matrix
 * This defines which SDK versions work with each platform API version
 */
export const PLATFORM_COMPATIBILITY_MATRIX: PlatformCompatibilityEntry[] = [
  {
    platformVersion: '0.2.0',
    compatibleSdkVersions: ['1.0.0'],
    recommendedSdkVersion: '1.0.0',
    status: 'active'
  },
  {
    platformVersion: '0.1.0',
    compatibleSdkVersions: ['0.9.0', '1.0.0'],
    recommendedSdkVersion: '1.0.0',
    status: 'deprecated'
  }
];

/**
 * Get compatibility information for a specific SDK version
 * @param sdkVersion - SDK version to look up
 * @returns Compatibility matrix entry or null if not found
 */
export function getSdkCompatibility(sdkVersion: string): CompatibilityMatrixEntry | null {
  return SDK_COMPATIBILITY_MATRIX.find(entry => entry.sdkVersion === sdkVersion) || null;
}

/**
 * Get compatibility information for current SDK version
 * @returns Compatibility matrix entry for current SDK
 */
export function getCurrentSdkCompatibility(): CompatibilityMatrixEntry {
  const entry = getSdkCompatibility(SDK_VERSION);
  if (!entry) {
    // Fallback for current SDK if not in matrix (shouldn't happen)
    return {
      sdkVersion: SDK_VERSION,
      minPlatformVersion: '0.2.0',
      releaseDate: new Date().toISOString().split('T')[0],
      status: 'stable'
    };
  }
  return entry;
}

/**
 * Get compatible SDK versions for a platform version
 * @param platformVersion - Platform API version
 * @returns Array of compatible SDK versions (ordered by recommendation)
 */
export function getCompatibleSdkVersions(platformVersion: string): string[] {
  const entry = PLATFORM_COMPATIBILITY_MATRIX.find(
    e => e.platformVersion === platformVersion
  );
  return entry ? entry.compatibleSdkVersions : [];
}

/**
 * Get recommended SDK version for a platform version
 * @param platformVersion - Platform API version
 * @returns Recommended SDK version or null if not found
 */
export function getRecommendedSdkVersion(platformVersion: string): string | null {
  const entry = PLATFORM_COMPATIBILITY_MATRIX.find(
    e => e.platformVersion === platformVersion
  );
  return entry ? entry.recommendedSdkVersion : null;
}

/**
 * Check if SDK version is deprecated
 * @param sdkVersion - SDK version to check
 * @returns True if SDK version is deprecated or sunset
 */
export function isSdkDeprecated(sdkVersion: string): boolean {
  const entry = getSdkCompatibility(sdkVersion);
  return entry ? entry.status === 'deprecated' || entry.status === 'sunset' : false;
}

/**
 * Check if SDK version has reached sunset date
 * @param sdkVersion - SDK version to check
 * @param currentDate - Current date (defaults to now)
 * @returns True if SDK version has reached sunset date
 */
export function isSdkSunset(sdkVersion: string, currentDate: Date = new Date()): boolean {
  const entry = getSdkCompatibility(sdkVersion);
  if (!entry) {
    return false;
  }

  if (entry.sunsetDate) {
    return currentDate >= new Date(entry.sunsetDate);
  }

  return entry.status === 'sunset';
}

/**
 * Get all active (non-deprecated, non-sunset) SDK versions
 * @returns Array of active SDK versions
 */
export function getActiveSdkVersions(): string[] {
  return SDK_COMPATIBILITY_MATRIX
    .filter(entry => entry.status === 'stable')
    .map(entry => entry.sdkVersion);
}

/**
 * Get all supported platform versions for a SDK version
 * @param sdkVersion - SDK version to check
 * @returns Array of platform versions (range: [min, max])
 */
export function getSupportedPlatformVersions(sdkVersion: string): { min: string; max?: string } | null {
  const entry = getSdkCompatibility(sdkVersion);
  if (!entry) {
    return null;
  }

  return {
    min: entry.minPlatformVersion,
    max: entry.maxPlatformVersion
  };
}

/**
 * Check if current SDK is the latest stable version
 * @returns True if current SDK is the latest stable version
 */
export function isLatestSdk(): boolean {
  const activeVersions = getActiveSdkVersions();
  if (activeVersions.length === 0) {
    return true; // No active versions in matrix, assume current is latest
  }

  // Sort versions and check if current SDK is the highest
  const sortedVersions = activeVersions.sort((a, b) => {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
      if (aParts[i] !== bParts[i]) {
        return bParts[i] - aParts[i]; // Descending order
      }
    }
    return 0;
  });

  return sortedVersions[0] === SDK_VERSION;
}

/**
 * Get deprecation warnings for a SDK version
 * @param sdkVersion - SDK version to check
 * @returns Array of warning messages
 */
export function getSdkWarnings(sdkVersion: string): string[] {
  const entry = getSdkCompatibility(sdkVersion);
  if (!entry) {
    return [`Unknown SDK version: ${sdkVersion}`];
  }

  const warnings: string[] = [];

  // Add status warnings
  if (entry.status === 'deprecated') {
    warnings.push(`SDK ${sdkVersion} is deprecated`);
    if (entry.deprecatedDate) {
      warnings.push(`Deprecated since: ${entry.deprecatedDate}`);
    }
    if (entry.sunsetDate) {
      warnings.push(`Will be sunset on: ${entry.sunsetDate}`);
    }
    if (entry.migrationNotes) {
      warnings.push(`Migration: ${entry.migrationNotes}`);
    }
  }

  if (entry.status === 'sunset') {
    warnings.push(`SDK ${sdkVersion} has reached sunset and is no longer supported`);
  }

  // Add specific warnings from matrix
  if (entry.warnings) {
    warnings.push(...entry.warnings);
  }

  return warnings;
}

/**
 * Generate compatibility report for current SDK and platform version
 * @param platformVersion - Platform version to check against
 * @returns Human-readable compatibility report
 */
export function generateCompatibilityReport(platformVersion: string): string {
  const sdkEntry = getCurrentSdkCompatibility();
  const platformEntry = PLATFORM_COMPATIBILITY_MATRIX.find(
    e => e.platformVersion === platformVersion
  );

  let report = `SDK Version Compatibility Report\n`;
  report += `=================================\n\n`;
  report += `Current SDK: ${SDK_VERSION} (${sdkEntry.status})\n`;
  report += `Platform Version: ${platformVersion}\n\n`;

  // Check if platform version is in compatibility matrix
  if (platformEntry) {
    report += `Platform Status: ${platformEntry.status}\n`;
    report += `Compatible SDK Versions: ${platformEntry.compatibleSdkVersions.join(', ')}\n`;
    report += `Recommended SDK: ${platformEntry.recommendedSdkVersion}\n\n`;

    const isCompatible = platformEntry.compatibleSdkVersions.includes(SDK_VERSION);
    const isRecommended = platformEntry.recommendedSdkVersion === SDK_VERSION;

    if (isCompatible) {
      report += `✓ Current SDK ${SDK_VERSION} is compatible with platform ${platformVersion}\n`;
      if (isRecommended) {
        report += `✓ Current SDK is the recommended version for this platform\n`;
      } else {
        report += `! Consider upgrading to SDK ${platformEntry.recommendedSdkVersion} (recommended)\n`;
      }
    } else {
      report += `✗ Current SDK ${SDK_VERSION} is NOT compatible with platform ${platformVersion}\n`;
      report += `! Please use SDK ${platformEntry.recommendedSdkVersion}\n`;
    }
  } else {
    report += `! Platform version ${platformVersion} not found in compatibility matrix\n`;
    report += `SDK supports: ${sdkEntry.minPlatformVersion}`;
    if (sdkEntry.maxPlatformVersion) {
      report += ` - ${sdkEntry.maxPlatformVersion}`;
    } else {
      report += ' and above';
    }
    report += '\n';
  }

  // Add warnings
  const warnings = getSdkWarnings(SDK_VERSION);
  if (warnings.length > 0) {
    report += `\nWarnings:\n`;
    warnings.forEach(warning => {
      report += `  - ${warning}\n`;
    });
  }

  return report;
}
