/**
 * Marketplace submissions — artifact store
 *
 * Stores uploaded submission artifacts on the server-local filesystem
 * (MARKETPLACE_STORAGE_DIR, default <cwd>/data/marketplace-submissions).
 * Files are only readable through the admin-authenticated download endpoint.
 */

import { createReadStream, createWriteStream } from 'fs';
import { mkdir, readdir, stat, unlink } from 'fs/promises';
import path from 'path';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { logger } from '@/core/logger/logger';

const DEFAULT_STORAGE_DIR = path.join(process.cwd(), 'data', 'marketplace-submissions');

export function storageDir(): string {
  return process.env.MARKETPLACE_STORAGE_DIR || DEFAULT_STORAGE_DIR;
}

export interface StoredArtifact {
  storagePath: string;
  filename: string;
  size: number;
}

const MAX_ARTIFACT_BYTES = 200 * 1024 * 1024; // 200MB
const SAFE_NAME_RE = /^[A-Za-z0-9._-]+$/;

function storedFilename(submissionId: string, filename: string): string {
  return `${submissionId}-${filename}`;
}

class SizeCountingStream extends Transform {
  size = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _transform(chunk: any, _encoding: string, callback: (error?: Error | null, data?: any) => void): void {
    this.size += chunk.length;
    callback(null, chunk);
  }
}

async function findStoredFile(submissionId: string): Promise<string | null> {
  const dir = storageDir();
  const entries = await readdir(dir).catch(() => [] as string[]);
  return entries.find((entry) => entry.startsWith(`${submissionId}-`)) ?? null;
}

export async function saveUploadedArtifact(
  submissionId: string,
  filename: string,
  source: NodeJS.ReadableStream,
): Promise<StoredArtifact> {
  const safeName = path.basename(filename || 'artifact.zip');
  if (!SAFE_NAME_RE.test(safeName)) {
    throw new Error('Artifact filename may only contain letters, digits, dot, dash, underscore');
  }

  const dir = storageDir();
  await mkdir(dir, { recursive: true });

  const storagePath = path.join(dir, storedFilename(submissionId, safeName));
  const counter = new SizeCountingStream();
  await pipeline(source, counter, createWriteStream(storagePath));

  if (counter.size > MAX_ARTIFACT_BYTES) {
    await unlink(storagePath).catch(() => undefined);
    throw new Error(`Artifact exceeds the ${Math.floor(MAX_ARTIFACT_BYTES / (1024 * 1024))}MB limit`);
  }

  logger.info('Submission artifact stored', { submissionId, storagePath, size: counter.size });
  return { storagePath, filename: safeName, size: counter.size };
}

export async function getStoredArtifactStream(
  submissionId: string,
): Promise<{
  stream: NodeJS.ReadableStream;
  filename: string;
  size: number;
  storagePath: string;
} | null> {
  const match = await findStoredFile(submissionId);
  if (!match) return null;
  const storagePath = path.join(storageDir(), match);
  const info = await stat(storagePath);
  return {
    stream: createReadStream(storagePath),
    filename: match.slice(submissionId.length + 1),
    size: info.size,
    storagePath,
  };
}

export async function deleteStoredArtifacts(submissionId: string): Promise<void> {
  const dir = storageDir();
  const entries = await readdir(dir).catch(() => [] as string[]);
  for (const entry of entries.filter((entry) => entry.startsWith(`${submissionId}-`))) {
    await unlink(path.join(dir, entry)).catch(() => undefined);
  }
}
