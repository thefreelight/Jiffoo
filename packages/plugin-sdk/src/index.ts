/**
 * Jiffoo Plugin SDK
 *
 * SDK for building external plugins for the Jiffoo Mall platform.
 *
 * Features:
 * - HMAC signature verification
 * - Context extraction from platform headers
 * - Express middleware helpers
 * - TypeScript type definitions
 *
 * @example
 * ```typescript
 * import { verifySignature, getContext, createSignatureMiddleware } from '@jiffoo/plugin-sdk';
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
  getTenantId,
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
  NextFunction
} from './types';

export type {
  ValidationResult,
  ValidationError,
  SettingsFieldType,
  SettingsField,
  SettingsSchema
} from './validators';

