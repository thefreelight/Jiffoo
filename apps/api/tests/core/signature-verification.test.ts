/**
 * Signature Verification Unit Tests (Task 2.2.3)
 *
 * Tests for the Ed25519 manifest-level signature verification:
 * - Valid signature passes
 * - Tampered content is rejected
 * - Unknown key is rejected
 * - JIFFOO_EXTRA_TRUSTED_KEYS environment variable support
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { generateKeyPairSync } from 'crypto';
import {
  verifyManifestSignature,
  verifyFileIntegrity,
  createSignedManifest,
  signManifest,
  loadTrustedKeys,
  type SignedManifest,
} from '@/core/admin/extension-installer/signature';

describe('Signature Verification (Task 2.2.3)', () => {
  // Generate test key pairs
  const officialKeys = generateKeyPairSync('ed25519');
  const attackerKeys = generateKeyPairSync('ed25519');

  const officialPrivateKeyPem = officialKeys.privateKey.export({
    type: 'pkcs8',
    format: 'pem',
  }) as string;
  const officialPublicKeyPem = officialKeys.publicKey.export({
    type: 'spki',
    format: 'pem',
  }) as string;

  const attackerPrivateKeyPem = attackerKeys.privateKey.export({
    type: 'pkcs8',
    format: 'pem',
  }) as string;

  // Save original env
  const originalEnv = { ...process.env };

  beforeAll(() => {
    // We can't easily override the built-in official.pub, so we use
    // JIFFOO_EXTRA_TRUSTED_KEYS to add our test key
    process.env.JIFFOO_EXTRA_TRUSTED_KEYS = officialPublicKeyPem;
  });

  afterAll(() => {
    // Restore env
    process.env = { ...originalEnv };
  });

  // --- Helper: create a valid signed manifest ---

  function createValidSignedManifest(): { manifestBuffer: Buffer; signature: string; manifest: SignedManifest } {
    const fileContent = Buffer.from('console.log("hello plugin");');
    const files = new Map([['server/index.js', fileContent]]);
    const manifest = createSignedManifest('test-plugin', '1.0.0', files);
    const manifestBuffer = Buffer.from(JSON.stringify(manifest, null, 2));
    const signature = signManifest(manifestBuffer, officialPrivateKeyPem);
    return { manifestBuffer, signature, manifest };
  }

  // --- 2.2.3: Valid signature passes ---

  it('accepts a valid signature from a trusted key', async () => {
    const { manifestBuffer, signature } = createValidSignedManifest();

    const result = await verifyManifestSignature(manifestBuffer, signature);

    expect(result.verified).toBe(true);
    expect(result.trustLevel).toBe('official');
    expect(result.signedBy).toBeDefined();
    expect(result.manifest).toBeDefined();
    expect(result.manifest!.slug).toBe('test-plugin');
    expect(result.manifest!.version).toBe('1.0.0');
  });

  // --- 2.2.3: Tampered content is rejected ---

  it('rejects a signature when manifest content is tampered after signing', async () => {
    const { manifestBuffer, signature } = createValidSignedManifest();

    // Tamper with the manifest buffer
    const tamperedBuffer = Buffer.from(
      JSON.stringify({ ...JSON.parse(manifestBuffer.toString()), slug: 'evil-plugin' }),
    );

    const result = await verifyManifestSignature(tamperedBuffer, signature);

    expect(result.verified).toBe(false);
    expect(result.trustLevel).toBe('third-party');
    expect(result.error).toBeDefined();
  });

  it('rejects a signature when file content does not match manifest hashes', async () => {
    const { manifest } = createValidSignedManifest();

    // Create extracted files with tampered content
    const extractedFiles = new Map([
      ['server/index.js', Buffer.from('console.log("EVIL CODE");')], // Different content
    ]);

    const mismatches = verifyFileIntegrity(manifest, extractedFiles);

    expect(mismatches).toContain('server/index.js');
  });

  it('detects missing files listed in the manifest', async () => {
    const { manifest } = createValidSignedManifest();

    // Empty extracted files — manifest expects server/index.js
    const extractedFiles = new Map<string, Buffer>();

    const mismatches = verifyFileIntegrity(manifest, extractedFiles);

    expect(mismatches).toContain('server/index.js');
  });

  // --- 2.2.3: Unknown key is rejected ---

  it('rejects a signature from an unknown (untrusted) key', async () => {
    const { manifestBuffer } = createValidSignedManifest();

    // Sign with the attacker's key instead of the official key
    const attackerSignature = signManifest(manifestBuffer, attackerPrivateKeyPem);

    const result = await verifyManifestSignature(manifestBuffer, attackerSignature);

    expect(result.verified).toBe(false);
    expect(result.trustLevel).toBe('third-party');
    expect(result.error).toContain('untrusted');
  });

  // --- Edge cases ---

  it('rejects an invalid base64 signature', async () => {
    const { manifestBuffer } = createValidSignedManifest();

    const result = await verifyManifestSignature(manifestBuffer, '!!!invalid-base64!!!');

    // Should not throw, should return not verified
    expect(result.verified).toBe(false);
    expect(result.trustLevel).toBe('third-party');
  });

  it('rejects a manifest with unsupported schemaVersion', async () => {
    const badManifest = Buffer.from(
      JSON.stringify({ schemaVersion: 99, slug: 'test', version: '1.0.0', files: {} }),
    );
    const signature = signManifest(badManifest, officialPrivateKeyPem);

    const result = await verifyManifestSignature(badManifest, signature);

    expect(result.verified).toBe(false);
    expect(result.error).toContain('schemaVersion');
  });

  it('rejects a manifest with invalid JSON', async () => {
    const badJson = Buffer.from('{ this is not valid json }');
    const signature = signManifest(badJson, officialPrivateKeyPem);

    const result = await verifyManifestSignature(badJson, signature);

    expect(result.verified).toBe(false);
    expect(result.error).toContain('parse');
  });

  // --- JIFFOO_EXTRA_TRUSTED_KEYS support ---

  it('loads extra trusted keys from JIFFOO_EXTRA_TRUSTED_KEYS', async () => {
    const keys = await loadTrustedKeys();

    // Should include the official key (if file exists) plus the extra key
    const extraKeys = keys.filter((k) => k.id.startsWith('extra-'));
    expect(extraKeys.length).toBeGreaterThanOrEqual(1);
  });

  it('accepts signatures from extra trusted keys (operator-trusted)', async () => {
    const { manifestBuffer } = createValidSignedManifest();

    // The official key is loaded via JIFFOO_EXTRA_TRUSTED_KEYS in beforeAll
    const result = await verifyManifestSignature(manifestBuffer, signManifest(manifestBuffer, officialPrivateKeyPem));

    expect(result.verified).toBe(true);
    expect(result.trustLevel).toBe('official');
  });

  // --- File integrity ---

  it('verifies file integrity passes when all files match', async () => {
    const fileContent = Buffer.from('console.log("hello");');
    const files = new Map([
      ['server/index.js', fileContent],
      ['package.json', Buffer.from('{"name":"test"}')],
    ]);
    const manifest = createSignedManifest('test-plugin', '1.0.0', files);

    // Same files extracted
    const extractedFiles = new Map([
      ['server/index.js', Buffer.from('console.log("hello");')],
      ['package.json', Buffer.from('{"name":"test"}')],
    ]);

    const mismatches = verifyFileIntegrity(manifest, extractedFiles);
    expect(mismatches).toEqual([]);
  });

  it('creates a manifest with correct SHA-256 file hashes', () => {
    const fileContent = Buffer.from('test content');
    const files = new Map([['test.js', fileContent]]);
    const manifest = createSignedManifest('test', '1.0.0', files);

    const expectedHash = require('crypto').createHash('sha256').update(fileContent).digest('hex');
    expect(manifest.files['test.js']).toBe(expectedHash);
  });
});
