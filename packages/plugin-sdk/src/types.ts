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
  installationId: string;
  signature: string;
  userId?: string;
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
 * Plugin manifest structure
 */
export interface PluginManifest {
  slug: string;
  name: string;
  version: string;
  description: string;
  author: string;
  category: 'payment' | 'email' | 'integration' | 'theme' | 'analytics' | 'marketing' | 'shipping' | 'seo' | 'social' | 'security' | 'other';
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

/**
 * Plugin configuration for definePlugin()
 */
export interface PluginConfig {
  slug: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  category: 'payment' | 'email' | 'integration' | 'theme' | 'analytics' | 'marketing' | 'shipping' | 'seo' | 'social' | 'security' | 'other';
  capabilities: string[];
  requiredScopes?: string[];
  webhooks?: {
    events: string[];
    url: string;
  };
  configSchema?: Record<string, any>;

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

