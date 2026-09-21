import { isVersionCompatible } from '@jiffoo/shared/versioning/compatibility-checker';
import { isValidVersion } from '@jiffoo/shared/versioning/version-parser';
import { apiVersionConfig } from '@/config/api-versions';
import type { PluginManifest } from './types';

export type PluginLoaderErrorCode = 'INCOMPATIBLE_API_VERSION' | 'INVALID_VERSION_FORMAT' | 'MISSING_VERSION_INFO' | 'VERSION_CHECK_FAILED';

export class PluginLoaderError extends Error {
  constructor(
    message: string,
    public readonly code: PluginLoaderErrorCode,
    public readonly pluginSlug: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'PluginLoaderError';
  }
}

export function getCurrentApiVersion(): string {
  const version = apiVersionConfig.defaultVersion;
  return version.startsWith('v') ? version : `v${version}`;
}

export interface VersionCheckResult {
  compatible: boolean;
  currentApiVersion: string;
  requiredApiVersion?: string;
  reason?: string;
}

export function validateManifestVersionInfo(manifest: PluginManifest): void {
  if (!manifest.version || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(manifest.version)) {
    throw new PluginLoaderError(`Invalid plugin version format: "${manifest.version}". Must be semantic version (e.g., "1.0.0")`, 'INVALID_VERSION_FORMAT', manifest.slug, { version: manifest.version });
  }
  if (manifest.minApiVersion && !isValidVersion(manifest.minApiVersion) && !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(manifest.minApiVersion)) {
    throw new PluginLoaderError(`Invalid minApiVersion format: "${manifest.minApiVersion}". Must be API version (e.g., "v1", "v2") or semantic version (e.g., "1.0.0")`, 'INVALID_VERSION_FORMAT', manifest.slug, { minApiVersion: manifest.minApiVersion });
  }
}

export function checkPluginApiCompatibility(manifest: PluginManifest): VersionCheckResult {
  const currentApiVersion = getCurrentApiVersion();
  if (!manifest.minApiVersion) return { compatible: true, currentApiVersion, reason: 'No minimum API version specified, assuming compatible' };
  try {
    const compatible = isVersionCompatible(currentApiVersion, { min: manifest.minApiVersion });
    return { compatible, currentApiVersion, requiredApiVersion: manifest.minApiVersion, reason: compatible ? `Plugin is compatible with current API version ${currentApiVersion}` : `Plugin requires API version ${manifest.minApiVersion} or higher, but current version is ${currentApiVersion}` };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown compatibility error';
    throw new PluginLoaderError(`Failed to check version compatibility: ${message}`, 'VERSION_CHECK_FAILED', manifest.slug, { currentApiVersion, minApiVersion: manifest.minApiVersion, error: message });
  }
}

export function validatePluginCompatibility(manifest: PluginManifest): void {
  validateManifestVersionInfo(manifest);
  if (!manifest.minApiVersion) return;
  try {
    if (!checkPluginApiCompatibility(manifest).compatible) {
      throw new PluginLoaderError(`Plugin "${manifest.slug}" is incompatible with current API version. Plugin requires API version ${manifest.minApiVersion} or higher, but current version is ${getCurrentApiVersion()}`, 'INCOMPATIBLE_API_VERSION', manifest.slug, { pluginVersion: manifest.version, currentApiVersion: getCurrentApiVersion(), requiredApiVersion: manifest.minApiVersion, pluginName: manifest.name });
    }
  } catch (error: unknown) {
    if (error instanceof PluginLoaderError) throw error;
    const message = error instanceof Error ? error.message : 'Unknown compatibility error';
    throw new PluginLoaderError(`Failed to check version compatibility: ${message}`, 'VERSION_CHECK_FAILED', manifest.slug, { currentApiVersion: getCurrentApiVersion(), minApiVersion: manifest.minApiVersion, error: message });
  }
}

export function getPluginCompatibilityStatus(manifest: PluginManifest): VersionCheckResult {
  try { validateManifestVersionInfo(manifest); return checkPluginApiCompatibility(manifest); } catch (error: unknown) { return { compatible: false, currentApiVersion: getCurrentApiVersion(), requiredApiVersion: manifest.minApiVersion, reason: error instanceof Error ? error.message : 'Unexpected error' }; }
}

export function getCompatibilityReport(manifest: PluginManifest): string {
  const status = getPluginCompatibilityStatus(manifest);
  return `Plugin: ${manifest.name} (${manifest.slug})\nVersion: ${manifest.version}\nCurrent API Version: ${status.currentApiVersion}\nRequired API Version: ${manifest.minApiVersion || 'None specified'}\nCompatible: ${status.compatible ? 'Yes' : 'No'}\n${status.reason ? `Details: ${status.reason}\n` : ''}`;
}

export function checkMultiplePlugins(manifests: PluginManifest[]) {
  return manifests.map((manifest) => ({ slug: manifest.slug, name: manifest.name, compatible: getPluginCompatibilityStatus(manifest).compatible, result: getPluginCompatibilityStatus(manifest) }));
}
