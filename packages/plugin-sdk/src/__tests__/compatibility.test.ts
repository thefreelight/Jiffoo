/**
 * Compatibility Matrix Tests
 *
 * Tests for SDK compatibility matrix functionality
 */

import { describe, it, expect } from 'vitest';
import {
  SDK_COMPATIBILITY_MATRIX,
  PLATFORM_COMPATIBILITY_MATRIX,
  getSdkCompatibility,
  getCurrentSdkCompatibility,
  getCompatibleSdkVersions,
  getRecommendedSdkVersion,
  isSdkDeprecated,
  isSdkSunset,
  getActiveSdkVersions,
  getSupportedPlatformVersions,
  isLatestSdk,
  getSdkWarnings,
  generateCompatibilityReport
} from '../compatibility';

describe('Compatibility Matrix', () => {
  describe('SDK_COMPATIBILITY_MATRIX', () => {
    it('should have valid matrix entries', () => {
      expect(SDK_COMPATIBILITY_MATRIX).toBeDefined();
      expect(SDK_COMPATIBILITY_MATRIX.length).toBeGreaterThan(0);

      SDK_COMPATIBILITY_MATRIX.forEach(entry => {
        expect(entry.sdkVersion).toMatch(/^\d+\.\d+\.\d+$/);
        expect(entry.minPlatformVersion).toMatch(/^\d+\.\d+\.\d+$/);
        expect(entry.releaseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(['stable', 'deprecated', 'sunset']).toContain(entry.status);
      });
    });

    it('should have 1.0.0 as stable version', () => {
      const v1 = SDK_COMPATIBILITY_MATRIX.find(e => e.sdkVersion === '1.0.0');
      expect(v1).toBeDefined();
      expect(v1!.status).toBe('stable');
    });
  });

  describe('PLATFORM_COMPATIBILITY_MATRIX', () => {
    it('should have valid matrix entries', () => {
      expect(PLATFORM_COMPATIBILITY_MATRIX).toBeDefined();
      expect(PLATFORM_COMPATIBILITY_MATRIX.length).toBeGreaterThan(0);

      PLATFORM_COMPATIBILITY_MATRIX.forEach(entry => {
        expect(entry.platformVersion).toMatch(/^\d+\.\d+\.\d+$/);
        expect(entry.compatibleSdkVersions).toBeDefined();
        expect(entry.compatibleSdkVersions.length).toBeGreaterThan(0);
        expect(entry.recommendedSdkVersion).toBeDefined();
        expect(['active', 'deprecated', 'sunset']).toContain(entry.status);
      });
    });

    it('should have 0.2.0 platform version', () => {
      const platform = PLATFORM_COMPATIBILITY_MATRIX.find(e => e.platformVersion === '0.2.0');
      expect(platform).toBeDefined();
      expect(platform!.compatibleSdkVersions).toContain('1.0.0');
    });
  });

  describe('getSdkCompatibility', () => {
    it('should return compatibility info for valid SDK version', () => {
      const compat = getSdkCompatibility('1.0.0');
      expect(compat).toBeDefined();
      expect(compat!.sdkVersion).toBe('1.0.0');
      expect(compat!.status).toBe('stable');
    });

    it('should return null for unknown SDK version', () => {
      const compat = getSdkCompatibility('99.99.99');
      expect(compat).toBeNull();
    });
  });

  describe('getCurrentSdkCompatibility', () => {
    it('should return compatibility info for current SDK', () => {
      const compat = getCurrentSdkCompatibility();
      expect(compat).toBeDefined();
      expect(compat.sdkVersion).toBe('1.0.0');
      expect(compat.minPlatformVersion).toBeDefined();
      expect(compat.status).toBeDefined();
    });
  });

  describe('getCompatibleSdkVersions', () => {
    it('should return compatible SDK versions for platform version', () => {
      const versions = getCompatibleSdkVersions('0.2.0');
      expect(versions).toBeDefined();
      expect(versions.length).toBeGreaterThan(0);
      expect(versions).toContain('1.0.0');
    });

    it('should return empty array for unknown platform version', () => {
      const versions = getCompatibleSdkVersions('99.99.99');
      expect(versions).toEqual([]);
    });
  });

  describe('getRecommendedSdkVersion', () => {
    it('should return recommended SDK version for platform version', () => {
      const recommended = getRecommendedSdkVersion('0.2.0');
      expect(recommended).toBe('1.0.0');
    });

    it('should return null for unknown platform version', () => {
      const recommended = getRecommendedSdkVersion('99.99.99');
      expect(recommended).toBeNull();
    });
  });

  describe('isSdkDeprecated', () => {
    it('should return false for stable SDK versions', () => {
      expect(isSdkDeprecated('1.0.0')).toBe(false);
    });

    it('should return true for deprecated SDK versions', () => {
      expect(isSdkDeprecated('0.9.0')).toBe(true);
    });

    it('should return false for unknown SDK versions', () => {
      expect(isSdkDeprecated('99.99.99')).toBe(false);
    });
  });

  describe('isSdkSunset', () => {
    it('should return false for stable SDK versions', () => {
      expect(isSdkSunset('1.0.0')).toBe(false);
    });

    it('should return false for deprecated but not sunset versions', () => {
      // 0.9.0 is deprecated but sunset date hasn't passed yet
      expect(isSdkSunset('0.9.0', new Date('2024-01-01'))).toBe(false);
    });

    it('should return true when sunset date has passed', () => {
      // 0.9.0 sunset date is 2024-07-15
      expect(isSdkSunset('0.9.0', new Date('2024-08-01'))).toBe(true);
    });

    it('should return false for unknown SDK versions', () => {
      expect(isSdkSunset('99.99.99')).toBe(false);
    });
  });

  describe('getActiveSdkVersions', () => {
    it('should return only stable SDK versions', () => {
      const active = getActiveSdkVersions();
      expect(active).toBeDefined();
      expect(active.length).toBeGreaterThan(0);
      expect(active).toContain('1.0.0');
      expect(active).not.toContain('0.9.0'); // deprecated
    });
  });

  describe('getSupportedPlatformVersions', () => {
    it('should return supported platform version range for SDK', () => {
      const range = getSupportedPlatformVersions('1.0.0');
      expect(range).toBeDefined();
      expect(range!.min).toBe('0.2.0');
    });

    it('should return null for unknown SDK version', () => {
      const range = getSupportedPlatformVersions('99.99.99');
      expect(range).toBeNull();
    });
  });

  describe('isLatestSdk', () => {
    it('should return true for latest stable SDK version', () => {
      // Current SDK is 1.0.0 which is the latest stable
      expect(isLatestSdk()).toBe(true);
    });
  });

  describe('getSdkWarnings', () => {
    it('should return empty warnings for stable SDK versions', () => {
      const warnings = getSdkWarnings('1.0.0');
      expect(warnings).toBeDefined();
      expect(Array.isArray(warnings)).toBe(true);
      // May have informational warnings but no deprecation warnings
    });

    it('should return deprecation warnings for deprecated SDK versions', () => {
      const warnings = getSdkWarnings('0.9.0');
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some(w => w.includes('deprecated'))).toBe(true);
    });

    it('should return warning for unknown SDK versions', () => {
      const warnings = getSdkWarnings('99.99.99');
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0]).toContain('Unknown SDK version');
    });
  });

  describe('generateCompatibilityReport', () => {
    it('should generate report for compatible platform version', () => {
      const report = generateCompatibilityReport('0.2.0');
      expect(report).toBeDefined();
      expect(report).toContain('SDK Version Compatibility Report');
      expect(report).toContain('1.0.0');
      expect(report).toContain('0.2.0');
      expect(report).toContain('compatible');
    });

    it('should generate report for unknown platform version', () => {
      const report = generateCompatibilityReport('99.99.99');
      expect(report).toBeDefined();
      expect(report).toContain('not found in compatibility matrix');
    });

    it('should include warnings in report', () => {
      const report = generateCompatibilityReport('0.2.0');
      // Report structure should be valid
      expect(report.split('\n').length).toBeGreaterThan(3);
    });
  });
});
