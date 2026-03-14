/**
 * Jiffoo Plugin SDK - Lifecycle Hook Handler
 *
 * Handles lifecycle hook HTTP requests from the platform (external-http mode).
 * The platform calls POST {externalBaseUrl}/__lifecycle/{hookName} to invoke
 * plugin lifecycle events.
 */

import type { LifecycleHookName, LifecycleContext } from './types';

export type LifecycleHookFn = (context: LifecycleContext) => void | Promise<void>;

export interface LifecycleHooks {
  onInstall?: LifecycleHookFn;
  onEnable?: LifecycleHookFn;
  onDisable?: LifecycleHookFn;
  onUninstall?: LifecycleHookFn;
  onUpgrade?: LifecycleHookFn;
}

export interface LifecycleHandler {
  /** Express/Fastify compatible HTTP handler for /__lifecycle/:hookName */
  httpHandler(): (req: any, res: any) => Promise<void>;
}

/**
 * Define lifecycle hooks for your plugin.
 *
 * The returned handler exposes an HTTP endpoint that the platform calls
 * at POST {externalBaseUrl}/__lifecycle/{hookName}.
 *
 * @param hooks - Object mapping lifecycle hook names to handler functions
 * @returns LifecycleHandler with an Express/Fastify compatible httpHandler()
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { defineLifecycleHooks } from 'jiffoo-plugin-sdk';
 *
 * const app = express();
 * const lifecycle = defineLifecycleHooks({
 *   onInstall: async (ctx) => {
 *     console.log(`Plugin installed for ${ctx.instanceKey}`);
 *     await initializeDatabase(ctx.config);
 *   },
 *   onEnable: async (ctx) => {
 *     console.log('Plugin enabled');
 *   },
 *   onDisable: async (ctx) => {
 *     console.log('Plugin disabled');
 *   },
 *   onUninstall: async (ctx) => {
 *     await cleanupResources(ctx.installationId);
 *   },
 *   onUpgrade: async (ctx) => {
 *     console.log(`Upgraded from ${ctx.previousVersion}`);
 *     await runMigrations(ctx.previousVersion);
 *   },
 * });
 *
 * app.post('/__lifecycle/:hookName', lifecycle.httpHandler());
 * ```
 */
export function defineLifecycleHooks(hooks: LifecycleHooks): LifecycleHandler {
  function httpHandler() {
    return async (req: any, res: any) => {
      // Extract hook name from URL path or route params
      let hookName: string | undefined;

      // Try Express-style route params first
      if (req.params?.hookName) {
        hookName = req.params.hookName;
      } else {
        // Fall back to URL parsing
        const url = req.url || req.path || '';
        const hookNameMatch = url.match(/__lifecycle\/(\w+)/);
        hookName = hookNameMatch?.[1];
      }

      if (!hookName || !isValidHookName(hookName)) {
        return sendResponse(res, 400, { error: 'Invalid hook name' });
      }

      const hookFn = hooks[hookName as LifecycleHookName];
      if (!hookFn) {
        // Hook not implemented - return 200 with noop indicator
        return sendResponse(res, 200, { handled: false });
      }

      try {
        const context: LifecycleContext = typeof req.body === 'object'
          ? req.body
          : JSON.parse(req.body);
        await hookFn(context);
        return sendResponse(res, 200, { handled: true });
      } catch (error: any) {
        return sendResponse(res, 500, { error: error.message });
      }
    };
  }

  return { httpHandler };
}

/**
 * Validate that a string is a recognized lifecycle hook name.
 */
function isValidHookName(name: string): name is LifecycleHookName {
  return ['onInstall', 'onEnable', 'onDisable', 'onUninstall', 'onUpgrade'].includes(name);
}

/**
 * Send an HTTP response compatible with both Express and Fastify.
 */
function sendResponse(res: any, statusCode: number, body: Record<string, unknown>): void {
  if (typeof res.status === 'function') {
    res.status(statusCode).send(body);
  } else if (typeof res.code === 'function') {
    res.code(statusCode).send(body);
  }
}
