import { describe, it, expect } from 'vitest';
import {
  parseVersionNumber,
  isValidVersion,
  compareVersions,
  isVersionGreaterThan,
  isVersionLessThan,
  isVersionEqual,
  normalizeVersion,
  extractVersionFromPath,
  getNextVersion,
  getPreviousVersion,
  sortVersions,
  getLatestVersion,
  isVersionInRange,
} from '../version-parser';

describe('version-parser', () => {
  describe('parseVersionNumber', () => {
    it('should parse valid version strings', () => {
      expect(parseVersionNumber('v1')).toBe(1);
      expect(parseVersionNumber('v2')).toBe(2);
      expect(parseVersionNumber('v10')).toBe(10);
      expect(parseVersionNumber('V1')).toBe(1);
    });

    it('should return null for invalid versions', () => {
      expect(parseVersionNumber('1')).toBeNull();
      expect(parseVersionNumber('version1')).toBeNull();
      expect(parseVersionNumber('invalid')).toBeNull();
      expect(parseVersionNumber('')).toBeNull();
    });
  });

  describe('isValidVersion', () => {
    it('should validate correct version formats', () => {
      expect(isValidVersion('v1')).toBe(true);
      expect(isValidVersion('v99')).toBe(true);
      expect(isValidVersion('V1')).toBe(true);
    });

    it('should reject invalid version formats', () => {
      expect(isValidVersion('1')).toBe(false);
      expect(isValidVersion('version1')).toBe(false);
      expect(isValidVersion('v1.0')).toBe(false);
      expect(isValidVersion('')).toBe(false);
    });
  });

  describe('compareVersions', () => {
    it('should return -1 when first version is less', () => {
      expect(compareVersions('v1', 'v2')).toBe(-1);
      expect(compareVersions('v1', 'v10')).toBe(-1);
    });

    it('should return 1 when first version is greater', () => {
      expect(compareVersions('v2', 'v1')).toBe(1);
      expect(compareVersions('v10', 'v1')).toBe(1);
    });

    it('should return 0 when versions are equal', () => {
      expect(compareVersions('v1', 'v1')).toBe(0);
      expect(compareVersions('v10', 'v10')).toBe(0);
    });

    it('should throw error for invalid versions', () => {
      expect(() => compareVersions('invalid', 'v1')).toThrow('Invalid version format');
      expect(() => compareVersions('v1', 'invalid')).toThrow('Invalid version format');
    });
  });

  describe('isVersionGreaterThan', () => {
    it('should correctly identify greater versions', () => {
      expect(isVersionGreaterThan('v2', 'v1')).toBe(true);
      expect(isVersionGreaterThan('v1', 'v2')).toBe(false);
      expect(isVersionGreaterThan('v1', 'v1')).toBe(false);
    });
  });

  describe('isVersionLessThan', () => {
    it('should correctly identify lesser versions', () => {
      expect(isVersionLessThan('v1', 'v2')).toBe(true);
      expect(isVersionLessThan('v2', 'v1')).toBe(false);
      expect(isVersionLessThan('v1', 'v1')).toBe(false);
    });
  });

  describe('isVersionEqual', () => {
    it('should correctly identify equal versions', () => {
      expect(isVersionEqual('v1', 'v1')).toBe(true);
      expect(isVersionEqual('v1', 'v2')).toBe(false);
    });
  });

  describe('normalizeVersion', () => {
    it('should normalize version strings to lowercase', () => {
      expect(normalizeVersion('V1')).toBe('v1');
      expect(normalizeVersion('v1')).toBe('v1');
      expect(normalizeVersion('V10')).toBe('v10');
    });

    it('should throw error for invalid formats', () => {
      expect(() => normalizeVersion('1')).toThrow('Invalid version format');
      expect(() => normalizeVersion('invalid')).toThrow('Invalid version format');
    });
  });

  describe('extractVersionFromPath', () => {
    it('should extract version from valid paths', () => {
      expect(extractVersionFromPath('/api/v1/products')).toBe('v1');
      expect(extractVersionFromPath('/v2/users')).toBe('v2');
      expect(extractVersionFromPath('/platform/v10/status')).toBe('v10');
    });

    it('should return null for paths without version', () => {
      expect(extractVersionFromPath('/api/products')).toBeNull();
      expect(extractVersionFromPath('/products')).toBeNull();
    });

    it('should handle case-insensitive paths', () => {
      expect(extractVersionFromPath('/api/V1/products')).toBe('v1');
    });
  });

  describe('getNextVersion', () => {
    it('should return the next version', () => {
      expect(getNextVersion('v1')).toBe('v2');
      expect(getNextVersion('v5')).toBe('v6');
      expect(getNextVersion('v10')).toBe('v11');
    });

    it('should throw error for invalid version', () => {
      expect(() => getNextVersion('invalid')).toThrow('Invalid version format');
    });
  });

  describe('getPreviousVersion', () => {
    it('should return the previous version', () => {
      expect(getPreviousVersion('v2')).toBe('v1');
      expect(getPreviousVersion('v5')).toBe('v4');
      expect(getPreviousVersion('v10')).toBe('v9');
    });

    it('should throw error for v1', () => {
      expect(() => getPreviousVersion('v1')).toThrow('Cannot get previous version of v1');
    });

    it('should throw error for invalid version', () => {
      expect(() => getPreviousVersion('invalid')).toThrow('Invalid version format');
    });
  });

  describe('sortVersions', () => {
    it('should sort versions in ascending order', () => {
      expect(sortVersions(['v3', 'v1', 'v2'])).toEqual(['v1', 'v2', 'v3']);
      expect(sortVersions(['v10', 'v2', 'v1'])).toEqual(['v1', 'v2', 'v10']);
    });

    it('should handle already sorted arrays', () => {
      expect(sortVersions(['v1', 'v2', 'v3'])).toEqual(['v1', 'v2', 'v3']);
    });

    it('should not modify the original array', () => {
      const original = ['v3', 'v1', 'v2'];
      const sorted = sortVersions(original);
      expect(original).toEqual(['v3', 'v1', 'v2']);
      expect(sorted).toEqual(['v1', 'v2', 'v3']);
    });
  });

  describe('getLatestVersion', () => {
    it('should return the highest version', () => {
      expect(getLatestVersion(['v1', 'v3', 'v2'])).toBe('v3');
      expect(getLatestVersion(['v10', 'v2', 'v5'])).toBe('v10');
    });

    it('should throw error for empty array', () => {
      expect(() => getLatestVersion([])).toThrow('Cannot get latest version from empty array');
    });
  });

  describe('isVersionInRange', () => {
    it('should check if version is within range', () => {
      expect(isVersionInRange('v2', 'v1', 'v3')).toBe(true);
      expect(isVersionInRange('v1', 'v1', 'v3')).toBe(true);
      expect(isVersionInRange('v3', 'v1', 'v3')).toBe(true);
    });

    it('should return false if version is outside range', () => {
      expect(isVersionInRange('v4', 'v1', 'v3')).toBe(false);
      expect(isVersionInRange('v0', 'v1', 'v3')).toBe(false);
    });

    it('should handle null boundaries', () => {
      expect(isVersionInRange('v10', 'v1', null)).toBe(true);
      expect(isVersionInRange('v1', null, 'v10')).toBe(true);
      expect(isVersionInRange('v5', null, null)).toBe(true);
    });

    it('should return false if below minimum', () => {
      expect(isVersionInRange('v0', 'v1', null)).toBe(false);
    });

    it('should return false if above maximum', () => {
      expect(isVersionInRange('v11', null, 'v10')).toBe(false);
    });
  });
});
