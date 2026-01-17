/**
 * Jiffoo Plugin SDK - Plugin Definition
 *
 * Helpers for defining plugins, routes, and hooks.
 */

import type {
  PluginConfig,
  PluginRoute,
  PluginHook,
  HookEvent,
  Plugin,
  PluginManifest,
} from './types';
import { validateManifest } from './validators';

/**
 * Define a plugin with configuration
 *
 * @param config - Plugin configuration
 * @returns Plugin instance
 *
 * @example
 * ```typescript
 * const plugin = definePlugin({
 *   slug: 'my-payment-plugin',
 *   name: 'My Payment Plugin',
 *   version: '1.0.0',
 *   description: 'A payment gateway integration',
 *   author: 'Your Name',
 *   category: 'payment',
 *   capabilities: ['payment.process', 'payment.refund'],
 * });
 * ```
 */
export function definePlugin(config: PluginConfig): Plugin {
  // Validate configuration
  const manifest: PluginManifest = {
    slug: config.slug,
    name: config.name,
    version: config.version,
    description: config.description || '',
    author: config.author || '',
    category: config.category,
    capabilities: config.capabilities,
    requiredScopes: config.requiredScopes,
    webhooks: config.webhooks,
    configSchema: config.configSchema,
  };

  const validation = validateManifest(manifest);
  if (!validation.valid) {
    const errors = validation.errors.map((e: { path: string; message: string }) => `${e.path}: ${e.message}`).join(', ');
    throw new Error(`Invalid plugin configuration: ${errors}`);
  }

  const routes: PluginRoute[] = [];
  const hooks: PluginHook[] = [];

  const plugin: Plugin = {
    manifest,
    routes,
    hooks,

    // Add a route
    addRoute(route: PluginRoute) {
      routes.push(route);
      return this;
    },

    // Add a hook
    addHook(hook: PluginHook) {
      hooks.push(hook);
      return this;
    },

    // Get manifest
    getManifest() {
      return manifest;
    },

    // Get all routes
    getRoutes() {
      return [...routes];
    },

    // Get all hooks
    getHooks() {
      return [...hooks];
    },

    // Initialize plugin (called on install)
    async initialize(context) {
      if (config.onInstall) {
        await config.onInstall(context);
      }
    },

    // Cleanup plugin (called on uninstall)
    async cleanup(context) {
      if (config.onUninstall) {
        await config.onUninstall(context);
      }
    },
  };

  return plugin;
}

/**
 * Create a route definition
 *
 * @param path - Route path (e.g., '/api/process')
 * @param handler - Route handler function
 * @param options - Route options
 * @returns Route definition
 *
 * @example
 * ```typescript
 * const processRoute = createRoute('/api/process', async (req, res, context) => {
 *   const { amount, currency } = req.body;
 *   // Process payment...
 *   res.json({ success: true, transactionId: '...' });
 * }, {
 *   method: 'POST',
 *   description: 'Process a payment',
 *   requiresAuth: true,
 * });
 * ```
 */
export function createRoute(
  path: string,
  handler: PluginRoute['handler'],
  options: Partial<Omit<PluginRoute, 'path' | 'handler'>> = {}
): PluginRoute {
  return {
    path,
    method: options.method || 'GET',
    handler,
    description: options.description,
    requiresAuth: options.requiresAuth ?? true,
    rateLimit: options.rateLimit,
  };
}

/**
 * Create a hook definition
 *
 * @param event - Hook event to listen for
 * @param handler - Hook handler function
 * @param options - Hook options
 * @returns Hook definition
 *
 * @example
 * ```typescript
 * const orderCreatedHook = createHook('order.created', async (data, context) => {
 *   console.log(`New order: ${data.orderId}`);
 *   // Send notification, update inventory, etc.
 * }, {
 *   description: 'Handle new order creation',
 *   priority: 10,
 * });
 * ```
 */
export function createHook(
  event: HookEvent,
  handler: PluginHook['handler'],
  options: Partial<Omit<PluginHook, 'event' | 'handler'>> = {}
): PluginHook {
  return {
    event,
    handler,
    description: options.description,
    priority: options.priority ?? 0,
    async: options.async ?? true,
  };
}

/**
 * Available hook events
 */
export const HOOK_EVENTS: HookEvent[] = [
  // Order events
  'order.created',
  'order.updated',
  'order.paid',
  'order.shipped',
  'order.delivered',
  'order.cancelled',
  'order.refunded',

  // Product events
  'product.created',
  'product.updated',
  'product.deleted',
  'product.stock_low',
  'product.out_of_stock',

  // Customer events
  'customer.created',
  'customer.updated',
  'customer.deleted',
  'customer.login',
  'customer.logout',

  // Cart events
  'cart.updated',
  'cart.abandoned',

  // Payment events
  'payment.pending',
  'payment.completed',
  'payment.failed',
  'payment.refunded',

  // Shipping events
  'shipping.label_created',
  'shipping.tracking_updated',

  // Store events
  'store.settings_updated',
];
