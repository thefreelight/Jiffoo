/**
 * Plugin Loader Tests
 *
 * Tests for runtime version checking in plugin initialization
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  validatePluginCompatibility,
  checkPluginApiCompatibility,
  validateManifestVersionInfo,
  getCurrentApiVersion,
  getPluginCompatibilityStatus,
  getCompatibilityReport,
  checkMultiplePlugins,
  PluginLoaderError,
  type VersionCheckResult
} from '@/plugins/loader';
import type { PluginManifest } from '@/core/admin/extension-installer/types';

// Mock the API version configuration
vi.mock('@/config/api-versions', () => ({
  apiVersionConfig: {
    defaultVersion: 'v1',
    supportedVersions: ['v1', 'v2'],
    deprecatedVersions: [],
    versionMetadata: {
      v1: {
        version: 'v1',
        releaseDate: '2024-01-01',
        status: 'active',
        features: [],
        breakingChanges: [],
        changelog: ''
      },
      v2: {
        version: 'v2',
        releaseDate: '2024-06-01',
        status: 'active',
        features: [],
        breakingChanges: [],
        changelog: ''
      }
    }
  }
}));

// Helper function to create a mock plugin manifest
function createMockManifest(overrides?: Partial<PluginManifest>): PluginManifest {
  return {
    schemaVersion: 1,
    slug: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    description: 'A test plugin',
    runtimeType: 'internal-fastify',
    permissions: [],
    ...overrides
  };
}

describe('Plugin Loader - Version Checking', () => {
  describe('getCurrentApiVersion', () => {
    it('should return current API version', () => {
      const version = getCurrentApiVersion();
      expect(version).toBe('v1');
    });

    it('should return version with v prefix', () => {
      const version = getCurrentApiVersion();
      expect(version).toMatch(/^v\d+/);
    });
  });

  describe('validateManifestVersionInfo', () => {
    it('should validate valid plugin version', () => {
      const manifest = createMockManifest({ version: '1.0.0' });
      expect(() => validateManifestVersionInfo(manifest)).not.toThrow();
    });

    it('should throw error for invalid plugin version format', () => {
      const manifest = createMockManifest({ version: 'invalid' });
      expect(() => validateManifestVersionInfo(manifest)).toThrow(PluginLoaderError);
      expect(() => validateManifestVersionInfo(manifest)).toThrow(/Invalid plugin version format/);
    });

    it('should throw error for empty plugin version', () => {
      const manifest = createMockManifest({ version: '' });
      expect(() => validateManifestVersionInfo(manifest)).toThrow(PluginLoaderError);
    });

    it('should validate valid minApiVersion', () => {
      const manifest = createMockManifest({ minApiVersion: 'v1' });
      expect(() => validateManifestVersionInfo(manifest)).not.toThrow();
    });

    it('should throw error for invalid minApiVersion format', () => {
      const manifest = createMockManifest({ minApiVersion: 'invalid-version' });
      expect(() => validateManifestVersionInfo(manifest)).toThrow(PluginLoaderError);
      expect(() => validateManifestVersionInfo(manifest)).toThrow(/Invalid minApiVersion format/);
    });

    it('should allow missing minApiVersion', () => {
      const manifest = createMockManifest({ minApiVersion: undefined });
      expect(() => validateManifestVersionInfo(manifest)).not.toThrow();
    });

    it('should validate semver plugin versions', () => {
      const validVersions = ['1.0.0', '2.1.3', '10.20.30'];
      validVersions.forEach(version => {
        const manifest = createMockManifest({ version });
        expect(() => validateManifestVersionInfo(manifest)).not.toThrow();
      });
    });

    it('should validate API versions with v prefix', () => {
      const validVersions = ['v1', 'v2', 'v10'];
      validVersions.forEach(minApiVersion => {
        const manifest = createMockManifest({ minApiVersion });
        expect(() => validateManifestVersionInfo(manifest)).not.toThrow();
      });
    });
  });

  describe('checkPluginApiCompatibility', () => {
    it('should return compatible for plugin without minApiVersion', () => {
      const manifest = createMockManifest({ minApiVersion: undefined });
      const result = checkPluginApiCompatibility(manifest);

      expect(result.compatible).toBe(true);
      expect(result.currentApiVersion).toBe('v1');
      expect(result.reason).toContain('No minimum API version specified');
    });

    it('should return compatible when current version meets minimum requirement', () => {
      const manifest = createMockManifest({ minApiVersion: 'v1' });
      const result = checkPluginApiCompatibility(manifest);

      expect(result.compatible).toBe(true);
      expect(result.currentApiVersion).toBe('v1');
      expect(result.requiredApiVersion).toBe('v1');
    });

    it('should return incompatible when current version is lower than required', () => {
      const manifest = createMockManifest({ minApiVersion: 'v2' });
      // Current version is v1, which is less than v2
      // Note: This depends on how the mock is set up

      // Mock getCurrentApiVersion to return v1 for this test
      const result = checkPluginApiCompatibility(manifest);

      // Since current is v1 and required is v2, should be incompatible
      expect(result.compatible).toBe(false);
      expect(result.currentApiVersion).toBe('v1');
      expect(result.requiredApiVersion).toBe('v2');
      expect(result.reason).toContain('requires API version');
    });

    it('should include detailed reason in result', () => {
      const manifest = createMockManifest({ minApiVersion: 'v1' });
      const result = checkPluginApiCompatibility(manifest);

      expect(result.reason).toBeDefined();
      expect(typeof result.reason).toBe('string');
    });

    it('should handle version comparison correctly', () => {
      // Test with exact version match
      const manifest1 = createMockManifest({ minApiVersion: 'v1' });
      const result1 = checkPluginApiCompatibility(manifest1);
      expect(result1.compatible).toBe(true);
    });
  });

  describe('validatePluginCompatibility', () => {
    it('should not throw for compatible plugin', () => {
      const manifest = createMockManifest({ version: '1.0.0', minApiVersion: 'v1' });
      expect(() => validatePluginCompatibility(manifest)).not.toThrow();
    });

    it('should throw PluginLoaderError for incompatible plugin', () => {
      const manifest = createMockManifest({ version: '1.0.0', minApiVersion: 'v2' });

      try {
        validatePluginCompatibility(manifest);
        // Should not reach here
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error).toBeInstanceOf(PluginLoaderError);
        expect(error.code).toBe('INCOMPATIBLE_API_VERSION');
        expect(error.pluginSlug).toBe('test-plugin');
        expect(error.details).toBeDefined();
        expect(error.details?.currentApiVersion).toBe('v1');
        expect(error.details?.requiredApiVersion).toBe('v2');
      }
    });

    it('should throw for invalid version format', () => {
      const manifest = createMockManifest({ version: 'invalid-version' });

      try {
        validatePluginCompatibility(manifest);
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error).toBeInstanceOf(PluginLoaderError);
        expect(error.code).toBe('INVALID_VERSION_FORMAT');
      }
    });

    it('should include plugin details in error', () => {
      const manifest = createMockManifest({
        slug: 'my-plugin',
        name: 'My Plugin',
        version: '2.0.0',
        minApiVersion: 'v2'
      });

      try {
        validatePluginCompatibility(manifest);
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.details?.pluginName).toBe('My Plugin');
        expect(error.details?.pluginVersion).toBe('2.0.0');
        expect(error.pluginSlug).toBe('my-plugin');
      }
    });

    it('should pass for plugin with no minApiVersion', () => {
      const manifest = createMockManifest({ version: '1.0.0' });
      expect(() => validatePluginCompatibility(manifest)).not.toThrow();
    });
  });

  describe('getPluginCompatibilityStatus', () => {
    it('should return compatibility status without throwing', () => {
      const manifest = createMockManifest({ version: '1.0.0', minApiVersion: 'v1' });
      const status = getPluginCompatibilityStatus(manifest);

      expect(status).toBeDefined();
      expect(status.compatible).toBe(true);
      expect(status.currentApiVersion).toBe('v1');
    });

    it('should return incompatible status for invalid versions', () => {
      const manifest = createMockManifest({ version: 'invalid' });
      const status = getPluginCompatibilityStatus(manifest);

      expect(status.compatible).toBe(false);
      expect(status.reason).toBeDefined();
    });

    it('should handle errors gracefully', () => {
      const manifest = createMockManifest({ minApiVersion: 'v2' });
      const status = getPluginCompatibilityStatus(manifest);

      expect(status).toBeDefined();
      expect(typeof status.compatible).toBe('boolean');
    });

    it('should return detailed reason for incompatibility', () => {
      const manifest = createMockManifest({ version: '1.0.0', minApiVersion: 'v2' });
      const status = getPluginCompatibilityStatus(manifest);

      expect(status.compatible).toBe(false);
      expect(status.reason).toContain('incompatible');
    });
  });

  describe('getCompatibilityReport', () => {
    it('should generate human-readable report', () => {
      const manifest = createMockManifest({
        slug: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        minApiVersion: 'v1'
      });

      const report = getCompatibilityReport(manifest);

      expect(report).toContain('Test Plugin');
      expect(report).toContain('test-plugin');
      expect(report).toContain('1.0.0');
      expect(report).toContain('v1');
      expect(report).toContain('Compatible');
    });

    it('should show compatibility status', () => {
      const manifest = createMockManifest({ minApiVersion: 'v1' });
      const report = getCompatibilityReport(manifest);

      expect(report).toContain('Compatible: Yes');
    });

    it('should show incompatibility for incompatible plugins', () => {
      const manifest = createMockManifest({ minApiVersion: 'v2' });
      const report = getCompatibilityReport(manifest);

      expect(report).toContain('Compatible: No');
    });

    it('should include current and required API versions', () => {
      const manifest = createMockManifest({ minApiVersion: 'v1' });
      const report = getCompatibilityReport(manifest);

      expect(report).toContain('Current API Version:');
      expect(report).toContain('Required API Version:');
    });

    it('should handle missing minApiVersion', () => {
      const manifest = createMockManifest({ minApiVersion: undefined });
      const report = getCompatibilityReport(manifest);

      expect(report).toContain('None specified');
    });
  });

  describe('checkMultiplePlugins', () => {
    it('should check multiple plugins', () => {
      const manifests = [
        createMockManifest({ slug: 'plugin1', name: 'Plugin 1', minApiVersion: 'v1' }),
        createMockManifest({ slug: 'plugin2', name: 'Plugin 2', minApiVersion: 'v1' }),
        createMockManifest({ slug: 'plugin3', name: 'Plugin 3' })
      ];

      const results = checkMultiplePlugins(manifests);

      expect(results).toHaveLength(3);
      expect(results[0].slug).toBe('plugin1');
      expect(results[1].slug).toBe('plugin2');
      expect(results[2].slug).toBe('plugin3');
    });

    it('should include compatibility status for each plugin', () => {
      const manifests = [
        createMockManifest({ slug: 'plugin1', minApiVersion: 'v1' }),
        createMockManifest({ slug: 'plugin2', minApiVersion: 'v2' })
      ];

      const results = checkMultiplePlugins(manifests);

      expect(results[0].compatible).toBe(true);
      expect(results[1].compatible).toBe(false);
    });

    it('should include detailed result for each plugin', () => {
      const manifests = [
        createMockManifest({ slug: 'plugin1', name: 'Plugin 1' })
      ];

      const results = checkMultiplePlugins(manifests);

      expect(results[0].result).toBeDefined();
      expect(results[0].result.currentApiVersion).toBe('v1');
    });

    it('should handle empty array', () => {
      const results = checkMultiplePlugins([]);
      expect(results).toHaveLength(0);
    });

    it('should handle mix of compatible and incompatible plugins', () => {
      const manifests = [
        createMockManifest({ slug: 'good-plugin', minApiVersion: 'v1' }),
        createMockManifest({ slug: 'bad-plugin', minApiVersion: 'v2' }),
        createMockManifest({ slug: 'neutral-plugin' })
      ];

      const results = checkMultiplePlugins(manifests);

      const compatibleCount = results.filter(r => r.compatible).length;
      const incompatibleCount = results.filter(r => !r.compatible).length;

      expect(compatibleCount).toBeGreaterThan(0);
      expect(incompatibleCount).toBeGreaterThan(0);
    });
  });

  describe('PluginLoaderError', () => {
    it('should create error with all properties', () => {
      const error = new PluginLoaderError(
        'Test error',
        'INCOMPATIBLE_API_VERSION',
        'test-plugin',
        { detail: 'value' }
      );

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('INCOMPATIBLE_API_VERSION');
      expect(error.pluginSlug).toBe('test-plugin');
      expect(error.details).toEqual({ detail: 'value' });
      expect(error.name).toBe('PluginLoaderError');
    });

    it('should be instance of Error', () => {
      const error = new PluginLoaderError('Test', 'INVALID_VERSION_FORMAT', 'plugin');
      expect(error).toBeInstanceOf(Error);
    });

    it('should handle undefined details', () => {
      const error = new PluginLoaderError('Test', 'VERSION_CHECK_FAILED', 'plugin');
      expect(error.details).toBeUndefined();
    });
  });

  describe('Integration scenarios', () => {
    it('should validate real-world plugin manifest structure', () => {
      const manifest: PluginManifest = {
        schemaVersion: 1,
        slug: 'payment-gateway',
        name: 'Payment Gateway Plugin',
        version: '2.1.0',
        description: 'Payment processing plugin',
        category: 'payments',
        runtimeType: 'internal-fastify',
        entryModule: 'dist/index.js',
        permissions: ['payments:process', 'orders:read'],
        author: 'Plugin Developer',
        authorUrl: 'https://example.com',
        minApiVersion: 'v1',
        dependencies: {
          'stripe': '^12.0.0'
        },
        tags: ['payments', 'stripe']
      };

      expect(() => validatePluginCompatibility(manifest)).not.toThrow();
    });

    it('should reject plugin requiring future API version', () => {
      const manifest = createMockManifest({
        name: 'Future Plugin',
        version: '3.0.0',
        minApiVersion: 'v10'
      });

      expect(() => validatePluginCompatibility(manifest)).toThrow(PluginLoaderError);
    });

    it('should provide actionable error messages', () => {
      const manifest = createMockManifest({
        slug: 'incompatible-plugin',
        name: 'Incompatible Plugin',
        minApiVersion: 'v2'
      });

      try {
        validatePluginCompatibility(manifest);
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toContain('incompatible-plugin');
        expect(error.message).toContain('v2');
        expect(error.details?.currentApiVersion).toBeDefined();
        expect(error.details?.requiredApiVersion).toBeDefined();
      }
    });
  });
});
