import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { promises as fs } from 'fs';
import { createHash } from 'crypto';

const mocks = vi.hoisted(() => ({
  getSignatureVerifyMode: vi.fn(),
  verifyPackageSignature: vi.fn(),
}));

vi.mock('@/core/admin/extension-installer/signature-verifier', () => ({
  getSignatureVerifyMode: mocks.getSignatureVerifyMode,
  verifyPackageSignature: mocks.verifyPackageSignature,
}));

import { verifyOfficialArtifact } from '@/core/admin/market/artifact-verification';

describe('verifyOfficialArtifact', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    mocks.getSignatureVerifyMode.mockReturnValue('required');
    mocks.verifyPackageSignature.mockResolvedValue({
      verified: true,
      signedBy: 'test-key',
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects missing signatures for trusted official artifact hosts in required mode', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'artifact-verification-'));
    const artifactPath = path.join(tempDir, 'navtoai.jtheme');
    const artifactBuffer = Buffer.from('navtoai-official-artifact');
    const sha256 = createHash('sha256').update(artifactBuffer).digest('hex');
    await fs.writeFile(artifactPath, artifactBuffer);

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('.sha256')) {
        return new Response(`${sha256}  navtoai.jtheme`, { status: 200 });
      }
      if (url.endsWith('.sig')) {
        return new Response('missing', { status: 404 });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    await expect(
      verifyOfficialArtifact({
        filePath: artifactPath,
        packageUrl: 'https://get.jiffoo.com/official-artifacts/themes/navtoai/0.2.1.jtheme',
      }),
    ).rejects.toThrow('Artifact metadata fetch failed (404)');

    expect(mocks.verifyPackageSignature).not.toHaveBeenCalled();
  });

  it('still rejects missing signatures for untrusted artifact hosts in required mode', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'artifact-verification-untrusted-'));
    const artifactPath = path.join(tempDir, 'plugin.jplugin');
    const artifactBuffer = Buffer.from('untrusted-artifact');
    const sha256 = createHash('sha256').update(artifactBuffer).digest('hex');
    await fs.writeFile(artifactPath, artifactBuffer);

    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('.sha256')) {
        return new Response(`${sha256}  plugin.jplugin`, { status: 200 });
      }
      if (url.endsWith('.sig')) {
        return new Response('missing', { status: 404 });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    await expect(
      verifyOfficialArtifact({
        filePath: artifactPath,
        packageUrl: 'https://downloads.example.com/plugins/stripe/1.0.0.jplugin',
      }),
    ).rejects.toThrow('Artifact metadata fetch failed (404)');
  });
});
