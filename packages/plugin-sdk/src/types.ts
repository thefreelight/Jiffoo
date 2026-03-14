/**
 * Jiffoo Plugin SDK - Type Definitions
 *
 * Core type definitions for external plugin development.
 */

import type {
  PluginApiVersionRange,
  LifecycleHookName as SharedLifecycleHookName,
  PluginCategory,
  PluginLifecycleDeclaration,
  PluginManifest as SharedPluginManifest,
  PluginRuntimeType as SharedPluginRuntimeType,
  PluginThemeExtensions,
} from 'shared';

/**
 * Platform request headers sent with every request
 * Updated to match actual gateway implementation (EXTENSIONS_IMPLEMENTATION.md)
 */
export interface PlatformHeaders {
  'x-platform-id': string;
  'x-plugin-slug': string;
  'x-installation-id': string;
  'x-installation-key': string;
  'x-user-id'?: string;
  'x-user-role'?: string;
  'x-request-id'?: string;
  'x-locale'?: string;
  'x-caller'?: string;
  'x-platform-version'?: string;
  'x-platform-api-base-url'?: string;
  'x-platform-integration-token'?: string;
}

/**
 * Plugin context extracted from request headers
 */
export interface PluginContext {
  platformId: string;
  pluginSlug: string;
  installationId: string;
  installationKey: string;
  userId?: string;
  userRole?: string;
  requestId?: string;
  locale?: string;
  caller?: string;
  platformVersion?: string;
  platformApiBaseUrl?: string;
  platformIntegrationToken?: string;
  /** Platform signature for request verification */
  signature: string;
  /** Request timestamp for replay attack prevention */
  timestamp: string;
}

/**
 * Install request body from platform
 */
export interface InstallRequest {
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
  installationId: string;
  reason: string;
}

/**
 * Plugin runtime types
 */
export type PluginRuntimeType = SharedPluginRuntimeType;

/**
 * Plugin manifest structure (aligned with EXTENSIONS_BLUEPRINT.md v1)
 */
export type PluginManifest = SharedPluginManifest;

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

/**
 * Plugin configuration for definePlugin()
 */
export interface PluginConfig extends Omit<PluginManifest, 'description'> {
  description?: string;
  // Lifecycle hooks
  onInstall?: (context: PluginContext) => Promise<void>;
  onUninstall?: (context: PluginContext) => Promise<void>;
}

/**
 * Plugin route definition
 */
export interface PluginRoute {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  handler: (req: PluginRequest, res: PluginResponse, context: PluginContext) => Promise<void> | void;
  description?: string;
  requiresAuth?: boolean;
  rateLimit?: {
    max: number;
    windowMs: number;
  };
}

/**
 * Hook event types
 */
export type HookEvent =
  // Order events
  | 'order.created'
  | 'order.updated'
  | 'order.paid'
  | 'order.shipped'
  | 'order.delivered'
  | 'order.cancelled'
  | 'order.refunded'
  // Product events
  | 'product.created'
  | 'product.updated'
  | 'product.deleted'
  | 'product.stock_low'
  | 'product.out_of_stock'
  // Customer events
  | 'customer.created'
  | 'customer.updated'
  | 'customer.deleted'
  | 'customer.login'
  | 'customer.logout'
  // Cart events
  | 'cart.updated'
  | 'cart.abandoned'
  // Payment events
  | 'payment.pending'
  | 'payment.completed'
  | 'payment.failed'
  | 'payment.refunded'
  // Shipping events
  | 'shipping.label_created'
  | 'shipping.tracking_updated'
  // Store events
  | 'store.settings_updated';

/**
 * Plugin hook definition
 */
export interface PluginHook {
  event: HookEvent;
  handler: (data: any, context: PluginContext) => Promise<void> | void;
  description?: string;
  priority?: number;
  async?: boolean;
}

/**
 * Plugin instance
 */
export interface Plugin {
  manifest: PluginManifest;
  routes: PluginRoute[];
  hooks: PluginHook[];

  addRoute(route: PluginRoute): Plugin;
  addHook(hook: PluginHook): Plugin;
  getManifest(): PluginManifest;
  getRoutes(): PluginRoute[];
  getHooks(): PluginHook[];
  initialize(context: PluginContext): Promise<void>;
  cleanup(context: PluginContext): Promise<void>;
}

/**
 * Version requirement specification for compatibility checking
 */
export type VersionRequirement = PluginApiVersionRange;

/**
 * Version compatibility check result
 */
export interface VersionCompatibilityResult {
  /** Whether the plugin is compatible */
  compatible: boolean;
  /** Plugin version being checked */
  pluginVersion: string;
  /** Platform version being checked against */
  platformVersion: string;
  /** SDK version used for checking */
  sdkVersion: string;
  /** Warning messages (non-blocking issues) */
  warnings: string[];
  /** Error messages (blocking issues) */
  errors: string[];
  /** Human-readable message describing the result */
  message: string;
}

// ============================================================================
// Service Token Types (§4.6)
// ============================================================================

/** Plugin service token payload (decoded from JWT) */
export interface PluginServiceTokenPayload {
  sub: string; // installationId
  pluginSlug: string;
  grantedPermissions: string[];
  iss: string; // 'jiffoo-platform'
  type: 'plugin-service';
  exp: number;
  iat: number;
}

// ============================================================================
// Webhook Types (§4.7)
// ============================================================================

/** Webhook event envelope */
export interface WebhookEventEnvelope {
  id: string;
  type: string; // e.g., 'order.created'
  timestamp: string;
  payload: unknown;
}

// ============================================================================
// Lifecycle Hook Types (§4.5)
// ============================================================================

/** Lifecycle hook names */
export type LifecycleHookName = SharedLifecycleHookName;

/** Lifecycle hook context from the platform */
export interface LifecycleContext {
  installationId: string;
  pluginSlug: string;
  instanceKey: string;
  config: Record<string, unknown>;
  previousVersion?: string;
}

// ============================================================================
// Manifest Extensions (§4.5-4.9)
// ============================================================================

/** Extended manifest with lifecycle, webhooks, and theme extensions */
export type ExtendedPluginManifest = PluginManifest;

export type {
  PluginApiVersionRange,
  PluginCategory,
  PluginLifecycleDeclaration,
  PluginThemeExtensions,
};
