/**
 * Jiffoo Plugin SDK
 *
 * SDK for building external plugins for the Jiffoo Mall platform.
 *
 * Features:
 * - HMAC signature verification
 * - Context extraction from platform headers
 * - Express/Fastify middleware helpers
 * - Plugin definition helpers
 * - TypeScript type definitions
 * - CLI tools for development
 *
 * @example
 * ```typescript
 * import {
 *   definePlugin,
 *   verifySignature,
 *   getContext,
 *   createSignatureMiddleware
 * } from '@jiffoo/plugin-sdk';
 *
 * // Define your plugin
 * const plugin = definePlugin({
 *   slug: 'my-plugin',
 *   name: 'My Plugin',
 *   version: '1.0.0',
 *   category: 'integration',
 *   capabilities: ['webhook.receive'],
 * });
 *
 * // Verify signature manually
 * const isValid = verifySignature(sharedSecret, method, path, body, timestamp, signature);
 *
 * // Extract context from headers
 * const context = getContext(req.headers);
 *
 * // Use as Express middleware
 * app.use('/api', createSignatureMiddleware(sharedSecret));
 * ```
 */

// Plugin definition
export { definePlugin, createRoute, createHook } from './plugin';

// Signature utilities
export {
  generateSignature,
  verifySignature,
  createSignatureMiddleware
} from './signature';

// Context utilities
export {
  getContext,
  createContextMiddleware,
  isFromJiffooPlatform,
  isProduction
} from './context';

// Validators
export {
  validateManifest,
  validateSettingsSchema,
  validateSettings,
  VALID_CATEGORIES,
  VALID_CAPABILITIES
} from './validators';

// Database & Storage (sandboxed)
export { createPluginDatabase, createPluginStorage } from './sandbox';

// Utilities
export { createLogger, formatError, retry } from './utils';

// Type definitions
export type {
  PlatformHeaders,
  PluginContext,
  InstallRequest,
  UninstallRequest,
  PluginManifest,
  HealthResponse,
  ApiResponse,
  VerifyOptions,
  PluginRequest,
  PluginResponse,
  NextFunction,
  PluginConfig,
  PluginRoute,
  PluginHook,
  HookEvent,
  Plugin
} from './types';

export type {
  ValidationResult,
  ValidationError,
  SettingsFieldType,
  SettingsField,
  SettingsSchema
} from './validators';

// SDK Version
export const SDK_VERSION = '1.0.0';
export const PLATFORM_COMPATIBILITY = '>=0.2.0';

