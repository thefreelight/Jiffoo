/**
 * Extension Installer Utilities
 * 
 * Utility functions for ZIP extraction, manifest validation, directory operations, etc.
 */

import { createWriteStream, promises as fs } from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { createGunzip } from 'zlib';
import { Extract } from 'unzip-stream';
import {
  ExtensionKind,
  ThemeTarget,
  ThemeManifest,
  PluginManifest,
} from './types';

// ============================================================================
// Path Constants
// ============================================================================

/** Extension root directory (relative to project root) */
export const EXTENSIONS_ROOT = process.env.EXTENSIONS_PATH || 'extensions';

/** Get theme directory path */
export function getThemeDir(target: ThemeTarget, slug?: string): string {
  const base = path.join(EXTENSIONS_ROOT, 'themes', target);
  return slug ? path.join(base, slug) : base;
}

/** Get plugin directory path */
export function getPluginDir(slug?: string): string {
  const base = path.join(EXTENSIONS_ROOT, 'plugins');
  return slug ? path.join(base, slug) : base;
}

/** Get target directory based on ExtensionKind */
export function getTargetDir(kind: ExtensionKind, slug: string): string {
  switch (kind) {
    case 'theme-shop':
      return getThemeDir('shop', slug);
    case 'theme-admin':
      return getThemeDir('admin', slug);
    case 'plugin':
      return getPluginDir(slug);
  }
}

// ============================================================================
// ZIP Extraction
// ============================================================================

/**
 * Extract ZIP to temporary directory
 * @returns Temporary directory path
 */
export async function extractZipToTemp(zipStream: Readable): Promise<string> {
  const tempDir = path.join(EXTENSIONS_ROOT, '.tmp', `extract-${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });

  return new Promise((resolve, reject) => {
    zipStream
      .pipe(Extract({ path: tempDir }))
      .on('close', () => resolve(tempDir))
      .on('error', reject);
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
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

/**
 * Get manifest filename
 */
export function getManifestFileName(kind: ExtensionKind): string {
  return kind === 'plugin' ? 'manifest.json' : 'theme.json';
}

/**
 * Validate theme manifest
 */
export function validateThemeManifest(manifest: ThemeManifest): void {
  if (!manifest.slug || typeof manifest.slug !== 'string') {
    throw new Error('Invalid theme manifest: missing or invalid "slug"');
  }
  if (!manifest.name || typeof manifest.name !== 'string') {
    throw new Error('Invalid theme manifest: missing or invalid "name"');
  }
  if (!manifest.version || typeof manifest.version !== 'string') {
    throw new Error('Invalid theme manifest: missing or invalid "version"');
  }
  // Slug format validation (only lowercase letters, numbers, and hyphens allowed)
  if (!/^[a-z0-9-]+$/.test(manifest.slug)) {
    throw new Error('Invalid theme manifest: slug must contain only lowercase letters, numbers, and hyphens');
  }
}

/**
 * Validate plugin manifest
 */
export function validatePluginManifest(manifest: PluginManifest): void {
  if (!manifest.slug || typeof manifest.slug !== 'string') {
    throw new Error('Invalid plugin manifest: missing or invalid "slug"');
  }
  if (!manifest.name || typeof manifest.name !== 'string') {
    throw new Error('Invalid plugin manifest: missing or invalid "name"');
  }
  if (!manifest.version || typeof manifest.version !== 'string') {
    throw new Error('Invalid plugin manifest: missing or invalid "version"');
  }
  if (!manifest.runtimeType || !['internal-fastify', 'external-http'].includes(manifest.runtimeType)) {
    throw new Error('Invalid plugin manifest: runtimeType must be "internal-fastify" or "external-http"');
  }
  // Slug format validation
  if (!/^[a-z0-9-]+$/.test(manifest.slug)) {
    throw new Error('Invalid plugin manifest: slug must contain only lowercase letters, numbers, and hyphens');
  }
  // internal-fastify requires entryModule
  if (manifest.runtimeType === 'internal-fastify' && !manifest.entryModule) {
    throw new Error('Invalid plugin manifest: internal-fastify plugins require "entryModule"');
  }
  // external-http requires externalBaseUrl
  if (manifest.runtimeType === 'external-http' && !manifest.externalBaseUrl) {
    throw new Error('Invalid plugin manifest: external-http plugins require "externalBaseUrl"');
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

/**
 * Move directory
 */
export async function moveDir(src: string, dest: string): Promise<void> {
  // Ensure target parent directory exists
  await ensureDir(path.dirname(dest));
  // If target already exists, delete it first
  try {
    await fs.rm(dest, { recursive: true, force: true });
  } catch {
    // Ignore if doesn't exist
  }
  // Move
  await fs.rename(src, dest);
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
