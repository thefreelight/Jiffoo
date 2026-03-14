/**
 * Deprecation Middleware Tests
 *
 * Coverage:
 * - Deprecated version handling
 * - Sunset version handling (410 Gone)
 * - Deprecation headers
 * - Warning headers (RFC 7234)
 * - Route-level deprecation
 * - Endpoint deprecation middleware factory
 * - Helper functions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FastifyRequest, FastifyReply } from 'fastify';
import {
  deprecationMiddleware,
  isRequestDeprecated,
  getRequestDeprecationInfo,
  getRequestDaysUntilSunset,
  deprecateEndpoint,
  isVersionDeprecated,
  getDeprecationMessage,
} from '../../src/middleware/deprecation';

// Mock the dependencies
vi.mock('@jiffoo/shared/versioning', () => ({
  createDeprecationHeaders: vi.fn((version: string, deprecationInfo: any) => {
    if (!deprecationInfo.isDeprecated) {
      return {};
    }
    const headers: Record<string, string> = {
      'X-API-Deprecated': 'true',
    };
    if (deprecationInfo.sunsetDate) {
      headers['X-API-Sunset-Date'] = deprecationInfo.sunsetDate;
    }
    if (deprecationInfo.migrationGuide) {
      headers['X-Migration-Guide'] = deprecationInfo.migrationGuide;
    }
    if (deprecationInfo.deprecatedAt) {
      headers['X-API-Deprecated-At'] = deprecationInfo.deprecatedAt;
    }
    return headers;
  }),
  generateDeprecationWarning: vi.fn((version: string, deprecationInfo: any) => {
    if (!deprecationInfo.isDeprecated) {
      return '';
    }
    let message = `API version ${version} is deprecated`;
    if (deprecationInfo.sunsetDate) {
      message += ` and will be sunset on ${deprecationInfo.sunsetDate}`;
    }
    message += '.';
    if (deprecationInfo.replacementEndpoint) {
      message += ` Please migrate to ${deprecationInfo.replacementEndpoint}.`;
    }
    if (deprecationInfo.migrationGuide) {
      message += ` See migration guide: ${deprecationInfo.migrationGuide}`;
    }
    return message;
  }),
  getDaysUntilSunset: vi.fn((deprecationInfo: any) => {
    if (!deprecationInfo.isDeprecated || !deprecationInfo.sunsetDate) {
      return null;
    }
    const sunsetDate = new Date(deprecationInfo.sunsetDate);
    const currentDate = new Date();
    const timeDiff = sunsetDate.getTime() - currentDate.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    return daysDiff;
  }),
  isSunset: vi.fn((deprecationInfo: any, currentDate?: Date) => {
    if (!deprecationInfo.isDeprecated || !deprecationInfo.sunsetDate) {
      return false;
    }
    const sunsetDate = new Date(deprecationInfo.sunsetDate);
    const compareDate = currentDate || new Date();
    return compareDate >= sunsetDate;
  }),
}));

vi.mock('../../src/config/api-versions', () => ({
  getVersionMetadata: vi.fn((version: string) => {
    if (version === 'v1') {
      return {
        version: 'v1',
        status: 'deprecated',
        releaseDate: '2024-01-01',
        features: ['Core features'],
        changelog: 'Initial release',
        deprecationInfo: {
          isDeprecated: true,
          deprecatedAt: '2024-06-01',
          sunsetDate: '2024-12-31',
          reason: 'Replaced by v2',
          replacementEndpoint: '/api/v2/',
          migrationGuide: 'https://docs.example.com/migrate-v2',
        },
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
    if (version === 'v0') {
      return {
        version: 'v0',
        status: 'deprecated',
        releaseDate: '2023-01-01',
        features: ['Legacy features'],
        changelog: 'Legacy version',
        deprecationInfo: {
          isDeprecated: true,
          deprecatedAt: '2024-01-01',
          sunsetDate: '2024-01-31',
          reason: 'Sunset - no longer supported',
          replacementEndpoint: '/api/v2/',
        },
      };
    }
    return undefined;
  }),
}));

describe('Deprecation Middleware', () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let headers: Record<string, string>;
  let statusCode: number;
  let responseBody: any;
  let logCalls: any[];

  beforeEach(() => {
    headers = {};
    statusCode = 200;
    responseBody = null;
    logCalls = [];

    mockRequest = {
      url: '/api/v1/products',
      method: 'GET',
      ip: '127.0.0.1',
      log: {
        warn: vi.fn((...args: any[]) => {
          logCalls.push({ level: 'warn', args });
        }),
        error: vi.fn((...args: any[]) => {
          logCalls.push({ level: 'error', args });
        }),
      } as any,
      routeOptions: {} as any,
    };

    mockReply = {
      header: vi.fn((key: string, value: string) => {
        headers[key] = value;
        return mockReply as FastifyReply;
      }),
      getHeader: vi.fn((key: string) => headers[key]),
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

  describe('deprecationMiddleware', () => {
    it('should add deprecation headers for deprecated version', async () => {
      (mockRequest as any).apiVersion = 'v1';
      (mockRequest as any).versionMetadata = {
        version: 'v1',
        status: 'deprecated',
        deprecationInfo: {
          isDeprecated: true,
          deprecatedAt: '2024-06-01',
          sunsetDate: '2024-12-31',
          migrationGuide: 'https://docs.example.com/migrate-v2',
        },
      };

      await deprecationMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(headers['X-API-Deprecated']).toBe('true');
      expect(headers['X-API-Sunset-Date']).toBe('2024-12-31');
      expect(headers['X-Migration-Guide']).toBe('https://docs.example.com/migrate-v2');
      expect(headers['X-API-Deprecated-At']).toBe('2024-06-01');
      expect(statusCode).toBe(200);
    });

    it('should add Warning header for deprecated version', async () => {
      (mockRequest as any).apiVersion = 'v1';
      (mockRequest as any).versionMetadata = {
        version: 'v1',
        status: 'deprecated',
        deprecationInfo: {
          isDeprecated: true,
          deprecatedAt: '2024-06-01',
          sunsetDate: '2024-12-31',
        },
      };

      await deprecationMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(headers['Warning']).toContain('299');
      expect(headers['Warning']).toContain('Deprecated API version');
      expect(statusCode).toBe(200);
    });

    it('should log warning for deprecated version usage', async () => {
      (mockRequest as any).apiVersion = 'v1';
      (mockRequest as any).versionMetadata = {
        version: 'v1',
        status: 'deprecated',
        deprecationInfo: {
          isDeprecated: true,
          deprecatedAt: '2024-06-01',
          sunsetDate: '2024-12-31',
        },
      };

      await deprecationMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(logCalls).toHaveLength(1);
      expect(logCalls[0].level).toBe('warn');
      expect(logCalls[0].args[0]).toMatchObject({
        message: 'Deprecated API version accessed',
        version: 'v1',
      });
    });

    it('should return 410 Gone for sunset version', async () => {
      // Mock isSunset to return true for this test
      const { isSunset } = await import('@jiffoo/shared/versioning');
      vi.mocked(isSunset).mockReturnValueOnce(true);

      (mockRequest as any).apiVersion = 'v0';
      (mockRequest as any).versionMetadata = {
        version: 'v0',
        status: 'deprecated',
        deprecationInfo: {
          isDeprecated: true,
          deprecatedAt: '2024-01-01',
          sunsetDate: '2024-01-31',
          replacementEndpoint: '/api/v2/',
        },
      };

      await deprecationMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(statusCode).toBe(410);
      expect(responseBody).toMatchObject({
        error: 'Gone',
        message: expect.stringContaining('has been sunset'),
        sunsetDate: '2024-01-31',
        replacementVersion: '/api/v2/',
      });
    });

    it('should skip if no version information available', async () => {
      (mockRequest as any).apiVersion = undefined;
      (mockRequest as any).versionMetadata = undefined;

      await deprecationMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(Object.keys(headers)).toHaveLength(0);
      expect(statusCode).toBe(200);
      expect(logCalls).toHaveLength(0);
    });

    it('should skip if version is not deprecated', async () => {
      (mockRequest as any).apiVersion = 'v2';
      (mockRequest as any).versionMetadata = {
        version: 'v2',
        status: 'active',
      };

      await deprecationMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(headers['X-API-Deprecated']).toBeUndefined();
      expect(headers['Warning']).toBeUndefined();
      expect(statusCode).toBe(200);
    });

    it('should handle route-level deprecation', async () => {
      (mockRequest as any).apiVersion = 'v2';
      (mockRequest as any).versionMetadata = {
        version: 'v2',
        status: 'active',
      };
      (mockRequest as any).routeOptions = {
        schema: {
          deprecated: true,
        },
      };

      await deprecationMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(headers['X-Endpoint-Deprecated']).toBe('true');
      expect(headers['Warning']).toContain('This endpoint is deprecated');
      expect(logCalls).toHaveLength(1);
      expect(logCalls[0].args[0].message).toBe('Deprecated endpoint accessed');
    });

    it('should combine version and endpoint deprecation warnings', async () => {
      (mockRequest as any).apiVersion = 'v1';
      (mockRequest as any).versionMetadata = {
        version: 'v1',
        status: 'deprecated',
        deprecationInfo: {
          isDeprecated: true,
          deprecatedAt: '2024-06-01',
          sunsetDate: '2024-12-31',
        },
      };
      (mockRequest as any).routeOptions = {
        schema: {
          deprecated: true,
        },
      };

      await deprecationMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(headers['X-API-Deprecated']).toBe('true');
      expect(headers['X-Endpoint-Deprecated']).toBe('true');
      expect(headers['Warning']).toContain('Deprecated API version');
      expect(headers['Warning']).toContain('This endpoint is deprecated');
      expect(logCalls).toHaveLength(2);
    });

    it('should handle errors gracefully', async () => {
      (mockRequest as any).apiVersion = 'v1';
      (mockRequest as any).versionMetadata = {
        version: 'v1',
        status: 'deprecated',
        deprecationInfo: {
          isDeprecated: true,
          deprecatedAt: '2024-06-01',
          sunsetDate: '2027-12-31',
        },
      };

      // Mock generateDeprecationWarning to throw an error
      const { generateDeprecationWarning } = await import('@jiffoo/shared/versioning');
      const originalMock = vi.mocked(generateDeprecationWarning);
      vi.mocked(generateDeprecationWarning).mockImplementationOnce(() => {
        throw new Error('Test error');
      });

      await deprecationMiddleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      // Restore mock
      vi.mocked(generateDeprecationWarning).mockImplementation(originalMock.getMockImplementation() as any);

      // Should log error but not throw
      const errorLogs = logCalls.filter((log) => log.level === 'error');
      expect(errorLogs).toHaveLength(1);
      expect(errorLogs[0].args[0].message).toBe('Error in deprecation middleware');
    });
  });

  describe('isRequestDeprecated', () => {
    it('should return true for deprecated version', () => {
      (mockRequest as any).versionMetadata = {
        status: 'deprecated',
      };

      const result = isRequestDeprecated(mockRequest as FastifyRequest);
      expect(result).toBe(true);
    });

    it('should return false for active version', () => {
      (mockRequest as any).versionMetadata = {
        status: 'active',
      };

      const result = isRequestDeprecated(mockRequest as FastifyRequest);
      expect(result).toBe(false);
    });

    it('should return false if no version metadata', () => {
      (mockRequest as any).versionMetadata = undefined;

      const result = isRequestDeprecated(mockRequest as FastifyRequest);
      expect(result).toBe(false);
    });
  });

  describe('getRequestDeprecationInfo', () => {
    it('should return deprecation info for deprecated version', () => {
      const deprecationInfo = {
        isDeprecated: true,
        sunsetDate: '2024-12-31',
      };
      (mockRequest as any).versionMetadata = {
        status: 'deprecated',
        deprecationInfo,
      };

      const result = getRequestDeprecationInfo(mockRequest as FastifyRequest);
      expect(result).toEqual(deprecationInfo);
    });

    it('should return null for active version', () => {
      (mockRequest as any).versionMetadata = {
        status: 'active',
      };

      const result = getRequestDeprecationInfo(mockRequest as FastifyRequest);
      expect(result).toBeNull();
    });

    it('should return null if no version metadata', () => {
      (mockRequest as any).versionMetadata = undefined;

      const result = getRequestDeprecationInfo(mockRequest as FastifyRequest);
      expect(result).toBeNull();
    });
  });

  describe('getRequestDaysUntilSunset', () => {
    it('should return days until sunset', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      (mockRequest as any).versionMetadata = {
        status: 'deprecated',
        deprecationInfo: {
          isDeprecated: true,
          sunsetDate: futureDate.toISOString().split('T')[0],
        },
      };

      const result = getRequestDaysUntilSunset(mockRequest as FastifyRequest);
      expect(result).toBeGreaterThanOrEqual(29);
      expect(result).toBeLessThanOrEqual(31);
    });

    it('should return null for non-deprecated version', () => {
      (mockRequest as any).versionMetadata = {
        status: 'active',
      };

      const result = getRequestDaysUntilSunset(mockRequest as FastifyRequest);
      expect(result).toBeNull();
    });
  });

  describe('deprecateEndpoint', () => {
    it('should add endpoint deprecation headers', async () => {
      const middleware = deprecateEndpoint({
        reason: 'Use new endpoint',
        replacementEndpoint: '/api/v1/new-endpoint',
        sunsetDate: '2027-01-01',
        migrationGuide: 'https://docs.example.com/migrate',
      });

      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(headers['X-Endpoint-Deprecated']).toBe('true');
      expect(headers['X-Endpoint-Sunset-Date']).toBe('2027-01-01');
      expect(headers['X-Replacement-Endpoint']).toBe('/api/v1/new-endpoint');
      expect(headers['X-Migration-Guide']).toBe('https://docs.example.com/migrate');
      expect(headers['Warning']).toContain('299');
      expect(headers['Warning']).toContain('Use new endpoint');
    });

    it('should return 410 Gone if sunset date passed', async () => {
      const middleware = deprecateEndpoint({
        sunsetDate: '2020-01-01',
        replacementEndpoint: '/api/v1/new-endpoint',
      });

      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(statusCode).toBe(410);
      expect(responseBody).toMatchObject({
        error: 'Gone',
        message: expect.stringContaining('has been sunset'),
        sunsetDate: '2020-01-01',
        replacementEndpoint: '/api/v1/new-endpoint',
      });
    });

    it('should work without optional parameters', async () => {
      const middleware = deprecateEndpoint({});

      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(headers['X-Endpoint-Deprecated']).toBe('true');
      expect(headers['Warning']).toContain('This endpoint is deprecated');
      expect(statusCode).toBe(200);
    });

    it('should log deprecation warning', async () => {
      const middleware = deprecateEndpoint({
        reason: 'Legacy endpoint',
        replacementEndpoint: '/api/v2/users',
      });

      await middleware(mockRequest as FastifyRequest, mockReply as FastifyReply);

      expect(logCalls).toHaveLength(1);
      expect(logCalls[0].level).toBe('warn');
      expect(logCalls[0].args[0]).toMatchObject({
        message: 'Deprecated endpoint accessed',
        reason: 'Legacy endpoint',
        replacementEndpoint: '/api/v2/users',
      });
    });
  });

  describe('isVersionDeprecated', () => {
    it('should return true for deprecated version', () => {
      const result = isVersionDeprecated('v1');
      expect(result).toBe(true);
    });

    it('should return false for active version', () => {
      const result = isVersionDeprecated('v2');
      expect(result).toBe(false);
    });

    it('should return false for unknown version', () => {
      const result = isVersionDeprecated('v99');
      expect(result).toBe(false);
    });
  });

  describe('getDeprecationMessage', () => {
    it('should return deprecation message for deprecated version', () => {
      (mockRequest as any).apiVersion = 'v1';
      (mockRequest as any).versionMetadata = {
        status: 'deprecated',
        deprecationInfo: {
          isDeprecated: true,
          sunsetDate: '2024-12-31',
          replacementEndpoint: '/api/v2/',
          migrationGuide: 'https://docs.example.com/migrate-v2',
        },
      };

      const result = getDeprecationMessage(mockRequest as FastifyRequest);
      expect(result).toContain('API version v1 is deprecated');
      expect(result).toContain('2024-12-31');
      expect(result).toContain('/api/v2/');
    });

    it('should return null for active version', () => {
      (mockRequest as any).apiVersion = 'v2';
      (mockRequest as any).versionMetadata = {
        status: 'active',
      };

      const result = getDeprecationMessage(mockRequest as FastifyRequest);
      expect(result).toBeNull();
    });

    it('should return null if no version metadata', () => {
      (mockRequest as any).apiVersion = undefined;
      (mockRequest as any).versionMetadata = undefined;

      const result = getDeprecationMessage(mockRequest as FastifyRequest);
      expect(result).toBeNull();
    });
  });
});
