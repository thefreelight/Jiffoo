/**
 * Signature Verification Infrastructure (Task 2.2)
 *
 * Ed25519 signature verification for extension packages.
 *
 * Two verification modes are supported:
 *
 * 1. **ZIP-level signature** (legacy, already in signature-verifier.ts):
 *    A `.sig` file alongside the ZIP contains a base64 Ed25519 signature
 *    of SHA-256(ZIP content).
 *
 * 2. **Manifest-level signature** (new, task 2.2.2):
 *    The ZIP contains `manifest.json` + `manifest.sig`. The `.sig` file is a
 *    detached Ed25519 signature of the manifest bytes. The manifest contains
 *    a `files` object mapping relative paths to SHA-256 hashes, enabling
 *    per-file integrity verification after extraction.
 *
 * Trusted keys are loaded from:
 * - Built-in official public key (`keys/official.pub`)
 * - `JIFFOO_EXTRA_TRUSTED_KEYS` environment variable (newline-separated PEM list)
 */

import { createHash, verify as cryptoVerify } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { LoggerService } from '@/core/logger/unified-logger';

// ============================================================================
// Types
// ============================================================================

/** A trusted public key with an identifier */
export interface TrustedKey {
  /** Key identifier (e.g. 'jiffoo-official', 'extra-1') */
  id: string;
  /** PEM-encoded public key */
  pem: Buffer;
}

/** Result of manifest-level signature verification */
export interface ManifestSignatureResult {
  /** Whether the signature was successfully verified */
  verified: boolean;
  /** Key identifier that signed the manifest */
  signedBy?: string;
  /** Derived trust level from the signing key */
  trustLevel: 'official' | 'third-party';
  /** Human-readable error message if verification failed */
  error?: string;
  /** The verified manifest (parsed) if verification succeeded */
  manifest?: SignedManifest;
}

/** The signed manifest format inside the ZIP */
export interface SignedManifest {
  /** Schema version, must be 1 */
  schemaVersion: 1;
  /** Plugin or theme slug */
  slug: string;
  /** Semantic version */
  version: string;
  /** File hash map: relative path -> SHA-256 hex */
  files: Record<string, string>;
  /** Key identifier that created the signature (for informational purposes) */
  signedByKey?: string;
}

// ============================================================================
// Trusted Key Management
// ============================================================================

const KEYS_DIR = path.join(__dirname, 'keys');

/**
 * Load all trusted public keys.
 *
 * Sources:
 * 1. Built-in official key from `keys/official.pub`
 * 2. `JIFFOO_EXTRA_TRUSTED_KEYS` environment variable — newline-separated
 *    list of PEM-encoded public keys (allows operators to trust additional
 *    signing keys, e.g. for internally signed enterprise plugins)
 *
 * @returns Array of trusted keys with identifiers
 */
export async function loadTrustedKeys(): Promise<TrustedKey[]> {
  const keys: TrustedKey[] = [];

  // 1. Built-in official key
  try {
    const officialKey = await fs.readFile(path.join(KEYS_DIR, 'official.pub'));
    keys.push({ id: 'jiffoo-official', pem: officialKey });
  } catch {
    LoggerService.log('warn', 'Official public key not found at keys/official.pub', {
      context: 'signature.loadTrustedKeys',
    });
  }

  // 2. Extra trusted keys from environment variable
  const extraKeysEnv = process.env.JIFFOO_EXTRA_TRUSTED_KEYS;
  if (extraKeysEnv && extraKeysEnv.trim()) {
    const pemBlocks = extraKeysEnv
      .split(/-----BEGIN PUBLIC KEY-----/)
      .filter((block) => block.trim())
      .map((block) => `-----BEGIN PUBLIC KEY-----${block}`)
      .filter((pem) => pem.includes('-----END PUBLIC KEY-----'));

    pemBlocks.forEach((pem, index) => {
      keys.push({
        id: `extra-${index + 1}`,
        pem: Buffer.from(pem.trim(), 'utf-8'),
      });
    });
  }

  return keys;
}

/**
 * Verify a detached Ed25519 signature against data using a public key.
 *
 * @param data - The original data that was signed
 * @param signature - The detached signature (raw bytes)
 * @param publicKeyPem - PEM-encoded public key
 * @returns true if the signature is valid
 */
export function verifyDetachedSignature(
  data: Buffer,
  signature: Buffer,
  publicKeyPem: Buffer,
): boolean {
  try {
    return cryptoVerify(null, data, { key: publicKeyPem, format: 'pem' }, signature);
  } catch {
    return false;
  }
}

// ============================================================================
// Manifest-Level Signature Verification (Task 2.2.2)
// ============================================================================

