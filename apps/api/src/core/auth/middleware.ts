import { FastifyRequest, FastifyReply } from 'fastify';
import { JwtUtils } from '@/utils/jwt';
import { prisma } from '@/config/database';
// 权限管理器已简化，不再需要复杂的权限管理
import { withTenantContext } from '@/core/database/tenant-middleware';
import { extractTenantId } from '@/utils/tenant-utils';

// 类型声明已移至 src/types/fastify.d.ts

/**
 * 统一认证中间件 - 标准化改造：只支持Bearer Token
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    // 只从Authorization头获取token
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

    // Demo tokens are not supported. All requests must provide a valid JWT.

    const payload = JwtUtils.verify(token);

    // 获取租户ID (优先使用JWT中的，然后是请求头中的)
    let tenantId = payload.tenantId;
    if (tenantId === undefined || tenantId === null) { // 0是有效的超级管理员tenantId
      const extractedTenantId = extractTenantId(request);
      if (extractedTenantId !== null) {
        tenantId = extractedTenantId;
      }
    }

    // 加载用户权限和角色（简化版本）
    try {
      // 从数据库获取用户信息和角色
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { role: true, tenantId: true }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // 简化的权限系统：基于角色的权限
      const permissions = user.role === 'SUPER_ADMIN' ? ['*'] : [];
      const roles = [user.role];

      request.user = {
        id: payload.userId,
        userId: payload.userId,
        email: payload.email,
        username: (payload as any).username || payload.email.split('@')[0],
        role: payload.role,
        permissions,
        roles,
        tenantId
      };
    } catch (permissionError) {
      console.error('Error loading user permissions/roles:', permissionError);
      throw permissionError;
    }

  } catch {
    return reply.status(401).send({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid or expired token'
    });
  }
}

/**
 * 可选认证中间件 - 标准化改造：只支持Bearer Token
 */
export async function optionalAuthMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply // eslint-disable-line @typescript-eslint/no-unused-vars
) {
  try {
    // 只从Authorization头获取token
    const authHeader = request.headers.authorization;
    let token: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    if (token) {
      try {
        const payload = JwtUtils.verify(token);

        // 获取租户ID
        let tenantId = payload.tenantId;
        if (tenantId === undefined || tenantId === null) { // 0是有效的超级管理员tenantId
          const headerTenantId = request.headers['x-tenant-id'] as string ||
                                (request.query as any)?.tenantId as string ||
                                (request.body as any)?.tenantId as string;
          tenantId = headerTenantId ? parseInt(headerTenantId, 10) : undefined;
        }

        // 加载用户权限和角色（简化版本）
        const user = await prisma.user.findUnique({
          where: { id: payload.userId },
          select: { role: true, tenantId: true }
        });

        if (!user) {
          throw new Error('User not found');
        }

        // 简化的权限系统：基于角色的权限
        const permissions = user.role === 'SUPER_ADMIN' ? ['*'] : [];
        const roles = [user.role];

        request.user = {
          id: payload.userId,
          userId: payload.userId,
          email: payload.email,
          username: (payload as any).username || payload.email.split('@')[0],
          role: payload.role,
          permissions,
          roles,
          tenantId
        };
      } catch (jwtError) {
        // Invalid token, but we don't fail the request
        request.log.warn({ err: jwtError }, 'Invalid token provided in optional auth');
      }
    }
  } catch (error) {
    // Log error but don't fail the request
    request.log.error({ err: error }, 'Optional authentication error');
  }
}

/**
 * 管理员权限检查中间件
 * 合并了原来的 adminMiddleware 和相关功能
 */
