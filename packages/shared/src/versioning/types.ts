/**
 * API Versioning System - Type Definitions
 */

/**
 * API Version identifier (e.g., "v1", "v2")
 */
export type ApiVersion = string;

/**
 * Version comparison result
 */
export type VersionComparison = -1 | 0 | 1;

/**
 * Deprecation status of an API version or endpoint
 */
export interface DeprecationInfo {
  isDeprecated: boolean;
  deprecatedAt?: string;
  sunsetDate?: string;
  migrationGuide?: string;
  replacementEndpoint?: string;
  reason?: string;
}

/**
 * Metadata about an API version
 */
export interface VersionMetadata {
  version: ApiVersion;
  status: 'active' | 'deprecated' | 'sunset';
  releaseDate: string;
  deprecationInfo?: DeprecationInfo;
  features?: string[];
  breakingChanges?: string[];
  changelog?: string;
}

/**
 * Compatibility check result
 */
export interface CompatibilityCheck {
  isCompatible: boolean;
  currentVersion: ApiVersion;
  requiredVersion: ApiVersion;
  message?: string;
  warnings?: string[];
  errors?: string[];
}

/**
 * Version range specification for compatibility checking
 */
export interface VersionRange {
  min?: ApiVersion;
  max?: ApiVersion;
  exact?: ApiVersion;
}

/**
 * Plugin compatibility requirements
 */
export interface PluginCompatibility {
  pluginId: string;
  pluginVersion: string;
  requiredApiVersion: VersionRange;
  supportedApiVersions?: ApiVersion[];
  sdkVersion?: string;
}

/**
 * API version configuration
 */
export interface ApiVersionConfig {
  defaultVersion: ApiVersion;
  supportedVersions: ApiVersion[];
  deprecatedVersions?: ApiVersion[];
  versionMetadata: Record<ApiVersion, VersionMetadata>;
}

/**
 * Version header names for HTTP requests/responses
 */
export interface VersionHeaders {
  version: string;
  deprecated: string;
  sunsetDate: string;
  migrationGuide: string;
  supportedVersions: string;
}

/**
 * Default version header names
 */
export const DEFAULT_VERSION_HEADERS: VersionHeaders = {
  version: 'X-API-Version',
  deprecated: 'X-API-Deprecated',
  sunsetDate: 'X-API-Sunset-Date',
  migrationGuide: 'X-Migration-Guide',
  supportedVersions: 'X-API-Supported-Versions',
};
