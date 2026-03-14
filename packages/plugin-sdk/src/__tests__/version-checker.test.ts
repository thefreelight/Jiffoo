/**
 * Version Checker Tests
 *
 * Tests for version compatibility checking functionality
 */

import { describe, it, expect } from 'vitest';
import {
  checkPluginCompatibility,
  checkRequestCompatibility,
  getPlatformVersion,
  satisfiesVersion,
  isValidVersionRequirement,
  getSdkVersion,
  getPlatformCompatibility,
  isSdkCompatibleWithPlatform
} from '../version-checker';
import type { PluginManifest, PlatformHeaders, VersionRequirement } from '../types';

describe('Version Checker', () => {
  const mockManifest: PluginManifest = {
    schemaVersion: 1,
    slug: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    description: 'Test plugin for version compatibility',
    author: 'Test Author',
    runtimeType: 'external-http',
    externalBaseUrl: 'http://localhost:3000',
    permissions: []
  };

  describe('satisfiesVersion', () => {
    it('should validate exact version match with = operator', () => {
      expect(satisfiesVersion('1.0.0', '=1.0.0')).toBe(true);
      expect(satisfiesVersion('1.0.0', '=1.0.1')).toBe(false);
      expect(satisfiesVersion('v1.0.0', '=1.0.0')).toBe(true);
    });

    it('should validate >= operator', () => {
      expect(satisfiesVersion('1.0.0', '>=1.0.0')).toBe(true);
      expect(satisfiesVersion('1.1.0', '>=1.0.0')).toBe(true);
      expect(satisfiesVersion('0.9.0', '>=1.0.0')).toBe(false);
    });

    it('should validate > operator', () => {
      expect(satisfiesVersion('1.1.0', '>1.0.0')).toBe(true);
      expect(satisfiesVersion('1.0.0', '>1.0.0')).toBe(false);
      expect(satisfiesVersion('0.9.0', '>1.0.0')).toBe(false);
    });

    it('should validate <= operator', () => {
      expect(satisfiesVersion('1.0.0', '<=1.0.0')).toBe(true);
      expect(satisfiesVersion('0.9.0', '<=1.0.0')).toBe(true);
      expect(satisfiesVersion('1.1.0', '<=1.0.0')).toBe(false);
    });

    it('should validate < operator', () => {
      expect(satisfiesVersion('0.9.0', '<1.0.0')).toBe(true);
      expect(satisfiesVersion('1.0.0', '<1.0.0')).toBe(false);
      expect(satisfiesVersion('1.1.0', '<1.0.0')).toBe(false);
    });

    it('should validate ^ (caret) operator - same major version', () => {
      expect(satisfiesVersion('1.0.0', '^1.0.0')).toBe(true);
      expect(satisfiesVersion('1.1.0', '^1.0.0')).toBe(true);
      expect(satisfiesVersion('1.9.9', '^1.0.0')).toBe(true);
      expect(satisfiesVersion('2.0.0', '^1.0.0')).toBe(false);
      expect(satisfiesVersion('0.9.0', '^1.0.0')).toBe(false);
    });

    it('should validate ~ (tilde) operator - same major.minor version', () => {
      expect(satisfiesVersion('1.0.0', '~1.0.0')).toBe(true);
      expect(satisfiesVersion('1.0.5', '~1.0.0')).toBe(true);
      expect(satisfiesVersion('1.1.0', '~1.0.0')).toBe(false);
      expect(satisfiesVersion('0.9.0', '~1.0.0')).toBe(false);
    });

    it('should handle versions with v prefix', () => {
      expect(satisfiesVersion('v1.0.0', '>=1.0.0')).toBe(true);
      expect(satisfiesVersion('1.0.0', '>=v1.0.0')).toBe(true);
      expect(satisfiesVersion('v1.0.0', '>=v1.0.0')).toBe(true);
    });

    it('should throw error for invalid version format', () => {
      expect(() => satisfiesVersion('invalid', '>=1.0.0')).toThrow();
      expect(() => satisfiesVersion('1.0.0', '>=invalid')).toThrow();
    });

    it('should throw error for invalid operator', () => {
      expect(() => satisfiesVersion('1.0.0', '!=1.0.0')).toThrow();
    });
  });

  describe('checkPluginCompatibility', () => {
    it('should return compatible for plugin without version requirements', () => {
      const result = checkPluginCompatibility(mockManifest, '0.2.0');

      expect(result.compatible).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('does not specify required API version');
      expect(result.errors).toHaveLength(0);
    });

    it('should validate exact version requirement', () => {
      const manifestWithRequirement = {
        ...mockManifest,
        requiredApiVersion: { exact: '0.2.0' } as VersionRequirement
      };

      const resultMatch = checkPluginCompatibility(manifestWithRequirement, '0.2.0');
      expect(resultMatch.compatible).toBe(true);
      expect(resultMatch.errors).toHaveLength(0);

      const resultNoMatch = checkPluginCompatibility(manifestWithRequirement, '0.3.0');
      expect(resultNoMatch.compatible).toBe(false);
      expect(resultNoMatch.errors[0]).toContain('exact platform version');
    });

    it('should validate minimum version requirement', () => {
      const manifestWithRequirement = {
        ...mockManifest,
        requiredApiVersion: { min: '0.2.0' } as VersionRequirement
      };

      const resultAbove = checkPluginCompatibility(manifestWithRequirement, '0.3.0');
      expect(resultAbove.compatible).toBe(true);

      const resultBelow = checkPluginCompatibility(manifestWithRequirement, '0.1.0');
      expect(resultBelow.compatible).toBe(false);
      expect(resultBelow.errors[0]).toContain('minimum platform version');
    });

    it('should validate maximum version requirement', () => {
      const manifestWithRequirement = {
        ...mockManifest,
        requiredApiVersion: { max: '0.5.0' } as VersionRequirement
      };

      const resultBelow = checkPluginCompatibility(manifestWithRequirement, '0.3.0');
      expect(resultBelow.compatible).toBe(true);

      const resultAbove = checkPluginCompatibility(manifestWithRequirement, '0.6.0');
      expect(resultAbove.compatible).toBe(false);
      expect(resultAbove.errors[0]).toContain('maximum required version');
    });

    it('should validate version range (min and max)', () => {
      const manifestWithRequirement = {
        ...mockManifest,
        requiredApiVersion: { min: '0.2.0', max: '0.5.0' } as VersionRequirement
      };

      const resultInRange = checkPluginCompatibility(manifestWithRequirement, '0.3.0');
      expect(resultInRange.compatible).toBe(true);

      const resultBelowRange = checkPluginCompatibility(manifestWithRequirement, '0.1.0');
      expect(resultBelowRange.compatible).toBe(false);

      const resultAboveRange = checkPluginCompatibility(manifestWithRequirement, '0.6.0');
      expect(resultAboveRange.compatible).toBe(false);
    });

    it('should warn about plugin SDK version mismatches', () => {
      const manifestWithSdk = {
        ...mockManifest,
        requiredApiVersion: { min: '0.2.0' } as VersionRequirement,
        sdkVersion: '0.9.0'
      };

      const result = checkPluginCompatibility(manifestWithSdk, '0.2.0');
      expect(result.compatible).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.includes('significantly older'))).toBe(true);
    });

    it('should handle invalid platform version', () => {
      const manifestWithRequirement = {
        ...mockManifest,
        requiredApiVersion: { min: '0.2.0' } as VersionRequirement
      };

      const result = checkPluginCompatibility(manifestWithRequirement, 'invalid');
      expect(result.compatible).toBe(false);
      expect(result.errors[0]).toContain('Invalid platform version format');
    });
  });

  describe('getPlatformVersion', () => {
    it('should extract platform version from headers', () => {
      const headers: PlatformHeaders = {
        'x-platform-id': 'test-platform',
        'x-plugin-slug': 'test-plugin',
        'x-installation-id': 'test-install',
        'x-installation-key': 'test-key',
        'x-platform-version': '0.2.0'
      };

      expect(getPlatformVersion(headers)).toBe('0.2.0');
    });

    it('should return null if platform version is missing', () => {
      const headers: PlatformHeaders = {
        'x-platform-id': 'test-platform',
        'x-plugin-slug': 'test-plugin',
        'x-installation-id': 'test-install',
        'x-installation-key': 'test-key'
      };

      expect(getPlatformVersion(headers)).toBeNull();
    });

    it('should handle array of header values', () => {
      const headers = {
        'x-platform-version': ['0.2.0', '0.1.0']
      };

      expect(getPlatformVersion(headers)).toBe('0.2.0');
    });

    it('should be case-insensitive', () => {
      const headers = {
        'X-Platform-Version': '0.2.0'
      };

      expect(getPlatformVersion(headers)).toBe('0.2.0');
    });
  });

  describe('checkRequestCompatibility', () => {
    it('should check compatibility from request headers', () => {
      const manifestWithRequirement = {
        ...mockManifest,
        requiredApiVersion: { min: '0.2.0' } as VersionRequirement
      };

      const headers: PlatformHeaders = {
        'x-platform-id': 'test-platform',
        'x-plugin-slug': 'test-plugin',
        'x-installation-id': 'test-install',
        'x-installation-key': 'test-key',
        'x-platform-version': '0.3.0'
      };

      const result = checkRequestCompatibility(manifestWithRequirement, headers);
      expect(result.compatible).toBe(true);
      expect(result.platformVersion).toBe('0.3.0');
    });

    it('should return error if platform version is missing from headers', () => {
      const headers: PlatformHeaders = {
        'x-platform-id': 'test-platform',
        'x-plugin-slug': 'test-plugin',
        'x-installation-id': 'test-install',
        'x-installation-key': 'test-key'
      };

      const result = checkRequestCompatibility(mockManifest, headers);
      expect(result.compatible).toBe(false);
      expect(result.errors[0]).toContain('Platform version not found');
    });
  });

  describe('isValidVersionRequirement', () => {
    it('should validate exact version requirement', () => {
      expect(isValidVersionRequirement({ exact: '1.0.0' })).toBe(true);
      expect(isValidVersionRequirement({ exact: 'invalid' })).toBe(false);
    });

    it('should validate min version requirement', () => {
      expect(isValidVersionRequirement({ min: '1.0.0' })).toBe(true);
      expect(isValidVersionRequirement({ min: 'invalid' })).toBe(false);
    });

    it('should validate max version requirement', () => {
      expect(isValidVersionRequirement({ max: '1.0.0' })).toBe(true);
      expect(isValidVersionRequirement({ max: 'invalid' })).toBe(false);
    });

    it('should validate version range', () => {
      expect(isValidVersionRequirement({ min: '1.0.0', max: '2.0.0' })).toBe(true);
      expect(isValidVersionRequirement({ min: '2.0.0', max: '1.0.0' })).toBe(false); // min > max
    });

    it('should require at least one constraint', () => {
      expect(isValidVersionRequirement({} as VersionRequirement)).toBe(false);
    });
  });

  describe('getSdkVersion', () => {
    it('should return SDK version', () => {
      const version = getSdkVersion();
      expect(version).toBe('1.0.0');
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe('getPlatformCompatibility', () => {
    it('should return platform compatibility string', () => {
      const compat = getPlatformCompatibility();
      expect(compat).toBe('>=0.2.0');
      expect(compat).toMatch(/^(>=|>|<=|<|=|\^|~)?[v]?\d+\.\d+\.\d+$/);
    });
  });

  describe('isSdkCompatibleWithPlatform', () => {
    it('should check if SDK is compatible with platform version', () => {
      expect(isSdkCompatibleWithPlatform('0.2.0')).toBe(true);
      expect(isSdkCompatibleWithPlatform('0.3.0')).toBe(true);
      expect(isSdkCompatibleWithPlatform('1.0.0')).toBe(true);
      expect(isSdkCompatibleWithPlatform('0.1.0')).toBe(false);
    });

    it('should handle invalid version gracefully', () => {
      expect(isSdkCompatibleWithPlatform('invalid')).toBe(false);
    });
  });
});
