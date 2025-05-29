import { FastifyRequest, FastifyReply } from 'fastify';
import { PermissionService } from './service';
import { Resource, Action, PermissionContext, UserRole } from './types';
import { LoggerService } from '@/core/logger/logger';

/**
 * 权限检查中间件工厂
 */
export function requirePermission(resource: Resource, action: Action) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    
    if (!user) {
      LoggerService.logSecurity('UNAUTHORIZED_ACCESS', {
        resource,
        action,
        ip: request.ip,
        url: request.url,
        method: request.method
      });
      
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    const context: PermissionContext = {
      userId: user.id,
      userRole: user.role as UserRole,
      resource,
      action,
      resourceId: (request.params as any)?.id,
      additionalData: {
        ownerId: user.id,
        body: request.body,
        query: request.query
      }
    };

    const result = await PermissionService.checkPermission(context);
    
    if (!result.allowed) {
      LoggerService.logSecurity('PERMISSION_DENIED', {
        userId: user.id,
        userRole: user.role,
        resource,
        action,
        reason: result.reason,
        ip: request.ip,
        url: request.url,
        method: request.method
      });
      
      return reply.status(403).send({
        error: 'Forbidden',
        message: result.reason || 'Insufficient permissions'
      });
    }

    // 将权限信息添加到请求对象
    (request as any).permission = result;
  };
}

/**
 * 角色检查中间件
 */
export function requireRole(minRole: UserRole) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    
    if (!user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    const roleHierarchy = {
      [UserRole.CUSTOMER]: 0,
      [UserRole.STAFF]: 1,
      [UserRole.MANAGER]: 2,
      [UserRole.ADMIN]: 3,
      [UserRole.SUPER_ADMIN]: 4
    };

    const userLevel = roleHierarchy[user.role as UserRole] || 0;
    const requiredLevel = roleHierarchy[minRole];

    if (userLevel < requiredLevel) {
      LoggerService.logSecurity('INSUFFICIENT_ROLE', {
        userId: user.id,
        userRole: user.role,
        requiredRole: minRole,
        ip: request.ip,
        url: request.url,
        method: request.method
      });
      
      return reply.status(403).send({
        error: 'Forbidden',
        message: `Requires ${minRole} role or higher`
      });
    }
  };
}

/**
 * 资源所有者检查中间件
 */
export function requireOwnership(resourceIdParam: string = 'id') {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const resourceId = (request.params as any)[resourceIdParam];
    
    if (!user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    // 管理员可以访问所有资源
    if (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) {
      return;
    }

    // 检查是否是资源所有者
    if (user.id !== resourceId) {
      LoggerService.logSecurity('OWNERSHIP_VIOLATION', {
        userId: user.id,
        resourceId,
        ip: request.ip,
        url: request.url,
        method: request.method
      });
      
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'You can only access your own resources'
      });
    }
  };
}

/**
 * 管理员权限中间件
 */
export async function adminMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const user = (request as any).user;
  
  if (!user) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }

  const isAdmin = await PermissionService.isAdmin(user.id, user.role);
  
  if (!isAdmin) {
    LoggerService.logSecurity('ADMIN_ACCESS_DENIED', {
      userId: user.id,
      userRole: user.role,
      ip: request.ip,
      url: request.url,
      method: request.method
    });
    
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'Administrator access required'
    });
  }
}

/**
 * 超级管理员权限中间件
 */
export async function superAdminMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const user = (request as any).user;
  
  if (!user) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }

  const isSuperAdmin = await PermissionService.isSuperAdmin(user.id, user.role);
  
  if (!isSuperAdmin) {
    LoggerService.logSecurity('SUPER_ADMIN_ACCESS_DENIED', {
      userId: user.id,
      userRole: user.role,
      ip: request.ip,
      url: request.url,
      method: request.method
    });
    
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'Super administrator access required'
    });
  }
}

/**
 * 权限装饰器
 */
export function Permission(resource: Resource, action: Action) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    
    descriptor.value = async function (request: FastifyRequest, reply: FastifyReply, ...args: any[]) {
      const user = (request as any).user;
      
      if (!user) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      const context: PermissionContext = {
        userId: user.id,
        userRole: user.role as UserRole,
        resource,
        action,
        resourceId: (request.params as any)?.id
      };

      const result = await PermissionService.checkPermission(context);
      
      if (!result.allowed) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: result.reason || 'Insufficient permissions'
        });
      }

      return method.apply(this, [request, reply, ...args]);
    };
    
    return descriptor;
  };
}