export async function adminMiddleware(
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

  // 检查是否有管理员权限
  // 1. 检查JWT token中的role字段
  const hasRoleInToken = request.user.role === 'ADMIN' ||
                        request.user.role === 'SUPER_ADMIN' ||
                        request.user.role === 'TENANT_ADMIN';

  // 2. 检查权限数组
  const hasPermissions = request.user.permissions?.includes('*') ||
                        request.user.permissions?.includes('system.*');

  // 3. 检查角色数组
  const hasRoleInArray = request.user.roles?.some(userRole =>
                          userRole.role?.name === 'ADMIN' ||
                          userRole.role?.name === 'SUPER_ADMIN' ||
                          userRole.role?.name === 'TENANT_ADMIN'
                        );

  const hasAdminPermission = hasRoleInToken || hasPermissions || hasRoleInArray;

  if (!hasAdminPermission) {
    return reply.status(403).send({
      success: false,
      error: 'Forbidden',
      message: 'Admin access required'
    });
  }
}

/**
 * 超级管理员权限检查中间件
 * 只允许超级管理员访问
 */
export async function superAdminMiddleware(
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

  // 检查是否为超级管理员
  const isSuperAdmin = request.user.role === 'SUPER_ADMIN';

  if (!isSuperAdmin) {
    return reply.status(403).send({
      success: false,
      error: 'Forbidden',
      message: 'Super admin access required'
    });
  }
}

/**
 * 角色检查中间件工厂 - 统一版本
 * 合并了原来 middleware/auth.ts 中的 requireRole 和 requireAnyRole
 */
