/**
 * Versioning Middleware Tests
 *
 * Coverage:
 * - Version extraction from URL
 * - Default version handling
 * - Invalid version format handling
 * - Unsupported version handling
 * - Version metadata attachment
 * - Response headers
 * - Helper functions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  versioningMiddleware,
  getRequestVersion,
  isRequestVersion,
  isRequestVersionDeprecated,
  requireMinVersion,
} from '../../src/middleware/versioning';

// Mock the dependencies
vi.mock('@jiffoo/shared/versioning', () => ({
  extractVersionFromPath: vi.fn((url: string) => {
    const match = url.match(/\/api\/(v\d+)\//);
    return match ? match[1] : null;
  }),
  isValidVersion: vi.fn((version: string) => /^v\d+$/i.test(version)),
  compareVersions: vi.fn((v1: string, v2: string) => {
    const num1 = parseInt(v1.substring(1), 10);
    const num2 = parseInt(v2.substring(1), 10);
    if (num1 < num2) return -1;
    if (num1 > num2) return 1;
    return 0;
  }),
}));

vi.mock('../../src/config/api-versions', () => ({
  apiVersionConfig: {
    defaultVersion: 'v1',
    supportedVersions: ['v1', 'v2'],
    deprecatedVersions: [],
    versionMetadata: {},
  },
  getDefaultVersion: vi.fn(() => 'v1'),
  isSupportedVersion: vi.fn((version: string) => ['v1', 'v2'].includes(version)),
  getVersionMetadata: vi.fn((version: string) => {
    if (version === 'v1') {
      return {
        version: 'v1',
        status: 'active',
        releaseDate: '2024-01-01',
        features: ['Core features'],
        changelog: 'Initial release',
      };
    }
    if (version === 'v2') {
      return {
        version: 'v2',
        status: 'active',
        releaseDate: '2024-06-01',
        features: ['Enhanced features'],
        changelog: 'Major update',
      };
    }
    return undefined;
  }),
}));

describe('Versioning Middleware', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let headers: Record<string, string>;
  let statusCode: number;
  let responseBody: any;

  beforeEach(() => {
    headers = {};
    statusCode = 200;
    responseBody = null;

    mockRequest = {
      url: '/api/v1/products',
      log: {
        error: vi.fn(),
      } as any,
    };

    mockReply = {
      header: vi.fn((key: string, value: string) => {
        headers[key] = value;
        return mockReply as FastifyReply;
      }),
      status: vi.fn((code: number) => {
        statusCode = code;
        return mockReply as FastifyReply;
      }),
      send: vi.fn((body: any) => {
        responseBody = body;
        return mockReply as FastifyReply;
      }),
    };
  });

  describe('versioningMiddleware', () => {
    it('should extract version from URL and set it on request', async () => {
      mockRequest.url = '/api/v1/products';

      await versioningMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect((mockRequest as any).apiVersion).toBe('v1');
      expect(headers['X-API-Version']).toBe('v1');
    });

    it('should use default version when no version in URL', async () => {
      mockRequest.url = '/api/products';

      await versioningMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect((mockRequest as any).apiVersion).toBe('v1');
      expect(headers['X-API-Version']).toBe('v1');
    });

    it('should extract v2 version correctly', async () => {
      mockRequest.url = '/api/v2/products';

      await versioningMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect((mockRequest as any).apiVersion).toBe('v2');
      expect(headers['X-API-Version']).toBe('v2');
    });

    it('should return 400 for invalid version format', async () => {
      mockRequest.url = '/api/invalid/products';

      await versioningMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(statusCode).toBe(400);
      expect(responseBody).toHaveProperty('error', 'Invalid API version format');
      expect(responseBody).toHaveProperty('supportedVersions');
    });

    it('should return 404 for unsupported version', async () => {
      mockRequest.url = '/api/v99/products';

      await versioningMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(statusCode).toBe(404);
      expect(responseBody).toHaveProperty('error', 'Unsupported API version');
      expect(responseBody).toHaveProperty('supportedVersions');
      expect(responseBody).toHaveProperty('defaultVersion');
    });

    it('should attach version metadata to request', async () => {
      mockRequest.url = '/api/v1/products';

      await versioningMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect((mockRequest as any).versionMetadata).toBeDefined();
      expect((mockRequest as any).versionMetadata.version).toBe('v1');
      expect((mockRequest as any).versionMetadata.status).toBe('active');
    });

    it('should add deprecation headers for deprecated versions', async () => {
      // Mock a deprecated version
      const { getVersionMetadata } = await import('../../src/config/api-versions');
      (getVersionMetadata as any).mockReturnValueOnce({
        version: 'v1',
        status: 'deprecated',
        releaseDate: '2024-01-01',
        deprecationInfo: {
          deprecatedAt: '2024-12-01',
          sunsetDate: '2025-06-01',
          migrationGuide: 'https://docs.example.com/migrate-v1-to-v2',
          reason: 'Superseded by v2',
        },
      });

      mockRequest.url = '/api/v1/products';

      await versioningMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(headers['X-API-Deprecated']).toBe('true');
      expect(headers['X-API-Sunset-Date']).toBe('2025-06-01');
      expect(headers['X-Migration-Guide']).toBe('https://docs.example.com/migrate-v1-to-v2');
    });

    it('should handle errors gracefully', async () => {
      // Mock extractVersionFromPath to throw an error
      const { extractVersionFromPath } = await import('@jiffoo/shared/versioning');
      (extractVersionFromPath as any).mockImplementationOnce(() => {
        throw new Error('Test error');
      });

      mockRequest.url = '/api/v1/products';

      await versioningMiddleware(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(statusCode).toBe(500);
      expect(responseBody).toHaveProperty('error', 'Internal server error');
      expect(mockRequest.log?.error).toHaveBeenCalled();
    });
  });

  describe('getRequestVersion', () => {
    it('should return the version from request', () => {
      (mockRequest as any).apiVersion = 'v2';
      const version = getRequestVersion(mockRequest as FastifyRequest);
      expect(version).toBe('v2');
    });

    it('should return default version if not set', () => {
      const version = getRequestVersion(mockRequest as FastifyRequest);
      expect(version).toBe('v1');
    });
  });

  describe('isRequestVersion', () => {
    it('should return true for matching version', () => {
      (mockRequest as any).apiVersion = 'v1';
      const result = isRequestVersion(mockRequest as FastifyRequest, 'v1');
      expect(result).toBe(true);
    });

    it('should return false for non-matching version', () => {
      (mockRequest as any).apiVersion = 'v1';
      const result = isRequestVersion(mockRequest as FastifyRequest, 'v2');
      expect(result).toBe(false);
    });
  });

  describe('isRequestVersionDeprecated', () => {
    it('should return true for deprecated version', () => {
      (mockRequest as any).versionMetadata = {
        version: 'v1',
        status: 'deprecated',
      };
      const result = isRequestVersionDeprecated(mockRequest as FastifyRequest);
      expect(result).toBe(true);
    });

    it('should return false for active version', () => {
      (mockRequest as any).versionMetadata = {
        version: 'v2',
        status: 'active',
      };
      const result = isRequestVersionDeprecated(mockRequest as FastifyRequest);
      expect(result).toBe(false);
    });

    it('should return false if metadata not set', () => {
      const result = isRequestVersionDeprecated(mockRequest as FastifyRequest);
      expect(result).toBe(false);
    });
  });

  describe('requireMinVersion', () => {
    it('should allow requests with exact minimum version', async () => {
      (mockRequest as any).apiVersion = 'v2';
      const middleware = requireMinVersion('v2');

      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(statusCode).toBe(200);
      expect(responseBody).toBeNull();
    });

    it('should allow requests with higher than minimum version', async () => {
      (mockRequest as any).apiVersion = 'v2';
      const middleware = requireMinVersion('v1');

      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(statusCode).toBe(200);
      expect(responseBody).toBeNull();
    });

    it('should reject requests with lower than minimum version', async () => {
      (mockRequest as any).apiVersion = 'v1';
      const middleware = requireMinVersion('v2');

      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(statusCode).toBe(426);
      expect(responseBody).toHaveProperty('error', 'Upgrade Required');
      expect(responseBody).toHaveProperty('requiredVersion', 'v2');
      expect(responseBody).toHaveProperty('currentVersion', 'v1');
    });

    it('should handle comparison errors gracefully', async () => {
      (mockRequest as any).apiVersion = 'v1';
      const middleware = requireMinVersion('v2');

      // Mock compareVersions to throw an error
      const { compareVersions } = await import('@jiffoo/shared/versioning');
      (compareVersions as any).mockImplementationOnce(() => {
        throw new Error('Comparison error');
      });

      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(statusCode).toBe(500);
      expect(responseBody).toHaveProperty('error', 'Internal server error');
      expect(mockRequest.log?.error).toHaveBeenCalled();
    });
  });
});
