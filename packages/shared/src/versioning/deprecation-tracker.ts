import type { ApiVersion, DeprecationInfo, VersionMetadata } from './types';
import { compareVersions, isVersionGreaterThan } from './version-parser';

/**
 * Default sunset period in days (6 months)
 */
const DEFAULT_SUNSET_PERIOD_DAYS = 180;

/**
 * Calculate sunset date based on deprecation date and period
 * @param deprecatedAt - The deprecation date (ISO 8601 string)
 * @param sunsetPeriodDays - Number of days until sunset (default: 180 days / 6 months)
 * @returns The calculated sunset date as ISO 8601 string
 * @example
 * calculateSunsetDate('2024-01-01') // returns '2024-06-29' (180 days later)
 * calculateSunsetDate('2024-01-01', 90) // returns '2024-03-31' (90 days later)
 */
export function calculateSunsetDate(
  deprecatedAt: string,
  sunsetPeriodDays: number = DEFAULT_SUNSET_PERIOD_DAYS
): string {
  const deprecationDate = new Date(deprecatedAt);
  const sunsetDate = new Date(deprecationDate);
  sunsetDate.setDate(sunsetDate.getDate() + sunsetPeriodDays);
  return sunsetDate.toISOString().split('T')[0];
}

/**
 * Check if a version or endpoint is currently deprecated
 * @param deprecationInfo - The deprecation information to check
 * @returns True if deprecated, false otherwise
 * @example
 * isDeprecated({ isDeprecated: true }) // returns true
 * isDeprecated({ isDeprecated: false }) // returns false
 */
export function isDeprecated(deprecationInfo: DeprecationInfo): boolean {
  return deprecationInfo.isDeprecated;
}

/**
 * Check if a deprecated version or endpoint has reached its sunset date
 * @param deprecationInfo - The deprecation information to check
 * @param currentDate - The current date to compare against (defaults to now)
 * @returns True if sunset date has passed, false otherwise
 * @example
 * isSunset({ isDeprecated: true, sunsetDate: '2023-01-01' }, new Date('2024-01-01')) // returns true
 * isSunset({ isDeprecated: true, sunsetDate: '2025-01-01' }, new Date('2024-01-01')) // returns false
 */
export function isSunset(
  deprecationInfo: DeprecationInfo,
  currentDate: Date = new Date()
): boolean {
  if (!deprecationInfo.isDeprecated || !deprecationInfo.sunsetDate) {
    return false;
  }

  const sunsetDate = new Date(deprecationInfo.sunsetDate);
  return currentDate >= sunsetDate;
}

/**
 * Get days remaining until sunset
 * @param deprecationInfo - The deprecation information
 * @param currentDate - The current date to compare against (defaults to now)
 * @returns Number of days until sunset, or null if not deprecated or no sunset date
 * @example
 * getDaysUntilSunset({ isDeprecated: true, sunsetDate: '2024-12-31' }, new Date('2024-12-01')) // returns 30
 */
export function getDaysUntilSunset(
  deprecationInfo: DeprecationInfo,
  currentDate: Date = new Date()
): number | null {
  if (!deprecationInfo.isDeprecated || !deprecationInfo.sunsetDate) {
    return null;
  }

  const sunsetDate = new Date(deprecationInfo.sunsetDate);
  const timeDiff = sunsetDate.getTime() - currentDate.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

  return daysDiff;
}

/**
 * Create a deprecation info object
 * @param options - Deprecation configuration options
 * @returns A complete DeprecationInfo object
 * @example
 * createDeprecationInfo({
 *   deprecatedAt: '2024-01-01',
 *   reason: 'Use v2 API instead',
 *   replacementEndpoint: '/api/v2/users'
 * })
 */
export function createDeprecationInfo(options: {
  deprecatedAt: string;
  sunsetPeriodDays?: number;
  reason?: string;
  replacementEndpoint?: string;
  migrationGuide?: string;
}): DeprecationInfo {
  const sunsetDate = calculateSunsetDate(
    options.deprecatedAt,
    options.sunsetPeriodDays
  );

  return {
    isDeprecated: true,
    deprecatedAt: options.deprecatedAt,
    sunsetDate,
    reason: options.reason,
    replacementEndpoint: options.replacementEndpoint,
    migrationGuide: options.migrationGuide,
  };
}

/**
 * Generate a deprecation warning message
 * @param version - The deprecated version
 * @param deprecationInfo - The deprecation information
 * @returns A formatted deprecation warning message
 * @example
 * generateDeprecationWarning('v1', {
 *   isDeprecated: true,
 *   sunsetDate: '2024-12-31',
 *   replacementEndpoint: '/api/v2/users'
 * })
 * // returns: "API version v1 is deprecated and will be sunset on 2024-12-31. Please migrate to /api/v2/users."
 */
export function generateDeprecationWarning(
  version: ApiVersion,
  deprecationInfo: DeprecationInfo
): string {
  if (!deprecationInfo.isDeprecated) {
    return '';
  }

  let message = `API version ${version} is deprecated`;

  if (deprecationInfo.sunsetDate) {
    message += ` and will be sunset on ${deprecationInfo.sunsetDate}`;
  }

  message += '.';

  if (deprecationInfo.replacementEndpoint) {
    message += ` Please migrate to ${deprecationInfo.replacementEndpoint}.`;
  } else if (deprecationInfo.reason) {
    message += ` ${deprecationInfo.reason}`;
  }

  if (deprecationInfo.migrationGuide) {
    message += ` See migration guide: ${deprecationInfo.migrationGuide}`;
  }

  return message;
}

