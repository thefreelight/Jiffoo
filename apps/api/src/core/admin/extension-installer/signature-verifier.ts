/**
 * Extension Package Signature Verifier (Phase 5, Section 4.8)
 *
 * Verifies Ed25519 signatures on extension packages.
 * Signature flow: .sig file -> base64 decode -> verify against SHA-256(ZIP) using Ed25519
 *
 * Verification modes:
 * - 'required': Installation fails if signature is missing or invalid
 * - 'optional': Signature is checked if present, but unsigned packages are allowed
 * - 'disabled': No signature checking is performed
 */

import { createHash, verify as cryptoVerify } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { createReadStream } from 'fs';
import { LoggerService } from '@/core/logger/unified-logger';
import { isOfficialMarketOnly } from './official-only';

/** Verification mode controlling how missing/invalid signatures are handled */
export type SignatureVerifyMode = 'required' | 'optional' | 'disabled';

/** Result of a signature verification attempt */
export interface SignatureVerifyResult {
  /** Whether the signature was successfully verified */
  verified: boolean;
  /** Key identifier that signed the package (e.g. 'jiffoo-official') */
  signedBy?: string;
  /** Human-readable error message if verification failed */
  error?: string;
  /** The verification mode that was in effect */
  mode: SignatureVerifyMode;
}

/** Directory containing trusted public keys */
const KEYS_DIR = path.join(__dirname, 'keys');

/**
 * Determine the signature verification mode from environment configuration.
 *
 * Reads EXTENSION_SIGNATURE_VERIFY from process.env and validates it.
 * Falls back to 'optional' for unrecognized values.
 */
export function getSignatureVerifyMode(): SignatureVerifyMode {
  const mode = process.env.EXTENSION_SIGNATURE_VERIFY || 'optional';
  if (mode === 'required' || mode === 'optional' || mode === 'disabled') {
    return mode;
  }
  if (isOfficialMarketOnly()) {
    return 'required';
  }
  return 'optional';
}

/**
 * Load the official Jiffoo public key for signature verification.
 *
 * Reads the PEM-encoded Ed25519 public key from the keys directory.
 * Returns null if the key file does not exist or cannot be read.
 */
async function loadOfficialPublicKey(): Promise<Buffer | null> {
  try {
    const keyPath = path.join(KEYS_DIR, 'official.pub');
    return await fs.readFile(keyPath);
  } catch {
    return null;
  }
}

export async function hasOfficialPublicKey(): Promise<boolean> {
  const key = await loadOfficialPublicKey();
  return Boolean(key && key.length > 0);
}

/**
 * Verify an extension package signature against its ZIP content.
 *
 * Process:
 * 1. Compute SHA-256 hash of the ZIP buffer
 * 2. Decode the base64-encoded Ed25519 signature
 * 3. Load the official public key
 * 4. Verify the signature against the ZIP hash
 *
 * @param zipBuffer - The raw ZIP file content
 * @param sigBase64 - The .sig file content (base64-encoded Ed25519 signature)
 * @returns Verification result with status and any error details
 */
export async function verifyPackageSignature(
  zipBuffer: Buffer,
  sigBase64: string,
): Promise<SignatureVerifyResult> {
  const mode = getSignatureVerifyMode();

  if (mode === 'disabled') {
    return { verified: false, mode, error: 'Signature verification disabled' };
  }

  try {
    // 1. Compute SHA-256 hash of the ZIP
    const zipHash = createHash('sha256').update(zipBuffer).digest();

    // 2. Decode the signature from base64
    const signature = Buffer.from(sigBase64, 'base64');

    // 3. Load the official public key
    const publicKey = await loadOfficialPublicKey();
    if (!publicKey) {
      if (mode === 'required') {
        return { verified: false, mode, error: 'Official public key not found' };
      }
      return { verified: false, mode, error: 'No public key available' };
    }

    // 4. Verify Ed25519 signature against the ZIP hash
    //    Ed25519 does not use a separate hash algorithm parameter (pass null)
    const isValid = cryptoVerify(
      null,
      zipHash,
      {
        key: publicKey,
        format: 'pem',
      },
      signature,
    );

    if (isValid) {
      return { verified: true, signedBy: 'jiffoo-official', mode };
    }

    if (mode === 'required') {
      return { verified: false, mode, error: 'Signature verification failed' };
    }

    return { verified: false, mode, error: 'Signature does not match' };
  } catch (error: any) {
    LoggerService.logError(error, { context: 'Signature verification' });

    if (mode === 'required') {
      return {
        verified: false,
        mode,
        error: `Signature verification error: ${error.message}`,
      };
    }

    return { verified: false, mode, error: error.message };
  }
}

