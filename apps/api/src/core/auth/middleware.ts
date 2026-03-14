import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtUtils } from '@/utils/jwt';
import { sendError } from '@/utils/response';
import { findAuthIdentityById } from './user-compat';

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
