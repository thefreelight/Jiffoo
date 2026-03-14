/**
 * Plugin Compatibility Integration Tests
 *
 * Coverage:
 * - Compatible plugin validation
 * - Incompatible plugin rejection
 * - Version requirement checking
 * - Invalid version format handling
 * - Plugin compatibility reports
 * - Multiple plugin batch checking
 * - Plugin loader error handling
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/create-test-app';
import {
  validatePluginCompatibility,
  checkPluginApiCompatibility,
  validateManifestVersionInfo,
  getCurrentApiVersion,
  getPluginCompatibilityStatus,
  getCompatibilityReport,
  checkMultiplePlugins,
  PluginLoaderError,
} from '@/plugins/loader';
import type { PluginManifest } from '@/core/admin/extension-installer/types';

describe('Plugin Compatibility Integration', () => {
  let app: FastifyInstance;
  let currentApiVersion: string;

  beforeAll(async () => {
    app = await createTestApp();
    currentApiVersion = getCurrentApiVersion();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Compatible Plugin Validation', () => {
    it('should accept plugin with compatible minApiVersion', () => {
      const manifest: PluginManifest = {
        schemaVersion: 1,
        slug: 'payment-gateway',
        name: 'Payment Gateway',
        version: '1.0.0',
        description: 'A payment processing plugin',
        runtimeType: 'internal-fastify',
        permissions: ['payments.process'],
        minApiVersion: 'v1',
      };

      expect(() => validatePluginCompatibility(manifest)).not.toThrow();
    });

    it('should accept plugin without minApiVersion', () => {
      const manifest: PluginManifest = {
        schemaVersion: 1,
        slug: 'legacy-widget',
        name: 'Legacy Widget',
        version: '1.0.0',
        description: 'A legacy widget plugin',
        runtimeType: 'internal-fastify',
        permissions: [],
      };

      expect(() => validatePluginCompatibility(manifest)).not.toThrow();
    });

    it('should return compatible status for v1 plugin', () => {
      const manifest: PluginManifest = {
        schemaVersion: 1,
        slug: 'analytics',
        name: 'Analytics Plugin',
        version: '2.1.0',
        description: 'Analytics tracking plugin',
        runtimeType: 'internal-fastify',
        permissions: ['analytics.track'],
        minApiVersion: 'v1',
      };

      const result = checkPluginApiCompatibility(manifest);

      expect(result.compatible).toBe(true);
      expect(result.currentApiVersion).toBe(currentApiVersion);
      expect(result.requiredApiVersion).toBe('v1');
    });

    it('should return compatible status for plugin without version requirement', () => {
      const manifest: PluginManifest = {
        schemaVersion: 1,
        slug: 'basic-plugin',
        name: 'Basic Plugin',
        version: '1.0.0',
        description: 'Basic plugin without version requirement',
        runtimeType: 'internal-fastify',
        permissions: [],
      };

      const result = checkPluginApiCompatibility(manifest);

      expect(result.compatible).toBe(true);
      expect(result.currentApiVersion).toBe(currentApiVersion);
      expect(result.reason).toContain('No minimum API version');
    });
  });

  describe('Incompatible Plugin Rejection', () => {
    it('should reject plugin requiring higher API version', () => {
      const manifest: PluginManifest = {
        schemaVersion: 1,
        slug: 'future-plugin',
        name: 'Future Plugin',
        version: '1.0.0',
        description: 'Plugin requiring future API version',
        runtimeType: 'internal-fastify',
        permissions: [],
        minApiVersion: 'v99',
      };

      expect(() => validatePluginCompatibility(manifest)).toThrow(PluginLoaderError);
      expect(() => validatePluginCompatibility(manifest)).toThrow(/incompatible with current API version/i);
    });

    it('should return incompatible status with details', () => {
      const manifest: PluginManifest = {
        schemaVersion: 1,
        slug: 'advanced-features',
        name: 'Advanced Features',
        version: '3.0.0',
        description: 'Advanced features plugin',
        runtimeType: 'internal-fastify',
        permissions: ['admin.advanced'],
        minApiVersion: 'v10',
      };

      const result = checkPluginApiCompatibility(manifest);

      expect(result.compatible).toBe(false);
      expect(result.currentApiVersion).toBe(currentApiVersion);
      expect(result.requiredApiVersion).toBe('v10');
      expect(result.reason).toContain('requires API version v10');
    });

    it('should throw PluginLoaderError with INCOMPATIBLE_API_VERSION code', () => {
      const manifest: PluginManifest = {
        schemaVersion: 1,
        slug: 'incompatible-plugin',
        name: 'Incompatible Plugin',
        version: '1.0.0',
        description: 'Incompatible plugin',
        runtimeType: 'internal-fastify',
        permissions: [],
        minApiVersion: 'v999',
      };

      try {
        validatePluginCompatibility(manifest);
        expect.fail('Should have thrown PluginLoaderError');
      } catch (error) {
        expect(error).toBeInstanceOf(PluginLoaderError);
        expect((error as PluginLoaderError).code).toBe('INCOMPATIBLE_API_VERSION');
        expect((error as PluginLoaderError).pluginSlug).toBe('incompatible-plugin');
        expect((error as PluginLoaderError).details).toHaveProperty('currentApiVersion');
        expect((error as PluginLoaderError).details).toHaveProperty('requiredApiVersion');
      }
    });
  });

  describe('Invalid Version Format Handling', () => {
    it('should reject plugin with invalid plugin version', () => {
      const manifest: PluginManifest = {
        schemaVersion: 1,
        slug: 'invalid-version-plugin',
        name: 'Invalid Version Plugin',
        version: 'not-a-version',
        description: 'Plugin with invalid version',
        runtimeType: 'internal-fastify',
        permissions: [],
      };

      expect(() => validateManifestVersionInfo(manifest)).toThrow(PluginLoaderError);
      expect(() => validateManifestVersionInfo(manifest)).toThrow(/Invalid plugin version format/i);
    });

    it('should reject plugin with invalid minApiVersion format', () => {
      const manifest: PluginManifest = {
        schemaVersion: 1,
        slug: 'invalid-api-version',
        name: 'Invalid API Version',
        version: '1.0.0',
        description: 'Plugin with invalid API version',
        runtimeType: 'internal-fastify',
        permissions: [],
        minApiVersion: 'invalid',
      };

      expect(() => validateManifestVersionInfo(manifest)).toThrow(PluginLoaderError);
      expect(() => validateManifestVersionInfo(manifest)).toThrow(/Invalid minApiVersion format/i);
    });

    it('should throw INVALID_VERSION_FORMAT error with details', () => {
      const manifest: PluginManifest = {
        schemaVersion: 1,
        slug: 'bad-format',
        name: 'Bad Format',
        version: '1.0.0',
        description: 'Bad format plugin',
        runtimeType: 'internal-fastify',
        permissions: [],
        minApiVersion: 'abc123',
      };

      try {
        validateManifestVersionInfo(manifest);
        expect.fail('Should have thrown PluginLoaderError');
      } catch (error) {
        expect(error).toBeInstanceOf(PluginLoaderError);
        expect((error as PluginLoaderError).code).toBe('INVALID_VERSION_FORMAT');
        expect((error as PluginLoaderError).pluginSlug).toBe('bad-format');
        expect((error as PluginLoaderError).details).toHaveProperty('minApiVersion', 'abc123');
      }
    });

    it('should accept valid semantic versions', () => {
      const validVersions = ['1.0.0', '2.1.3', '10.0.0', 'v1', 'v2', 'v10'];

      validVersions.forEach(version => {
        const manifest: PluginManifest = {
          schemaVersion: 1,
          slug: `plugin-${version}`,
          name: 'Test Plugin',
          version: '1.0.0',
          description: 'Test plugin',
          runtimeType: 'internal-fastify',
          permissions: [],
          minApiVersion: version,
        };

        expect(() => validateManifestVersionInfo(manifest)).not.toThrow();
      });
    });
  });

  describe('Plugin Compatibility Status', () => {
    it('should return non-throwing compatibility status', () => {
      const manifest: PluginManifest = {
        schemaVersion: 1,
        slug: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        description: 'Test plugin',
        runtimeType: 'internal-fastify',
        permissions: [],
        minApiVersion: 'v1',
      };

      const status = getPluginCompatibilityStatus(manifest);

      expect(status).toHaveProperty('compatible');
      expect(status).toHaveProperty('currentApiVersion');
      expect(status.compatible).toBe(true);
    });

    it('should handle invalid manifests gracefully', () => {
      const manifest: PluginManifest = {
        schemaVersion: 1,
        slug: 'invalid-plugin',
        name: 'Invalid Plugin',
        version: 'invalid',
        description: 'Invalid plugin',
        runtimeType: 'internal-fastify',
        permissions: [],
      };

      const status = getPluginCompatibilityStatus(manifest);

      expect(status.compatible).toBe(false);
      expect(status.reason).toBeDefined();
    });

    it('should include reason for incompatibility', () => {
      const manifest: PluginManifest = {
        schemaVersion: 1,
        slug: 'future-plugin',
        name: 'Future Plugin',
        version: '1.0.0',
        description: 'Future plugin',
        runtimeType: 'internal-fastify',
        permissions: [],
        minApiVersion: 'v50',
      };

      const status = getPluginCompatibilityStatus(manifest);

      expect(status.compatible).toBe(false);
      expect(status.reason).toContain('requires API version v50');
    });
  });

  describe('Compatibility Reports', () => {
    it('should generate detailed compatibility report', () => {
      const manifest: PluginManifest = {
        schemaVersion: 1,
        slug: 'payment-processor',
        name: 'Payment Processor',
        version: '2.5.0',
        description: 'Payment processing plugin',
        runtimeType: 'internal-fastify',
        permissions: ['payments.process'],
        minApiVersion: 'v1',
      };

      const report = getCompatibilityReport(manifest);

      expect(report).toContain('Payment Processor');
      expect(report).toContain('payment-processor');
      expect(report).toContain('2.5.0');
      expect(report).toContain(currentApiVersion);
      expect(report).toContain('v1');
      expect(report).toContain('Compatible: Yes');
    });

    it('should show compatibility failure in report', () => {
      const manifest: PluginManifest = {
        schemaVersion: 1,
        slug: 'incompatible-feature',
        name: 'Incompatible Feature',
        version: '1.0.0',
        description: 'Incompatible feature',
        runtimeType: 'internal-fastify',
        permissions: [],
        minApiVersion: 'v100',
      };

      const report = getCompatibilityReport(manifest);

      expect(report).toContain('Incompatible Feature');
      expect(report).toContain('Compatible: No');
      expect(report).toContain('Details:');
    });

    it('should handle missing minApiVersion in report', () => {
      const manifest: PluginManifest = {
        schemaVersion: 1,
        slug: 'no-version',
        name: 'No Version Plugin',
        version: '1.0.0',
        description: 'No version plugin',
        runtimeType: 'internal-fastify',
        permissions: [],
      };

      const report = getCompatibilityReport(manifest);

      expect(report).toContain('Required API Version: None specified');
      expect(report).toContain('Compatible: Yes');
    });
  });

  describe('Batch Plugin Checking', () => {
    it('should check multiple plugins at once', () => {
      const manifests: PluginManifest[] = [
        {
          schemaVersion: 1,
          slug: 'plugin-1',
          name: 'Plugin 1',
          version: '1.0.0',
          description: 'First plugin',
          runtimeType: 'internal-fastify',
          permissions: [],
          minApiVersion: 'v1',
        },
        {
          schemaVersion: 1,
          slug: 'plugin-2',
          name: 'Plugin 2',
          version: '1.0.0',
          description: 'Second plugin',
          runtimeType: 'internal-fastify',
          permissions: [],
          minApiVersion: 'v2',
        },
        {
          schemaVersion: 1,
          slug: 'plugin-3',
          name: 'Plugin 3',
          version: '1.0.0',
          description: 'Third plugin',
          runtimeType: 'internal-fastify',
          permissions: [],
        },
      ];

      const results = checkMultiplePlugins(manifests);

      expect(results).toHaveLength(3);
      expect(results[0].slug).toBe('plugin-1');
      expect(results[0].compatible).toBe(true);
      expect(results[1].slug).toBe('plugin-2');
      expect(results[2].slug).toBe('plugin-3');
      expect(results[2].compatible).toBe(true); // No version requirement
    });

    it('should identify incompatible plugins in batch', () => {
      const manifests: PluginManifest[] = [
        {
          schemaVersion: 1,
          slug: 'compatible-plugin',
          name: 'Compatible Plugin',
          version: '1.0.0',
          description: 'Compatible',
          runtimeType: 'internal-fastify',
          permissions: [],
          minApiVersion: 'v1',
        },
        {
          schemaVersion: 1,
          slug: 'incompatible-plugin',
          name: 'Incompatible Plugin',
          version: '1.0.0',
          description: 'Incompatible',
          runtimeType: 'internal-fastify',
          permissions: [],
          minApiVersion: 'v999',
        },
      ];

      const results = checkMultiplePlugins(manifests);

      expect(results).toHaveLength(2);

      const compatible = results.find(r => r.slug === 'compatible-plugin');
      expect(compatible?.compatible).toBe(true);

      const incompatible = results.find(r => r.slug === 'incompatible-plugin');
      expect(incompatible?.compatible).toBe(false);
    });

    it('should return empty array for empty input', () => {
      const results = checkMultiplePlugins([]);
      expect(results).toEqual([]);
    });
  });

  describe('Current API Version', () => {
    it('should return valid API version', () => {
      const version = getCurrentApiVersion();

      expect(version).toMatch(/^v\d+$/);
      expect(version).toBeTruthy();
    });

    it('should return consistent version across calls', () => {
      const version1 = getCurrentApiVersion();
      const version2 = getCurrentApiVersion();

      expect(version1).toBe(version2);
    });
  });

  describe('Error Details', () => {
    it('should include plugin details in error', () => {
      const manifest: PluginManifest = {
        schemaVersion: 1,
        slug: 'test-error-plugin',
        name: 'Test Error Plugin',
        version: '1.5.0',
        description: 'Plugin for testing errors',
        runtimeType: 'internal-fastify',
        permissions: ['test.permission'],
        minApiVersion: 'v50',
      };

      try {
        validatePluginCompatibility(manifest);
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(PluginLoaderError);
        const loaderError = error as PluginLoaderError;

        expect(loaderError.details).toHaveProperty('pluginVersion', '1.5.0');
        expect(loaderError.details).toHaveProperty('pluginName', 'Test Error Plugin');
        expect(loaderError.details).toHaveProperty('currentApiVersion');
        expect(loaderError.details).toHaveProperty('requiredApiVersion', 'v50');
      }
    });

    it('should have descriptive error messages', () => {
      const manifest: PluginManifest = {
        schemaVersion: 1,
        slug: 'my-plugin',
        name: 'My Plugin',
        version: '1.0.0',
        description: 'My plugin',
        runtimeType: 'internal-fastify',
        permissions: [],
        minApiVersion: 'v20',
      };

      try {
        validatePluginCompatibility(manifest);
        expect.fail('Should have thrown error');
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain('my-plugin');
        expect(message).toContain('incompatible');
      }
    });
  });

  describe('Integration with Fastify App', () => {
    it('should access version configuration through app', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      // Root endpoint should have version info
      expect(body).toHaveProperty('name');
      expect(body).toHaveProperty('version');
    });

    it('should have consistent version across API and plugin loader', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/health',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-api-version']).toBe('v1');

      const loaderVersion = getCurrentApiVersion();
      expect(loaderVersion).toBe('v1');
    });
  });

  describe('Real-world Plugin Scenarios', () => {
    it('should handle payment gateway plugin scenario', () => {
      const manifest: PluginManifest = {
        schemaVersion: 1,
        slug: 'stripe-payment-gateway',
        name: 'Stripe Payment Gateway',
        version: '3.2.1',
        description: 'Stripe integration for payments',
        runtimeType: 'internal-fastify',
        permissions: ['payments.process', 'webhooks.receive'],
        minApiVersion: 'v1',
        author: 'Payment Solutions Inc',
      };

      expect(() => validatePluginCompatibility(manifest)).not.toThrow();

      const status = getPluginCompatibilityStatus(manifest);
      expect(status.compatible).toBe(true);
    });

    it('should handle analytics plugin without version requirement', () => {
      const manifest: PluginManifest = {
        schemaVersion: 1,
        slug: 'google-analytics',
        name: 'Google Analytics Integration',
        version: '1.0.0',
        description: 'Google Analytics tracking',
        runtimeType: 'external-http',
        externalBaseUrl: 'https://analytics.example.com',
        permissions: ['analytics.track'],
      };

      expect(() => validatePluginCompatibility(manifest)).not.toThrow();

      const report = getCompatibilityReport(manifest);
      expect(report).toContain('Required API Version: None specified');
    });

    it('should handle external plugin with version requirement', () => {
      const manifest: PluginManifest = {
        schemaVersion: 1,
        slug: 'external-crm',
        name: 'External CRM Integration',
        version: '2.0.0',
        description: 'CRM integration service',
        runtimeType: 'external-http',
        externalBaseUrl: 'https://crm.example.com',
        permissions: ['customers.read', 'customers.write'],
        minApiVersion: 'v1',
      };

      const result = checkPluginApiCompatibility(manifest);
      expect(result.compatible).toBe(true);
    });
  });
});
