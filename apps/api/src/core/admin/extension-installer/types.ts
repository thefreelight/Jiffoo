/**
 * Extension Installer Types
 * 
 * Core types for extension installer, supporting ZIP installation of themes and plugins
 * Based on .kiro/specs/single-tenant-core-architecture/design.md
 */

import { Readable } from 'stream';
import type { InstalledThemeApp } from './theme-app-installer';
import type {
  PluginManifest as SharedPluginManifest,
  PluginRuntimeType as SharedPluginRuntimeType,
} from '@jiffoo/shared';

// ============================================================================
// Base Enums and Types
// ============================================================================

/**
 * Extension type enum - all installable content types
 * - theme-shop: Theme Pack for shop frontend
 * - theme-admin: Theme Pack for admin frontend
 * - theme-app-shop: Theme App (executable) for shop frontend
 * - theme-app-admin: Theme App (executable) for admin frontend
 * - plugin: Plugin for backend functionality
 * - bundle: Bundle containing multiple extensions
 */
export type ExtensionKind =
  | 'theme-shop'
  | 'theme-admin'
  | 'theme-app-shop'
  | 'theme-app-admin'
  | 'plugin'
  | 'bundle';

/** Theme target platform */
export type ThemeTarget = 'shop' | 'admin';

/** Extension source */
export type ExtensionSource = 'local-zip' | 'official-market' | 'builtin';

/** Plugin runtime type */
export type PluginRuntimeType = SharedPluginRuntimeType;

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

export interface InstallFromZipOptions {
  skipSignatureVerification?: boolean;
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
  signatureVerified?: boolean;
  signedBy?: string;
  installedAt: Date;
  updatedAt: Date;
}

/** Installed plugin package information (corresponds to PluginInstall in DB) */
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
  zipHash?: string;            // SHA-256 hash of the installed ZIP file
  manifestJson?: Record<string, unknown> | string;       // Full manifest.json content
  signatureVerified?: boolean; // Whether the package signature was verified
  signedBy?: string;           // Key identifier that signed the package
  deletedAt?: Date | null;     // Soft uninstall marker
  installedAt: Date;
  updatedAt: Date;
}

/** Plugin installation instance (corresponds to PluginInstallation in DB) */
export interface PluginInstallationInstance {
  id: string;                  // installationId (UUID), globally unique
  pluginSlug: string;          // Reference to plugin slug
  instanceKey: string;         // Instance key (format: ^[a-z0-9-]{1,32}$, 'default' is reserved)
  enabled: boolean;            // Whether this instance is enabled
  configJson?: Record<string, unknown> | string;         // Instance-specific configuration
  config?: Record<string, unknown>; // Parsed config object
  grantedPermissions?: string[]; // Actually granted permissions
  deletedAt?: Date;            // Soft delete timestamp
  createdAt: Date;
  updatedAt: Date;
}

/** Plugin with all its instances (for list/detail views) */
export interface InstalledPluginWithInstances extends InstalledPlugin {
  instances: PluginInstallationInstance[];
}

/** Request to create a new plugin instance */
export interface CreatePluginInstanceRequest {
  instanceKey: string;         // Must match ^[a-z0-9-]{1,32}$
  enabled?: boolean;           // Default: true
  config?: Record<string, unknown>;
  grantedPermissions?: string[];
}

/** Request to update a plugin instance */
export interface UpdatePluginInstanceRequest {
  enabled?: boolean;
  config?: Record<string, unknown>;
  grantedPermissions?: string[];
}

/** Universal installed extension metadata (used for lists) */
export type InstalledExtensionMeta = InstalledTheme | InstalledThemeApp | InstalledPlugin;

// ============================================================================
// Manifest Types (Descriptor files within the ZIP package)
// ============================================================================

/** Theme Pack entry points (paths relative to theme root) */
export interface ThemePackEntry {
  /** CSS tokens file path, e.g., "tokens.css" */
  tokensCSS?: string;
  /** Templates directory path, e.g., "templates" */
  templatesDir?: string;
  /** Assets directory path, e.g., "assets" */
  assetsDir?: string;
  /** Settings schema file path, e.g., "schemas/settings.schema.json" */
  settingsSchema?: string;
  /** Presets directory path, e.g., "presets" */
  presetsDir?: string;
}

/** Theme Pack compatibility requirements */
export interface ThemeCompatibility {
  /** Minimum core version required */
  minCoreVersion?: string;
}

/** Theme manifest (theme.json) - Theme Pack v1 specification */
export interface ThemeManifest {
  /** Schema version, must be 1 for v1 */
  schemaVersion: number;
  /** Theme slug (lowercase letters, numbers, hyphens only) */
  slug: string;
  /** Display name */
  name: string;
  /** Semantic version */
  version: string;
  /** Target platform: 'shop' or 'admin' */
  target: 'shop' | 'admin';
  /** Theme description */
  description?: string;
  /** Theme category */
  category?: string;
  /** Author name */
  author?: string;
  /** Author URL */
  authorUrl?: string;
  /** Thumbnail/preview image path */
  thumbnail?: string;
  /** Screenshot paths */
  screenshots?: string[];
  /** Entry points configuration */
  entry?: ThemePackEntry;
  /** Compatibility requirements */
  compatibility?: ThemeCompatibility;
  /** Default configuration for the theme */
  defaultConfig?: Record<string, unknown>;
  /** Tags for categorization */
  tags?: string[];
  /** Vendor-specific extensions (x-* fields) */
  [key: `x-${string}`]: unknown;
}

/** Plugin manifest (manifest.json) */
export type PluginManifest = SharedPluginManifest;

// ============================================================================
// Service Interfaces
// ============================================================================

/** Unified Extension Installer Interface */
export interface IExtensionInstaller {
  /** Install extension from ZIP */
  installFromZip(kind: ExtensionKind, zipStream: Readable, options?: InstallFromZipOptions): Promise<InstallResult>;
  /** Uninstall extension */
  uninstall(kind: ExtensionKind, slug: string): Promise<UninstallResult>;
  /** List installed extensions */
  listInstalled(kind: ExtensionKind): Promise<InstalledExtensionMeta[]>;
  /** Get extension details */
  getInstalled(kind: ExtensionKind, slug: string): Promise<InstalledExtensionMeta | null>;
}

/** Theme Installer Interface */
export interface IThemeInstaller {
  install(target: ThemeTarget, zipStream: Readable, options?: InstallFromZipOptions): Promise<InstalledTheme>;
  uninstall(target: ThemeTarget, slug: string): Promise<void>;
  list(target: ThemeTarget): Promise<InstalledTheme[]>;
  get(target: ThemeTarget, slug: string): Promise<InstalledTheme | null>;
}

/** Plugin Installer Interface */
export interface IPluginInstaller {
  install(zipStream: Readable, options?: InstallFromZipOptions): Promise<InstalledPlugin>;
  uninstall(slug: string): Promise<void>;
  list(): Promise<InstalledPlugin[]>;
  get(slug: string): Promise<InstalledPlugin | null>;
}
