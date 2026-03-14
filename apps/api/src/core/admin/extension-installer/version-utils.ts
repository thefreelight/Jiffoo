/**
 * Version Utilities
 * 
 * Semantic version comparison and validation utilities
 */

import { ExtensionInstallerError } from './errors';

/**
 * Compare semantic versions
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 * 
 * @example
 * compareVersions('1.0.0', '1.0.1') // -1
 * compareVersions('2.0.0', '1.9.9') // 1
 * compareVersions('1.5.0', '1.5.0') // 0
 */
export function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    const numA = partsA[i] || 0;
    const numB = partsB[i] || 0;
    if (numA < numB) return -1;
    if (numA > numB) return 1;
  }

  return 0;
}

/**
 * Validate semantic version format
 * Only allows strict MAJOR.MINOR.PATCH format (no 'v' prefix, no pre-release tags)
 * 
 * @throws ExtensionInstallerError if version format is invalid
 */
export function validateVersionFormat(version: string): void {
  const semverRegex = /^\d+\.\d+\.\d+$/;
  
  if (!semverRegex.test(version)) {
    throw new ExtensionInstallerError(
      `Invalid version format: "${version}". Must be MAJOR.MINOR.PATCH (e.g., 1.0.0)`,
      { code: 'INVALID_VERSION_FORMAT', statusCode: 400 }
    );
  }
}
