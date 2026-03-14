/**
 * Plugin Token Guard Middleware (Phase 2, Section 4.6)
 *
 * Fastify preHandler hook factory that authenticates requests from plugins
 * using their service tokens (JWT) and enforces permission-based access control.
 *
 * Usage:
 *   fastify.get('/api/products', { preHandler: [pluginTokenGuard('products:read')] }, handler);
 *   fastify.post('/api/orders', { preHandler: [pluginTokenGuard('orders:write')] }, handler);
 *   fastify.get('/api/some-route', { preHandler: [pluginTokenGuard()] }, handler); // any valid token
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { PluginTokenService } from '@/core/admin/plugin-management/token-service';
import { sendError } from '@/utils/response';
import { logger } from '@/core/logger/logger';

// ---------------------------------------------------------------------------
// Fastify type augmentation
// ---------------------------------------------------------------------------

declare module 'fastify' {
  interface FastifyRequest {
    pluginIdentity?: {
      installationId: string;
      pluginSlug: string;
      grantedPermissions: string[];
    };
  }
}

// ---------------------------------------------------------------------------
// Permission -> Route mapping (hardcoded v1)
// ---------------------------------------------------------------------------

const PERMISSION_ROUTE_MAP: Record<string, { methods: string[]; pathPattern: RegExp }> = {
  'products:read': { methods: ['GET'], pathPattern: /^\/api\/products/ },
  'products:write': { methods: ['POST', 'PUT', 'PATCH', 'DELETE'], pathPattern: /^\/api\/products/ },
  'orders:read': { methods: ['GET'], pathPattern: /^\/api\/orders/ },
  'orders:write': { methods: ['POST', 'PUT', 'PATCH', 'DELETE'], pathPattern: /^\/api\/orders/ },
  'customers:read': { methods: ['GET'], pathPattern: /^\/api\/admin\/users/ },
  'store:read': { methods: ['GET'], pathPattern: /^\/api\/store/ },
  'store:write': { methods: ['POST', 'PUT', 'PATCH', 'DELETE'], pathPattern: /^\/api\/store/ },
};

// ---------------------------------------------------------------------------
// Guard factory
// ---------------------------------------------------------------------------

/**
 * Create a Fastify preHandler hook that validates plugin service tokens
 * and optionally checks a required permission.
 *
 * @param requiredPermission - If specified, the plugin must have been granted
 *   this permission AND the request method/path must match the permission's
 *   route mapping.
 */
export function pluginTokenGuard(requiredPermission?: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();
    const endpoint = `${request.method} ${request.url}`;
    let installationId: string | undefined;
    let permissionCheckStatus: 'granted' | 'denied' | 'skipped' = 'skipped';

    try {
      // ---------------------------------------------------------------
      // 1. Extract Bearer token from Authorization header
      // ---------------------------------------------------------------
      const authHeader = request.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        permissionCheckStatus = 'denied';
        return sendError(reply, 401, 'UNAUTHORIZED', 'Missing or invalid authorization header');
      }

      const token = authHeader.substring(7);
      if (!token) {
        permissionCheckStatus = 'denied';
        return sendError(reply, 401, 'UNAUTHORIZED', 'Missing authentication token');
      }

      // ---------------------------------------------------------------
      // 2. Validate the plugin service token
      // ---------------------------------------------------------------
      const identity = await PluginTokenService.validateToken(token);
      if (!identity) {
        permissionCheckStatus = 'denied';
        return sendError(reply, 401, 'UNAUTHORIZED', 'Invalid or expired plugin service token');
      }

      installationId = identity.installationId;

      // ---------------------------------------------------------------
      // 3. Check required permission (if specified)
      // ---------------------------------------------------------------
      if (requiredPermission) {
        // The plugin must have the permission in its granted list
        if (!identity.grantedPermissions.includes(requiredPermission)) {
          permissionCheckStatus = 'denied';
          return sendError(
            reply,
            403,
            'FORBIDDEN',
            `Plugin does not have required permission: ${requiredPermission}`,
          );
        }

        // Validate that the request method+path matches the permission's route map
        const routeSpec = PERMISSION_ROUTE_MAP[requiredPermission];
        if (routeSpec) {
          const methodAllowed = routeSpec.methods.includes(request.method);
          const pathAllowed = routeSpec.pathPattern.test(request.url);

          if (!methodAllowed || !pathAllowed) {
            permissionCheckStatus = 'denied';
            return sendError(
              reply,
              403,
              'FORBIDDEN',
              `Permission "${requiredPermission}" does not authorize ${request.method} ${request.url}`,
            );
          }
        }
        // If the permission is not in the route map, we allow it as long as
        // the plugin has it granted (future-proofing for custom permissions).

        permissionCheckStatus = 'granted';
      }

      // ---------------------------------------------------------------
      // 4. Inject plugin identity onto the request
      // ---------------------------------------------------------------
      request.pluginIdentity = {
        installationId: identity.installationId,
        pluginSlug: identity.pluginSlug,
        grantedPermissions: identity.grantedPermissions,
      };
    } finally {
      // ---------------------------------------------------------------
      // 5. Audit logging
      // ---------------------------------------------------------------
      const latencyMs = Date.now() - startTime;
      logger.info({
        event: 'plugin_token_guard',
        installationId: installationId ?? 'unknown',
        endpoint,
        requiredPermission: requiredPermission ?? null,
        permissionCheckStatus,
        latencyMs,
      });
    }
  };
}
