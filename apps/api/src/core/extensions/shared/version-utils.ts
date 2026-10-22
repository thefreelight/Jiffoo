/**
 * Version Utilities
 * 
 * Semantic version comparison, validation, and range matching utilities
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

// ============================================================
// Semver Range Matching (Task 6.2.2)
// ============================================================

/**
 * Parse a simple semver range and check if a version satisfies it.
 * 
 * Supported syntax:
 *   - Exact: "1.0.0"
 *   - Caret: "^1.0.0" (compatible within same major, except 0.x)
 *   - Tilde: "~1.0.0" (compatible within same minor)
 *   - GTE:   ">=1.0.0"
 *   - GT:    ">1.0.0"
 *   - LTE:   "<=1.0.0"
 *   - LT:    "<1.0.0"
 *   - OR:    "1.0.0 || 2.0.0"
 *   - AND:   ">=1.0.0 <2.0.0" (space-separated)
 *
 * @returns true if version satisfies the range
 */
export function satisfiesRange(version: string, range: string): boolean {
  const rangeStr = range.trim();
  if (!rangeStr) return true;

  // Parse version
  const versionParts = version.split('.').map(Number);
  if (versionParts.length < 3 || versionParts.some(isNaN)) return false;

  // Handle OR conditions (||)
  const orParts = rangeStr.split('||').map(p => p.trim());
  return orParts.some(orPart => satisfiesAndRange(version, versionParts, orPart));
}

function satisfiesAndRange(
  version: string,
  versionParts: number[],
  rangeStr: string,
): boolean {
  // Split by space for AND conditions
  const conditions = rangeStr.split(/\s+/).filter(Boolean);
  return conditions.every(cond => satisfiesCondition(versionParts, cond));
}

function satisfiesCondition(versionParts: number[], condition: string): boolean {
  const cond = condition.trim();

  // Caret: ^1.0.0
  if (cond.startsWith('^')) {
    const target = cond.slice(1);
    const targetParts = parseSemver(target);
    if (!targetParts) return false;

    // For 0.x.y: ^0.2.0 allows 0.2.x but not 0.3.0
    // For 1.x.y: ^1.0.0 allows 1.x.x but not 2.0.0
    if (targetParts[0] === 0) {
      if (versionParts[0] !== 0) return false;
      if (targetParts[1] === 0) {
        // ^0.0.3 only matches exactly 0.0.3
        return versionParts[0] === 0 && versionParts[1] === 0 && versionParts[2] === targetParts[2];
      }
      return versionParts[0] === 0 && versionParts[1] === targetParts[1] && versionParts[2] >= targetParts[2];
    }
    return versionParts[0] === targetParts[0] &&
      compareVersionArrays(versionParts, targetParts) >= 0;
  }

  // Tilde: ~1.0.0
  if (cond.startsWith('~')) {
    const target = cond.slice(1);
    const targetParts = parseSemver(target);
    if (!targetParts) return false;

    return versionParts[0] === targetParts[0] &&
      versionParts[1] === targetParts[1] &&
      versionParts[2] >= targetParts[2];
  }

  // >=, <=, >, <
  if (cond.startsWith('>=')) {
    const targetParts = parseSemver(cond.slice(2));
    if (!targetParts) return false;
    return compareVersionArrays(versionParts, targetParts) >= 0;
  }
  if (cond.startsWith('<=')) {
    const targetParts = parseSemver(cond.slice(2));
    if (!targetParts) return false;
    return compareVersionArrays(versionParts, targetParts) <= 0;
  }
  if (cond.startsWith('>')) {
    const targetParts = parseSemver(cond.slice(1));
    if (!targetParts) return false;
    return compareVersionArrays(versionParts, targetParts) > 0;
  }
  if (cond.startsWith('<')) {
    const targetParts = parseSemver(cond.slice(1));
    if (!targetParts) return false;
    return compareVersionArrays(versionParts, targetParts) < 0;
  }

  // Exact match
  const targetParts = parseSemver(cond);
  if (!targetParts) return false;
  return compareVersionArrays(versionParts, targetParts) === 0;
}

function parseSemver(v: string): [number, number, number] | null {
  const match = v.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
}

function compareVersionArrays(a: number[], b: number[]): number {
  for (let i = 0; i < 3; i++) {
    const numA = a[i] || 0;
    const numB = b[i] || 0;
    if (numA < numB) return -1;
    if (numA > numB) return 1;
  }
  return 0;
}

/**
 * Validate that a version range string is well-formed.
 * 
 * @throws ExtensionInstallerError if range is invalid
 */
export function validateVersionRange(range: string): void {
  const rangeStr = range.trim();
  if (!rangeStr) return;

  const orParts = rangeStr.split('||');
  for (const orPart of orParts) {
    const conditions = orPart.trim().split(/\s+/).filter(Boolean);
    for (const cond of conditions) {
      const rangeMatch = cond.match(/^(\^|~|>=|<=|>|<)?(\d+\.\d+\.\d+)$/);
      if (!rangeMatch) {
        throw new ExtensionInstallerError(
          `Invalid version range: "${cond}". Supported: exact, ^x.y.z, ~x.y.z, >=x.y.z, >x.y.z, <=x.y.z, <x.y.z`,
          { code: 'INVALID_VERSION_RANGE', statusCode: 400 }
        );
      }
    }
  }
}

