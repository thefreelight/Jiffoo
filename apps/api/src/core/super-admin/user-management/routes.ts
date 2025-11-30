import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware, superAdminMiddleware } from '@/core/auth/middleware';
import { SuperAdminUserService } from './service';
import {
  UpdateUserSchema,
  UpdateUserRoleSchema,
  BatchUserOperationSchema,
  GetUsersRequest,
  UpdateUserRequest,
  UpdateUserRoleRequest,
  BatchUserOperationRequest
} from './types';

export async function superAdminUserRoutes(fastify: FastifyInstance) {
  // 应用中间件到所有路由
  fastify.addHook('preHandler', authMiddleware);
  fastify.addHook('preHandler', superAdminMiddleware);

  /**
   * 获取所有用户列表（超级管理员）- 跨租户
   */
  fastify.get('/', {
    schema: {
      hide: true,
      tags: ['super-admin-users'],
      summary: 'Get all users (super admin)',
      querystring: {
        type: 'object',
        additionalProperties: true
      },
      response: {
        200: {
          type: 'object',
          additionalProperties: true
        },
        500: {
          type: 'object',
          additionalProperties: true
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as GetUsersRequest;
      const result = await SuperAdminUserService.getAllUsers(query);

      reply.code(200).send(result);
    } catch (error) {
      console.error('Get all users error:', error);
      reply.code(500).send({
        success: false,
        message: 'Failed to get users',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 获取用户统计信息（超级管理员）- 跨租户统计
   */
  fastify.get('/stats', {
    schema: {
      hide: true,
      tags: ['super-admin-users'],
      summary: 'Get user statistics (super admin)',
      response: {
        200: {
          type: 'object',
          additionalProperties: true
        },
        500: {
          type: 'object',
          additionalProperties: true
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await SuperAdminUserService.getUserStats();
      reply.code(200).send(stats);
    } catch (error) {
      console.error('Get user stats error:', error);
      reply.code(500).send({
        success: false,
        message: 'Failed to get user statistics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 获取用户详情（超级管理员）
   */
  fastify.get('/:id', {
    schema: {
      hide: true,
      tags: ['super-admin-users'],
      summary: 'Get user by ID (super admin)',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          additionalProperties: true
        },
        404: {
          type: 'object',
          additionalProperties: true
        },
        500: {
          type: 'object',
          additionalProperties: true
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };
      const user = await SuperAdminUserService.getUserById(id);

      if (!user) {
        return reply.code(404).send({
          success: false,
          message: 'User not found'
        });
      }

      reply.code(200).send({
        success: true,
        data: user
      });
    } catch (error) {
      console.error('Get user by ID error:', error);
      reply.code(500).send({
        success: false,
        message: 'Failed to get user',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 更新用户信息（超级管理员）
   */
  fastify.put('/:id', {
    schema: {
      hide: true,
      tags: ['super-admin-users'],
      summary: 'Update user (super admin)',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        additionalProperties: true
      },
      response: {
        200: {
          type: 'object',
          additionalProperties: true
        },
        400: {
          type: 'object',
          additionalProperties: true
        },
        500: {
          type: 'object',
          additionalProperties: true
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };

      // 验证请求体
      const validationResult = UpdateUserSchema.safeParse(request.body);
      if (!validationResult.success) {
        return reply.code(400).send({
          success: false,
          message: 'Invalid request data',
          errors: validationResult.error.errors
        });
      }

      const updateData: UpdateUserRequest = validationResult.data;
      const updatedUser = await SuperAdminUserService.updateUser(id, updateData);

      reply.code(200).send({
        success: true,
        data: updatedUser,
        message: 'User updated successfully'
      });
    } catch (error) {
      console.error('Update user error:', error);
      reply.code(500).send({
        success: false,
        message: 'Failed to update user',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 更新用户角色（超级管理员）
   */
  fastify.patch('/:id/role', {
    schema: {
      hide: true,
      tags: ['super-admin-users'],
      summary: 'Update user role (super admin)',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        additionalProperties: true
      },
      response: {
        200: {
          type: 'object',
          additionalProperties: true
        },
        400: {
          type: 'object',
          additionalProperties: true
        },
        500: {
          type: 'object',
          additionalProperties: true
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };

      // 验证请求体
      const validationResult = UpdateUserRoleSchema.safeParse(request.body);
      if (!validationResult.success) {
        return reply.code(400).send({
          success: false,
          message: 'Invalid request data',
          errors: validationResult.error.errors
        });
      }

      const roleData: UpdateUserRoleRequest = validationResult.data;
      const updatedUser = await SuperAdminUserService.updateUserRole(id, roleData);

      reply.code(200).send({
        success: true,
        data: updatedUser,
        message: `User role updated to ${roleData.role}`
      });
    } catch (error) {
      console.error('Update user role error:', error);
      reply.code(500).send({
        success: false,
        message: 'Failed to update user role',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 批量操作用户（超级管理员）
   */
  fastify.post('/batch', {
    schema: {
      hide: true,
      tags: ['super-admin-users'],
      summary: 'Batch operate users (super admin)',
      body: {
        type: 'object',
        additionalProperties: true
      },
      response: {
        200: {
          type: 'object',
          additionalProperties: true
        },
        400: {
          type: 'object',
          additionalProperties: true
        },
        500: {
          type: 'object',
          additionalProperties: true
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // 验证请求体
      const validationResult = BatchUserOperationSchema.safeParse(request.body);
      if (!validationResult.success) {
        return reply.code(400).send({
          success: false,
          message: 'Invalid request data',
          errors: validationResult.error.errors
        });
      }

      const batchData: BatchUserOperationRequest = validationResult.data;
      const result = await SuperAdminUserService.batchOperation(batchData);

      reply.code(200).send(result);
    } catch (error) {
      console.error('Batch operation error:', error);
      reply.code(500).send({
        success: false,
        message: 'Failed to perform batch operation',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 删除用户（超级管理员）
   */
  fastify.delete('/:id', {
    schema: {
      hide: true,
      tags: ['super-admin-users'],
      summary: 'Delete user (super admin)',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          additionalProperties: true
        },
        400: {
          type: 'object',
          additionalProperties: true
        },
        500: {
          type: 'object',
          additionalProperties: true
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = request.params as { id: string };

      await SuperAdminUserService.deleteUser(id);

      reply.code(200).send({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      console.error('Delete user error:', error);

      if (error instanceof Error && error.message.includes('active orders')) {
        return reply.code(400).send({
          success: false,
          message: 'Cannot delete user with active orders'
        });
      }

      reply.code(500).send({
        success: false,
        message: 'Failed to delete user',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

}