async function verifyPackageHashSignature(
  zipHash: Buffer,
  sigBase64: string,
): Promise<SignatureVerifyResult> {
  const mode = getSignatureVerifyMode();

  if (mode === 'disabled') {
    return { verified: false, mode, error: 'Signature verification disabled' };
  }

  try {
    const signature = Buffer.from(sigBase64, 'base64');
    const publicKey = await loadOfficialPublicKey();
    if (!publicKey) {
      if (mode === 'required') {
        return { verified: false, mode, error: 'Official public key not found' };
      }
      return { verified: false, mode, error: 'No public key available' };
    }

    const isValid = cryptoVerify(
      null,
      zipHash,
      {
        key: publicKey,
        format: 'pem',
      },
      signature,
    );

    if (isValid) {
      return { verified: true, signedBy: 'jiffoo-official', mode };
    }

    if (mode === 'required') {
      return { verified: false, mode, error: 'Signature verification failed' };
    }

    return { verified: false, mode, error: 'Signature does not match' };
  } catch (error: any) {
    LoggerService.logError(error, { context: 'Signature verification' });

    if (mode === 'required') {
      return {
        verified: false,
        mode,
        error: `Signature verification error: ${error.message}`,
      };
    }

    return { verified: false, mode, error: error.message };
  }
}

async function calculateFileHashBuffer(filePath: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const input = createReadStream(filePath);

    input.on('data', (chunk) => {
      hash.update(chunk);
    });

    input.on('end', () => {
      resolve(hash.digest());
    });

    input.on('error', reject);
  });
}

/**
 * Verify a package from its ZIP buffer and an optional .sig file path.
 *
 * This is the primary entry point for the install flow. It handles:
 * - Reading the .sig file from disk
 * - Delegating to verifyPackageSignature for cryptographic verification
 * - Respecting the verification mode for missing signature files
 *
 * @param zipBuffer - The raw ZIP file content
 * @param sigFilePath - Optional path to the .sig file on disk
 * @returns Verification result suitable for use in the install decision flow
 */
export async function verifyPackageFromFiles(
  zipBuffer: Buffer,
  sigFilePath?: string,
): Promise<SignatureVerifyResult> {
  const mode = getSignatureVerifyMode();

  if (mode === 'disabled') {
    return { verified: false, mode };
  }

  if (!sigFilePath) {
    if (mode === 'required') {
      return {
        verified: false,
        mode,
        error: 'Signature file (.sig) required but not found',
      };
    }
    return { verified: false, mode, error: 'No signature file provided' };
  }

  try {
    const sigContent = await fs.readFile(sigFilePath, 'utf-8');
    return verifyPackageSignature(zipBuffer, sigContent.trim());
  } catch (error: any) {
    if (mode === 'required') {
      return {
        verified: false,
        mode,
        error: `Failed to read signature file: ${error.message}`,
      };
    }
    return { verified: false, mode, error: error.message };
  }
}

export async function verifyPackageFromZipFile(
  zipFilePath: string,
  sigFilePath?: string,
): Promise<SignatureVerifyResult> {
  const mode = getSignatureVerifyMode();

  if (mode === 'disabled') {
    return { verified: false, mode };
  }

  if (!sigFilePath) {
    if (mode === 'required') {
      return {
        verified: false,
        mode,
        error: 'Signature file (.sig) required but not found',
      };
    }
    return { verified: false, mode, error: 'No signature file provided' };
  }

  try {
    const [sigContent, zipHash] = await Promise.all([
      fs.readFile(sigFilePath, 'utf-8'),
      calculateFileHashBuffer(zipFilePath),
    ]);
    return verifyPackageHashSignature(zipHash, sigContent.trim());
  } catch (error: any) {
    if (mode === 'required') {
      return {
        verified: false,
        mode,
        error: `Failed to verify signature file: ${error.message}`,
      };
    }
    return { verified: false, mode, error: error.message };
  }
}
