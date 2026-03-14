import { FastifyRequest, FastifyReply } from 'fastify';
import {
  createDeprecationHeaders,
  generateDeprecationWarning,
  getDaysUntilSunset,
  isSunset
} from '@jiffoo/shared/versioning';
import { getVersionMetadata } from '../config/api-versions';

/**
 * Deprecation Middleware
 *
 * Handles deprecation warnings for API versions and endpoints.
 * Adds deprecation headers to responses and logs warnings for deprecated usage.
 */

/**
 * Main deprecation middleware
 * Checks if the current API version is deprecated and adds appropriate headers
 */
export async function deprecationMiddleware(request: FastifyRequest, reply: FastifyReply) {
  try {
    // Get version from request (set by versioning middleware)
    const apiVersion = (request as any).apiVersion;
    const versionMetadata = (request as any).versionMetadata;

    if (!apiVersion || !versionMetadata) {
      // No version information available, skip deprecation handling
      return;
    }

    // Check if version is deprecated
    if (versionMetadata.status === 'deprecated' && versionMetadata.deprecationInfo) {
      const deprecationInfo = versionMetadata.deprecationInfo;

      // Check if version has reached sunset date
      if (isSunset(deprecationInfo)) {
        return reply.status(410).send({
          error: 'Gone',
          message: `API version "${apiVersion}" has been sunset and is no longer available.`,
          sunsetDate: deprecationInfo.sunsetDate,
          replacementVersion: deprecationInfo.replacementEndpoint || 'latest',
          migrationGuide: deprecationInfo.migrationGuide,
        });
      }

      // Add deprecation headers to response
      reply.header('X-API-Deprecated', 'true');

      if (deprecationInfo.deprecatedAt) {
        reply.header('X-API-Deprecated-At', deprecationInfo.deprecatedAt);
      }

      if (deprecationInfo.sunsetDate) {
        reply.header('X-API-Sunset-Date', deprecationInfo.sunsetDate);
      }

      if (deprecationInfo.migrationGuide) {
        reply.header('X-Migration-Guide', deprecationInfo.migrationGuide);
      }

      // Generate and log deprecation warning
      const warningMessage = generateDeprecationWarning(apiVersion, deprecationInfo);
      request.log.warn({
        message: 'Deprecated API version accessed',
        version: apiVersion,
        deprecation: warningMessage,
        url: request.url,
        method: request.method,
        ip: request.ip,
      });

      // Add Warning header (RFC 7234)
      const daysUntilSunset = getDaysUntilSunset(deprecationInfo);
      if (daysUntilSunset !== null) {
        const warningHeader = `299 - "Deprecated API version. ${warningMessage}"`;
        reply.header('Warning', warningHeader);
      }
    }

    // Check for route-level deprecation (if configured in route schema)
    const routeSchema = (request.routeOptions as any)?.schema;
    if (routeSchema?.deprecated === true) {
      reply.header('X-Endpoint-Deprecated', 'true');

      request.log.warn({
        message: 'Deprecated endpoint accessed',
        endpoint: request.url,
        method: request.method,
        version: apiVersion,
        ip: request.ip,
      });

      const endpointWarning = '299 - "This endpoint is deprecated and may be removed in a future version."';
      const existingWarning = reply.getHeader('Warning');
      if (existingWarning) {
        reply.header('Warning', `${existingWarning}, ${endpointWarning}`);
      } else {
        reply.header('Warning', endpointWarning);
      }
    }

  } catch (error) {
    // Log error but don't block the request
    request.log.error({
      message: 'Error in deprecation middleware',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  }
}

/**
 * Check if the current request is using a deprecated version
 * @param request - Fastify request object
 * @returns True if the version is deprecated
 */
export function isRequestDeprecated(request: FastifyRequest): boolean {
  const versionMetadata = (request as any).versionMetadata;
  if (!versionMetadata) {
    return false;
  }
  return versionMetadata.status === 'deprecated';
}

/**
 * Get deprecation info for the current request
 * @param request - Fastify request object
 * @returns Deprecation info or null if not deprecated
 */
export function getRequestDeprecationInfo(request: FastifyRequest) {
  const versionMetadata = (request as any).versionMetadata;
  if (!versionMetadata || versionMetadata.status !== 'deprecated') {
    return null;
  }
  return versionMetadata.deprecationInfo || null;
}

/**
 * Get days until sunset for the current request version
 * @param request - Fastify request object
 * @returns Number of days until sunset, or null if not deprecated/no sunset date
 */
export function getRequestDaysUntilSunset(request: FastifyRequest): number | null {
  const deprecationInfo = getRequestDeprecationInfo(request);
  if (!deprecationInfo) {
    return null;
  }
  return getDaysUntilSunset(deprecationInfo);
}

/**
 * Middleware factory to mark specific endpoints as deprecated
 * Use this to deprecate individual endpoints regardless of API version
 *
 * @param options - Deprecation configuration
 * @returns Middleware function
 *
 * @example
 * ```typescript
 * fastify.get('/api/v1/old-endpoint', {
 *   preHandler: deprecateEndpoint({
 *     reason: 'Use /api/v1/new-endpoint instead',
 *     replacementEndpoint: '/api/v1/new-endpoint',
 *     sunsetDate: '2025-01-01'
 *   })
 * }, handler);
 * ```
 */
export function deprecateEndpoint(options: {
  reason?: string;
  replacementEndpoint?: string;
  sunsetDate?: string;
  migrationGuide?: string;
}) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Add endpoint-specific deprecation headers
    reply.header('X-Endpoint-Deprecated', 'true');

    if (options.sunsetDate) {
      reply.header('X-Endpoint-Sunset-Date', options.sunsetDate);

      // Check if endpoint has reached sunset
      const sunsetDate = new Date(options.sunsetDate);
      if (new Date() >= sunsetDate) {
        return reply.status(410).send({
          error: 'Gone',
          message: 'This endpoint has been sunset and is no longer available.',
          sunsetDate: options.sunsetDate,
          replacementEndpoint: options.replacementEndpoint,
          migrationGuide: options.migrationGuide,
        });
      }
    }

    if (options.replacementEndpoint) {
      reply.header('X-Replacement-Endpoint', options.replacementEndpoint);
    }

    if (options.migrationGuide) {
      reply.header('X-Migration-Guide', options.migrationGuide);
    }

    // Build warning message
    let warningMessage = 'This endpoint is deprecated';
    if (options.reason) {
      warningMessage += `. ${options.reason}`;
    } else if (options.replacementEndpoint) {
      warningMessage += `. Please use ${options.replacementEndpoint} instead`;
    }

    if (options.sunsetDate) {
      warningMessage += `. Sunset date: ${options.sunsetDate}`;
    }

    // Add Warning header
    reply.header('Warning', `299 - "${warningMessage}"`);

    // Log deprecation warning
    request.log.warn({
      message: 'Deprecated endpoint accessed',
      endpoint: request.url,
      method: request.method,
      reason: options.reason,
      replacementEndpoint: options.replacementEndpoint,
      sunsetDate: options.sunsetDate,
      ip: request.ip,
    });
  };
}

/**
 * Check if a specific version is deprecated
 * @param version - API version string (e.g., 'v1')
 * @returns True if the version is deprecated
 */
export function isVersionDeprecated(version: string): boolean {
  const metadata = getVersionMetadata(version);
  return metadata?.status === 'deprecated';
}

/**
 * Get deprecation message for display in responses or logs
 * @param request - Fastify request object
 * @returns Deprecation message or null if not deprecated
 */
export function getDeprecationMessage(request: FastifyRequest): string | null {
  const apiVersion = (request as any).apiVersion;
  const deprecationInfo = getRequestDeprecationInfo(request);

  if (!apiVersion || !deprecationInfo) {
    return null;
  }

  return generateDeprecationWarning(apiVersion, deprecationInfo);
}
