/**
 * Trust Level Enforcement Tests (Task 2.3.4)
 *
 * Integration tests for the two-tier plugin trust model:
 * - Official signed package installs successfully
 * - Unsigned third-party internal-fastify package is rejected
 * - Grace mode works for existing legacy plugins
 * - External-http plugins with third-party trust are allowed
 */

import { describe, it, expect } from 'vitest';
import {
  deriveTrustLevel,
  checkInstallationAllowed,
  checkGraceMode,
  logGraceModeWarnings,
  INTERNAL_PLUGIN_ENFORCEMENT_VERSION,
  THIRD_PARTY_INTERNAL_ERROR_CODE,
} from '@/core/admin/extension-installer/trust-level';
import type { SignatureVerifyResult } from '@/core/admin/extension-installer/signature-verifier';

describe('Trust Level Enforcement (Task 2.3)', () => {
  // --- 2.3.1: Trust level derivation ---

  describe('deriveTrustLevel', () => {
    it('returns "builtin" for builtin source', () => {
      const level = deriveTrustLevel('builtin', 'internal-fastify', null, undefined);
      expect(level).toBe('builtin');
    });

    it('returns "official" when signature is verified', () => {
      const sigResult: SignatureVerifyResult = {
        verified: true,
        signedBy: 'jiffoo-official',
        mode: 'optional',
      };
      const level = deriveTrustLevel('local-zip', 'internal-fastify', sigResult, undefined);
      expect(level).toBe('official');
    });

    it('returns "official" when official-market source declares it', () => {
      const level = deriveTrustLevel('official-market', 'internal-fastify', null, 'official');
      expect(level).toBe('official');
    });

    it('returns "third-party" for unsigned local-zip', () => {
      const sigResult: SignatureVerifyResult = {
        verified: false,
        mode: 'optional',
        error: 'No signature file provided',
      };
      const level = deriveTrustLevel('local-zip', 'internal-fastify', sigResult, undefined);
      expect(level).toBe('third-party');
    });

    it('returns "third-party" for unsigned external-http', () => {
      const level = deriveTrustLevel('local-zip', 'external-http', null, undefined);
      expect(level).toBe('third-party');
    });
  });

  // --- 2.3.2: Installation rejection ---

  describe('checkInstallationAllowed', () => {
    it('rejects third-party internal-fastify', () => {
      const error = checkInstallationAllowed('internal-fastify', 'third-party');
      expect(error).not.toBeNull();
      expect(error!.code).toBe(THIRD_PARTY_INTERNAL_ERROR_CODE);
      expect(error!.message).toContain('external-http');
      expect(error!.docUrl).toBeDefined();
      expect(error!.details.enforcementVersion).toBe(INTERNAL_PLUGIN_ENFORCEMENT_VERSION);
    });

    it('allows builtin internal-fastify', () => {
      const error = checkInstallationAllowed('internal-fastify', 'builtin');
      expect(error).toBeNull();
    });

    it('allows official internal-fastify', () => {
      const error = checkInstallationAllowed('internal-fastify', 'official');
      expect(error).toBeNull();
    });

    it('allows third-party external-http', () => {
      const error = checkInstallationAllowed('external-http', 'third-party');
      expect(error).toBeNull();
    });

    it('allows official external-http', () => {
      const error = checkInstallationAllowed('external-http', 'official');
      expect(error).toBeNull();
    });
  });

  // --- 2.3.3: Grace mode ---

  describe('checkGraceMode', () => {
    it('returns warning for third-party internal-fastify', () => {
      const warning = checkGraceMode('my-plugin', 'internal-fastify', 'third-party');
      expect(warning).not.toBeNull();
      expect(warning!.slug).toBe('my-plugin');
      expect(warning!.trustLevel).toBe('third-party');
      expect(warning!.message).toContain(INTERNAL_PLUGIN_ENFORCEMENT_VERSION);
    });

    it('returns warning for undefined trustLevel (legacy install)', () => {
      const warning = checkGraceMode('legacy-plugin', 'internal-fastify', undefined);
      expect(warning).not.toBeNull();
      expect(warning!.trustLevel).toBe('third-party');
    });

    it('returns null for builtin internal-fastify', () => {
      const warning = checkGraceMode('builtin-plugin', 'internal-fastify', 'builtin');
      expect(warning).toBeNull();
    });

    it('returns null for official internal-fastify', () => {
      const warning = checkGraceMode('official-plugin', 'internal-fastify', 'official');
      expect(warning).toBeNull();
    });

    it('returns null for external-http regardless of trust level', () => {
      expect(checkGraceMode('ext-plugin', 'external-http', 'third-party')).toBeNull();
      expect(checkGraceMode('ext-plugin', 'external-http', undefined)).toBeNull();
    });
  });

  describe('logGraceModeWarnings', () => {
    it('does not throw when processing mixed plugin list', () => {
      const plugins = [
        { slug: 'builtin-1', runtimeType: 'internal-fastify', trustLevel: 'builtin' },
        { slug: 'official-1', runtimeType: 'internal-fastify', trustLevel: 'official' },
        { slug: 'third-party-1', runtimeType: 'internal-fastify', trustLevel: 'third-party' },
        { slug: 'legacy-1', runtimeType: 'internal-fastify', trustLevel: undefined },
        { slug: 'ext-1', runtimeType: 'external-http', trustLevel: 'third-party' },
      ];

      // Should not throw
      expect(() => logGraceModeWarnings(plugins)).not.toThrow();
    });

    it('handles empty plugin list', () => {
      expect(() => logGraceModeWarnings([])).not.toThrow();
    });
  });

  // --- Constants ---

  describe('constants', () => {
    it('INTERNAL_PLUGIN_ENFORCEMENT_VERSION is a valid semver', () => {
      expect(INTERNAL_PLUGIN_ENFORCEMENT_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it('THIRD_PARTY_INTERNAL_ERROR_CODE is a stable string', () => {
      expect(THIRD_PARTY_INTERNAL_ERROR_CODE).toBe('THIRD_PARTY_INTERNAL_NOT_ALLOWED');
    });
  });
});
