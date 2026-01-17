/**
 * Extension Installer Types
 * 
 * Core types for extension installer, supporting ZIP installation of themes and plugins
 * Based on .kiro/specs/single-tenant-core-architecture/design.md
 */

import { Readable } from 'stream';

// ============================================================================
// Base Enums and Types
// ============================================================================

/** Extension type enum - all installable content is abstracted into 3 types */
export type ExtensionKind = 'theme-shop' | 'theme-admin' | 'plugin';

/** Theme target platform */
export type ThemeTarget = 'shop' | 'admin';

/** Extension source */
export type ExtensionSource = 'local-zip' | 'official-market';

/** Plugin runtime type */
export type PluginRuntimeType = 'internal-fastify' | 'external-http';

// ============================================================================
// Installation Results
// ============================================================================

/** Installation result */
export interface InstallResult {
  kind: ExtensionKind;
  slug: string;
  version: string;
  source: ExtensionSource;
  fsPath: string;
}

/** Uninstallation result */
export interface UninstallResult {
  kind: ExtensionKind;
  slug: string;
  success: boolean;
}

// ============================================================================
// Installed Extension Metadata
// ============================================================================

/** Installed theme information */
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

/** Installed plugin information */
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

/** Universal installed extension metadata (used for lists) */
export type InstalledExtensionMeta = InstalledTheme | InstalledPlugin;

// ============================================================================
// Manifest Types (Descriptor files within the ZIP package)
// ============================================================================

/** Theme manifest (theme.json) */
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

/** Plugin manifest (manifest.json) */
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
// Service Interfaces
// ============================================================================

/** Unified Extension Installer Interface */
export interface IExtensionInstaller {
  /** Install extension from ZIP */
  installFromZip(kind: ExtensionKind, zipStream: Readable): Promise<InstallResult>;
  /** Uninstall extension */
  uninstall(kind: ExtensionKind, slug: string): Promise<UninstallResult>;
  /** List installed extensions */
  listInstalled(kind: ExtensionKind): Promise<InstalledExtensionMeta[]>;
  /** Get extension details */
  getInstalled(kind: ExtensionKind, slug: string): Promise<InstalledExtensionMeta | null>;
}

/** Theme Installer Interface */
export interface IThemeInstaller {
  install(target: ThemeTarget, zipStream: Readable): Promise<InstalledTheme>;
  uninstall(target: ThemeTarget, slug: string): Promise<void>;
  list(target: ThemeTarget): Promise<InstalledTheme[]>;
  get(target: ThemeTarget, slug: string): Promise<InstalledTheme | null>;
}

/** Plugin Installer Interface */
export interface IPluginInstaller {
  install(zipStream: Readable): Promise<InstalledPlugin>;
  uninstall(slug: string): Promise<void>;
  list(): Promise<InstalledPlugin[]>;
  get(slug: string): Promise<InstalledPlugin | null>;
}
