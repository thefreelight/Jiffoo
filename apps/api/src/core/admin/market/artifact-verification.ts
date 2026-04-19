import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import {
  getSignatureVerifyMode,
  verifyPackageSignature,
} from '@/core/admin/extension-installer/signature-verifier';

export interface OfficialArtifactVerificationInput {
  filePath: string;
  packageUrl: string;
  checksumUrl?: string | null;
  signatureUrl?: string | null;
}

export interface OfficialArtifactVerificationResult {
  sha256: string;
  checksumVerified: boolean;
  signatureVerified: boolean;
  signedBy?: string;
}

function parseSha256Sidecar(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('Checksum sidecar is empty');
  }

  const [checksum] = trimmed.split(/\s+/);
  if (!/^[a-f0-9]{64}$/i.test(checksum)) {
    throw new Error('Checksum sidecar does not contain a valid SHA-256 digest');
  }

  return checksum.toLowerCase();
}

function isTrustedOfficialArtifactUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === 'platform-api.jiffoo.com' ||
      parsed.hostname === 'market.jiffoo.com' ||
      parsed.hostname === 'get.jiffoo.com'
    );
  } catch {
    return false;
  }
}

async function fetchText(url: string, { optional = false }: { optional?: boolean } = {}): Promise<string | null> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'text/plain, application/octet-stream;q=0.9, */*;q=0.8',
    },
  });

  if (response.ok) {
    return await response.text();
  }

  if (optional && response.status === 404) {
    return null;
  }

  throw new Error(`Artifact metadata fetch failed (${response.status}) for ${url}`);
}

export async function verifyOfficialArtifact(
  input: OfficialArtifactVerificationInput,
): Promise<OfficialArtifactVerificationResult> {
  const checksumUrl = input.checksumUrl || `${input.packageUrl}.sha256`;
  const signatureUrl = input.signatureUrl || `${input.packageUrl}.sig`;
  const artifactBuffer = await fs.readFile(input.filePath);
  const sha256 = createHash('sha256').update(artifactBuffer).digest('hex');
  const allowMissingSignature = isTrustedOfficialArtifactUrl(input.packageUrl);

  const checksumRaw = await fetchText(checksumUrl);
  const expectedSha256 = parseSha256Sidecar(checksumRaw || '');

  if (expectedSha256 !== sha256) {
    throw new Error(
      `Artifact checksum mismatch: expected ${expectedSha256}, got ${sha256}`,
    );
  }

  const mode = getSignatureVerifyMode();
  const signatureRaw = await fetchText(signatureUrl, {
    optional: mode !== 'required' || allowMissingSignature,
  });

  if (!signatureRaw) {
    if (mode === 'required') {
      if (allowMissingSignature) {
        return {
          sha256,
          checksumVerified: true,
          signatureVerified: false,
        };
      }
      throw new Error('Official artifact signature is required but missing');
    }

    return {
      sha256,
      checksumVerified: true,
      signatureVerified: false,
    };
  }

  const signatureResult = await verifyPackageSignature(artifactBuffer, signatureRaw.trim());
  if (mode === 'required' && !signatureResult.verified) {
    throw new Error(
      signatureResult.error || 'Official artifact signature verification failed',
    );
  }

  return {
    sha256,
    checksumVerified: true,
    signatureVerified: signatureResult.verified,
    signedBy: signatureResult.signedBy,
  };
}

export async function verifyEmbeddedOfficialArtifact(input: {
  filePath: string;
  checksumFilePath?: string | null;
  signatureFilePath?: string | null;
}): Promise<OfficialArtifactVerificationResult> {
  const artifactBuffer = await fs.readFile(input.filePath);
  const sha256 = createHash('sha256').update(artifactBuffer).digest('hex');

  let checksumVerified = false;
  if (input.checksumFilePath) {
    const checksumRaw = await fs.readFile(input.checksumFilePath, 'utf-8');
    const expectedSha256 = parseSha256Sidecar(checksumRaw);
    if (expectedSha256 !== sha256) {
      throw new Error(
        `Embedded artifact checksum mismatch: expected ${expectedSha256}, got ${sha256}`,
      );
    }
    checksumVerified = true;
  }

  const mode = getSignatureVerifyMode();
  if (!input.signatureFilePath) {
    if (mode === 'required') {
      return {
        sha256,
        checksumVerified,
        signatureVerified: false,
      };
    }

    return {
      sha256,
      checksumVerified,
      signatureVerified: false,
    };
  }

  const signatureRaw = await fs.readFile(input.signatureFilePath, 'utf-8');
  const signatureResult = await verifyPackageSignature(artifactBuffer, signatureRaw.trim());
  if (mode === 'required' && !signatureResult.verified) {
    throw new Error(
      signatureResult.error || 'Embedded artifact signature verification failed',
    );
  }

  return {
    sha256,
    checksumVerified,
    signatureVerified: signatureResult.verified,
    signedBy: signatureResult.signedBy,
  };
}
