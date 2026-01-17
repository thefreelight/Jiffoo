/**
 * Jiffoo Plugin SDK - Context Utilities
 *
 * Extract and validate plugin context from platform request headers.
 */

import { PlatformHeaders, PluginContext, PluginRequest, PluginResponse, NextFunction } from './types';

/**
 * Extract plugin context from request headers
 */
export function getContext(headers: Record<string, string | string[] | undefined>): PluginContext {
    const getHeader = (name: string): string => {
        const value = headers[name] || headers[name.toLowerCase()];
        return Array.isArray(value) ? value[0] : (value || '');
    };

    return {
        platformId: getHeader('x-platform-id'),
        environment: getHeader('x-platform-env'),
        timestamp: getHeader('x-platform-timestamp'),
        pluginSlug: getHeader('x-plugin-slug'),
        installationId: getHeader('x-installation-id'),
        signature: getHeader('x-platform-signature'),
        userId: getHeader('x-user-id') || undefined,
    };
}

/**
 * Check if request is from Jiffoo platform
 */
export function isFromJiffooPlatform(headers: Record<string, string | string[] | undefined>): boolean {
    const platformId = headers['x-platform-id'] || headers['X-Platform-Id'];
    return !!platformId && (Array.isArray(platformId) ? platformId[0] : platformId).startsWith('jiffoo-');
}



/**
 * Check if running in production environment
 */
export function isProduction(headers: Record<string, string | string[] | undefined>): boolean {
    const env = headers['x-platform-env'] || headers['X-Platform-Env'];
    const envValue = Array.isArray(env) ? env[0] : env;
    return envValue === 'production';
}

/**
 * Express/Fastify middleware to extract and attach plugin context
 */
export function createContextMiddleware() {
    return (req: PluginRequest, res: PluginResponse, next: NextFunction) => {
        // Validate required headers
        const requiredHeaders = [
            'x-platform-id',
            'x-plugin-slug',
            'x-installation-id'
        ];

        for (const header of requiredHeaders) {
            if (!req.headers[header]) {
                res.status(400).json({
                    success: false,
                    error: `Missing required header: ${header}`
                });
                return;
            }
        }

        // Extract context and attach to request
        req.pluginContext = getContext(req.headers);
        next();
    };
}
