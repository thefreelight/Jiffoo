import { FastifyRequest } from 'fastify';
import type { VersionMetadata } from '@jiffoo/shared/versioning';
type VersionStatus = VersionMetadata['status'];
import {
  apiVersionConfig,
  getVersionMetadata as getConfigVersionMetadata,
  isSupportedVersion as isConfigSupportedVersion,
  getDefaultVersion as getConfigDefaultVersion
} from '../config/api-versions';

/**
 * API Version Utility Helpers
 *
 * Utility functions for working with API versions in route handlers and services.
 */

/**
 * Get the current API version from a request
 * @param request - Fastify request object
 * @returns The API version string (e.g., 'v1')
 */
export function getCurrentVersion(request: FastifyRequest): string {
  return (request as any).apiVersion || getConfigDefaultVersion();
}

/**
 * Check if a version is supported by the API
 * @param version - The version to check (e.g., 'v1')
 * @returns True if the version is supported
 */
export function isVersionSupported(version: string): boolean {
  return isConfigSupportedVersion(version);
}

/**
 * Get metadata for a specific API version
 * @param version - The version to get metadata for (e.g., 'v1')
 * @returns Version metadata or undefined if not found
 */
export function getVersionMetadata(version: string): VersionMetadata | undefined {
  return getConfigVersionMetadata(version);
}

/**
 * Get the default API version
 * @returns The default version string
 */
export function getDefaultVersion(): string {
  return getConfigDefaultVersion();
}

/**
 * Get all supported API versions
 * @returns Array of supported version strings
 */
export function getSupportedVersions(): string[] {
  return apiVersionConfig.supportedVersions;
}

/**
 * Check if a version is deprecated
 * @param version - The version to check
 * @returns True if the version is deprecated
 */
export function isVersionDeprecated(version: string): boolean {
  const metadata = getVersionMetadata(version);
  return metadata?.status === 'deprecated';
}

/**
 * Check if a version has reached its sunset date
 * @param version - The version to check
 * @returns True if the version is sunset
 */
export function isVersionSunset(version: string): boolean {
  const metadata = getVersionMetadata(version);
  return metadata?.status === 'sunset';
}

/**
 * Get the status of a specific version
 * @param version - The version to check
 * @returns The version status ('active', 'deprecated', or 'sunset')
 */
export function getVersionStatus(version: string): VersionStatus | undefined {
  const metadata = getVersionMetadata(version);
  return metadata?.status;
}

/**
 * Format a path with the API version prefix
 * @param path - The path to format (e.g., '/products')
 * @param version - The version to use (optional, defaults to v1)
 * @returns The versioned path (e.g., '/api/v1/products')
 */
export function formatVersionedPath(path: string, version?: string): string {
  const ver = version || getConfigDefaultVersion();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `/api/${ver}${cleanPath}`;
}

/**
 * Generate version-related HTTP headers
 * @param version - The API version
 * @returns Object containing header key-value pairs
 */
export function getVersionHeaders(version: string): Record<string, string> {
  const metadata = getVersionMetadata(version);
  const headers: Record<string, string> = {
    'X-API-Version': version,
  };

  if (metadata?.status === 'deprecated' && metadata.deprecationInfo) {
    headers['X-API-Deprecated'] = 'true';

    if (metadata.deprecationInfo.sunsetDate) {
      headers['X-API-Sunset-Date'] = metadata.deprecationInfo.sunsetDate;
    }

    if (metadata.deprecationInfo.migrationGuide) {
      headers['X-Migration-Guide'] = metadata.deprecationInfo.migrationGuide;
    }

    if (metadata.deprecationInfo.reason) {
      headers['X-Deprecation-Reason'] = metadata.deprecationInfo.reason;
    }
  }

  return headers;
}

/**
 * Get version metadata from a request
 * @param request - Fastify request object
 * @returns Version metadata or undefined
 */
export function getRequestVersionMetadata(request: FastifyRequest): VersionMetadata | undefined {
  return (request as any).versionMetadata;
}

/**
 * Check if the request is using a specific version
 * @param request - Fastify request object
 * @param version - Version to check against
 * @returns True if the request is using the specified version
 */
export function isRequestVersion(request: FastifyRequest, version: string): boolean {
  return getCurrentVersion(request) === version;
}

/**
 * Get a list of all active (non-deprecated, non-sunset) versions
 * @returns Array of active version strings
 */
export function getActiveVersions(): string[] {
  return apiVersionConfig.supportedVersions.filter(version => {
    const metadata = getVersionMetadata(version);
    return metadata?.status === 'active';
  });
}

/**
 * Get a list of deprecated versions
 * @returns Array of deprecated version strings
 */
export function getDeprecatedVersions(): string[] {
  return apiVersionConfig.supportedVersions.filter(version => {
    const metadata = getVersionMetadata(version);
    return metadata?.status === 'deprecated';
  });
}

/**
 * Get version information summary for API documentation
 * @returns Object containing version information
 */
export function getVersionInfo() {
  return {
    defaultVersion: apiVersionConfig.defaultVersion,
    supportedVersions: apiVersionConfig.supportedVersions,
    activeVersions: getActiveVersions(),
    deprecatedVersions: getDeprecatedVersions(),
    versionMetadata: apiVersionConfig.supportedVersions.map(version => ({
      version,
      ...getVersionMetadata(version),
    })),
  };
}
