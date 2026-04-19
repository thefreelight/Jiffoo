import { createWriteStream } from 'fs';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { Readable, Transform } from 'stream';
import { pipeline } from 'stream/promises';

interface DownloadWorkspaceMeta {
  url: string;
  etag?: string;
  totalBytes?: number;
  downloadedBytes?: number;
  updatedAt: string;
}

export interface DownloadArtifactOptions {
  slug: string;
  version: string;
  url: string;
}

export interface DownloadArtifactResult {
  filePath: string;
  workspaceDir: string;
  totalBytes: number | null;
  downloadedBytes: number;
  resumed: boolean;
  etag?: string;
  acceptRanges: boolean;
}

const DEFAULT_DOWNLOAD_ROOT = path.join(os.tmpdir(), 'jiffoo-market-downloads');

function getDownloadRoot(): string {
  return process.env.MARKET_DOWNLOAD_DIR || DEFAULT_DOWNLOAD_ROOT;
}

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-');
}

function getWorkspacePaths(slug: string, version: string) {
  const workspaceDir = path.join(getDownloadRoot(), sanitizeSegment(slug), sanitizeSegment(version));
  return {
    workspaceDir,
    artifactPath: path.join(workspaceDir, 'artifact.part'),
    metaPath: path.join(workspaceDir, 'download.json'),
  };
}

async function readMeta(metaPath: string): Promise<DownloadWorkspaceMeta | null> {
  try {
    const raw = await fs.readFile(metaPath, 'utf-8');
    return JSON.parse(raw) as DownloadWorkspaceMeta;
  } catch {
    return null;
  }
}

async function writeMeta(metaPath: string, meta: DownloadWorkspaceMeta): Promise<void> {
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
}

async function getExistingSize(filePath: string): Promise<number> {
  try {
    const stat = await fs.stat(filePath);
    return stat.size;
  } catch {
    return 0;
  }
}

async function fetchHead(url: string): Promise<{
  totalBytes: number | null;
  acceptRanges: boolean;
  etag?: string;
}> {
  const response = await fetch(url, { method: 'HEAD' });
  if (!response.ok) {
    throw new Error(`Artifact HEAD request failed: ${response.status}`);
  }

  const contentLength = response.headers.get('content-length');
  return {
    totalBytes: contentLength ? Number(contentLength) : null,
    acceptRanges: response.headers.get('accept-ranges')?.toLowerCase() === 'bytes',
    etag: response.headers.get('etag') || undefined,
  };
}

export async function downloadArtifactWithResume(
  options: DownloadArtifactOptions,
): Promise<DownloadArtifactResult> {
  const { workspaceDir, artifactPath, metaPath } = getWorkspacePaths(options.slug, options.version);
  await fs.mkdir(workspaceDir, { recursive: true });

  const head = await fetchHead(options.url);
  const previousMeta = await readMeta(metaPath);
  const existingSize = await getExistingSize(artifactPath);

  const sameArtifact = previousMeta?.url === options.url;
  const etagMatches = !head.etag || !previousMeta?.etag || previousMeta.etag === head.etag;

  if (
    sameArtifact &&
    etagMatches &&
    head.totalBytes !== null &&
    existingSize === head.totalBytes &&
    existingSize > 0
  ) {
    await writeMeta(metaPath, {
      url: options.url,
      etag: head.etag,
      totalBytes: head.totalBytes,
      downloadedBytes: existingSize,
      updatedAt: new Date().toISOString(),
    });

    return {
      filePath: artifactPath,
      workspaceDir,
      totalBytes: head.totalBytes,
      downloadedBytes: existingSize,
      resumed: false,
      etag: head.etag,
      acceptRanges: head.acceptRanges,
    };
  }

  const canResume = sameArtifact && head.acceptRanges && existingSize > 0 && etagMatches;

  if (!sameArtifact || !etagMatches) {
    await fs.rm(artifactPath, { force: true });
  }

  const requestHeaders: Record<string, string> = {};
  let resumed = false;
  let writeFlags: 'a' | 'w' = 'w';

  if (canResume) {
    requestHeaders.Range = `bytes=${existingSize}-`;
    if (head.etag) {
      requestHeaders['If-Range'] = head.etag;
    }
  }

  const response = await fetch(options.url, {
    headers: requestHeaders,
  });

  if (!response.ok && response.status !== 206) {
    throw new Error(`Artifact download failed: ${response.status}`);
  }

  if (canResume && response.status === 206) {
    resumed = true;
    writeFlags = 'a';
  } else if (!canResume || response.status === 200) {
    await fs.rm(artifactPath, { force: true });
    writeFlags = 'w';
  }

  if (!response.body) {
    throw new Error('Artifact download returned an empty body');
  }

  const counter = new Transform({
    transform(chunk, _encoding, callback) {
      callback(null, chunk);
    },
  });

  await pipeline(
    Readable.fromWeb(response.body as any),
    counter,
    createWriteStream(artifactPath, { flags: writeFlags }),
  );

  const downloadedBytes = await getExistingSize(artifactPath);
  const totalBytes = head.totalBytes;

  if (totalBytes !== null && downloadedBytes !== totalBytes) {
    throw new Error(
      `Artifact download incomplete: expected ${totalBytes} bytes, got ${downloadedBytes}`,
    );
  }

  await writeMeta(metaPath, {
    url: options.url,
    etag: head.etag,
    totalBytes: totalBytes ?? undefined,
    downloadedBytes,
    updatedAt: new Date().toISOString(),
  });

  return {
    filePath: artifactPath,
    workspaceDir,
    totalBytes,
    downloadedBytes,
    resumed,
    etag: head.etag,
    acceptRanges: head.acceptRanges,
  };
}

export async function cleanupDownloadedArtifact(slug: string, version: string): Promise<void> {
  const { workspaceDir } = getWorkspacePaths(slug, version);
  await fs.rm(workspaceDir, { recursive: true, force: true });
}
