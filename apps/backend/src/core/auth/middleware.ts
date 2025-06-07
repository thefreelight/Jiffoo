import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtUtils, JwtPayload } from '@/utils/jwt';
import { permissionManager } from './permission-manager';

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload & {
      permissions?: string[];
      roles?: any[];
      tenantId?: string;
    };
  }
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const payload = JwtUtils.verify(token);

    // 获取租户ID (如果在请求中)
    const tenantId = request.headers['x-tenant-id'] as string ||
                     (request.query as any)?.tenantId as string ||
                     (request.body as any)?.tenantId as string;

    // 加载用户权限和角色
    try {
      const [permissions, roles] = await Promise.all([
        permissionManager.getUserPermissions(payload.userId, tenantId),
        permissionManager.getUserRoles(payload.userId, tenantId)
      ]);

      request.user = {
        ...payload,
        permissions,
        roles,
        tenantId
      };
    } catch (permissionError) {
      console.error('Error loading user permissions/roles:', permissionError);
      throw permissionError;
    }


  } catch (error) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid or expired token'
    });
  }
}

export async function adminMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  if (!request.user) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }

  // 检查是否有管理员权限
  const hasAdminPermission = request.user.permissions?.includes('*') ||
                            request.user.permissions?.includes('system.*') ||
                            request.user.roles?.some(userRole =>
                              userRole.role?.name === 'ADMIN' || userRole.role?.name === 'SUPER_ADMIN'
                            );

  if (!hasAdminPermission) {
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'Admin access required'
    });
  }
}

/**
 * 权限检查中间件工厂
 */
export function requirePermission(permission: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      console.log('requirePermission middleware started for permission:', permission);

      if (!request.user) {
        console.log('No user found in request');
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      console.log('User found:', { userId: request.user.userId, tenantId: request.user.tenantId });

      const hasPermission = await permissionManager.hasPermission(
        request.user.userId,
        permission,
        request.user.tenantId
      );

      console.log('Permission check result:', hasPermission);

      if (!hasPermission) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: `Permission '${permission}' required`
        });
      }

      console.log('requirePermission middleware completed successfully');
    } catch (error) {
      console.error('Error in requirePermission middleware:', error);
      return reply.status(500).send({
        error: 'Internal server error',
        message: 'Permission check failed'
      });
    }
  };
}

/**
 * 租户权限检查中间件
 */
export async function tenantMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  if (!request.user) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }

  const tenantId = (request.params as any)?.tenantId ||
                   request.headers['x-tenant-id'] ||
                   request.user.tenantId;

  if (!tenantId) {
    return reply.status(400).send({
      error: 'Bad Request',
      message: 'Tenant ID required'
    });
  }

  // 检查用户是否有访问该租户的权限
  const hasAccess = request.user.permissions?.includes('*') ||
                   request.user.permissions?.includes('tenants.*') ||
                   request.user.roles?.some(userRole =>
                     userRole.tenantId === tenantId ||
                     userRole.role?.name === 'ADMIN' ||
                     userRole.role?.name === 'SUPER_ADMIN'
                   );

  if (!hasAccess) {
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'Access to this tenant denied'
    });
  }

  // 将租户ID添加到请求中
  request.user.tenantId = tenantId;
}

/**
 * 角色检查中间件工厂
 */
export function requireRole(roleName: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    const hasRole = request.user.roles?.some(userRole => userRole.role?.name === roleName);

    if (!hasRole) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: `Role '${roleName}' required`
      });
    }
  };
}

/**
 * 审计日志中间件
 */
export function auditLog(action: string, module: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const originalSend = reply.send;

    reply.send = function(payload: any) {
      // 记录操作日志
      if (request.user) {
        const success = reply.statusCode < 400;
        const resourceId = (request.params as any)?.id || (request.body as any)?.id;
        const resourceType = module;

        permissionManager.logAction(
          request.user.userId,
          action,
          module,
          resourceId,
          resourceType,
          request.method === 'PUT' || request.method === 'PATCH' ? request.body : undefined,
          success ? payload : undefined,
          request.user.tenantId,
          request.ip,
          request.headers['user-agent'],
          success,
          success ? undefined : payload?.message
        ).catch(console.error);
      }

      return originalSend.call(this, payload);
    };
  };
}
