/**
 * Extension Installer Utilities
 *
 * Utility functions for ZIP extraction, manifest validation, directory operations, etc.
 */

import { createReadStream, createWriteStream, promises as fs } from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { Readable, PassThrough, Transform } from 'stream';
import { createGunzip } from 'zlib';
import { createHash } from 'crypto';
import { Parse } from 'unzip-stream';
import {
  ExtensionKind,
  PluginManifest,
} from './types';
import { ExtensionInstallerError } from './errors';
import { validateVersionFormat, validateVersionRange } from './version-utils';
import { getPluginManifestIssues } from '@jiffoo/shared';
import { pluginPackageStore } from '@/core/storage/plugin-package-store';

// ============================================================================
// ZIP Extraction
// ============================================================================

/**
 * Extract ZIP to temporary directory with security validation
 * @returns Temporary directory path
 */
export async function extractZipToTemp(zipStream: Readable, kind?: ExtensionKind): Promise<string> {
  const tempDir = await pluginPackageStore.createTemporaryDirectory(`extract-${kind || 'extension'}`);

  const { validateZipEntry, MAX_FONT_FILES, MAX_FONT_FILE_SIZE, MAX_TOTAL_FONT_SIZE } = await import('./security');
  const enforceFontLimits = false;

  return new Promise((resolve, reject) => {
    let entryCount = 0;
    let finishedCount = 0;
    let isClosed = false;
    let fontFileCount = 0;
    let totalFontSize = 0;

    const checkDone = () => {
      if (isClosed && entryCount === finishedCount) {
        resolve(tempDir);
      }
    };

    zipStream
      .pipe(Parse())
      .on('entry', (entry) => {
        entryCount++;
        const entryPath = entry.path;
        const entrySize = entry.size;

        try {
          // Check if this is a font file (only woff/woff2 as per whitelist)
          const ext = path.extname(entryPath).toLowerCase();
          const isFontFile = ['.woff', '.woff2'].includes(ext);
          
          if (isFontFile && enforceFontLimits) {
            fontFileCount++;
            totalFontSize += entrySize;
            
            // Check font file count limit
            if (fontFileCount > MAX_FONT_FILES) {
              entry.autodrain();
              reject(new (require('./errors').ExtensionInstallerError)(
                `Too many font files: ${fontFileCount} (max: ${MAX_FONT_FILES})`,
                { code: 'TOO_MANY_FONTS', statusCode: 413 }
              ));
              return;
            }
            
            // Check individual font file size
            if (entrySize > MAX_FONT_FILE_SIZE) {
              entry.autodrain();
              const formatBytes = (bytes: number): string => {
                if (bytes === 0) return '0 Bytes';
                const k = 1024;
                const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
              };
              reject(new (require('./errors').ExtensionInstallerError)(
                `Font file "${entryPath}" size (${formatBytes(entrySize)}) exceeds maximum allowed size of ${formatBytes(MAX_FONT_FILE_SIZE)}`,
                { code: 'FONT_FILE_TOO_LARGE', statusCode: 413 }
              ));
              return;
            }
            
            // Check total font size
            if (totalFontSize > MAX_TOTAL_FONT_SIZE) {
              entry.autodrain();
              const formatBytes = (bytes: number): string => {
                if (bytes === 0) return '0 Bytes';
                const k = 1024;
                const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
              };
              reject(new (require('./errors').ExtensionInstallerError)(
                `Total font size (${formatBytes(totalFontSize)}) exceeds maximum allowed size of ${formatBytes(MAX_TOTAL_FONT_SIZE)}`,
                { code: 'TOTAL_FONT_SIZE_TOO_LARGE', statusCode: 413 }
              ));
              return;
            }
          }

          // 1. Security validation BEFORE writing any data (Zip Slip & File Type Protection)
          validateZipEntry(entryPath, entrySize, tempDir, kind);

          const fullPath = path.join(tempDir, entryPath);

          if (entry.type === 'Directory') {
            fs.mkdir(fullPath, { recursive: true })
              .then(() => {
                entry.autodrain();
                finishedCount++;
                checkDone();
              })
              .catch((err) => {
                entry.autodrain();
                reject(err);
              });
          } else {
            // Ensure parent directory exists
            fs.mkdir(path.dirname(fullPath), { recursive: true })
              .then(() => {
                const writeStream = createWriteStream(fullPath);

                entry.pipe(writeStream)
                  .on('finish', () => {
                    finishedCount++;
                    checkDone();
                  })
                  .on('error', (err) => {
                    reject(err);
                  });
              })
              .catch((err) => {
                entry.autodrain();
                reject(err);
              });
          }
        } catch (error) {
          // Validation failed
          entry.autodrain();
          reject(error);
        }
      })
      .on('close', () => {
        isClosed = true;
        checkDone();
      })
      .on('error', (error) => {
        cleanupTemp(tempDir).finally(() => reject(error));
      });
  });
}

