/**
 * Extension Installer Types
 * 
 * Core types for extension installer, supporting ZIP installation of plugins.
 * Based on docs/agentra-001-core-v1-product-charter.md
 */

import { Readable } from 'stream';
import type {
  PluginManifest as SharedPluginManifest,
  PluginRuntimeType as SharedPluginRuntimeType,
  PluginTrustLevel as SharedPluginTrustLevel,
} from '@jiffoo/shared';

// ============================================================================
// Base Enums and Types
// ============================================================================

/**
 * Extension type enum - all installable content types
 * - plugin: Plugin for backend functionality
 * - bundle: Bundle containing multiple extensions
 */
export type ExtensionKind =
  | 'plugin'
  | 'bundle';

/** Extension source */
export type ExtensionSource = 'local-zip' | 'builtin';

/** Plugin runtime type */
export type PluginRuntimeType = SharedPluginRuntimeType;

/** Plugin trust level assigned at installation. */
export type PluginTrustLevel = SharedPluginTrustLevel;

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

/** Installed plugin package information (corresponds to PluginInstall in DB) */
export interface InstalledPlugin {
  id: string;
  slug: string;
  name: string;
  version: string;
  description: string;
  category: string;
  runtimeType: PluginRuntimeType;
  /** Trust level assigned at install time (builtin | signed | unsigned). */
  trustLevel?: PluginTrustLevel;
  entryModule?: string;        // For internal-fastify, e.g. 'server/index.js'
  source: ExtensionSource;
  fsPath: string;
  permissions?: string[];
  author?: string;
  authorUrl?: string;
  zipHash?: string;            // SHA-256 hash of the installed ZIP file
  manifestJson?: SharedPluginManifest | string;          // Full manifest.json content
  manifestError?: {
    issues: Array<{ path: string; message: string; code: string }>;
  };
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
export type InstalledExtensionMeta = InstalledPlugin;

/** Plugin manifest (manifest.json) */
export type PluginManifest = SharedPluginManifest;

// ============================================================================
// Service Interfaces
// ============================================================================

/** Unified Extension Installer Interface */
export interface IExtensionInstaller {
  /** Install extension from ZIP */
  installFromZip(kind: ExtensionKind, zipStream: Readable, options?: { source?: string; confirmUnsigned?: boolean; actorUserId?: string }): Promise<InstallResult>;
  /** Uninstall extension */
  uninstall(kind: ExtensionKind, slug: string): Promise<UninstallResult>;
  /** List installed extensions */
  listInstalled(kind: ExtensionKind): Promise<InstalledExtensionMeta[]>;
  /** Get extension details */
  getInstalled(kind: ExtensionKind, slug: string): Promise<InstalledExtensionMeta | null>;
}

/** Plugin Installer Interface */
export interface IPluginInstaller {
  install(zipStream: Readable, options?: { source?: string; confirmUnsigned?: boolean; actorUserId?: string }): Promise<InstalledPlugin>;
  uninstall(slug: string): Promise<void>;
  list(): Promise<InstalledPlugin[]>;
  get(slug: string): Promise<InstalledPlugin | null>;
}
