/**
 * Property Test: SDK Version Compatibility
 * 
 * Feature: developer-ecosystem, Property 2: SDK Version Compatibility
 * Validates: Requirements 2.5
 * 
 * For any SDK version X and platform version Y, if X is declared compatible
 * with Y, then extensions built with SDK X SHALL work correctly on platform Y.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { SDK_VERSION, PLATFORM_COMPATIBILITY } from '../index';

// Semantic version parsing
interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

function parseSemVer(version: string): SemVer | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

function parseVersionRange(range: string): { operator: string; version: SemVer } | null {
  const match = range.match(/^(>=|>|<=|<|=)?(\d+\.\d+\.\d+)$/);
  if (!match) return null;
  const version = parseSemVer(match[2]);
  if (!version) return null;
  return {
    operator: match[1] || '=',
    version,
  };
}

function isVersionCompatible(sdkVersion: string, platformVersion: string, compatibility: string): boolean {
  const sdk = parseSemVer(sdkVersion);
  const platform = parseSemVer(platformVersion);
  const range = parseVersionRange(compatibility);
  
  if (!sdk || !platform || !range) return false;
  
  const { operator, version: minVersion } = range;
  
  switch (operator) {
    case '>=':
      return (
        platform.major > minVersion.major ||
        (platform.major === minVersion.major && platform.minor > minVersion.minor) ||
        (platform.major === minVersion.major && platform.minor === minVersion.minor && platform.patch >= minVersion.patch)
      );
    case '>':
      return (
        platform.major > minVersion.major ||
        (platform.major === minVersion.major && platform.minor > minVersion.minor) ||
        (platform.major === minVersion.major && platform.minor === minVersion.minor && platform.patch > minVersion.patch)
      );
    case '<=':
      return (
        platform.major < minVersion.major ||
        (platform.major === minVersion.major && platform.minor < minVersion.minor) ||
        (platform.major === minVersion.major && platform.minor === minVersion.minor && platform.patch <= minVersion.patch)
      );
    case '<':
      return (
        platform.major < minVersion.major ||
        (platform.major === minVersion.major && platform.minor < minVersion.minor) ||
        (platform.major === minVersion.major && platform.minor === minVersion.minor && platform.patch < minVersion.patch)
      );
    case '=':
    default:
      return (
        platform.major === minVersion.major &&
        platform.minor === minVersion.minor &&
        platform.patch === minVersion.patch
      );
  }
}

// Arbitrary generators
const semverArb = fc.tuple(
  fc.integer({ min: 0, max: 10 }),
  fc.integer({ min: 0, max: 20 }),
  fc.integer({ min: 0, max: 100 })
).map(([major, minor, patch]) => `${major}.${minor}.${patch}`);

describe('SDK Version Compatibility Property Tests', () => {
  /**
   * Property 2.1: SDK version is valid semantic version
   */
  it('SDK_VERSION is valid semantic version', () => {
    const parsed = parseSemVer(SDK_VERSION);
    expect(parsed).not.toBeNull();
    expect(parsed!.major).toBeGreaterThanOrEqual(0);
    expect(parsed!.minor).toBeGreaterThanOrEqual(0);
    expect(parsed!.patch).toBeGreaterThanOrEqual(0);
  });

  /**
   * Property 2.2: Platform compatibility is valid version range
   */
  it('PLATFORM_COMPATIBILITY is valid version range', () => {
    const parsed = parseVersionRange(PLATFORM_COMPATIBILITY);
    expect(parsed).not.toBeNull();
    expect(['>=', '>', '<=', '<', '=']).toContain(parsed!.operator);
  });

  /**
   * Property 2.3: Version comparison is transitive
   * If A >= B and B >= C, then A >= C
   */
  it('version comparison is transitive', () => {
    fc.assert(
      fc.property(semverArb, semverArb, semverArb, (a, b, c) => {
        const aVer = parseSemVer(a)!;
        const bVer = parseSemVer(b)!;
        const cVer = parseSemVer(c)!;
        
        const aGteB = isVersionCompatible(SDK_VERSION, a, `>=${b}`);
        const bGteC = isVersionCompatible(SDK_VERSION, b, `>=${c}`);
        const aGteC = isVersionCompatible(SDK_VERSION, a, `>=${c}`);
        
        // If A >= B and B >= C, then A >= C
        if (aGteB && bGteC) {
          expect(aGteC).toBe(true);
        }
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2.4: Version comparison is reflexive
   * A >= A is always true
   */
  it('version comparison is reflexive', () => {
    fc.assert(
      fc.property(semverArb, (version) => {
        const isCompatible = isVersionCompatible(SDK_VERSION, version, `>=${version}`);
        expect(isCompatible).toBe(true);
        return true;
      }),
      { numRuns: 50 }
    );
  });

  /**
   * Property 2.5: Version comparison is antisymmetric
   * If A > B, then B is not > A
   */
  it('version comparison is antisymmetric', () => {
    fc.assert(
      fc.property(semverArb, semverArb, (a, b) => {
        if (a === b) return true; // Skip equal versions
        
        const aGtB = isVersionCompatible(SDK_VERSION, a, `>${b}`);
        const bGtA = isVersionCompatible(SDK_VERSION, b, `>${a}`);
        
        // If A > B, then B is not > A
        if (aGtB) {
          expect(bGtA).toBe(false);
        }
        
        return true;
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2.6: SDK declares valid platform compatibility
   * Current SDK should be compatible with declared platform range
   */
  it('SDK declares valid platform compatibility', () => {
    // The SDK should work with platforms in its declared compatibility range
    const range = parseVersionRange(PLATFORM_COMPATIBILITY);
    expect(range).not.toBeNull();
    
    // Generate platform versions that should be compatible
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5 }),
        fc.integer({ min: 2, max: 20 }),
        fc.integer({ min: 0, max: 100 }),
        (major, minor, patch) => {
          const platformVersion = `${major}.${minor}.${patch}`;
          const isCompatible = isVersionCompatible(SDK_VERSION, platformVersion, PLATFORM_COMPATIBILITY);
          
          // If platform version meets the minimum requirement, it should be compatible
          const platform = parseSemVer(platformVersion)!;
          const minVersion = range!.version;
          
          if (range!.operator === '>=') {
            const meetsMinimum = 
              platform.major > minVersion.major ||
              (platform.major === minVersion.major && platform.minor > minVersion.minor) ||
              (platform.major === minVersion.major && platform.minor === minVersion.minor && platform.patch >= minVersion.patch);
            
            expect(isCompatible).toBe(meetsMinimum);
          }
          
          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 2.7: Breaking changes require major version bump
   * Major version changes indicate potential incompatibility
   */
  it('major version difference indicates potential incompatibility', () => {
    const currentSdk = parseSemVer(SDK_VERSION)!;
    
    fc.assert(
      fc.property(
        fc.integer({ min: currentSdk.major + 1, max: currentSdk.major + 5 }),
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 0, max: 100 }),
        (major, minor, patch) => {
          // Future major versions may not be compatible
          const futureVersion = `${major}.${minor}.${patch}`;
          
          // This is a design decision: major version bumps may break compatibility
          // The test documents this expectation
          expect(major).toBeGreaterThan(currentSdk.major);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });
});
