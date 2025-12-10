/**
 * Extension Installer Types
 * 
 * 定义扩展安装器的核心类型，支持主题和插件的 ZIP 安装
 * 基于 .kiro/specs/single-tenant-core-architecture/design.md
 */

import { Readable } from 'stream';

// ============================================================================
// 基础枚举和类型
// ============================================================================

/** 扩展类型枚举 - 所有可安装内容抽象成 3 类 */
export type ExtensionKind = 'theme-shop' | 'theme-admin' | 'plugin';

/** 主题目标平台 */
export type ThemeTarget = 'shop' | 'admin';

/** 扩展来源 */
export type ExtensionSource = 'local-zip' | 'official-market';

/** 插件运行时类型 */
export type PluginRuntimeType = 'internal-fastify' | 'external-http';

// ============================================================================
// 安装结果
// ============================================================================

/** 安装结果 */
export interface InstallResult {
  kind: ExtensionKind;
  slug: string;
  version: string;
  source: ExtensionSource;
  fsPath: string;
}

/** 卸载结果 */
export interface UninstallResult {
  kind: ExtensionKind;
  slug: string;
  success: boolean;
}

// ============================================================================
// 已安装扩展元数据
// ============================================================================

/** 已安装主题信息 */
export interface InstalledTheme {
  id: string;
  slug: string;
  name: string;
  version: string;
  description: string;
  category: string;
  target: ThemeTarget;
  source: ExtensionSource;
  fsPath: string;  // extensions/themes/{target}/{slug}
  thumbnail?: string;
  author?: string;
  authorUrl?: string;
  installedAt: Date;
  updatedAt: Date;
}

/** 已安装插件信息 */
export interface InstalledPlugin {
  id: string;
  slug: string;
  name: string;
  version: string;
  description: string;
  category: string;
  runtimeType: PluginRuntimeType;
  entryModule?: string;        // For internal-fastify, e.g. 'server/index.js'
  externalBaseUrl?: string;    // For external-http
  source: ExtensionSource;
  fsPath: string;              // extensions/plugins/{slug}
  permissions?: string[];
  author?: string;
  authorUrl?: string;
  installedAt: Date;
  updatedAt: Date;
}

/** 通用已安装扩展元数据（用于列表） */
export type InstalledExtensionMeta = InstalledTheme | InstalledPlugin;

// ============================================================================
// Manifest 类型（ZIP 包内的描述文件）
// ============================================================================

/** 主题 manifest (theme.json) */
export interface ThemeManifest {
  slug: string;
  name: string;
  version: string;
  description: string;
  category?: string;
  author?: string;
  authorUrl?: string;
  thumbnail?: string;
  screenshots?: string[];
  minApiVersion?: string;
  tags?: string[];
}

/** 插件 manifest (manifest.json) */
export interface PluginManifest {
  slug: string;
  name: string;
  version: string;
  description: string;
  category?: string;
  runtimeType: PluginRuntimeType;
  entryModule?: string;        // For internal-fastify
  externalBaseUrl?: string;    // For external-http
  permissions?: string[];
  author?: string;
  authorUrl?: string;
  icon?: string;
  screenshots?: string[];
  minApiVersion?: string;
  dependencies?: Record<string, string>;
  tags?: string[];
}

// ============================================================================
// 服务接口
// ============================================================================

/** 统一扩展安装器接口 */
export interface IExtensionInstaller {
  /** 从 ZIP 安装扩展 */
  installFromZip(kind: ExtensionKind, zipStream: Readable): Promise<InstallResult>;
  /** 卸载扩展 */
  uninstall(kind: ExtensionKind, slug: string): Promise<UninstallResult>;
  /** 列出已安装的扩展 */
  listInstalled(kind: ExtensionKind): Promise<InstalledExtensionMeta[]>;
  /** 获取扩展详情 */
  getInstalled(kind: ExtensionKind, slug: string): Promise<InstalledExtensionMeta | null>;
}

/** 主题安装器接口 */
export interface IThemeInstaller {
  install(target: ThemeTarget, zipStream: Readable): Promise<InstalledTheme>;
  uninstall(target: ThemeTarget, slug: string): Promise<void>;
  list(target: ThemeTarget): Promise<InstalledTheme[]>;
  get(target: ThemeTarget, slug: string): Promise<InstalledTheme | null>;
}

/** 插件安装器接口 */
export interface IPluginInstaller {
  install(zipStream: Readable): Promise<InstalledPlugin>;
  uninstall(slug: string): Promise<void>;
  list(): Promise<InstalledPlugin[]>;
  get(slug: string): Promise<InstalledPlugin | null>;
}

