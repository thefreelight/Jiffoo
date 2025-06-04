import { FastifyInstance } from 'fastify';
import { PermissionService } from './service';
import { authMiddleware } from '@/core/auth/middleware';
import { requirePermission, superAdminMiddleware } from './middleware';
import { Resource, Action, UserRole } from './types';

export async function permissionRoutes(fastify: FastifyInstance) {
  // 获取用户权限列表
  fastify.get('/user/:userId', {
    preHandler: [authMiddleware, requirePermission(Resource.USER, Action.READ)],
    schema: {
      tags: ['permissions'],
      summary: '获取用户权限列表',
      description: '获取指定用户的所有权限',
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: '用户ID' }
        },
        required: ['userId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
            userRole: { type: 'string' },
            permissions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  resource: { type: 'string' },
                  action: { type: 'string' },
                  level: { type: 'integer' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { userId } = request.params as { userId: string };

      // 获取用户信息
      const { prisma } = await import('@/config/database');
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true }
      });

      if (!user) {
        return reply.status(404).send({
          error: 'User not found'
        });
      }

      const permissions = await PermissionService.getUserPermissions(userId, user.role as UserRole);

      return reply.send({
        userId,
        userRole: user.role,
        permissions
      });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to get user permissions',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 检查权限
  fastify.post('/check', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['permissions'],
      summary: '检查权限',
      description: '检查用户是否有执行特定操作的权限',
      body: {
        type: 'object',
        properties: {
          resource: { type: 'string', enum: Object.values(Resource) },
          action: { type: 'string', enum: Object.values(Action) },
          resourceId: { type: 'string' }
        },
        required: ['resource', 'action']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            allowed: { type: 'boolean' },
            reason: { type: 'string' },
            level: { type: 'integer' },
            source: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { resource, action, resourceId } = request.body as {
        resource: Resource;
        action: Action;
        resourceId?: string;
      };

      const result = await PermissionService.checkPermission({
        userId: user.id,
        userRole: user.role as UserRole,
        resource,
        action,
        resourceId
      });

      return reply.send(result);
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to check permission',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 批量权限检查
  fastify.post('/check-multiple', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['permissions'],
      summary: '批量权限检查',
      description: '批量检查多个权限',
      body: {
        type: 'object',
        properties: {
          checks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                resource: { type: 'string', enum: Object.values(Resource) },
                action: { type: 'string', enum: Object.values(Action) },
                resourceId: { type: 'string' }
              },
              required: ['resource', 'action']
            }
          }
        },
        required: ['checks']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  allowed: { type: 'boolean' },
                  reason: { type: 'string' },
                  level: { type: 'integer' },
                  source: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const user = (request as any).user;
      const { checks } = request.body as {
        checks: Array<{
          resource: Resource;
          action: Action;
          resourceId?: string;
        }>;
      };

      // 获取用户的主要角色（从JWT token或roles数组中）
      const userRole = user.role ||
                      (user.roles && user.roles.length > 0 ? user.roles[0].role?.name : null) ||
                      'USER';

      const contexts = checks.map(check => ({
        userId: user.id || user.userId,
        userRole: userRole as UserRole,
        resource: check.resource,
        action: check.action,
        resourceId: check.resourceId
      }));

      const results = await PermissionService.checkMultiplePermissions(contexts);

      return reply.send({ results });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to check permissions',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 清除用户权限缓存 (超级管理员)
  fastify.delete('/cache/:userId', {
    preHandler: [authMiddleware, superAdminMiddleware],
    schema: {
      tags: ['permissions'],
      summary: '清除用户权限缓存',
      description: '清除指定用户的权限缓存',
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: '用户ID' }
        },
        required: ['userId']
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
  }, async (request, reply) => {
    try {
      const { userId } = request.params as { userId: string };

      await PermissionService.clearUserPermissionCache(userId);

      return reply.send({
        success: true,
        message: `Permission cache cleared for user ${userId}`
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 获取权限统计 (超级管理员)
  fastify.get('/stats', {
    preHandler: [authMiddleware, superAdminMiddleware],
    schema: {
      tags: ['permissions'],
      summary: '获取权限统计',
      description: '获取权限系统的统计信息',
      response: {
        200: {
          type: 'object',
          properties: {
            totalChecks: { type: 'integer' },
            allowedChecks: { type: 'integer' },
            deniedChecks: { type: 'integer' },
            cacheHitRate: { type: 'number' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const stats = await PermissionService.getPermissionStats();
      return reply.send(stats);
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to get permission stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 获取角色权限配置 (超级管理员)
  fastify.get('/roles', {
    preHandler: [authMiddleware, superAdminMiddleware],
    schema: {
      tags: ['permissions'],
      summary: '获取角色权限配置',
      description: '获取所有角色的权限配置',
      response: {
        200: {
          type: 'object',
          properties: {
            roles: {
              type: 'object',
              additionalProperties: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    resource: { type: 'string' },
                    action: { type: 'string' },
                    level: { type: 'integer' }
                  }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { DEFAULT_ROLE_PERMISSIONS } = await import('./types');

      return reply.send({
        roles: DEFAULT_ROLE_PERMISSIONS
      });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to get role permissions',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
