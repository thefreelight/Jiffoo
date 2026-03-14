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
        pluginSlug: getHeader('x-plugin-slug'),
        installationId: getHeader('x-installation-id'),
        installationKey: getHeader('x-installation-key'),
        userId: getHeader('x-user-id') || undefined,
        userRole: getHeader('x-user-role') || undefined,
        requestId: getHeader('x-request-id') || undefined,
        locale: getHeader('x-locale') || undefined,
        caller: getHeader('x-caller') || undefined,
        platformVersion: getHeader('x-platform-version') || undefined,
        platformApiBaseUrl: getHeader('x-platform-api-base-url') || undefined,
        platformIntegrationToken: getHeader('x-platform-integration-token') || undefined,
        signature: getHeader('x-platform-signature'),
        timestamp: getHeader('x-platform-timestamp'),
    };
}

/**
 * Check if request is from Jiffoo platform
 * Updated: no longer requires 'jiffoo-' prefix, just checks for x-platform-id presence
 */
export function isFromJiffooPlatform(headers: Record<string, string | string[] | undefined>): boolean {
    const platformId = headers['x-platform-id'] || headers['X-Platform-Id'];
    return !!platformId && (Array.isArray(platformId) ? platformId[0] : platformId).length > 0;
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
