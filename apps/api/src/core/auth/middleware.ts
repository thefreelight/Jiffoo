import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtUtils } from '@/utils/jwt';
import { prisma } from '@/config/database';

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
      return reply.status(401).send({
        success: false,
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header'
      });
    }

    const token = authHeader.substring(7);
    if (!token) {
      return reply.status(401).send({
        success: false,
        error: 'Unauthorized',
        message: 'Missing authentication token'
      });
    }

    const payload = JwtUtils.verify(token);

    // Get user info from database
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, username: true, role: true }
    });

    if (!user) {
      return reply.status(401).send({
        success: false,
        error: 'Unauthorized',
        message: 'User not found'
      });
    }

    // Simplified permission system: Role based permissions
    const permissions = (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') ? ['*'] : [];
    const roles = [user.role];

    request.user = {
      id: user.id,
      userId: user.id,
      email: user.email,
      username: user.username || user.email.split('@')[0],
      role: user.role,
      permissions,
      roles,
    };

  } catch {
    return reply.status(401).send({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid or expired token'
    });
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

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, username: true, role: true }
    });

    if (user) {
      request.user = {
        id: user.id,
        userId: user.id,
        email: user.email,
        username: user.username || user.email.split('@')[0],
        role: user.role,
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
    return reply.status(401).send({
      success: false,
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }

  // Allow both ADMIN and SUPER_ADMIN roles
  if (request.user.role !== 'ADMIN' && request.user.role !== 'SUPER_ADMIN') {
    return reply.status(403).send({
      success: false,
      error: 'Forbidden',
      message: 'Admin access required'
    });
  }
}

/**
 * Role check middleware factory
 */
export function requireRole(...allowedRoles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(request.user.role)) {
      return reply.status(403).send({
        success: false,
        error: 'Forbidden',
        message: `Required role: ${allowedRoles.join(' or ')}`
      });
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