/**
 * Clean up temporary directory
 */
export async function cleanupTemp(tempDir: string): Promise<void> {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

// ============================================================================
// Manifest Reading and Validation
// ============================================================================

/**
 * Read JSON file
 */
export async function readJsonFile<T>(filePath: string): Promise<T> {
  let content: string;
  try {
    content = await fs.readFile(filePath, 'utf-8');
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      throw new ExtensionInstallerError(`Missing required file: ${path.basename(filePath)}`, {
        code: 'MISSING_MANIFEST',
        statusCode: 400,
        cause: error,
      });
    }
    throw error;
  }

  try {
    return JSON.parse(content) as T;
  } catch (error: any) {
    throw new ExtensionInstallerError(`Invalid JSON in ${path.basename(filePath)}`, {
      code: 'INVALID_JSON',
      statusCode: 400,
      cause: error,
    });
  }
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve extracted package root directory and manifest path.
 *
 * Supports both:
 * - ZIP where manifest is at archive root
 * - ZIP where everything is wrapped in a single top-level folder
 */
export async function resolveExtractedPackageRoot(
  tempDir: string,
  kind: ExtensionKind
): Promise<{ rootDir: string; manifestPath: string }> {
  const manifestName = getManifestFileName(kind);

  const rootManifest = path.join(tempDir, manifestName);
  if (await pathExists(rootManifest)) {
    return { rootDir: tempDir, manifestPath: rootManifest };
  }

  const entries = await fs.readdir(tempDir, { withFileTypes: true });
  const candidateDirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => !name.startsWith('.') && name !== '__MACOSX');

  const matches: Array<{ rootDir: string; manifestPath: string }> = [];
  for (const dirName of candidateDirs) {
    const dirPath = path.join(tempDir, dirName);
    const manifestPath = path.join(dirPath, manifestName);
    if (await pathExists(manifestPath)) {
      matches.push({ rootDir: dirPath, manifestPath });
    }
  }

  if (matches.length === 1) {
    return matches[0];
  }

  if (matches.length > 1) {
    throw new ExtensionInstallerError(
      `Ambiguous package structure: found multiple "${manifestName}" files at the top level`,
      { code: 'BAD_REQUEST', statusCode: 400 }
    );
  }

  throw new ExtensionInstallerError(
    `Missing required file: ${manifestName}. The ZIP must contain "${manifestName}" at the root (or inside a single top-level folder).`,
    { code: 'BAD_REQUEST', statusCode: 400 }
  );
}

/**
 * Get manifest filename
 */
export function getManifestFileName(kind: ExtensionKind): string {
  return kind === 'bundle' ? 'bundle.json' : 'manifest.json';
}

/**
 * Strict slug validation per EXTENSIONS_IMPLEMENTATION.md
 * Format: ^[a-z][a-z0-9-]{0,30}[a-z0-9]$ (2-32 characters, must start and end with letter/digit)
 * CRITICAL: Must match plugin-runtime.ts SLUG_REGEX
 */
export function validateSlugFormat(slug: string): void {
  const SLUG_REGEX = /^[a-z][a-z0-9-]{0,30}[a-z0-9]$/;
  if (!SLUG_REGEX.test(slug)) {
    throw new ExtensionInstallerError(
      `Invalid slug format: "${slug}". Must match ^[a-z][a-z0-9-]{0,30}[a-z0-9]$ (2-32 characters, start with letter, end with letter or digit)`,
      { code: 'INVALID_SLUG_FORMAT', statusCode: 400 }
    );
  }
}

/**
 * Strict instance key validation per EXTENSIONS_IMPLEMENTATION.md
 * Format: ^[a-z0-9-]{1,32}$ (1-32 characters, lowercase letters/numbers/hyphens only)
 * CRITICAL: Must match plugin-runtime.ts INSTANCE_KEY_REGEX
 */
