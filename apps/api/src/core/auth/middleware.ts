import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtUtils } from '@/utils/jwt';
import { sendError } from '@/utils/response';
import { findAuthIdentityById } from './user-compat';
import { ApiTokenService, type ApiTokenScope } from './api-token';

/**
 * Auth Middleware
 * 
 * Simplified version, removed all tenant related logic.
 */

/**
 * Unified auth middleware - only supports Bearer Token
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(reply, 401, 'UNAUTHORIZED', 'Missing or invalid authorization header');
    }

    const token = authHeader.substring(7);
    if (!token) {
      return sendError(reply, 401, 'UNAUTHORIZED', 'Missing authentication token');
    }

    const payload = JwtUtils.verify(token);

    // Get user info from database
    const user = await findAuthIdentityById(payload.userId);

    if (!user) {
      return sendError(reply, 401, 'UNAUTHORIZED', 'User not found');
    }
    if (!user.isActive) {
      return sendError(reply, 403, 'FORBIDDEN', 'Account is inactive');
    }

    // Simplified permission system: Role based permissions
    const permissions = user.role === 'ADMIN' ? ['*'] : [];
    const roles = [user.role];

    request.user = {
      id: user.id,
      userId: user.id,
      email: user.email,
      username: user.username || user.email.split('@')[0],
      role: user.role,
      emailVerified: user.emailVerified,
      permissions,
      roles,
    };

  } catch {
    return sendError(reply, 401, 'UNAUTHORIZED', 'Invalid or expired token');
  }
}

/**
 * Optional auth middleware - login not required
 */
export async function optionalAuthMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return; // Login not required
    }

    const token = authHeader.substring(7);
    if (!token) return;

    const payload = JwtUtils.verify(token);

    const user = await findAuthIdentityById(payload.userId);

    if (user && user.isActive) {
      request.user = {
        id: user.id,
        userId: user.id,
        email: user.email,
        username: user.username || user.email.split('@')[0],
        role: user.role,
        emailVerified: user.emailVerified,
        permissions: user.role === 'ADMIN' ? ['*'] : [],
        roles: [user.role],
      };
    }
  } catch {
    // Ignore error, user not logged in
  }
}

/**
 * Admin permission check middleware
 */
export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
) {
  if (!request.user) {
    return sendError(reply, 401, 'UNAUTHORIZED', 'Authentication required');
  }

  // Allow only ADMIN role
  if (request.user.role !== 'ADMIN') {
    return sendError(reply, 403, 'FORBIDDEN', 'Admin access required');
  }
}

/**
 * Email verification check middleware
 */
export async function requireEmailVerified(
  request: FastifyRequest,
  reply: FastifyReply
) {
  if (!request.user) {
    return reply.status(401).send({
      success: false,
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }

  // Check if email is verified
  if (!request.user.emailVerified) {
    return reply.status(403).send({
      success: false,
      error: 'Forbidden',
      message: 'Email verification required'
    });
  }
}

/**
 * Role check middleware factory
 */
export function requireRole(...allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return sendError(reply, 401, 'UNAUTHORIZED', 'Authentication required');
    }

    if (!allowedRoles.includes(request.user.role)) {
      return sendError(reply, 403, 'FORBIDDEN', `Required role: ${allowedRoles.join(' or ')}`);
    }
  };
}

/**
 * Dual auth middleware — supports both JWT and API tokens.
 *
 * If the Bearer token starts with `jiffoo_`, it is treated as an API token
 * and validated via ApiTokenService. Otherwise, standard JWT auth is used.
 *
 * When authenticated via API token, a synthetic user object is attached to
 * `request.user` so that downstream services (cart, order) can use
 * `request.user.id` without changes.
 *
 * @param requiredScopes - If provided, the API token must have all these scopes.
 *                         JWT-authenticated users bypass scope checks.
 */
export function dualAuthMiddleware(...requiredScopes: ApiTokenScope[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendError(reply, 401, 'UNAUTHORIZED', 'Missing or invalid authorization header');
      return;
    }

    const token = authHeader.substring(7);

    // API token path
    if (token.startsWith('jiffoo_')) {
      const identity = await ApiTokenService.validateToken(token);
      if (!identity) {
        sendError(reply, 401, 'INVALID_TOKEN', 'API token is invalid or revoked');
        return;
      }

      // Check scopes
      for (const scope of requiredScopes) {
        const granted = identity.scopes;
        if (!granted.includes('*') && !granted.includes(scope)) {
          sendError(
            reply,
            403,
            'INSUFFICIENT_SCOPE',
            `Token lacks required scope: ${scope}. Granted scopes: ${granted.join(', ')}`,
          );
          return;
        }
      }

      // Attach synthetic user so cart/order services work unchanged
      (request as any).apiToken = identity;
      request.user = {
        id: `api:${identity.tokenId}`,
        userId: `api:${identity.tokenId}`,
        email: `${identity.label.replace(/\s+/g, '-').toLowerCase()}@api-token.local`,
        username: identity.label,
        role: 'CUSTOMER',
        emailVerified: true,
        permissions: [],
        roles: ['CUSTOMER'],
      };
      return;
    }

    // JWT path — delegate to standard authMiddleware
    await authMiddleware(request, reply);
  };
}

// ============================================
// Compatibility exports (keep old code working)
// ============================================



/**
 * Admin middleware - combines auth + admin check
 */
export async function adminMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  await authMiddleware(request, reply);
  if (reply.sent) return;
  await requireAdmin(request, reply);
}
