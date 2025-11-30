import { FastifyInstance } from 'fastify';
import { UserManagementService } from './service';
import { UpdateUserSchema, UpdateUserRoleSchema } from './types';
import { authMiddleware, adminMiddleware, tenantMiddleware } from '@/core/auth/middleware';
import { withTenantContext } from '@/core/database/tenant-middleware';

/**
 * 管理员用户管理路由
 * 路径前缀: /api/admin/users
 * 权限要求: 租户管理员及以上
 */
export async function adminUserManagementRoutes(fastify: FastifyInstance) {

  /**
   * 获取用户统计信息
   * GET /api/admin/users/stats
   */
  fastify.get('/stats', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      tags: ['admin-users'],
      summary: 'Get User Statistics',
      description: 'Get user statistics within tenant',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                totalUsers: { type: 'integer' },
                activeUsers: { type: 'integer' },
                roleDistribution: {
                  type: 'object',
                  additionalProperties: { type: 'integer' }
                }
              }
            }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const stats = await withTenantContext(
        request.user!.tenantId,
        request.user!.id,
        () => UserManagementService.getUserStats(request.user!.tenantId.toString())
      );

      return reply.send({
        success: true,
        data: stats
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch user statistics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 获取所有用户列表
   * GET /api/admin/users
   */
  fastify.get('/', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      tags: ['admin-users'],
      summary: 'Get User List',
      description: 'Get all users within tenant with search and pagination support',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
          search: { type: 'string', description: 'Search username or email' },
          role: { type: 'string', enum: ['USER', 'TENANT_ADMIN'], description: 'Filter by role' }
          // status: { type: 'string', enum: ['active', 'inactive'], description: 'Filter by status' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  username: { type: 'string' },
                  avatar: { type: 'string' },
                  role: { type: 'string' },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                  lastLoginAt: { type: 'string' }
                }
              }
            },
            pagination: {
              type: 'object',
              properties: {
                total: { type: 'integer' },
                page: { type: 'integer' },
                limit: { type: 'integer' },
                totalPages: { type: 'integer' }
              }
            }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { page = 1, limit = 10, search, role, status } = request.query as any;
      const result = await withTenantContext(
        request.user!.tenantId,
        request.user!.id,
        () => UserManagementService.getAllUsers({
          page: Number(page),
          limit: Number(limit),
          search,
          role,
          status,
          tenantId: request.user!.tenantId.toString()
        })
      );

      return reply.send({
        success: true,
        data: result.users,
        pagination: result.pagination
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch users',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 获取用户详情
   * GET /api/admin/users/:id
   */
  fastify.get('/:id', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      tags: ['admin-users'],
      summary: 'Get User Details',
      description: 'Get detailed information of specified user',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = await withTenantContext(
        request.user!.tenantId,
        request.user!.id,
        () => UserManagementService.getUserById(id, request.user!.tenantId.toString())
      );

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: 'User not found'
        });
      }

      return reply.send({
        success: true,
        data: user
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch user',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 更新用户信息
   * PUT /api/admin/users/:id
   */
  fastify.put('/:id', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      tags: ['admin-users'],
      summary: 'Update User Information',
      description: 'Update basic information of specified user',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          username: { type: 'string', minLength: 3, maxLength: 50 },
          avatar: { type: 'string' }
          // status: { type: 'string', enum: ['active', 'inactive'] }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const updateData = UpdateUserSchema.parse(request.body);

      const user = await withTenantContext(
        request.user!.tenantId,
        request.user!.id,
        () => UserManagementService.updateUser(
          id,
          updateData,
          request.user!.tenantId.toString()
        )
      );

      return reply.send({
        success: true,
        data: user,
        message: 'User updated successfully'
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: 'Failed to update user',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 更新用户角色
   * PATCH /api/admin/users/:id/role
   */
  fastify.patch('/:id/role', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      tags: ['admin-users'],
      summary: 'Update User Role',
      description: 'Update role permissions of specified user',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['role'],
        properties: {
          role: { type: 'string', enum: ['USER', 'TENANT_ADMIN'] }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const roleData = UpdateUserRoleSchema.parse(request.body);

      const user = await withTenantContext(
        request.user!.tenantId,
        request.user!.id,
        () => UserManagementService.updateUserRole(
          id,
          roleData,
          request.user!.tenantId.toString()
        )
      );

      return reply.send({
        success: true,
        data: user,
        message: 'User role updated successfully'
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: 'Failed to update user role',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 删除用户
   * DELETE /api/admin/users/:id
   */
  fastify.delete('/:id', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      tags: ['admin-users'],
      summary: 'Delete User',
      description: 'Delete specified user (soft delete)',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      // 防止管理员删除自己
      if (id === request.user!.userId) {
        return reply.status(400).send({
          success: false,
          error: 'Cannot delete yourself'
        });
      }

      await withTenantContext(
        request.user!.tenantId,
        request.user!.id,
        () => UserManagementService.deleteUser(id, request.user!.tenantId.toString())
      );

      return reply.status(204).send();
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: 'Failed to delete user',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 批量操作用户
   * POST /api/admin/users/batch
   */
  fastify.post('/batch', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      tags: ['admin-users'],
      summary: 'Batch User Operations',
      description: 'Batch update user status or roles',
      body: {
        type: 'object',
        required: ['action', 'userIds'],
        properties: {
          action: { type: 'string', enum: ['activate', 'deactivate', 'delete', 'updateRole'] },
          userIds: { type: 'array', items: { type: 'string' } },
          role: { type: 'string', enum: ['USER', 'TENANT_ADMIN'] }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { action, userIds, role } = request.body as any;

      const result = await withTenantContext(
        request.user!.tenantId,
        request.user!.id,
        () => UserManagementService.batchUpdateUsers({
          action,
          userIds,
          role,
          tenantId: request.user!.tenantId.toString(),
          operatorId: request.user!.userId
        })
      );

      return reply.send({
        success: true,
        data: result,
        message: `Batch ${action} completed successfully`
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: 'Batch operation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
