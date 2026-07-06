/**
 * Trust Level Installation Integration Tests (Task 2.3.4)
 *
 * Integration-level tests that exercise the trust level enforcement through
 * the actual installer path, covering:
 * - Official signed package installs successfully (trustLevel = official)
 * - Unsigned third-party internal-fastify package is rejected
 * - Grace mode: existing third-party internal-fastify plugin continues to run
 * - Third-party external-http plugin is allowed (no rejection)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { generateKeyPairSync } from 'crypto';
import {
  deriveTrustLevel,
  checkInstallationAllowed,
  checkGraceMode,
  logGraceModeWarnings,
  type TrustLevelEnforcementError,
} from '@/core/admin/extension-installer/trust-level';
import type { SignatureVerifyResult } from '@/core/admin/extension-installer/signature-verifier';
import {
  verifyManifestSignature,
  createSignedManifest,
  signManifest,
} from '@/core/admin/extension-installer/signature';

describe('Trust Level Installation Integration (Task 2.3.4)', () => {
  const officialKeys = generateKeyPairSync('ed25519');
  const officialPrivateKeyPem = officialKeys.privateKey.export({
    type: 'pkcs8',
    format: 'pem',
  }) as string;
  const officialPublicKeyPem = officialKeys.publicKey.export({
    type: 'spki',
    format: 'pem',
  }) as string;

  const originalEnv = { ...process.env };

  beforeAll(() => {
    process.env.JIFFOO_EXTRA_TRUSTED_KEYS = officialPublicKeyPem;
  });

  afterAll(() => {
    process.env = { ...originalEnv };
  });

  // --- 2.3.4 Scenario 1: Official signed package installs successfully ---

  it('scenario 1: official signed package → trustLevel=official → installation allowed', async () => {
    // 1. Create a valid signed manifest
    const fileContent = Buffer.from('module.exports = async function(fastify) { fastify.get("/health", async () => ({ ok: true })); };');
    const files = new Map([['server/index.js', fileContent]]);
    const manifest = createSignedManifest('official-test', '1.0.0', files);
    const manifestBuffer = Buffer.from(JSON.stringify(manifest, null, 2));
    const signature = signManifest(manifestBuffer, officialPrivateKeyPem);

    // 2. Verify the signature (simulates what the installer does)
    const sigResult = await verifyManifestSignature(manifestBuffer, signature);
    expect(sigResult.verified).toBe(true);
    expect(sigResult.trustLevel).toBe('official');

    // 3. Derive trust level
    const legacySigResult: SignatureVerifyResult = {
      verified: sigResult.verified,
      signedBy: sigResult.signedBy,
      mode: 'optional',
    };
    const trustLevel = deriveTrustLevel(
      'local-zip',
      'internal-fastify',
      legacySigResult,
      undefined,
    );
    expect(trustLevel).toBe('official');

    // 4. Check installation is allowed
    const error = checkInstallationAllowed('internal-fastify', trustLevel);
    expect(error).toBeNull();
  });

  // --- 2.3.4 Scenario 2: Unsigned third-party internal-fastify is rejected ---

  it('scenario 2: unsigned third-party internal-fastify → trustLevel=third-party → installation rejected', () => {
    // 1. Simulate unsigned package (no signature verification)
    const unsignedSigResult: SignatureVerifyResult = {
      verified: false,
      mode: 'optional',
      error: 'No signature file provided',
    };

    // 2. Derive trust level
    const trustLevel = deriveTrustLevel(
      'local-zip',
      'internal-fastify',
      unsignedSigResult,
      undefined,
    );
    expect(trustLevel).toBe('third-party');

    // 3. Check installation is rejected
    const error = checkInstallationAllowed('internal-fastify', trustLevel);
    expect(error).not.toBeNull();
    expect(error!.code).toBe('THIRD_PARTY_INTERNAL_NOT_ALLOWED');
    expect(error!.message).toContain('external-http');
    expect(error!.docUrl).toBeDefined();
  });

  // --- 2.3.4 Scenario 3: Grace mode for existing third-party internal-fastify ---

  it('scenario 3: existing third-party internal-fastify plugin → grace mode (warn, not disabled)', () => {
    // 1. Check grace mode for a legacy plugin without trustLevel
    const warning = checkGraceMode('legacy-plugin', 'internal-fastify', undefined);
    expect(warning).not.toBeNull();
    expect(warning!.slug).toBe('legacy-plugin');
    expect(warning!.trustLevel).toBe('third-party');
    expect(warning!.message).toContain('1.2.0');

    // 2. Grace mode should NOT reject — just warn
    // The checkInstallationAllowed function is NOT called for existing plugins
    // (only for new installations). So we verify the warning is produced, not an error.
    expect(warning!.message).toContain('migrate')

    // 3. logGraceModeWarnings should not throw
    expect(() =>
      logGraceModeWarnings([
        { slug: 'legacy-plugin', runtimeType: 'internal-fastify', trustLevel: undefined },
      ]),
    ).not.toThrow();
  });

  // --- 2.3.4 Scenario 4: Third-party external-http is allowed ---

  it('scenario 4: unsigned third-party external-http → trustLevel=third-party → installation allowed', () => {
    const unsignedSigResult: SignatureVerifyResult = {
      verified: false,
      mode: 'optional',
      error: 'No signature file provided',
    };

    const trustLevel = deriveTrustLevel(
      'local-zip',
      'external-http',
      unsignedSigResult,
      undefined,
    );
    expect(trustLevel).toBe('third-party');

    const error = checkInstallationAllowed('external-http', trustLevel);
    expect(error).toBeNull();
  });

  // --- 2.3.4 Scenario 5: Tampered signed package is rejected ---

  it('scenario 5: tampered signed package → signature fails → trustLevel=third-party → rejected for internal-fastify', async () => {
    const fileContent = Buffer.from('console.log("original");');
    const files = new Map([['server/index.js', fileContent]]);
    const manifest = createSignedManifest('tampered-test', '1.0.0', files);
    const manifestBuffer = Buffer.from(JSON.stringify(manifest, null, 2));
    const signature = signManifest(manifestBuffer, officialPrivateKeyPem);

    // Tamper with the manifest after signing
    const tamperedBuffer = Buffer.from(
      JSON.stringify({ ...JSON.parse(manifestBuffer.toString()), slug: 'evil-plugin' }),
    );

    const sigResult = await verifyManifestSignature(tamperedBuffer, signature);
    expect(sigResult.verified).toBe(false);
    expect(sigResult.trustLevel).toBe('third-party');

    // Derived trust level should be third-party → rejected for internal-fastify
    const legacySigResult: SignatureVerifyResult = {
      verified: false,
      mode: 'optional',
      error: sigResult.error,
    };
    const trustLevel = deriveTrustLevel('local-zip', 'internal-fastify', legacySigResult, undefined);
    expect(trustLevel).toBe('third-party');

    const error = checkInstallationAllowed('internal-fastify', trustLevel);
    expect(error).not.toBeNull();
  });

  // --- 2.3.4 Scenario 6: Builtin plugin is always allowed ---

  it('scenario 6: builtin source → trustLevel=builtin → installation allowed for internal-fastify', () => {
    const trustLevel = deriveTrustLevel('builtin', 'internal-fastify', null, undefined);
    expect(trustLevel).toBe('builtin');

    const error = checkInstallationAllowed('internal-fastify', trustLevel);
    expect(error).toBeNull();
  });

  // --- 2.3.4 Scenario 7: File integrity check detects post-extraction tampering ---

  it('scenario 7: file integrity check detects tampered file after extraction', async () => {
    const { verifyFileIntegrity } = await import('@/core/admin/extension-installer/signature');

    const originalContent = Buffer.from('console.log("safe");');
    const files = new Map([['server/index.js', originalContent]]);
    const manifest = createSignedManifest('integrity-test', '1.0.0', files);
    const manifestBuffer = Buffer.from(JSON.stringify(manifest, null, 2));
    const signature = signManifest(manifestBuffer, officialPrivateKeyPem);

    // Signature verifies
    const sigResult = await verifyManifestSignature(manifestBuffer, signature);
    expect(sigResult.verified).toBe(true);
    expect(sigResult.manifest).toBeDefined();

    // But extracted file has been tampered
    const tamperedFiles = new Map([
      ['server/index.js', Buffer.from('console.log("EVIL");')],
    ]);
    const mismatches = verifyFileIntegrity(sigResult.manifest!, tamperedFiles);
    expect(mismatches).toContain('server/index.js');
  });
});
