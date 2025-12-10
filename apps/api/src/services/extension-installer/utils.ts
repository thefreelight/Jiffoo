/**
 * Extension Installer Utilities
 * 
 * ZIP 解压、manifest 校验、目录操作等工具函数
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
// 路径常量
// ============================================================================

/** 扩展根目录（相对于项目根） */
export const EXTENSIONS_ROOT = process.env.EXTENSIONS_PATH || 'extensions';

/** 获取主题目录路径 */
export function getThemeDir(target: ThemeTarget, slug?: string): string {
  const base = path.join(EXTENSIONS_ROOT, 'themes', target);
  return slug ? path.join(base, slug) : base;
}

/** 获取插件目录路径 */
export function getPluginDir(slug?: string): string {
  const base = path.join(EXTENSIONS_ROOT, 'plugins');
  return slug ? path.join(base, slug) : base;
}

/** 根据 ExtensionKind 获取目标目录 */
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
// ZIP 解压
// ============================================================================

/**
 * 解压 ZIP 到临时目录
 * @returns 临时目录路径
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
 * 清理临时目录
 */
export async function cleanupTemp(tempDir: string): Promise<void> {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

// ============================================================================
// Manifest 读取和校验
// ============================================================================

/**
 * 读取 JSON 文件
 */
export async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

/**
 * 获取 manifest 文件名
 */
export function getManifestFileName(kind: ExtensionKind): string {
  return kind === 'plugin' ? 'manifest.json' : 'theme.json';
}

/**
 * 校验主题 manifest
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
  // Slug 格式校验（只允许小写字母、数字、连字符）
  if (!/^[a-z0-9-]+$/.test(manifest.slug)) {
    throw new Error('Invalid theme manifest: slug must contain only lowercase letters, numbers, and hyphens');
  }
}

/**
 * 校验插件 manifest
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
  // Slug 格式校验
  if (!/^[a-z0-9-]+$/.test(manifest.slug)) {
    throw new Error('Invalid plugin manifest: slug must contain only lowercase letters, numbers, and hyphens');
  }
  // internal-fastify 需要 entryModule
  if (manifest.runtimeType === 'internal-fastify' && !manifest.entryModule) {
    throw new Error('Invalid plugin manifest: internal-fastify plugins require "entryModule"');
  }
  // external-http 需要 externalBaseUrl
  if (manifest.runtimeType === 'external-http' && !manifest.externalBaseUrl) {
    throw new Error('Invalid plugin manifest: external-http plugins require "externalBaseUrl"');
  }
}

// ============================================================================
// 目录操作
// ============================================================================

/**
 * 确保目录存在
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * 移动目录
 */
export async function moveDir(src: string, dest: string): Promise<void> {
  // 确保目标父目录存在
  await ensureDir(path.dirname(dest));
  // 如果目标已存在，先删除
  try {
    await fs.rm(dest, { recursive: true, force: true });
  } catch {
    // Ignore if doesn't exist
  }
  // 移动
  await fs.rename(src, dest);
}

/**
 * 检查目录是否存在
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
 * 删除目录
 */
export async function removeDir(dirPath: string): Promise<void> {
  await fs.rm(dirPath, { recursive: true, force: true });
}

