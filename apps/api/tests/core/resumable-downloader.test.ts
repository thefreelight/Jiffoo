import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cleanupDownloadedArtifact,
  downloadArtifactWithResume,
} from '../../src/core/admin/market/resumable-downloader';

describe('resumable-downloader', () => {
  const slug = 'odoo';
  const version = '1.0.0';
  const url = 'https://market.example.com/artifacts/plugins/odoo/1.0.0.jplugin';
  const artifact = Buffer.from('official-market-artifact');
  let downloadRoot = '';
  let originalFetch: typeof global.fetch | undefined;

  beforeEach(async () => {
    downloadRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'market-download-test-'));
    process.env.MARKET_DOWNLOAD_DIR = downloadRoot;
    originalFetch = global.fetch;
  });

  afterEach(async () => {
    global.fetch = originalFetch as typeof fetch;
    delete process.env.MARKET_DOWNLOAD_DIR;
    await fs.rm(downloadRoot, { recursive: true, force: true });
  });

  it('resumes an interrupted download using HTTP Range when the upstream supports it', async () => {
    const workspaceDir = path.join(downloadRoot, slug, version);
    await fs.mkdir(workspaceDir, { recursive: true });
    await fs.writeFile(path.join(workspaceDir, 'artifact.part'), artifact.subarray(0, 8));
    await fs.writeFile(
      path.join(workspaceDir, 'download.json'),
      JSON.stringify(
        {
          url,
          etag: '"artifact-etag"',
          totalBytes: artifact.length,
          downloadedBytes: 8,
          updatedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
      'utf-8',
    );

    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const method = (init?.method || 'GET').toUpperCase();

      if (requestUrl !== url) {
        throw new Error(`Unexpected URL: ${requestUrl}`);
      }

      if (method === 'HEAD') {
        return new Response(null, {
          status: 200,
          headers: {
            'Content-Length': String(artifact.length),
            'Accept-Ranges': 'bytes',
            ETag: '"artifact-etag"',
          },
        });
      }

      expect((init?.headers as Record<string, string>)?.Range).toBe('bytes=8-');

      return new Response(artifact.subarray(8), {
        status: 206,
        headers: {
          'Content-Length': String(artifact.length - 8),
          'Content-Range': `bytes 8-${artifact.length - 1}/${artifact.length}`,
          'Accept-Ranges': 'bytes',
        },
      });
    }) as typeof fetch;

    const result = await downloadArtifactWithResume({ slug, version, url });
    const written = await fs.readFile(result.filePath);

    expect(result.resumed).toBe(true);
    expect(result.downloadedBytes).toBe(artifact.length);
    expect(written.equals(artifact)).toBe(true);

    await cleanupDownloadedArtifact(slug, version);
    await expect(fs.stat(workspaceDir)).rejects.toThrow();
  });
});
