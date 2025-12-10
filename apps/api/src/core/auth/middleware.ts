import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtUtils } from '@/utils/jwt';
import { prisma } from '@/config/database';

/**
 * 认证中间件 (单商户版本)
 * 
 * 简化版本，移除了所有租户相关逻辑。
 */

/**
 * 统一认证中间件 - 只支持Bearer Token
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

    // 从数据库获取用户信息
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

    // 简化的权限系统：基于角色的权限
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
 * 可选认证中间件 - 不强制要求登录
 */
export async function optionalAuthMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply
) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return; // 不强制要求登录
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
    // 忽略错误，用户未登录
  }
}

/**
 * 管理员权限检查中间件
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
 * 角色检查中间件工厂
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
// 兼容性导出 (保持旧代码不报错)
// ============================================

/** @deprecated 单商户模式不需要租户中间件 */
export async function tenantMiddleware(
  _request: FastifyRequest,
  _reply: FastifyReply
) {
  // 单商户模式：直接通过
}

/** @deprecated 单商户模式不需要租户验证 */
export async function requireTenantAccess(
  _request: FastifyRequest,
  _reply: FastifyReply
) {
  // 单商户模式：直接通过
}

/** @deprecated 单商户模式不需要超级管理员检查 */
export async function requireSuperAdmin(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // 在单商户模式下，ADMIN 就是最高权限
  return requireAdmin(request, reply);
}

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
