/**
 * Version Range Matching Tests (Task 6.2.x)
 *
 * Tests the semver range matching logic used for
 * theme engines["jiffoo-theme-sdk"] validation.
 */

import { describe, it, expect } from 'vitest';
import {
  compareVersions,
  validateVersionFormat,
  satisfiesRange,
  validateVersionRange,
} from '@/core/admin/extension-installer/version-utils';
import { ExtensionInstallerError } from '@/core/admin/extension-installer/errors';

describe('Version Utilities', () => {
  // ── compareVersions ──────────────────────────────────────────

  describe('compareVersions', () => {
    it('should return 0 for equal versions', () => {
      expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
      expect(compareVersions('2.3.4', '2.3.4')).toBe(0);
    });

    it('should return -1 when a < b', () => {
      expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
      expect(compareVersions('1.0.0', '1.1.0')).toBe(-1);
      expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
    });

    it('should return 1 when a > b', () => {
      expect(compareVersions('1.0.1', '1.0.0')).toBe(1);
      expect(compareVersions('1.1.0', '1.0.0')).toBe(1);
      expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
    });
  });

  // ── validateVersionFormat ────────────────────────────────────

  describe('validateVersionFormat', () => {
    it('should accept valid semver', () => {
      expect(() => validateVersionFormat('1.0.0')).not.toThrow();
      expect(() => validateVersionFormat('0.2.0')).not.toThrow();
      expect(() => validateVersionFormat('10.20.30')).not.toThrow();
    });

    it('should reject invalid formats', () => {
      expect(() => validateVersionFormat('1.0')).toThrow(ExtensionInstallerError);
      expect(() => validateVersionFormat('1.0.0.0')).toThrow(ExtensionInstallerError);
      expect(() => validateVersionFormat('v1.0.0')).toThrow(ExtensionInstallerError);
      expect(() => validateVersionFormat('1.0.0-beta')).toThrow(ExtensionInstallerError);
      expect(() => validateVersionFormat('')).toThrow(ExtensionInstallerError);
    });
  });

  // ── satisfiesRange ───────────────────────────────────────────

  describe('satisfiesRange', () => {
    describe('exact match', () => {
      it('should match exact version', () => {
        expect(satisfiesRange('1.0.0', '1.0.0')).toBe(true);
        expect(satisfiesRange('0.2.0', '0.2.0')).toBe(true);
      });

      it('should not match different version', () => {
        expect(satisfiesRange('1.0.1', '1.0.0')).toBe(false);
        expect(satisfiesRange('0.3.0', '0.2.0')).toBe(false);
      });
    });

    describe('caret (^) ranges', () => {
      it('should match within same major for 1.x', () => {
        expect(satisfiesRange('1.0.0', '^1.0.0')).toBe(true);
        expect(satisfiesRange('1.5.0', '^1.0.0')).toBe(true);
        expect(satisfiesRange('1.99.99', '^1.0.0')).toBe(true);
      });

      it('should not match different major for 1.x', () => {
        expect(satisfiesRange('2.0.0', '^1.0.0')).toBe(false);
        expect(satisfiesRange('0.9.0', '^1.0.0')).toBe(false);
      });

      it('should handle 0.x.y caret ranges correctly', () => {
        // ^0.2.0 allows 0.2.x but not 0.3.0
        expect(satisfiesRange('0.2.0', '^0.2.0')).toBe(true);
        expect(satisfiesRange('0.2.5', '^0.2.0')).toBe(true);
        expect(satisfiesRange('0.3.0', '^0.2.0')).toBe(false);
        expect(satisfiesRange('0.1.0', '^0.2.0')).toBe(false);
      });

      it('should handle 0.0.z caret ranges correctly', () => {
        // ^0.0.3 only matches exactly 0.0.3
        expect(satisfiesRange('0.0.3', '^0.0.3')).toBe(true);
        expect(satisfiesRange('0.0.4', '^0.0.3')).toBe(false);
        expect(satisfiesRange('0.1.0', '^0.0.3')).toBe(false);
      });
    });

    describe('tilde (~) ranges', () => {
      it('should match within same minor', () => {
        expect(satisfiesRange('1.0.0', '~1.0.0')).toBe(true);
        expect(satisfiesRange('1.0.5', '~1.0.0')).toBe(true);
      });

      it('should not match different minor', () => {
        expect(satisfiesRange('1.1.0', '~1.0.0')).toBe(false);
        expect(satisfiesRange('1.0.0', '~1.1.0')).toBe(false);
      });
    });

    describe('comparison operators', () => {
      it('should handle >=', () => {
        expect(satisfiesRange('1.0.0', '>=1.0.0')).toBe(true);
        expect(satisfiesRange('2.0.0', '>=1.0.0')).toBe(true);
        expect(satisfiesRange('0.9.0', '>=1.0.0')).toBe(false);
      });

      it('should handle >', () => {
        expect(satisfiesRange('1.0.1', '>1.0.0')).toBe(true);
        expect(satisfiesRange('1.0.0', '>1.0.0')).toBe(false);
        expect(satisfiesRange('0.9.0', '>1.0.0')).toBe(false);
      });

      it('should handle <=', () => {
        expect(satisfiesRange('1.0.0', '<=1.0.0')).toBe(true);
        expect(satisfiesRange('0.9.0', '<=1.0.0')).toBe(true);
        expect(satisfiesRange('1.0.1', '<=1.0.0')).toBe(false);
      });

      it('should handle <', () => {
        expect(satisfiesRange('0.9.0', '<1.0.0')).toBe(true);
        expect(satisfiesRange('1.0.0', '<1.0.0')).toBe(false);
      });
    });

    describe('AND conditions (space-separated)', () => {
      it('should match when all conditions are satisfied', () => {
        expect(satisfiesRange('1.5.0', '>=1.0.0 <2.0.0')).toBe(true);
        expect(satisfiesRange('1.0.0', '>=1.0.0 <2.0.0')).toBe(true);
        expect(satisfiesRange('1.99.99', '>=1.0.0 <2.0.0')).toBe(true);
      });

      it('should not match when any condition fails', () => {
        expect(satisfiesRange('2.0.0', '>=1.0.0 <2.0.0')).toBe(false);
        expect(satisfiesRange('0.9.0', '>=1.0.0 <2.0.0')).toBe(false);
      });
    });

    describe('OR conditions (||)', () => {
      it('should match when any condition is satisfied', () => {
        expect(satisfiesRange('1.0.0', '1.0.0 || 2.0.0')).toBe(true);
        expect(satisfiesRange('2.0.0', '1.0.0 || 2.0.0')).toBe(true);
        expect(satisfiesRange('1.5.0', '^1.0.0 || ^2.0.0')).toBe(true);
        expect(satisfiesRange('2.5.0', '^1.0.0 || ^2.0.0')).toBe(true);
      });

      it('should not match when no condition is satisfied', () => {
        expect(satisfiesRange('3.0.0', '1.0.0 || 2.0.0')).toBe(false);
        expect(satisfiesRange('3.0.0', '^1.0.0 || ^2.0.0')).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should return true for empty range', () => {
        expect(satisfiesRange('1.0.0', '')).toBe(true);
        expect(satisfiesRange('0.0.1', '  ')).toBe(true);
      });

      it('should return false for invalid version', () => {
        expect(satisfiesRange('invalid', '1.0.0')).toBe(false);
        expect(satisfiesRange('1.0', '1.0.0')).toBe(false);
      });
    });

    describe('real-world theme SDK scenarios', () => {
      it('should validate current SDK version 0.2.0', () => {
        // Current SDK is 0.2.0
        expect(satisfiesRange('0.2.0', '^0.2.0')).toBe(true);
        expect(satisfiesRange('0.2.0', '>=0.2.0')).toBe(true);
        expect(satisfiesRange('0.2.0', '0.2.0')).toBe(true);
      });

      it('should reject incompatible SDK versions', () => {
        // Theme requires ^0.2.0
        expect(satisfiesRange('0.3.0', '^0.2.0')).toBe(false);
        expect(satisfiesRange('0.1.0', '^0.2.0')).toBe(false);
        expect(satisfiesRange('1.0.0', '^0.2.0')).toBe(false);
      });

      it('should handle range with jiffoo core version', () => {
        expect(satisfiesRange('0.2.0', '>=0.2.0')).toBe(true);
        expect(satisfiesRange('1.0.0', '>=0.2.0')).toBe(true);
        expect(satisfiesRange('0.1.0', '>=0.2.0')).toBe(false);
      });
    });
  });

  // ── validateVersionRange ─────────────────────────────────────

  describe('validateVersionRange', () => {
    it('should accept valid ranges', () => {
      expect(() => validateVersionRange('1.0.0')).not.toThrow();
      expect(() => validateVersionRange('^1.0.0')).not.toThrow();
      expect(() => validateVersionRange('~1.0.0')).not.toThrow();
      expect(() => validateVersionRange('>=1.0.0')).not.toThrow();
      expect(() => validateVersionRange('>1.0.0')).not.toThrow();
      expect(() => validateVersionRange('<=1.0.0')).not.toThrow();
      expect(() => validateVersionRange('<1.0.0')).not.toThrow();
      expect(() => validateVersionRange('>=1.0.0 <2.0.0')).not.toThrow();
      expect(() => validateVersionRange('1.0.0 || 2.0.0')).not.toThrow();
      expect(() => validateVersionRange('')).not.toThrow();
    });

    it('should reject invalid ranges', () => {
      expect(() => validateVersionRange('1.0')).toThrow(ExtensionInstallerError);
      expect(() => validateVersionRange('=1.0.0')).toThrow(ExtensionInstallerError);
      expect(() => validateVersionRange('latest')).toThrow(ExtensionInstallerError);
      expect(() => validateVersionRange('^1.0')).toThrow(ExtensionInstallerError);
    });
  });
});