export function validateInstanceKeyFormat(key: string): void {
  const INSTANCE_KEY_REGEX = /^[a-z0-9-]{1,32}$/;
  if (!INSTANCE_KEY_REGEX.test(key)) {
    throw new ExtensionInstallerError(
      `Invalid instance key format: "${key}". Must match ^[a-z0-9-]{1,32}$ (1-32 characters, lowercase letters/numbers/hyphens only)`,
      { code: 'INVALID_INSTANCE_KEY_FORMAT', statusCode: 400 }
    );
  }
}

/**
 * Validate instance config size and depth per EXTENSIONS_BLUEPRINT.md 5.4
 * - Max size: 64KB (JSON stringified)
 * - Max nesting depth: 10 layers
 */
export function validateInstanceConfig(config: unknown): void {
  if (config === null || config === undefined) {
    return; // null/undefined is allowed (means no config)
  }

  if (typeof config !== 'object' || Array.isArray(config)) {
    throw new ExtensionInstallerError(
      'Invalid instance config: must be an object (not array or primitive)',
      { code: 'INVALID_CONFIG_FORMAT', statusCode: 400 }
    );
  }

  // Check JSON size (64KB limit)
  const jsonStr = JSON.stringify(config);
  const sizeBytes = Buffer.byteLength(jsonStr, 'utf-8');
  const MAX_CONFIG_SIZE = 64 * 1024; // 64KB

  if (sizeBytes > MAX_CONFIG_SIZE) {
    throw new ExtensionInstallerError(
      `Instance config size (${sizeBytes} bytes) exceeds maximum allowed size of ${MAX_CONFIG_SIZE} bytes (64KB)`,
      { code: 'CONFIG_TOO_LARGE', statusCode: 413 }
    );
  }

  // Check nesting depth (max 10 layers)
  const MAX_DEPTH = 10;
  function getDepth(obj: any, currentDepth = 1): number {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
      return currentDepth;
    }
    const depths = Object.values(obj).map(val => getDepth(val, currentDepth + 1));
    return depths.length > 0 ? Math.max(...depths) : currentDepth;
  }

  const depth = getDepth(config);
  if (depth > MAX_DEPTH) {
    throw new ExtensionInstallerError(
      `Instance config nesting depth (${depth}) exceeds maximum allowed depth of ${MAX_DEPTH} layers`,
      { code: 'CONFIG_TOO_DEEP', statusCode: 400 }
    );
  }
}

/**
 * Strict semver validation (MAJOR.MINOR.PATCH format only)
 */
export function validateSemverFormat(version: string): void {
  const SEMVER_REGEX = /^\d+\.\d+\.\d+$/;
  if (!SEMVER_REGEX.test(version)) {
    throw new ExtensionInstallerError(
      `Invalid version format: "${version}". Must be strict semver (MAJOR.MINOR.PATCH, e.g., "1.0.0")`,
      { code: 'INVALID_VERSION_FORMAT', statusCode: 400 }
    );
  }
}

/**
 * Validate permissions array format
 */
export function validatePermissionsFormat(permissions: unknown): void {
  if (!Array.isArray(permissions)) {
    throw new ExtensionInstallerError(
      'Invalid permissions: must be an array of strings',
      { code: 'INVALID_PERMISSIONS', statusCode: 400 }
    );
  }
  for (const perm of permissions) {
    if (typeof perm !== 'string') {
      throw new ExtensionInstallerError(
        'Invalid permissions: all items must be strings',
        { code: 'INVALID_PERMISSIONS', statusCode: 400 }
      );
    }
  }
}

/**
 * Validate plugin manifest (strict per EXTENSIONS_BLUEPRINT.md)
 */
export function validatePluginManifest(manifest: PluginManifest): void {
  const issues = getPluginManifestIssues(manifest);
  if (issues.length > 0) {
    const issue = issues[0];
    throw new ExtensionInstallerError(
      `Invalid plugin manifest: ${issue.path} ${issue.message}`,
      { code: issue.code, statusCode: 400 }
    );
  }
}

// ============================================================================
// Directory Operations
// ============================================================================

