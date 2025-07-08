import { FastifyInstance } from 'fastify';
import { UserService } from './service';
import { UpdateUserSchema, UpdateUserRoleSchema } from './types';
import { authMiddleware, adminMiddleware } from '@/core/auth/middleware';

export async function userRoutes(fastify: FastifyInstance) {
  // Get all users (admin only)
  fastify.get('/', {
    preHandler: [authMiddleware, adminMiddleware]
  }, async (request, reply) => {
    try {
      const { page = 1, limit = 10, search } = request.query as any;
      const result = await UserService.getAllUsers(Number(page), Number(limit), search);
      
      // 返回与前端期望一致的数据格式
      return reply.send({
        success: true,
        data: result.users,
        pagination: result.pagination
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get user by ID
  fastify.get('/:id', {
    preHandler: [authMiddleware]
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      // Users can only view their own profile, admins can view any profile
      if (request.user!.role !== 'ADMIN' && request.user!.userId !== id) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'You can only view your own profile'
        });
      }

      const user = await UserService.getUserById(id);
      if (!user) {
        return reply.status(404).send({
          error: 'User not found'
        });
      }

      return reply.send({ user });
    } catch (error) {
      return reply.status(500).send({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Update user profile
  fastify.put('/:id', {
    preHandler: [authMiddleware]
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      // Users can only update their own profile, admins can update any profile
      if (request.user!.role !== 'ADMIN' && request.user!.userId !== id) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'You can only update your own profile'
        });
      }

      const user = await UserService.updateUser(id, request.body as any);
      return reply.send({ user });
    } catch (error) {
      return reply.status(400).send({
        error: 'Update failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Update user role (admin only)
  fastify.patch('/:id/role', {
    preHandler: [authMiddleware, adminMiddleware]
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = await UserService.updateUserRole(id, request.body as any);
      return reply.send({ user });
    } catch (error) {
      return reply.status(400).send({
        error: 'Role update failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Delete user (admin only)
  fastify.delete('/:id', {
    preHandler: [authMiddleware, adminMiddleware]
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await UserService.deleteUser(id);
      return reply.status(204).send();
    } catch (error) {
      return reply.status(400).send({
        error: 'Delete failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