/**
 * Verify a signed manifest from a ZIP package.
 *
 * The ZIP must contain:
 * - `manifest.json` — the signed manifest with file hash list
 * - `manifest.sig` — base64-encoded Ed25519 detached signature of manifest.json bytes
 *
 * Verification process:
 * 1. Parse manifest.json
 * 2. Decode manifest.sig from base64
 * 3. Try each trusted key until one verifies the signature
 * 4. If verified, the signing key determines the trust level:
 *    - `jiffoo-official` key → trustLevel = 'official'
 *    - `extra-*` keys → trustLevel = 'official' (operator-trusted)
 *    - No matching key → trustLevel = 'third-party' (not verified)
 *
 * @param manifestJsonBuffer - Raw bytes of manifest.json from the ZIP
 * @param manifestSigBase64 - Base64-encoded signature from manifest.sig
 * @returns Verification result
 */
export async function verifyManifestSignature(
  manifestJsonBuffer: Buffer,
  manifestSigBase64: string,
): Promise<ManifestSignatureResult> {
  let manifest: SignedManifest;

  // 1. Parse manifest.json
  try {
    manifest = JSON.parse(manifestJsonBuffer.toString('utf-8')) as SignedManifest;
  } catch (error: any) {
    return {
      verified: false,
      trustLevel: 'third-party',
      error: `Failed to parse manifest.json: ${error.message}`,
    };
  }

  // Validate manifest schema version
  if (manifest.schemaVersion !== 1) {
    return {
      verified: false,
      trustLevel: 'third-party',
      error: `Unsupported manifest schemaVersion: ${manifest.schemaVersion}`,
    };
  }

  // 2. Decode signature
  let signature: Buffer;
  try {
    signature = Buffer.from(manifestSigBase64.trim(), 'base64');
  } catch {
    return {
      verified: false,
      trustLevel: 'third-party',
      error: 'Failed to decode manifest.sig (expected base64)',
    };
  }

  // 3. Load trusted keys and try each
  const trustedKeys = await loadTrustedKeys();

  if (trustedKeys.length === 0) {
    return {
      verified: false,
      trustLevel: 'third-party',
      error: 'No trusted public keys available',
    };
  }

  for (const key of trustedKeys) {
    const isValid = verifyDetachedSignature(manifestJsonBuffer, signature, key.pem);
    if (isValid) {
      return {
        verified: true,
        signedBy: key.id,
        trustLevel: 'official',
        manifest: { ...manifest, signedByKey: key.id },
      };
    }
  }

  // 4. No trusted key matched — signature is from an unknown key
  return {
    verified: false,
    trustLevel: 'third-party',
    error: 'Signature is valid but signed by an untrusted key',
  };
}

/**
 * Verify file integrity against the manifest's file hash list.
 *
 * After extracting a ZIP, this function checks that each file's SHA-256
 * matches the hash declared in the signed manifest. This detects tampering
 * that occurs after the manifest was signed.
 *
 * @param manifest - The verified signed manifest
 * @param extractedFiles - Map of relative file paths to file content buffers
 * @returns Array of mismatched file paths (empty if all match)
 */
export function verifyFileIntegrity(
  manifest: SignedManifest,
  extractedFiles: Map<string, Buffer>,
): string[] {
  const mismatches: string[] = [];

  for (const [relativePath, expectedHash] of Object.entries(manifest.files)) {
    const fileBuffer = extractedFiles.get(relativePath);
    if (!fileBuffer) {
      mismatches.push(relativePath);
      continue;
    }

    const actualHash = createHash('sha256').update(fileBuffer).digest('hex');
    if (actualHash !== expectedHash) {
      mismatches.push(relativePath);
    }
  }

  return mismatches;
}

// ============================================================================
// Signing Utility (for testing and build pipeline)
// ============================================================================

/**
 * Create a detached Ed25519 signature for a manifest.
 *
 * This is used by:
 * - The `build:official-artifacts` script to sign packages
 * - Tests to generate valid signatures for verification
 *
 * @param manifestBuffer - Raw manifest.json bytes to sign
 * @param privateKeyPem - PEM-encoded Ed25519 private key
 * @returns Base64-encoded signature
 */
export function signManifest(
  manifestBuffer: Buffer,
  privateKeyPem: string,
): string {
  const { sign: cryptoSign } = require('crypto');
  const signature = cryptoSign(null, manifestBuffer, privateKeyPem);
  return signature.toString('base64');
}

/**
 * Create a SignedManifest object with file hashes from a directory.
 *
 * @param slug - Plugin/theme slug
 * @param version - Semantic version
 * @param files - Map of relative file paths to file content buffers
 * @returns SignedManifest object (not yet signed)
 */
export function createSignedManifest(
  slug: string,
  version: string,
  files: Map<string, Buffer>,
): SignedManifest {
  const fileHashes: Record<string, string> = {};
  for (const [relativePath, buffer] of files) {
    fileHashes[relativePath] = createHash('sha256').update(buffer).digest('hex');
  }

  return {
    schemaVersion: 1,
    slug,
    version,
    files: fileHashes,
  };
}