/**
 * Ensure directory exists
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

function isRetryableWindowsFsError(error: any): boolean {
  const code = error?.code;
  return code === 'EPERM' || code === 'EBUSY' || code === 'EACCES';
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function renameWithRetry(src: string, dest: string): Promise<void> {
  const maxAttempts = 8;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await fs.rename(src, dest);
      return;
    } catch (error: any) {
      if (attempt === maxAttempts || !isRetryableWindowsFsError(error)) {
        throw error;
      }
      // Backoff: 50ms, 100ms, 200ms, ... (cap ~2s)
      const delayMs = Math.min(2000, 50 * Math.pow(2, attempt - 1));
      await sleep(delayMs);
    }
  }
}

async function moveDirBestEffort(src: string, dest: string): Promise<void> {
  // Ensure target parent directory exists
  await ensureDir(path.dirname(dest));

  // 1) Try atomic rename with retry (Windows can transiently lock files)
  try {
    await renameWithRetry(src, dest);
    return;
  } catch (error: any) {
    // 2) Fallback to copy+delete (handles cases where rename is blocked)
    if (error?.code !== 'EXDEV' && !isRetryableWindowsFsError(error)) {
      throw error;
    }
  }

  await ensureDir(dest);
  // fs.cp is available in modern Node; use force to overwrite if partially created.
  await fs.cp(src, dest, { recursive: true, force: true });
  await fs.rm(src, { recursive: true, force: true });
}

/**
 * Move directory (atomic replacement with backup)
 */
export async function moveDir(src: string, dest: string): Promise<void> {
  const destExists = await dirExists(dest);
  
  if (destExists) {
    // Two-phase replacement: dest -> dest.__bak -> rename -> delete bak
    const backupPath = `${dest}.__bak`;
    
    try {
      // 1. Backup old directory
      await moveDirBestEffort(dest, backupPath);
      
      // 2. Move new directory
      await moveDirBestEffort(src, dest);
      
      // 3. Delete backup (failure doesn't affect operation)
      try {
        await fs.rm(backupPath, { recursive: true, force: true });
      } catch (cleanupError) {
        console.warn(`Failed to cleanup backup at ${backupPath}:`, cleanupError);
      }
    } catch (error) {
      // Rollback: if backup exists and new dest doesn't exist, restore backup
      const backupExists = await dirExists(backupPath);
      const newDestExists = await dirExists(dest);
      
      if (backupExists && !newDestExists) {
        try {
          await moveDirBestEffort(backupPath, dest);
        } catch (rollbackError) {
          console.error('Failed to rollback after moveDir error:', rollbackError);
        }
      }
      
      throw error;
    }
  } else {
    // Target doesn't exist, direct move
    await moveDirBestEffort(src, dest);
  }
}

/**
 * Check if directory exists
 */
export async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Delete directory
 */
export async function removeDir(dirPath: string): Promise<void> {
  await fs.rm(dirPath, { recursive: true, force: true });
}

// ============================================================================
// Hash Utilities
// ============================================================================

/**
 * Calculate SHA-256 hash of a file
 */
export async function calculateFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const input = createReadStream(filePath);

    input.on('data', (chunk) => {
      hash.update(chunk);
    });

    input.on('end', () => {
      resolve(hash.digest('hex'));
    });

    input.on('error', reject);
  });
}

/**
 * Calculate SHA-256 hash from a readable stream
 * Returns both the hash and a new readable stream (for further processing)
 */
export async function calculateStreamHash(
  stream: Readable
): Promise<{ hash: string; buffer: Buffer }> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const chunks: Buffer[] = [];

    stream.on('data', (chunk: Buffer) => {
      hash.update(chunk);
      chunks.push(chunk);
    });

    stream.on('end', () => {
      const buffer = Buffer.concat(chunks);
      resolve({
        hash: hash.digest('hex'),
        buffer,
      });
    });

    stream.on('error', reject);
  });
}

/**
 * Stream a ZIP payload to disk while calculating its SHA-256 hash.
 * This avoids buffering large packages fully in memory during install.
 */
export async function spoolStreamToTempFileAndHash(
  stream: Readable,
  prefix: string,
): Promise<{ hash: string; filePath: string; cleanup: () => Promise<void> }> {
  const { directory: tempDir, filePath } = await pluginPackageStore.createTemporaryFile(prefix, 'package.zip');
  const hash = createHash('sha256');
  const output = createWriteStream(filePath);

  await pipeline(
    stream,
    new Transform({
      transform(chunk, _encoding, callback) {
        hash.update(chunk as Buffer);
        callback(null, chunk);
      },
    }),
    output,
  );

  return {
    hash: hash.digest('hex'),
    filePath,
    cleanup: async () => {
      await fs.rm(tempDir, { recursive: true, force: true });
    },
  };
}

/**
 * Create a readable stream from a buffer
 */
export function bufferToStream(buffer: Buffer): Readable {
  const stream = new PassThrough();
  stream.end(buffer);
  return stream;
}
