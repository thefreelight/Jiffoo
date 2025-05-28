import { FastifyInstance } from 'fastify';
import { AuthService } from './service';
import { LoginSchema, RegisterSchema } from './types';
import { authMiddleware } from './middleware';

export async function authRoutes(fastify: FastifyInstance) {
  // Register
  fastify.post('/register', async (request, reply) => {
    try {
      const result = await AuthService.register(request.body as any);
      return reply.status(201).send(result);
    } catch (error) {
      return reply.status(400).send({
        error: 'Registration failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Login
  fastify.post('/login', async (request, reply) => {
    try {
      const result = await AuthService.login(request.body as any);
      return reply.send(result);
    } catch (error) {
      return reply.status(401).send({
        error: 'Login failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get current user profile
  fastify.get('/me', {
    preHandler: [authMiddleware]
  }, async (request, reply) => {
    try {
      const user = await AuthService.getUserById(request.user!.userId);
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
}
