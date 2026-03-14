import type { ThemeAppManifest } from './contract';

/**
 * Theme App Runtime Types
 *
 * Types for Theme App (L4) runtime management.
 * Theme Apps are executable Next.js storefronts that can be installed via ZIP.
 */

export type { ThemeAppManifest } from './contract';

/**
 * Theme App runtime status
 */
export type ThemeAppStatus =
  | 'stopped'      // Process not running
  | 'starting'     // Process starting, health check pending
  | 'healthy'      // Process running, health check passed
  | 'unhealthy'    // Process running but health check failed
  | 'crashed'      // Process exited unexpectedly
  | 'stopping';    // Process shutting down

/**
 * Theme App runtime instance
 */
export interface ThemeAppInstance {
  /** Theme slug */
  slug: string;
  /** Target (shop or admin) */
  target: 'shop' | 'admin';
  /** Current status */
  status: ThemeAppStatus;
  /** Process ID (if running) */
  pid?: number;
  /** Port the app is listening on */
  port?: number;
  /** Base URL for the app (e.g., http://localhost:3100) */
  baseUrl?: string;
  /** Last health check result */
  lastHealthCheck?: {
    success: boolean;
    timestamp: string;
    latencyMs: number;
    error?: string;
  };
  /** When the process was started */
  startedAt?: string;
  /** When the process was stopped */
  stoppedAt?: string;
  /** Error message if crashed */
  error?: string;
  /** Manifest */
  manifest: ThemeAppManifest;
}

/**
 * Theme type in ActiveTheme record
 */
export type ThemeType = 'pack' | 'app';

/**
 * Extended ActiveTheme with type field
 */
export interface ActiveThemeWithType {
  slug: string;
  version: string;
  source: 'builtin' | 'installed' | 'local-zip' | 'official-market';
  type: ThemeType;
  config: Record<string, unknown>;
  activatedAt: string;
  previousSlug?: string;
  /** For Theme App: base URL of the running process */
  baseUrl?: string;
  /** For Theme App: port of the running process */
  port?: number;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  success: boolean;
  statusCode?: number;
  latencyMs: number;
  error?: string;
}

/**
 * Theme App start options
 */
export interface ThemeAppStartOptions {
  /** Force restart if already running */
  forceRestart?: boolean;
  /** Skip health check after start */
  skipHealthCheck?: boolean;
  /** Custom environment variables */
  env?: Record<string, string>;
}

/**
 * Theme App stop options
 */
export interface ThemeAppStopOptions {
  /** Force kill (SIGKILL instead of SIGTERM) */
  force?: boolean;
  /** Timeout for graceful shutdown in ms */
  timeout?: number;
}
