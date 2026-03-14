import type { ApiVersion, VersionComparison } from './types';

/**
 * Regular expression to validate API version format (e.g., "v1", "v2", "v10")
 */
const VERSION_REGEX = /^v(\d+)$/i;

/**
 * Parse a version string and extract the version number
 * @param version - The version string to parse (e.g., "v1", "v2")
 * @returns The numeric version number, or null if invalid
 * @example
 * parseVersionNumber('v1') // returns 1
 * parseVersionNumber('v10') // returns 10
 * parseVersionNumber('invalid') // returns null
 */
export function parseVersionNumber(version: ApiVersion): number | null {
  const match = version.match(VERSION_REGEX);
  if (!match || !match[1]) {
    return null;
  }
  return parseInt(match[1], 10);
}

/**
 * Validate if a string is a valid API version format
 * @param version - The version string to validate
 * @returns True if the version is valid, false otherwise
 * @example
 * isValidVersion('v1') // returns true
 * isValidVersion('v99') // returns true
 * isValidVersion('1') // returns false
 * isValidVersion('version1') // returns false
 */
export function isValidVersion(version: string): boolean {
  return VERSION_REGEX.test(version);
}

/**
 * Compare two API versions
 * @param version1 - The first version to compare
 * @param version2 - The second version to compare
 * @returns -1 if version1 < version2, 0 if equal, 1 if version1 > version2
 * @throws Error if either version is invalid
 * @example
 * compareVersions('v1', 'v2') // returns -1
 * compareVersions('v2', 'v1') // returns 1
 * compareVersions('v1', 'v1') // returns 0
 */
export function compareVersions(
  version1: ApiVersion,
  version2: ApiVersion
): VersionComparison {
  const num1 = parseVersionNumber(version1);
  const num2 = parseVersionNumber(version2);

  if (num1 === null) {
    throw new Error(`Invalid version format: ${version1}`);
  }

  if (num2 === null) {
    throw new Error(`Invalid version format: ${version2}`);
  }

  if (num1 < num2) return -1;
  if (num1 > num2) return 1;
  return 0;
}

/**
 * Check if version1 is greater than version2
 * @param version1 - The first version
 * @param version2 - The second version
 * @returns True if version1 is greater than version2
 * @example
 * isVersionGreaterThan('v2', 'v1') // returns true
 * isVersionGreaterThan('v1', 'v2') // returns false
 */
export function isVersionGreaterThan(
  version1: ApiVersion,
  version2: ApiVersion
): boolean {
  return compareVersions(version1, version2) === 1;
}

/**
 * Check if version1 is less than version2
 * @param version1 - The first version
 * @param version2 - The second version
 * @returns True if version1 is less than version2
 * @example
 * isVersionLessThan('v1', 'v2') // returns true
 * isVersionLessThan('v2', 'v1') // returns false
 */
export function isVersionLessThan(
  version1: ApiVersion,
  version2: ApiVersion
): boolean {
  return compareVersions(version1, version2) === -1;
}

/**
 * Check if two versions are equal
 * @param version1 - The first version
 * @param version2 - The second version
 * @returns True if versions are equal
 * @example
 * isVersionEqual('v1', 'v1') // returns true
 * isVersionEqual('v1', 'v2') // returns false
 */
export function isVersionEqual(
  version1: ApiVersion,
  version2: ApiVersion
): boolean {
  return compareVersions(version1, version2) === 0;
}

/**
 * Normalize a version string to lowercase with 'v' prefix
 * @param version - The version string to normalize
 * @returns The normalized version string
 * @throws Error if the version format is invalid
 * @example
 * normalizeVersion('V1') // returns 'v1'
 * normalizeVersion('v2') // returns 'v2'
 * normalizeVersion('1') // throws Error
 */
export function normalizeVersion(version: string): ApiVersion {
  const normalized = version.toLowerCase();
  if (!isValidVersion(normalized)) {
    throw new Error(`Invalid version format: ${version}`);
  }
  return normalized;
}

/**
 * Extract version from a URL path
 * @param path - The URL path containing the version (e.g., "/api/v1/products")
 * @returns The extracted version string, or null if no version found
 * @example
 * extractVersionFromPath('/api/v1/products') // returns 'v1'
 * extractVersionFromPath('/v2/users') // returns 'v2'
 * extractVersionFromPath('/api/products') // returns null
 */
export function extractVersionFromPath(path: string): ApiVersion | null {
  const versionMatch = path.match(/\/v(\d+)\//i);
  if (!versionMatch) {
    return null;
  }
  return normalizeVersion(`v${versionMatch[1]}`);
}

/**
 * Get the next version
 * @param version - The current version
 * @returns The next version
 * @throws Error if the version format is invalid
 * @example
 * getNextVersion('v1') // returns 'v2'
 * getNextVersion('v5') // returns 'v6'
 */
export function getNextVersion(version: ApiVersion): ApiVersion {
  const num = parseVersionNumber(version);
  if (num === null) {
    throw new Error(`Invalid version format: ${version}`);
  }
  return `v${num + 1}`;
}

/**
 * Get the previous version
 * @param version - The current version
 * @returns The previous version
 * @throws Error if the version format is invalid or if version is v1
 * @example
 * getPreviousVersion('v2') // returns 'v1'
 * getPreviousVersion('v5') // returns 'v4'
 * getPreviousVersion('v1') // throws Error
 */
export function getPreviousVersion(version: ApiVersion): ApiVersion {
  const num = parseVersionNumber(version);
  if (num === null) {
    throw new Error(`Invalid version format: ${version}`);
  }
  if (num <= 1) {
    throw new Error('Cannot get previous version of v1');
  }
  return `v${num - 1}`;
}

/**
 * Sort an array of versions in ascending order
 * @param versions - Array of version strings to sort
 * @returns Sorted array of versions
 * @throws Error if any version is invalid
 * @example
 * sortVersions(['v3', 'v1', 'v2']) // returns ['v1', 'v2', 'v3']
 */
export function sortVersions(versions: ApiVersion[]): ApiVersion[] {
  return [...versions].sort(compareVersions);
}

/**
 * Get the latest (highest) version from an array of versions
 * @param versions - Array of version strings
 * @returns The latest version
 * @throws Error if array is empty or contains invalid versions
 * @example
 * getLatestVersion(['v1', 'v3', 'v2']) // returns 'v3'
 */
export function getLatestVersion(versions: ApiVersion[]): ApiVersion {
  if (versions.length === 0) {
    throw new Error('Cannot get latest version from empty array');
  }
  const sorted = sortVersions(versions);
  return sorted[sorted.length - 1];
}

/**
 * Check if a version is in a given range
 * @param version - The version to check
 * @param minVersion - The minimum version (inclusive), or null for no minimum
 * @param maxVersion - The maximum version (inclusive), or null for no maximum
 * @returns True if version is within the range
 * @throws Error if any version format is invalid
 * @example
 * isVersionInRange('v2', 'v1', 'v3') // returns true
 * isVersionInRange('v4', 'v1', 'v3') // returns false
 * isVersionInRange('v2', 'v1', null) // returns true (no max)
 */
export function isVersionInRange(
  version: ApiVersion,
  minVersion: ApiVersion | null,
  maxVersion: ApiVersion | null
): boolean {
  if (minVersion && compareVersions(version, minVersion) < 0) {
    return false;
  }
  if (maxVersion && compareVersions(version, maxVersion) > 0) {
    return false;
  }
  return true;
}
