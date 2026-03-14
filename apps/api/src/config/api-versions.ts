import type { ApiVersionConfig, VersionMetadata } from '@jiffoo/shared/versioning';

/**
 * API Version Configuration for Core API
 *
 * Defines supported versions, default version, and version metadata
 * including deprecation information and release dates.
 */

/**
 * Version metadata for all supported API versions
 */
const versionMetadata: Record<string, VersionMetadata> = {
  v1: {
    version: 'v1',
    status: 'active',
    releaseDate: '2024-01-01',
    features: [
      'Core product management',
      'Order processing',
      'User authentication',
      'Basic plugin system',
    ],
    changelog: 'Initial stable API release',
  },
  v2: {
    version: 'v2',
    status: 'active',
    releaseDate: '2024-06-01',
    features: [
      'Enhanced plugin system',
      'Improved performance',
      'Advanced filtering',
      'Batch operations',
    ],
    breakingChanges: [
      'Product schema updated with new required fields',
      'Authentication endpoints restructured',
      'Order status enum values changed',
    ],
    changelog: 'Major update with enhanced features and breaking changes',
  },
};

/**
 * Core API version configuration
 */
export const apiVersionConfig: ApiVersionConfig = {
  defaultVersion: 'v1',
  supportedVersions: ['v1', 'v2'],
  deprecatedVersions: [],
  versionMetadata,
};

/**
 * Get metadata for a specific API version
 */
export function getVersionMetadata(version: string): VersionMetadata | undefined {
  return versionMetadata[version];
}

/**
 * Check if a version is supported
 */
export function isSupportedVersion(version: string): boolean {
  return apiVersionConfig.supportedVersions.includes(version);
}

/**
 * Get the default API version
 */
export function getDefaultVersion(): string {
  return apiVersionConfig.defaultVersion;
}

/**
 * Get all active (non-deprecated, non-sunset) versions
 */
export function getActiveVersions(): string[] {
  return apiVersionConfig.supportedVersions.filter((version) => {
    const metadata = versionMetadata[version];
    return metadata && metadata.status === 'active';
  });
}
