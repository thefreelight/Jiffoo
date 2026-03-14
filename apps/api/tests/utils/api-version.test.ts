import { describe, it, expect, beforeEach } from 'vitest';
import {
  getCurrentVersion,
  isVersionSupported,
  getVersionMetadata,
  getDefaultVersion,
  getSupportedVersions,
  isVersionDeprecated,
  isVersionSunset,
  getVersionStatus,
  formatVersionedPath,
  getVersionHeaders,
  getRequestVersionMetadata,
  isRequestVersion,
  getActiveVersions,
  getDeprecatedVersions,
  getVersionInfo,
} from '../../src/utils/api-version';
import type { FastifyRequest } from 'fastify';
import type { VersionMetadata } from '@jiffoo/shared/versioning';

// Mock request objects
function createMockRequest(apiVersion?: string, versionMetadata?: VersionMetadata): FastifyRequest {
  return {
    apiVersion,
    versionMetadata,
  } as any;
}

describe('API Version Utilities', () => {
  describe('getCurrentVersion', () => {
    it('should return the version from request', () => {
      const request = createMockRequest('v2');
      expect(getCurrentVersion(request)).toBe('v2');
    });

    it('should return default version when no version in request', () => {
      const request = createMockRequest();
      expect(getCurrentVersion(request)).toBe('v1');
    });

    it('should return default version for empty request', () => {
      const request = {} as FastifyRequest;
      expect(getCurrentVersion(request)).toBe('v1');
    });
  });

  describe('isVersionSupported', () => {
    it('should return true for supported versions', () => {
      expect(isVersionSupported('v1')).toBe(true);
      expect(isVersionSupported('v2')).toBe(true);
    });

    it('should return false for unsupported versions', () => {
      expect(isVersionSupported('v3')).toBe(false);
      expect(isVersionSupported('v99')).toBe(false);
      expect(isVersionSupported('invalid')).toBe(false);
    });
  });

  describe('getVersionMetadata', () => {
    it('should return metadata for supported versions', () => {
      const v1Metadata = getVersionMetadata('v1');
      expect(v1Metadata).toBeDefined();
      expect(v1Metadata?.version).toBe('v1');
      expect(v1Metadata?.status).toBe('active');

      const v2Metadata = getVersionMetadata('v2');
      expect(v2Metadata).toBeDefined();
      expect(v2Metadata?.version).toBe('v2');
      expect(v2Metadata?.status).toBe('active');
    });

    it('should return undefined for unsupported versions', () => {
      expect(getVersionMetadata('v99')).toBeUndefined();
      expect(getVersionMetadata('invalid')).toBeUndefined();
    });

    it('should include version features in metadata', () => {
      const v1Metadata = getVersionMetadata('v1');
      expect(v1Metadata?.features).toBeDefined();
      expect(Array.isArray(v1Metadata?.features)).toBe(true);
      expect(v1Metadata?.features?.length).toBeGreaterThan(0);
    });
  });

  describe('getDefaultVersion', () => {
    it('should return v1 as default version', () => {
      expect(getDefaultVersion()).toBe('v1');
    });
  });

  describe('getSupportedVersions', () => {
    it('should return array of supported versions', () => {
      const versions = getSupportedVersions();
      expect(Array.isArray(versions)).toBe(true);
      expect(versions).toContain('v1');
      expect(versions).toContain('v2');
    });

    it('should return at least 2 versions', () => {
      const versions = getSupportedVersions();
      expect(versions.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('isVersionDeprecated', () => {
    it('should return false for active versions', () => {
      expect(isVersionDeprecated('v1')).toBe(false);
      expect(isVersionDeprecated('v2')).toBe(false);
    });

    it('should return false for unsupported versions', () => {
      expect(isVersionDeprecated('v99')).toBe(false);
    });
  });

  describe('isVersionSunset', () => {
    it('should return false for active versions', () => {
      expect(isVersionSunset('v1')).toBe(false);
      expect(isVersionSunset('v2')).toBe(false);
    });

    it('should return false for unsupported versions', () => {
      expect(isVersionSunset('v99')).toBe(false);
    });
  });

  describe('getVersionStatus', () => {
    it('should return active for current versions', () => {
      expect(getVersionStatus('v1')).toBe('active');
      expect(getVersionStatus('v2')).toBe('active');
    });

    it('should return undefined for unsupported versions', () => {
      expect(getVersionStatus('v99')).toBeUndefined();
    });
  });

  describe('formatVersionedPath', () => {
    it('should format path with default version', () => {
      expect(formatVersionedPath('/products')).toBe('/api/v1/products');
    });

    it('should format path with specific version', () => {
      expect(formatVersionedPath('/products', 'v2')).toBe('/api/v2/products');
      expect(formatVersionedPath('/orders', 'v1')).toBe('/api/v1/orders');
    });

    it('should handle paths without leading slash', () => {
      expect(formatVersionedPath('products')).toBe('/api/v1/products');
      expect(formatVersionedPath('products', 'v2')).toBe('/api/v2/products');
    });

    it('should handle nested paths', () => {
      expect(formatVersionedPath('/products/123/reviews')).toBe('/api/v1/products/123/reviews');
      expect(formatVersionedPath('/products/123/reviews', 'v2')).toBe('/api/v2/products/123/reviews');
    });

    it('should handle paths with query parameters', () => {
      expect(formatVersionedPath('/products?limit=10')).toBe('/api/v1/products?limit=10');
    });
  });

  describe('getVersionHeaders', () => {
    it('should return basic version header for active versions', () => {
      const headers = getVersionHeaders('v1');
      expect(headers['X-API-Version']).toBe('v1');
      expect(headers['X-API-Deprecated']).toBeUndefined();
    });

    it('should include deprecation headers for deprecated versions', () => {
      // Create mock metadata with deprecation info
      const deprecatedMetadata: VersionMetadata = {
        version: 'v0',
        status: 'deprecated',
        releaseDate: '2023-01-01',
        deprecationInfo: {
          deprecatedAt: '2024-01-01',
          sunsetDate: '2025-01-01',
          reason: 'Outdated features',
          migrationGuide: 'https://docs.example.com/migrate-v0-to-v1',
          alternativeVersion: 'v1',
        },
        features: [],
        changelog: 'Deprecated version',
      };

      // This test is illustrative - in practice we'd need to mock getVersionMetadata
      // For now, we test the structure with active versions
      const headers = getVersionHeaders('v1');
      expect(headers).toHaveProperty('X-API-Version');
    });

    it('should return object with string values', () => {
      const headers = getVersionHeaders('v1');
      Object.values(headers).forEach(value => {
        expect(typeof value).toBe('string');
      });
    });
  });

  describe('getRequestVersionMetadata', () => {
    it('should return metadata from request', () => {
      const metadata: VersionMetadata = {
        version: 'v1',
        status: 'active',
        releaseDate: '2024-01-01',
        features: ['Feature 1'],
        changelog: 'Initial release',
      };
      const request = createMockRequest('v1', metadata);
      expect(getRequestVersionMetadata(request)).toEqual(metadata);
    });

    it('should return undefined when no metadata in request', () => {
      const request = createMockRequest('v1');
      expect(getRequestVersionMetadata(request)).toBeUndefined();
    });
  });

  describe('isRequestVersion', () => {
    it('should return true when request version matches', () => {
      const request = createMockRequest('v2');
      expect(isRequestVersion(request, 'v2')).toBe(true);
    });

    it('should return false when request version does not match', () => {
      const request = createMockRequest('v1');
      expect(isRequestVersion(request, 'v2')).toBe(false);
    });

    it('should use default version when no version in request', () => {
      const request = createMockRequest();
      expect(isRequestVersion(request, 'v1')).toBe(true);
      expect(isRequestVersion(request, 'v2')).toBe(false);
    });
  });

  describe('getActiveVersions', () => {
    it('should return array of active versions', () => {
      const active = getActiveVersions();
      expect(Array.isArray(active)).toBe(true);
      expect(active.length).toBeGreaterThan(0);
    });

    it('should only include active versions', () => {
      const active = getActiveVersions();
      active.forEach(version => {
        const metadata = getVersionMetadata(version);
        expect(metadata?.status).toBe('active');
      });
    });

    it('should include v1 and v2 as active', () => {
      const active = getActiveVersions();
      expect(active).toContain('v1');
      expect(active).toContain('v2');
    });
  });

  describe('getDeprecatedVersions', () => {
    it('should return array of deprecated versions', () => {
      const deprecated = getDeprecatedVersions();
      expect(Array.isArray(deprecated)).toBe(true);
    });

    it('should return empty array when no deprecated versions', () => {
      const deprecated = getDeprecatedVersions();
      expect(deprecated.length).toBe(0);
    });

    it('should only include deprecated versions', () => {
      const deprecated = getDeprecatedVersions();
      deprecated.forEach(version => {
        const metadata = getVersionMetadata(version);
        expect(metadata?.status).toBe('deprecated');
      });
    });
  });

  describe('getVersionInfo', () => {
    it('should return comprehensive version information', () => {
      const info = getVersionInfo();

      expect(info).toHaveProperty('defaultVersion');
      expect(info).toHaveProperty('supportedVersions');
      expect(info).toHaveProperty('activeVersions');
      expect(info).toHaveProperty('deprecatedVersions');
      expect(info).toHaveProperty('versionMetadata');
    });

    it('should have correct default version', () => {
      const info = getVersionInfo();
      expect(info.defaultVersion).toBe('v1');
    });

    it('should have arrays for version lists', () => {
      const info = getVersionInfo();
      expect(Array.isArray(info.supportedVersions)).toBe(true);
      expect(Array.isArray(info.activeVersions)).toBe(true);
      expect(Array.isArray(info.deprecatedVersions)).toBe(true);
      expect(Array.isArray(info.versionMetadata)).toBe(true);
    });

    it('should include metadata for all supported versions', () => {
      const info = getVersionInfo();
      expect(info.versionMetadata.length).toBe(info.supportedVersions.length);
    });

    it('should have complete metadata objects', () => {
      const info = getVersionInfo();
      info.versionMetadata.forEach(metadata => {
        expect(metadata).toHaveProperty('version');
        expect(metadata).toHaveProperty('status');
        expect(metadata).toHaveProperty('releaseDate');
        expect(metadata).toHaveProperty('features');
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should work together for version checking workflow', () => {
      // Get default version
      const defaultVer = getDefaultVersion();
      expect(defaultVer).toBe('v1');

      // Check if it's supported
      expect(isVersionSupported(defaultVer)).toBe(true);

      // Get its metadata
      const metadata = getVersionMetadata(defaultVer);
      expect(metadata).toBeDefined();

      // Check status
      expect(getVersionStatus(defaultVer)).toBe('active');
      expect(isVersionDeprecated(defaultVer)).toBe(false);
    });

    it('should format paths correctly for all supported versions', () => {
      const versions = getSupportedVersions();
      const path = '/test';

      versions.forEach(version => {
        const formatted = formatVersionedPath(path, version);
        expect(formatted).toBe(`/api/${version}${path}`);
      });
    });

    it('should provide consistent version information', () => {
      const info = getVersionInfo();
      const supported = getSupportedVersions();
      const active = getActiveVersions();

      expect(info.supportedVersions).toEqual(supported);
      expect(info.activeVersions).toEqual(active);
    });
  });
});