/**
 * Check if a version should show deprecation warnings based on another version
 * Typically, a version is deprecated when it's 2 versions behind the latest
 * @param version - The version to check
 * @param latestVersion - The current latest version
 * @param deprecationThreshold - Number of versions behind before deprecation (default: 2)
 * @returns True if the version should be marked as deprecated
 * @example
 * shouldDeprecateVersion('v1', 'v3', 2) // returns true (v1 is 2 versions behind v3)
 * shouldDeprecateVersion('v2', 'v3', 2) // returns false (v2 is only 1 version behind)
 */
export function shouldDeprecateVersion(
  version: ApiVersion,
  latestVersion: ApiVersion,
  deprecationThreshold: number = 2
): boolean {
  try {
    const comparison = compareVersions(version, latestVersion);

    // If version is greater than or equal to latest, it's not deprecated
    if (comparison >= 0) {
      return false;
    }

    // Check if version is at least deprecationThreshold versions behind
    const versionNum = parseInt(version.replace(/^v/i, ''), 10);
    const latestNum = parseInt(latestVersion.replace(/^v/i, ''), 10);

    return (latestNum - versionNum) >= deprecationThreshold;
  } catch (error) {
    // If comparison fails, assume not deprecated
    return false;
  }
}

/**
 * Filter deprecated versions from a list of version metadata
 * @param versions - Array of version metadata objects
 * @param currentDate - The current date to check against (defaults to now)
 * @returns Array of deprecated version metadata
 * @example
 * const versions = [
 *   { version: 'v1', status: 'deprecated', deprecationInfo: {...} },
 *   { version: 'v2', status: 'active' }
 * ];
 * filterDeprecatedVersions(versions) // returns [{ version: 'v1', ... }]
 */
export function filterDeprecatedVersions(
  versions: VersionMetadata[],
  currentDate: Date = new Date()
): VersionMetadata[] {
  return versions.filter((versionMeta) => {
    if (versionMeta.status === 'deprecated') {
      return true;
    }

    if (versionMeta.deprecationInfo?.isDeprecated) {
      return true;
    }

    return false;
  });
}

/**
 * Get active (non-deprecated, non-sunset) versions from metadata
 * @param versions - Array of version metadata objects
 * @param currentDate - The current date to check against (defaults to now)
 * @returns Array of active version metadata
 * @example
 * const versions = [
 *   { version: 'v1', status: 'deprecated', deprecationInfo: {...} },
 *   { version: 'v2', status: 'active' }
 * ];
 * getActiveVersions(versions) // returns [{ version: 'v2', ... }]
 */
export function getActiveVersions(
  versions: VersionMetadata[],
  currentDate: Date = new Date()
): VersionMetadata[] {
  return versions.filter((versionMeta) => {
    // Exclude sunset versions
    if (versionMeta.status === 'sunset') {
      return false;
    }

    // Exclude versions that have reached sunset date
    if (
      versionMeta.deprecationInfo &&
      isSunset(versionMeta.deprecationInfo, currentDate)
    ) {
      return false;
    }

    return true;
  });
}

/**
 * Create deprecation headers for HTTP responses
 * @param version - The API version
 * @param deprecationInfo - The deprecation information
 * @returns Object containing deprecation headers
 * @example
 * createDeprecationHeaders('v1', {
 *   isDeprecated: true,
 *   sunsetDate: '2024-12-31',
 *   migrationGuide: 'https://docs.example.com/migrate-v2'
 * })
 * // returns:
 * // {
 * //   'X-API-Deprecated': 'true',
 * //   'X-API-Sunset-Date': '2024-12-31',
 * //   'X-Migration-Guide': 'https://docs.example.com/migrate-v2'
 * // }
 */
export function createDeprecationHeaders(
  version: ApiVersion,
  deprecationInfo: DeprecationInfo
): Record<string, string> {
  if (!deprecationInfo.isDeprecated) {
    return {};
  }

  const headers: Record<string, string> = {
    'X-API-Deprecated': 'true',
  };

  if (deprecationInfo.sunsetDate) {
    headers['X-API-Sunset-Date'] = deprecationInfo.sunsetDate;
  }

  if (deprecationInfo.migrationGuide) {
    headers['X-Migration-Guide'] = deprecationInfo.migrationGuide;
  }

  if (deprecationInfo.deprecatedAt) {
    headers['X-API-Deprecated-At'] = deprecationInfo.deprecatedAt;
  }

  return headers;
}

/**
 * Sort versions by deprecation status and version number
 * Active versions come first, then deprecated, then sunset
 * Within each group, versions are sorted by version number
 * @param versions - Array of version metadata to sort
 * @returns Sorted array of version metadata
 * @example
 * sortByDeprecationStatus([
 *   { version: 'v1', status: 'sunset' },
 *   { version: 'v3', status: 'active' },
 *   { version: 'v2', status: 'deprecated' }
 * ])
 * // returns: [v3 (active), v2 (deprecated), v1 (sunset)]
 */
export function sortByDeprecationStatus(
  versions: VersionMetadata[]
): VersionMetadata[] {
  const statusPriority = {
    active: 0,
    deprecated: 1,
    sunset: 2,
  };

  return [...versions].sort((a, b) => {
    // First sort by status
    const statusDiff = statusPriority[a.status] - statusPriority[b.status];
    if (statusDiff !== 0) {
      return statusDiff;
    }

    // Then sort by version number (descending - newer first)
    try {
      return compareVersions(b.version, a.version);
    } catch {
      return 0;
    }
  });
}
