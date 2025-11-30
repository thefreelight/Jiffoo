/**
 * Jiffoo Plugin SDK - Type Definitions
 *
 * Core type definitions for external plugin development.
 */

/**
 * Platform request headers sent with every request
 */
export interface PlatformHeaders {
  'x-platform-id': string;
  'x-platform-env': string;
  'x-platform-timestamp': string;
  'x-plugin-slug': string;
  'x-tenant-id': string;
  'x-installation-id': string;
  'x-platform-signature': string;
  'x-user-id'?: string;
}

/**
 * Plugin context extracted from request headers
 */
export interface PluginContext {
  platformId: string;
  environment: string;
  timestamp: string;
  pluginSlug: string;
  tenantId: string;
  installationId: string;
  signature: string;
  userId?: string;
}

/**
 * Install request body from platform
 */
export interface InstallRequest {
  tenantId: number;
  installationId: string;
  environment: string;
  planId: string;
  config?: {
    accountId?: string;
    scopes?: string;
    metadata?: Record<string, any>;
  };
  platform: {
    baseUrl: string;
    pluginSlug: string;
  };
}

/**
 * Uninstall request body from platform
 */
export interface UninstallRequest {
  tenantId: number;
  installationId: string;
  reason: string;
}

/**
 * Plugin manifest structure
 */
export interface PluginManifest {
  slug: string;
  name: string;
  version: string;
  description: string;
  author: string;
  category: 'payment' | 'email' | 'integration' | 'theme' | 'analytics' | 'marketing';
  capabilities: string[];
  requiredScopes?: string[];
  webhooks?: {
    events: string[];
    url: string;
  };
  configSchema?: Record<string, any>;
}

/**
 * Health check response
 */
export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  details?: Record<string, any>;
}

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Signature verification options
 */
export interface VerifyOptions {
  maxAgeSeconds?: number;
}

/**
 * Express-compatible request with plugin context
 */
export interface PluginRequest {
  headers: Record<string, string | string[] | undefined>;
  method: string;
  path: string;
  body?: any;
  pluginContext?: PluginContext;
}

/**
 * Express-compatible response
 */
export interface PluginResponse {
  status(code: number): PluginResponse;
  json(data: any): void;
  send(data: any): void;
}

/**
 * Express-compatible next function
 */
export type NextFunction = (error?: any) => void;

