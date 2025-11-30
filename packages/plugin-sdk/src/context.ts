/**
 * Jiffoo Plugin SDK - Context Utilities
 *
 * Extract and parse plugin context from request headers.
 */

import { PluginContext, PlatformHeaders, PluginRequest, PluginResponse, NextFunction } from './types';

/**
 * Extract plugin context from request headers
 *
 * @param headers - Request headers object
 * @returns PluginContext object or null if required headers are missing
 */
export function getContext(headers: Record<string, string | string[] | undefined>): PluginContext | null {
  const getHeader = (name: string): string | undefined => {
    const value = headers[name] || headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  };

  const platformId = getHeader('x-platform-id');
  const environment = getHeader('x-platform-env');
  const timestamp = getHeader('x-platform-timestamp');
  const pluginSlug = getHeader('x-plugin-slug');
  const tenantId = getHeader('x-tenant-id');
  const installationId = getHeader('x-installation-id');
  const signature = getHeader('x-platform-signature');
  const userId = getHeader('x-user-id');

  // Validate required headers
  if (!platformId || !environment || !timestamp || !pluginSlug || !tenantId || !installationId || !signature) {
    return null;
  }

  return {
    platformId,
    environment,
    timestamp,
    pluginSlug,
    tenantId,
    installationId,
    signature,
    userId
  };
}

/**
 * Create context extraction middleware for Express
 *
 * Extracts plugin context from headers and attaches to request object.
 * Returns 401 if required headers are missing.
 *
 * @returns Express middleware function
 */
export function createContextMiddleware() {
  return (req: PluginRequest, res: PluginResponse, next: NextFunction) => {
    const context = getContext(req.headers);

    if (!context) {
      return (res as any).status(401).json({
        success: false,
        error: 'Missing required platform headers'
      });
    }

    // Attach context to request
    req.pluginContext = context;
    next();
  };
}

/**
 * Validate that request is from Jiffoo platform
 *
 * @param headers - Request headers
 * @returns true if platform ID is 'jiffoo'
 */
export function isFromJiffooPlatform(headers: Record<string, string | string[] | undefined>): boolean {
  const platformId = headers['x-platform-id'] || headers['X-Platform-Id'];
  const value = Array.isArray(platformId) ? platformId[0] : platformId;
  return value === 'jiffoo';
}

/**
 * Get tenant ID from context
 *
 * @param context - Plugin context
 * @returns Tenant ID as number
 */
export function getTenantId(context: PluginContext): number {
  return parseInt(context.tenantId, 10);
}

/**
 * Check if request is from production environment
 *
 * @param context - Plugin context
 * @returns true if environment is 'production'
 */
export function isProduction(context: PluginContext): boolean {
  return context.environment === 'production';
}

