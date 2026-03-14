import { describe, it, expect } from 'vitest';
import {
  isVersionCompatible,
  checkPluginCompatibility,
  checkMultiplePluginsCompatibility,
  getCompatiblePlugins,
  getIncompatiblePlugins,
  isVersionAvailable,
  findBestCompatibleVersion,
  generateCompatibilityReport,
  isValidVersionRange,
  parseVersionRangeSpec,
} from '../compatibility-checker';
import type {
  PluginCompatibility,
  VersionMetadata,
  VersionRange,
} from '../types';

describe('compatibility-checker', () => {
  describe('isVersionCompatible', () => {
    it('should check exact version match', () => {
      expect(isVersionCompatible('v2', { exact: 'v2' })).toBe(true);
      expect(isVersionCompatible('v1', { exact: 'v2' })).toBe(false);
      expect(isVersionCompatible('v3', { exact: 'v2' })).toBe(false);
    });

    it('should check min version range', () => {
      expect(isVersionCompatible('v2', { min: 'v1' })).toBe(true);
      expect(isVersionCompatible('v1', { min: 'v1' })).toBe(true);
      expect(isVersionCompatible('v1', { min: 'v2' })).toBe(false);
    });

    it('should check max version range', () => {
      expect(isVersionCompatible('v2', { max: 'v3' })).toBe(true);
      expect(isVersionCompatible('v3', { max: 'v3' })).toBe(true);
      expect(isVersionCompatible('v4', { max: 'v3' })).toBe(false);
    });

    it('should check min and max version range', () => {
      expect(isVersionCompatible('v2', { min: 'v1', max: 'v3' })).toBe(true);
      expect(isVersionCompatible('v1', { min: 'v1', max: 'v3' })).toBe(true);
      expect(isVersionCompatible('v3', { min: 'v1', max: 'v3' })).toBe(true);
      expect(isVersionCompatible('v4', { min: 'v1', max: 'v3' })).toBe(false);
      expect(isVersionCompatible('v1', { min: 'v2', max: 'v3' })).toBe(false);
    });

    it('should throw error for invalid version format', () => {
      expect(() => isVersionCompatible('invalid', { min: 'v1' })).toThrow(
        'Invalid current version format'
      );
      expect(() => isVersionCompatible('v1', { exact: 'invalid' })).toThrow(
        'Invalid exact version format'
      );
      expect(() => isVersionCompatible('v1', { min: 'invalid' })).toThrow(
        'Invalid min version format'
      );
    });
  });

  describe('checkPluginCompatibility', () => {
    it('should return compatible for matching version', () => {
      const plugin: PluginCompatibility = {
        pluginId: 'test-plugin',
        pluginVersion: '1.0.0',
        requiredApiVersion: { min: 'v1', max: 'v3' },
      };

      const result = checkPluginCompatibility(plugin, 'v2');

      expect(result.isCompatible).toBe(true);
      expect(result.currentVersion).toBe('v2');
      expect(result.message).toContain('compatible');
      expect(result.errors).toHaveLength(0);
    });

    it('should return incompatible for version out of range', () => {
      const plugin: PluginCompatibility = {
        pluginId: 'test-plugin',
        pluginVersion: '1.0.0',
        requiredApiVersion: { min: 'v2', max: 'v3' },
      };

      const result = checkPluginCompatibility(plugin, 'v1');

      expect(result.isCompatible).toBe(false);
      expect(result.message).toContain('not compatible');
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0]).toContain('requires API version');
    });

    it('should handle exact version requirement', () => {
      const plugin: PluginCompatibility = {
        pluginId: 'test-plugin',
        pluginVersion: '1.0.0',
        requiredApiVersion: { exact: 'v2' },
      };

      expect(checkPluginCompatibility(plugin, 'v2').isCompatible).toBe(true);
      expect(checkPluginCompatibility(plugin, 'v1').isCompatible).toBe(false);
      expect(checkPluginCompatibility(plugin, 'v3').isCompatible).toBe(false);
    });

    it('should add warning for version not in supported list', () => {
      const plugin: PluginCompatibility = {
        pluginId: 'test-plugin',
        pluginVersion: '1.0.0',
        requiredApiVersion: { min: 'v1', max: 'v3' },
        supportedApiVersions: ['v1', 'v2'],
      };

      const result = checkPluginCompatibility(plugin, 'v3');

      expect(result.isCompatible).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings?.[0]).toContain('not in the explicitly supported');
    });

    it('should handle invalid API version', () => {
      const plugin: PluginCompatibility = {
        pluginId: 'test-plugin',
        pluginVersion: '1.0.0',
        requiredApiVersion: { min: 'v1' },
      };

      const result = checkPluginCompatibility(plugin, 'invalid');

      expect(result.isCompatible).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0]).toContain('Invalid API version format');
    });

    it('should include plugin info in result', () => {
      const plugin: PluginCompatibility = {
        pluginId: 'my-awesome-plugin',
        pluginVersion: '2.5.0',
        requiredApiVersion: { min: 'v2' },
      };

      const result = checkPluginCompatibility(plugin, 'v3');

      expect(result.message).toContain('my-awesome-plugin');
      expect(result.message).toContain('2.5.0');
      expect(result.message).toContain('v3');
    });
  });

  describe('checkMultiplePluginsCompatibility', () => {
    it('should check compatibility for multiple plugins', () => {
      const plugins: PluginCompatibility[] = [
        {
          pluginId: 'plugin1',
          pluginVersion: '1.0.0',
          requiredApiVersion: { min: 'v1', max: 'v2' },
        },
        {
          pluginId: 'plugin2',
          pluginVersion: '1.0.0',
          requiredApiVersion: { min: 'v3' },
        },
        {
          pluginId: 'plugin3',
          pluginVersion: '1.0.0',
          requiredApiVersion: { exact: 'v2' },
        },
      ];

      const results = checkMultiplePluginsCompatibility(plugins, 'v2');

      expect(results).toHaveLength(3);
      expect(results[0].isCompatible).toBe(true); // plugin1
      expect(results[1].isCompatible).toBe(false); // plugin2
      expect(results[2].isCompatible).toBe(true); // plugin3
    });

    it('should return empty array for empty input', () => {
      const results = checkMultiplePluginsCompatibility([], 'v1');
      expect(results).toHaveLength(0);
    });
  });

  describe('getCompatiblePlugins', () => {
    it('should filter and return only compatible plugins', () => {
      const plugins: PluginCompatibility[] = [
        {
          pluginId: 'plugin1',
          pluginVersion: '1.0.0',
          requiredApiVersion: { min: 'v1', max: 'v2' },
        },
        {
          pluginId: 'plugin2',
          pluginVersion: '1.0.0',
          requiredApiVersion: { min: 'v3' },
        },
        {
          pluginId: 'plugin3',
          pluginVersion: '1.0.0',
          requiredApiVersion: { exact: 'v2' },
        },
      ];

      const compatible = getCompatiblePlugins(plugins, 'v2');

      expect(compatible).toHaveLength(2);
      expect(compatible[0].pluginId).toBe('plugin1');
      expect(compatible[1].pluginId).toBe('plugin3');
    });

    it('should return empty array when no plugins are compatible', () => {
      const plugins: PluginCompatibility[] = [
        {
          pluginId: 'plugin1',
          pluginVersion: '1.0.0',
          requiredApiVersion: { exact: 'v5' },
        },
      ];

      const compatible = getCompatiblePlugins(plugins, 'v1');
      expect(compatible).toHaveLength(0);
    });
  });

  describe('getIncompatiblePlugins', () => {
    it('should return plugins with incompatibility details', () => {
      const plugins: PluginCompatibility[] = [
        {
          pluginId: 'plugin1',
          pluginVersion: '1.0.0',
          requiredApiVersion: { min: 'v1', max: 'v2' },
        },
        {
          pluginId: 'plugin2',
          pluginVersion: '1.0.0',
          requiredApiVersion: { min: 'v3' },
        },
      ];

      const incompatible = getIncompatiblePlugins(plugins, 'v2');

      expect(incompatible).toHaveLength(1);
      expect(incompatible[0].plugin.pluginId).toBe('plugin2');
      expect(incompatible[0].check.isCompatible).toBe(false);
      expect(incompatible[0].check.errors).toHaveLength(1);
    });

    it('should return empty array when all plugins are compatible', () => {
      const plugins: PluginCompatibility[] = [
        {
          pluginId: 'plugin1',
          pluginVersion: '1.0.0',
          requiredApiVersion: { min: 'v1' },
        },
      ];

      const incompatible = getIncompatiblePlugins(plugins, 'v2');
      expect(incompatible).toHaveLength(0);
    });
  });

  describe('isVersionAvailable', () => {
    it('should return false for sunset versions', () => {
      const metadata: VersionMetadata = {
        version: 'v1',
        status: 'sunset',
        releaseDate: '2020-01-01',
      };

      expect(isVersionAvailable('v1', metadata)).toBe(false);
    });

    it('should return true for active versions', () => {
      const metadata: VersionMetadata = {
        version: 'v2',
        status: 'active',
        releaseDate: '2024-01-01',
      };

      expect(isVersionAvailable('v2', metadata)).toBe(true);
    });

    it('should return false if sunset date has passed', () => {
      const metadata: VersionMetadata = {
        version: 'v1',
        status: 'deprecated',
        releaseDate: '2020-01-01',
        deprecationInfo: {
          isDeprecated: true,
          deprecatedAt: '2023-01-01',
          sunsetDate: '2023-06-01',
        },
      };

      expect(isVersionAvailable('v1', metadata, new Date('2024-01-01'))).toBe(
        false
      );
    });

    it('should return true if sunset date has not passed', () => {
      const metadata: VersionMetadata = {
        version: 'v1',
        status: 'deprecated',
        releaseDate: '2020-01-01',
        deprecationInfo: {
          isDeprecated: true,
          deprecatedAt: '2023-01-01',
          sunsetDate: '2025-06-01',
        },
      };

      expect(isVersionAvailable('v1', metadata, new Date('2024-01-01'))).toBe(
        true
      );
    });
  });

  describe('findBestCompatibleVersion', () => {
    const availableVersions: VersionMetadata[] = [
      {
        version: 'v1',
        status: 'sunset',
        releaseDate: '2020-01-01',
      },
      {
        version: 'v2',
        status: 'deprecated',
        releaseDate: '2022-01-01',
        deprecationInfo: {
          isDeprecated: true,
          deprecatedAt: '2024-01-01',
          sunsetDate: '2025-06-01',
        },
      },
      {
        version: 'v3',
        status: 'active',
        releaseDate: '2024-01-01',
      },
      {
        version: 'v4',
        status: 'active',
        releaseDate: '2025-01-01',
      },
    ];

    it('should find the highest compatible active version', () => {
      const plugin: PluginCompatibility = {
        pluginId: 'test-plugin',
        pluginVersion: '1.0.0',
        requiredApiVersion: { min: 'v2' },
      };

      const result = findBestCompatibleVersion(plugin, availableVersions);

      expect(result).not.toBeNull();
      expect(result?.version).toBe('v4');
      expect(result?.status).toBe('active');
    });

    it('should prefer active over deprecated versions', () => {
      const plugin: PluginCompatibility = {
        pluginId: 'test-plugin',
        pluginVersion: '1.0.0',
        requiredApiVersion: { min: 'v2', max: 'v3' },
      };

      const result = findBestCompatibleVersion(plugin, availableVersions);

      expect(result).not.toBeNull();
      expect(result?.version).toBe('v3');
      expect(result?.status).toBe('active');
    });

    it('should skip sunset versions', () => {
      const plugin: PluginCompatibility = {
        pluginId: 'test-plugin',
        pluginVersion: '1.0.0',
        requiredApiVersion: { exact: 'v1' },
      };

      const result = findBestCompatibleVersion(plugin, availableVersions);
      expect(result).toBeNull();
    });

    it('should return null if no compatible version found', () => {
      const plugin: PluginCompatibility = {
        pluginId: 'test-plugin',
        pluginVersion: '1.0.0',
        requiredApiVersion: { exact: 'v10' },
      };

      const result = findBestCompatibleVersion(plugin, availableVersions);
      expect(result).toBeNull();
    });
  });

  describe('generateCompatibilityReport', () => {
    it('should generate report for compatible plugin', () => {
      const plugin: PluginCompatibility = {
        pluginId: 'my-plugin',
        pluginVersion: '1.0.0',
        requiredApiVersion: { min: 'v1' },
      };

      const metadata: VersionMetadata = {
        version: 'v2',
        status: 'active',
        releaseDate: '2024-01-01',
      };

      const report = generateCompatibilityReport(plugin, 'v2', metadata);

      expect(report).toContain('my-plugin');
      expect(report).toContain('1.0.0');
      expect(report).toContain('✓ Compatible');
      expect(report).toContain('v2');
      expect(report).toContain('active');
    });

    it('should generate report for incompatible plugin', () => {
      const plugin: PluginCompatibility = {
        pluginId: 'my-plugin',
        pluginVersion: '1.0.0',
        requiredApiVersion: { exact: 'v3' },
      };

      const report = generateCompatibilityReport(plugin, 'v2');

      expect(report).toContain('my-plugin');
      expect(report).toContain('✗ Incompatible');
      expect(report).toContain('Errors:');
    });

    it('should include warnings in report', () => {
      const plugin: PluginCompatibility = {
        pluginId: 'my-plugin',
        pluginVersion: '1.0.0',
        requiredApiVersion: { min: 'v1', max: 'v3' },
        supportedApiVersions: ['v1', 'v2'],
      };

      const report = generateCompatibilityReport(plugin, 'v3');

      expect(report).toContain('Warnings:');
      expect(report).toContain('not in the explicitly supported');
    });
  });

  describe('isValidVersionRange', () => {
    it('should validate exact version ranges', () => {
      expect(isValidVersionRange({ exact: 'v1' })).toBe(true);
      expect(isValidVersionRange({ exact: 'invalid' })).toBe(false);
    });

    it('should validate min/max version ranges', () => {
      expect(isValidVersionRange({ min: 'v1', max: 'v3' })).toBe(true);
      expect(isValidVersionRange({ min: 'v1' })).toBe(true);
      expect(isValidVersionRange({ max: 'v3' })).toBe(true);
    });

    it('should reject invalid min > max', () => {
      expect(isValidVersionRange({ min: 'v3', max: 'v1' })).toBe(false);
    });

    it('should reject ranges with no constraints', () => {
      expect(isValidVersionRange({})).toBe(false);
    });

    it('should reject invalid version formats', () => {
      expect(isValidVersionRange({ min: 'invalid' })).toBe(false);
      expect(isValidVersionRange({ max: 'invalid' })).toBe(false);
    });
  });

  describe('parseVersionRangeSpec', () => {
    it('should parse exact version', () => {
      const result = parseVersionRangeSpec('v2');
      expect(result).toEqual({ exact: 'v2' });
    });

    it('should parse version range', () => {
      const result = parseVersionRangeSpec('v1-v3');
      expect(result).toEqual({ min: 'v1', max: 'v3' });
    });

    it('should parse >= operator', () => {
      expect(parseVersionRangeSpec('>=v2')).toEqual({ min: 'v2' });
      expect(parseVersionRangeSpec('>v2')).toEqual({ min: 'v2' });
      expect(parseVersionRangeSpec('>= v2')).toEqual({ min: 'v2' });
    });

    it('should parse <= operator', () => {
      expect(parseVersionRangeSpec('<=v3')).toEqual({ max: 'v3' });
      expect(parseVersionRangeSpec('<v3')).toEqual({ max: 'v3' });
      expect(parseVersionRangeSpec('<= v3')).toEqual({ max: 'v3' });
    });

    it('should handle case insensitive versions', () => {
      expect(parseVersionRangeSpec('V2')).toEqual({ exact: 'v2' });
      expect(parseVersionRangeSpec('V1-V3')).toEqual({ min: 'v1', max: 'v3' });
    });

    it('should throw error for invalid specs', () => {
      expect(() => parseVersionRangeSpec('invalid')).toThrow(
        'Invalid version range specification'
      );
      expect(() => parseVersionRangeSpec('1-3')).toThrow(
        'Invalid version range specification'
      );
      expect(() => parseVersionRangeSpec('')).toThrow(
        'Invalid version range specification'
      );
    });
  });
});
