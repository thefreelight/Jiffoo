import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { permissionManager } from './permission-manager';
import { authMiddleware, adminMiddleware, requirePermission, auditLog } from './middleware';
import { z } from 'zod';
import { prisma } from '@/config/database';

// 请求验证模式
const assignRoleSchema = z.object({
  userId: z.string().min(1),
  roleName: z.string().min(1),
  tenantId: z.string().optional()
});

const createRoleSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().optional(),
  level: z.number().min(0).max(100),
  permissions: z.array(z.string())
});

const createPermissionSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().min(1),
  description: z.string().optional(),
  module: z.string().min(1),
  action: z.string().min(1),
  resource: z.string().optional()
});

export async function permissionRoutes(fastify: FastifyInstance) {

  /**
   * 初始化权限系统
   * POST /api/permissions/initialize
   */
  fastify.post('/initialize', {
    preHandler: [authMiddleware, adminMiddleware, auditLog('INITIALIZE', 'permissions')],
    schema: {
      tags: ['permissions'],
      summary: '初始化权限系统',
      description: '初始化默认角色和权限',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await permissionManager.initializePermissions();

      return reply.send({
        success: true,
        message: 'Permission system initialized successfully'
      });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to initialize permissions',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 分配角色给用户
   * POST /api/permissions/assign-role
   */
  fastify.post('/assign-role', {
    preHandler: [authMiddleware, requirePermission('users.update'), auditLog('ASSIGN_ROLE', 'permissions')],
    schema: {
      tags: ['permissions'],
      summary: '分配角色',
      description: '为用户分配角色',
      body: {
        type: 'object',
        required: ['userId', 'roleName'],
        properties: {
          userId: { type: 'string' },
          roleName: { type: 'string' },
          tenantId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      const validation = assignRoleSchema.parse(body);

      await permissionManager.assignRole(
        validation.userId,
        validation.roleName,
        validation.tenantId
      );

      return reply.send({
        success: true,
        message: 'Role assigned successfully'
      });
    } catch (error) {
      return reply.status(400).send({
        error: 'Failed to assign role',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 检查用户权限
   * GET /api/permissions/check/:permission
   */
  fastify.get('/check/:permission', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['permissions'],
      summary: '检查权限',
      description: '检查当前用户是否有指定权限',
      params: {
        type: 'object',
        properties: {
          permission: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          tenantId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            hasPermission: { type: 'boolean' },
            permission: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as any;
      const query = request.query as any;
      const userId = (request.user as any).id;

      const hasPermission = await permissionManager.hasPermission(
        userId,
        params.permission,
        query.tenantId
      );

      return reply.send({
        hasPermission,
        permission: params.permission
      });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to check permission',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 获取用户权限
   * GET /api/permissions/user/:userId
   */
  fastify.get('/user/:userId', {
    preHandler: [authMiddleware, requirePermission('users.view')],
    schema: {
      tags: ['permissions'],
      summary: '获取用户权限',
      description: '获取指定用户的所有权限',
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          tenantId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            permissions: { type: 'array', items: { type: 'string' } },
            roles: { type: 'array' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as any;
      const query = request.query as any;

      const [permissions, roles] = await Promise.all([
        permissionManager.getUserPermissions(params.userId, query.tenantId),
        permissionManager.getUserRoles(params.userId, query.tenantId)
      ]);

      return reply.send({
        permissions,
        roles
      });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to get user permissions',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 获取当前用户权限
   * GET /api/permissions/my-permissions
   */
  fastify.get('/my-permissions', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['permissions'],
      summary: '获取我的权限',
      description: '获取当前用户的所有权限',
      querystring: {
        type: 'object',
        properties: {
          tenantId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            permissions: { type: 'array', items: { type: 'string' } },
            roles: { type: 'array' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const userId = (request.user as any).id;

      const [permissions, roles] = await Promise.all([
        permissionManager.getUserPermissions(userId, query.tenantId),
        permissionManager.getUserRoles(userId, query.tenantId)
      ]);

      return reply.send({
        permissions,
        roles
      });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to get permissions',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 获取所有角色
   * GET /api/permissions/roles
   */
  // 测试路由 - 完全简单版本
  fastify.get('/test', async (request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ message: 'Test endpoint works!' });
  });

  // 获取所有角色 - 临时测试版本，无认证
  fastify.get('/roles', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      console.log('Roles endpoint handler started');

      const roles = await prisma.role.findMany({
        where: { isActive: true },
        orderBy: { level: 'desc' }
      });

      console.log('Found roles:', roles.length);

      return reply.send({ roles });
    } catch (error) {
      console.error('Error in roles endpoint:', error);
      return reply.status(500).send({
        error: 'Failed to fetch roles',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 获取所有权限
   * GET /api/permissions/permissions
   */
  fastify.get('/permissions', {
    preHandler: [authMiddleware, requirePermission('users.view')],
    schema: {
      tags: ['permissions'],
      summary: '获取所有权限',
      description: '获取系统中的所有权限',
      response: {
        200: {
          type: 'object',
          properties: {
            permissions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  displayName: { type: 'string' },
                  description: { type: 'string' },
                  module: { type: 'string' },
                  action: { type: 'string' },
                  resource: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const permissions = await prisma.permission.findMany({
        where: { isActive: true },
        orderBy: [{ module: 'asc' }, { action: 'asc' }]
      });

      return reply.send({ permissions });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to fetch permissions',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 获取审计日志
   * GET /api/permissions/audit-logs
   */
  fastify.get('/audit-logs', {
    preHandler: [authMiddleware, requirePermission('system.config')],
    schema: {
      tags: ['permissions'],
      summary: '获取审计日志',
      description: '获取系统操作审计日志',
      querystring: {
        type: 'object',
        properties: {
          userId: { type: 'string' },
          tenantId: { type: 'string' },
          action: { type: 'string' },
          module: { type: 'string' },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;

      // 构建查询条件
      const whereClause: any = {};

      if (query.userId) whereClause.userId = query.userId;
      if (query.tenantId) whereClause.tenantId = query.tenantId;
      if (query.action) whereClause.action = query.action;
      if (query.module) whereClause.module = query.module;

      if (query.startDate || query.endDate) {
        whereClause.createdAt = {};
        if (query.startDate) whereClause.createdAt.gte = new Date(query.startDate);
        if (query.endDate) whereClause.createdAt.lte = new Date(query.endDate);
      }

      // 分页参数
      const page = query.page || 1;
      const limit = query.limit || 20;
      const skip = (page - 1) * limit;

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where: whereClause,
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true
              }
            },
            tenant: {
              select: {
                id: true,
                companyName: true
              }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        }),
        prisma.auditLog.count({ where: whereClause })
      ]);

      const totalPages = Math.ceil(total / limit);

      return reply.send({
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages
        }
      });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to fetch audit logs',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
