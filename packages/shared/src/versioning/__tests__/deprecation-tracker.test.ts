import { describe, it, expect } from 'vitest';
import type { DeprecationInfo, VersionMetadata } from '../types';
import {
  calculateSunsetDate,
  isDeprecated,
  isSunset,
  getDaysUntilSunset,
  createDeprecationInfo,
  generateDeprecationWarning,
  shouldDeprecateVersion,
  filterDeprecatedVersions,
  getActiveVersions,
  createDeprecationHeaders,
  sortByDeprecationStatus,
} from '../deprecation-tracker';

describe('deprecation-tracker', () => {
  describe('calculateSunsetDate', () => {
    it('should calculate sunset date 180 days after deprecation by default', () => {
      const result = calculateSunsetDate('2024-01-01');
      expect(result).toBe('2024-06-29'); // 180 days later (2024 is a leap year)
    });

    it('should calculate sunset date with custom period', () => {
      const result = calculateSunsetDate('2024-01-01', 90);
      expect(result).toBe('2024-03-31'); // 90 days later
    });

    it('should handle different months', () => {
      const result = calculateSunsetDate('2024-06-01', 30);
      expect(result).toBe('2024-07-01'); // 30 days later
    });
  });

  describe('isDeprecated', () => {
    it('should return true when isDeprecated is true', () => {
      const info: DeprecationInfo = {
        isDeprecated: true,
      };
      expect(isDeprecated(info)).toBe(true);
    });

    it('should return false when isDeprecated is false', () => {
      const info: DeprecationInfo = {
        isDeprecated: false,
      };
      expect(isDeprecated(info)).toBe(false);
    });
  });

  describe('isSunset', () => {
    it('should return true when sunset date has passed', () => {
      const info: DeprecationInfo = {
        isDeprecated: true,
        sunsetDate: '2023-01-01',
      };
      const currentDate = new Date('2024-01-01');
      expect(isSunset(info, currentDate)).toBe(true);
    });

    it('should return false when sunset date has not passed', () => {
      const info: DeprecationInfo = {
        isDeprecated: true,
        sunsetDate: '2025-01-01',
      };
      const currentDate = new Date('2024-01-01');
      expect(isSunset(info, currentDate)).toBe(false);
    });

    it('should return false when not deprecated', () => {
      const info: DeprecationInfo = {
        isDeprecated: false,
        sunsetDate: '2023-01-01',
      };
      const currentDate = new Date('2024-01-01');
      expect(isSunset(info, currentDate)).toBe(false);
    });

    it('should return false when no sunset date', () => {
      const info: DeprecationInfo = {
        isDeprecated: true,
      };
      expect(isSunset(info)).toBe(false);
    });

    it('should return true on the exact sunset date', () => {
      const info: DeprecationInfo = {
        isDeprecated: true,
        sunsetDate: '2024-01-01',
      };
      const currentDate = new Date('2024-01-01');
      expect(isSunset(info, currentDate)).toBe(true);
    });
  });

  describe('getDaysUntilSunset', () => {
    it('should calculate days remaining until sunset', () => {
      const info: DeprecationInfo = {
        isDeprecated: true,
        sunsetDate: '2024-12-31',
      };
      const currentDate = new Date('2024-12-01');
      expect(getDaysUntilSunset(info, currentDate)).toBe(30);
    });

    it('should return negative days for past sunset', () => {
      const info: DeprecationInfo = {
        isDeprecated: true,
        sunsetDate: '2024-01-01',
      };
      const currentDate = new Date('2024-12-01');
      const days = getDaysUntilSunset(info, currentDate);
      expect(days).toBeLessThan(0);
    });

    it('should return null when not deprecated', () => {
      const info: DeprecationInfo = {
        isDeprecated: false,
        sunsetDate: '2024-12-31',
      };
      expect(getDaysUntilSunset(info)).toBeNull();
    });

    it('should return null when no sunset date', () => {
      const info: DeprecationInfo = {
        isDeprecated: true,
      };
      expect(getDaysUntilSunset(info)).toBeNull();
    });
  });

  describe('createDeprecationInfo', () => {
    it('should create basic deprecation info', () => {
      const result = createDeprecationInfo({
        deprecatedAt: '2024-01-01',
      });

      expect(result.isDeprecated).toBe(true);
      expect(result.deprecatedAt).toBe('2024-01-01');
      expect(result.sunsetDate).toBe('2024-06-29');
    });

    it('should create deprecation info with custom sunset period', () => {
      const result = createDeprecationInfo({
        deprecatedAt: '2024-01-01',
        sunsetPeriodDays: 90,
      });

      expect(result.sunsetDate).toBe('2024-03-31');
    });

    it('should include optional fields', () => {
      const result = createDeprecationInfo({
        deprecatedAt: '2024-01-01',
        reason: 'Use v2 instead',
        replacementEndpoint: '/api/v2/users',
        migrationGuide: 'https://docs.example.com/migrate',
      });

      expect(result.reason).toBe('Use v2 instead');
      expect(result.replacementEndpoint).toBe('/api/v2/users');
      expect(result.migrationGuide).toBe('https://docs.example.com/migrate');
    });
  });

  describe('generateDeprecationWarning', () => {
    it('should generate basic warning message', () => {
      const info: DeprecationInfo = {
        isDeprecated: true,
        sunsetDate: '2024-12-31',
      };
      const message = generateDeprecationWarning('v1', info);
      expect(message).toBe(
        'API version v1 is deprecated and will be sunset on 2024-12-31.'
      );
    });

    it('should include replacement endpoint', () => {
      const info: DeprecationInfo = {
        isDeprecated: true,
        sunsetDate: '2024-12-31',
        replacementEndpoint: '/api/v2/users',
      };
      const message = generateDeprecationWarning('v1', info);
      expect(message).toContain('Please migrate to /api/v2/users.');
    });

    it('should include reason when no replacement endpoint', () => {
      const info: DeprecationInfo = {
        isDeprecated: true,
        sunsetDate: '2024-12-31',
        reason: 'This endpoint is no longer supported.',
      };
      const message = generateDeprecationWarning('v1', info);
      expect(message).toContain('This endpoint is no longer supported.');
    });

    it('should include migration guide', () => {
      const info: DeprecationInfo = {
        isDeprecated: true,
        sunsetDate: '2024-12-31',
        migrationGuide: 'https://docs.example.com/migrate',
      };
      const message = generateDeprecationWarning('v1', info);
      expect(message).toContain('See migration guide: https://docs.example.com/migrate');
    });

    it('should return empty string for non-deprecated', () => {
      const info: DeprecationInfo = {
        isDeprecated: false,
      };
      const message = generateDeprecationWarning('v1', info);
      expect(message).toBe('');
    });

    it('should handle deprecated without sunset date', () => {
      const info: DeprecationInfo = {
        isDeprecated: true,
        replacementEndpoint: '/api/v2/users',
      };
      const message = generateDeprecationWarning('v1', info);
      expect(message).toBe('API version v1 is deprecated. Please migrate to /api/v2/users.');
    });
  });

  describe('shouldDeprecateVersion', () => {
    it('should deprecate version 2 versions behind', () => {
      expect(shouldDeprecateVersion('v1', 'v3', 2)).toBe(true);
    });

    it('should not deprecate version 1 version behind', () => {
      expect(shouldDeprecateVersion('v2', 'v3', 2)).toBe(false);
    });

    it('should not deprecate latest version', () => {
      expect(shouldDeprecateVersion('v3', 'v3', 2)).toBe(false);
    });

    it('should not deprecate future version', () => {
      expect(shouldDeprecateVersion('v4', 'v3', 2)).toBe(false);
    });

    it('should handle custom deprecation threshold', () => {
      expect(shouldDeprecateVersion('v1', 'v2', 1)).toBe(true);
      expect(shouldDeprecateVersion('v1', 'v4', 3)).toBe(true);
      expect(shouldDeprecateVersion('v2', 'v4', 3)).toBe(false);
    });

    it('should handle invalid versions gracefully', () => {
      expect(shouldDeprecateVersion('invalid', 'v3', 2)).toBe(false);
    });
  });

  describe('filterDeprecatedVersions', () => {
    it('should filter versions with deprecated status', () => {
      const versions: VersionMetadata[] = [
        {
          version: 'v1',
          status: 'deprecated',
          releaseDate: '2023-01-01',
        },
        {
          version: 'v2',
          status: 'active',
          releaseDate: '2024-01-01',
        },
      ];

      const result = filterDeprecatedVersions(versions);
      expect(result).toHaveLength(1);
      expect(result[0].version).toBe('v1');
    });

    it('should filter versions with deprecationInfo', () => {
      const versions: VersionMetadata[] = [
        {
          version: 'v1',
          status: 'active',
          releaseDate: '2023-01-01',
          deprecationInfo: {
            isDeprecated: true,
            sunsetDate: '2024-12-31',
          },
        },
        {
          version: 'v2',
          status: 'active',
          releaseDate: '2024-01-01',
        },
      ];

      const result = filterDeprecatedVersions(versions);
      expect(result).toHaveLength(1);
      expect(result[0].version).toBe('v1');
    });

    it('should return empty array when no deprecated versions', () => {
      const versions: VersionMetadata[] = [
        {
          version: 'v2',
          status: 'active',
          releaseDate: '2024-01-01',
        },
      ];

      const result = filterDeprecatedVersions(versions);
      expect(result).toHaveLength(0);
    });
  });

  describe('getActiveVersions', () => {
    it('should return only active versions', () => {
      const versions: VersionMetadata[] = [
        {
          version: 'v1',
          status: 'sunset',
          releaseDate: '2023-01-01',
        },
        {
          version: 'v2',
          status: 'deprecated',
          releaseDate: '2023-06-01',
        },
        {
          version: 'v3',
          status: 'active',
          releaseDate: '2024-01-01',
        },
      ];

      const result = getActiveVersions(versions);
      expect(result).toHaveLength(2);
      expect(result.map(v => v.version)).toEqual(['v2', 'v3']);
    });

    it('should exclude versions past sunset date', () => {
      const versions: VersionMetadata[] = [
        {
          version: 'v1',
          status: 'deprecated',
          releaseDate: '2023-01-01',
          deprecationInfo: {
            isDeprecated: true,
            sunsetDate: '2023-12-31',
          },
        },
        {
          version: 'v2',
          status: 'active',
          releaseDate: '2024-01-01',
        },
      ];

      const currentDate = new Date('2024-06-01');
      const result = getActiveVersions(versions, currentDate);
      expect(result).toHaveLength(1);
      expect(result[0].version).toBe('v2');
    });

    it('should include deprecated versions before sunset', () => {
      const versions: VersionMetadata[] = [
        {
          version: 'v1',
          status: 'deprecated',
          releaseDate: '2023-01-01',
          deprecationInfo: {
            isDeprecated: true,
            sunsetDate: '2025-12-31',
          },
        },
        {
          version: 'v2',
          status: 'active',
          releaseDate: '2024-01-01',
        },
      ];

      const currentDate = new Date('2024-06-01');
      const result = getActiveVersions(versions, currentDate);
      expect(result).toHaveLength(2);
    });
  });

  describe('createDeprecationHeaders', () => {
    it('should create headers for deprecated version', () => {
      const info: DeprecationInfo = {
        isDeprecated: true,
        deprecatedAt: '2024-01-01',
        sunsetDate: '2024-12-31',
        migrationGuide: 'https://docs.example.com/migrate',
      };

      const headers = createDeprecationHeaders('v1', info);
      expect(headers['X-API-Deprecated']).toBe('true');
      expect(headers['X-API-Sunset-Date']).toBe('2024-12-31');
      expect(headers['X-Migration-Guide']).toBe('https://docs.example.com/migrate');
      expect(headers['X-API-Deprecated-At']).toBe('2024-01-01');
    });

    it('should return empty object for non-deprecated', () => {
      const info: DeprecationInfo = {
        isDeprecated: false,
      };

      const headers = createDeprecationHeaders('v1', info);
      expect(headers).toEqual({});
    });

    it('should handle partial deprecation info', () => {
      const info: DeprecationInfo = {
        isDeprecated: true,
      };

      const headers = createDeprecationHeaders('v1', info);
      expect(headers['X-API-Deprecated']).toBe('true');
      expect(headers['X-API-Sunset-Date']).toBeUndefined();
      expect(headers['X-Migration-Guide']).toBeUndefined();
    });
  });

  describe('sortByDeprecationStatus', () => {
    it('should sort versions by status priority', () => {
      const versions: VersionMetadata[] = [
        {
          version: 'v1',
          status: 'sunset',
          releaseDate: '2022-01-01',
        },
        {
          version: 'v3',
          status: 'active',
          releaseDate: '2024-01-01',
        },
        {
          version: 'v2',
          status: 'deprecated',
          releaseDate: '2023-01-01',
        },
      ];

      const result = sortByDeprecationStatus(versions);
      expect(result.map(v => v.version)).toEqual(['v3', 'v2', 'v1']);
    });

    it('should sort by version within same status', () => {
      const versions: VersionMetadata[] = [
        {
          version: 'v1',
          status: 'active',
          releaseDate: '2023-01-01',
        },
        {
          version: 'v3',
          status: 'active',
          releaseDate: '2024-06-01',
        },
        {
          version: 'v2',
          status: 'active',
          releaseDate: '2024-01-01',
        },
      ];

      const result = sortByDeprecationStatus(versions);
      expect(result.map(v => v.version)).toEqual(['v3', 'v2', 'v1']);
    });

    it('should not modify original array', () => {
      const versions: VersionMetadata[] = [
        {
          version: 'v1',
          status: 'sunset',
          releaseDate: '2022-01-01',
        },
        {
          version: 'v2',
          status: 'active',
          releaseDate: '2024-01-01',
        },
      ];

      const original = [...versions];
      sortByDeprecationStatus(versions);
      expect(versions).toEqual(original);
    });
  });
});
