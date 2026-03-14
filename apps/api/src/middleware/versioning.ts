import { FastifyRequest, FastifyReply } from 'fastify';
import { extractVersionFromPath, isValidVersion } from '@jiffoo/shared/versioning';
import { apiVersionConfig, getDefaultVersion, isSupportedVersion, getVersionMetadata } from '../config/api-versions';

/**
 * Versioning Middleware
 *
 * Extracts the API version from the request URL path and validates it.
 * Sets the version on the request object for downstream handlers.
 * Falls back to the default version if no version is specified in the path.
 */

/**
 * Extract and validate API version from request URL
 */
export async function versioningMiddleware(request: FastifyRequest, reply: FastifyReply) {
  try {
    // Extract version from URL path (e.g., /api/v1/products -> v1)
    const extractedVersion = extractVersionFromPath(request.url);

    // Determine the version to use
    let apiVersion: string;

    if (extractedVersion) {
      // Validate the extracted version format
      if (!isValidVersion(extractedVersion)) {
        return reply.status(400).send({
          error: 'Invalid API version format',
          message: `The version "${extractedVersion}" is not in a valid format. Expected format: v1, v2, etc.`,
          supportedVersions: apiVersionConfig.supportedVersions,
        });
      }

      // Check if the version is supported
      if (!isSupportedVersion(extractedVersion)) {
        return reply.status(404).send({
          error: 'Unsupported API version',
          message: `API version "${extractedVersion}" is not supported.`,
          supportedVersions: apiVersionConfig.supportedVersions,
          defaultVersion: apiVersionConfig.defaultVersion,
        });
      }

      apiVersion = extractedVersion;
    } else {
      // No version in URL, use default version
      apiVersion = getDefaultVersion();
    }

    // Set the version on the request object
    (request as any).apiVersion = apiVersion;

    // Get version metadata for additional context
    const versionMetadata = getVersionMetadata(apiVersion);
    (request as any).versionMetadata = versionMetadata;

    // Add version header to response
    reply.header('X-API-Version', apiVersion);

    // If version is deprecated, add deprecation headers (will be handled by deprecation middleware in phase 4)
    if (versionMetadata?.status === 'deprecated' && versionMetadata.deprecationInfo) {
      reply.header('X-API-Deprecated', 'true');
      if (versionMetadata.deprecationInfo.sunsetDate) {
        reply.header('X-API-Sunset-Date', versionMetadata.deprecationInfo.sunsetDate);
      }
      if (versionMetadata.deprecationInfo.migrationGuide) {
        reply.header('X-Migration-Guide', versionMetadata.deprecationInfo.migrationGuide);
      }
    }

  } catch (error) {
    // Log error and return internal server error
    request.log.error('Error in versioning middleware:', error);
    return reply.status(500).send({
      error: 'Internal server error',
      message: 'Failed to process API version',
    });
  }
}

/**
 * Get the API version from the request
 * @param request - Fastify request object
 * @returns The API version string (e.g., 'v1')
 */
export function getRequestVersion(request: FastifyRequest): string {
  return (request as any).apiVersion || getDefaultVersion();
}

/**
 * Check if the request is using a specific API version
 * @param request - Fastify request object
 * @param version - Version to check (e.g., 'v1')
 * @returns True if the request is using the specified version
 */
export function isRequestVersion(request: FastifyRequest, version: string): boolean {
  return getRequestVersion(request) === version;
}

/**
 * Check if the request is using a deprecated API version
 * @param request - Fastify request object
 * @returns True if the request is using a deprecated version
 */
export function isRequestVersionDeprecated(request: FastifyRequest): boolean {
  const versionMetadata = (request as any).versionMetadata;
  return versionMetadata?.status === 'deprecated';
}

/**
 * Require a specific minimum API version
 * Middleware factory that returns a middleware function to enforce minimum version
 * @param minVersion - Minimum required version (e.g., 'v2')
 * @returns Middleware function
 */
export function requireMinVersion(minVersion: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const currentVersion = getRequestVersion(request);
    const { compareVersions } = await import('@jiffoo/shared/versioning');

    try {
      const comparison = compareVersions(currentVersion, minVersion);

      if (comparison < 0) {
        return reply.status(426).send({
          error: 'Upgrade Required',
          message: `This endpoint requires API version ${minVersion} or higher. Current version: ${currentVersion}`,
          requiredVersion: minVersion,
          currentVersion,
          upgradeInstructions: `Please use /api/${minVersion}/ endpoints instead of /api/${currentVersion}/`,
        });
      }
    } catch (error) {
      request.log.error('Error comparing versions:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Failed to validate API version requirement',
      });
    }
  };
}