export function requireRole(requiredRole: string | string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) {
      return reply.status(401).send({
        success: false,
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    const hasRole = roles.some(role =>
      request.user!.role === role ||
      request.user!.roles?.some(userRole => userRole.role?.name === role)
    );

    if (!hasRole) {
      return reply.status(403).send({
        success: false,
        error: 'Forbidden',
        message: `This endpoint requires one of the following roles: ${roles.join(', ')}`
      });
    }
  };
}

/**
 * 权限检查中间件工厂 - 统一版本
 * 合并了原来 middleware/auth.ts 中的 requirePermission 和 requireAnyPermission
 */
export function requirePermission(permission: string | string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      if (!request.user) {
        return reply.status(401).send({
          success: false,
          error: 'Unauthorized',
          message: 'Authentication required'
        });
      }

      const permissions = Array.isArray(permission) ? permission : [permission];

      // Admin role has all permissions
      if (request.user.role === 'ADMIN' || request.user.role === 'SUPER_ADMIN') {
        return;
      }

      // Check if user has any of the required permissions (简化版本)
      let hasPermission = false;
      // 简化的权限检查：超级管理员有所有权限
      if (request.user.role === 'SUPER_ADMIN') {
        hasPermission = true;
      }
      // 其他角色的权限检查可以在这里扩展
      // TODO: 实现基于 permissions 数组的详细权限检查

      if (!hasPermission) {
        return reply.status(403).send({
          success: false,
          error: 'Forbidden',
          message: `This endpoint requires one of the following permissions: ${permissions.join(', ')}`
        });
      }

    } catch (error) {
      request.log.error({ err: error }, 'Error in requirePermission middleware');
      return reply.status(500).send({
        success: false,
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

  const tenantIdRaw = (request.params as any)?.tenantId ||
                      request.headers['x-tenant-id'] ||
                      request.user.tenantId;

  if (tenantIdRaw === undefined || tenantIdRaw === null) {
    return reply.status(400).send({
      error: 'Bad Request',
      message: 'Tenant ID required'
    });
  }

  // 🔧 修复类型转换：确保tenantId是数字类型，避免字符串和数字比较失败
  const tenantId = typeof tenantIdRaw === 'string' ? parseInt(tenantIdRaw, 10) : tenantIdRaw;

  // 检查用户是否有访问该租户的权限
  // 1. 超级管理员可以访问任何租户
  // 2. 用户可以访问JWT token中指定的租户
  // 3. 用户可以访问通过数据库验证的租户关联
  const isSuperAdmin = request.user.role === 'SUPER_ADMIN';
  const isUserTenant = request.user.tenantId === tenantId;

  let hasAccess = isSuperAdmin || isUserTenant;

  // 简化后的权限检查：只检查JWT中的租户信息和超级管理员权限
  // 已删除TenantUser表，直接使用User.tenantId字段进行验证

  if (!hasAccess) {
    // 记录租户访问被拒绝的安全事件
    request.log.warn(`Tenant access denied: User ${request.user.userId} attempted to access tenant ${tenantId}`);
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'Access to this tenant denied'
    });
  }

  // 将租户ID添加到请求中
  request.user.tenantId = tenantId;

  // 记录成功的租户访问
  request.log.info(`Tenant access granted: User ${request.user.userId} accessing tenant ${tenantId}`);
}

/**
 * 租户解析器中间件
 * 从请求头、参数或子域名中解析租户ID，无需认证
 */
export async function tenantResolver(
  request: FastifyRequest,
  _reply: FastifyReply // eslint-disable-line @typescript-eslint/no-unused-vars
) {
  // 从多个来源获取租户ID
  const tenantIdStr = request.headers['x-tenant-id'] as string ||
                      (request.params as any)?.tenantId as string ||
                      (request.query as any)?.tenantId as string;

  const tenantId = tenantIdStr ? parseInt(tenantIdStr, 10) : undefined;

  // 可选：从子域名推断租户ID
  // const host = request.headers.host;
  // if (host && !tenantId) {
  //   const subdomain = host.split('.')[0];
  //   if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
  //     tenantId = subdomain;
  //   }
  // }

  if (tenantId) {
    request.tenantId = tenantId;
    // 记录租户上下文解析日志
    request.log.info(`Tenant context resolved: ${tenantId} for ${request.method} ${request.url}`);
  } else {
    // 记录缺少租户上下文的情况
    request.log.warn(`No tenant context found for ${request.method} ${request.url}`);
  }
}

/**
 * 可选租户权限检查中间件
 * 如果用户已认证且提供了租户ID则进行验证，否则只设置租户上下文
 */
export async function optionalTenantMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  // 首先运行租户解析器
  await tenantResolver(request, reply);

  // 如果用户未认证，只设置租户上下文，不进行权限检查
  if (!request.user) {
    return;
  }

  const tenantId = request.tenantId || request.user.tenantId;

  // 如果没有租户ID，跳过验证
  if (tenantId === undefined || tenantId === null) {
    return;
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
    // 记录可选租户访问被拒绝的安全事件
    request.log.warn(`Optional tenant access denied: User ${request.user.userId} attempted to access tenant ${tenantId}`);
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'Access to this tenant denied'
    });
  }

  // 记录成功的可选租户访问
  if (tenantId) {
    request.log.info(`Optional tenant access granted: User ${request.user.userId} accessing tenant ${tenantId}`);
  }

  // 将租户ID添加到用户上下文中
  request.user.tenantId = tenantId;
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
        // 简化的日志记录（可以在这里添加自定义日志逻辑）
        console.log(`User ${request.user.userId} performed ${action} on ${module}`, {
          resourceId,
          success,
          tenantId: request.user.tenantId,
          ip: request.ip
        });
      }

      return originalSend.call(this, payload);
    };
  };
}

/**
 * 租户上下文包装中间件
 * 为后续的数据库操作设置租户上下文
 */
export function withTenantContextMiddleware(
  handler: (request: FastifyRequest, reply: FastifyReply) => Promise<any>
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const tenantId = request.user?.tenantId || request.tenantId;
    const userId = request.user?.userId;
    const isSuperAdmin = request.user?.role === 'SUPER_ADMIN';

    if (tenantId !== undefined) {
      // 在租户上下文中执行处理器，包含超级管理员标志
      return withTenantContext(tenantId, userId, () => handler(request, reply), isSuperAdmin);
    } else {
      // 没有租户上下文时直接执行
      return handler(request, reply);
    }
  };
}
