import { FastifyInstance } from 'fastify';
import { AuthService } from './service';
import { LoginSchema, RegisterSchema } from './types';
import { authMiddleware } from './middleware';

export async function authRoutes(fastify: FastifyInstance) {
  // Register
  fastify.post('/register', async (request, reply) => {
    try {
      // 验证请求数据
      const validatedData = RegisterSchema.parse(request.body);
      const result = await AuthService.register(validatedData);
      return reply.status(201).send({
        success: true,
        data: result,
        message: 'Registration successful'
      });
    } catch (error) {
      // 如果是 Zod 验证错误
      if (error instanceof Error && error.name === 'ZodError') {
        return reply.status(400).send({
          success: false,
          error: 'Validation failed',
          message: 'Invalid request data',
          details: (error as any).errors
        });
      }
      
      return reply.status(400).send({
        success: false,
        error: 'Registration failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Login
  fastify.post('/login', async (request, reply) => {
    try {
      // 添加调试日志
      fastify.log.info('Login request received:', JSON.stringify(request.body));
      
      // 验证请求数据
      const validatedData = LoginSchema.parse(request.body);
      fastify.log.info('Validated login data:', JSON.stringify(validatedData));
      
      const result = await AuthService.login(validatedData);
      return reply.send({
        success: true,
        data: result,
        message: 'Login successful'
      });
    } catch (error) {
      // 添加错误日志
      fastify.log.error('Login error:', error);
      
      // 如果是 Zod 验证错误
      if (error instanceof Error && error.name === 'ZodError') {
        return reply.status(400).send({
          success: false,
          error: 'Validation failed',
          message: 'Invalid request data',
          details: (error as any).errors
        });
      }
      
      return reply.status(401).send({
        success: false,
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
          success: false,
          error: 'User not found'
        });
      }
      return reply.send({
        success: true,
        data: { user },
        message: 'User profile retrieved successfully'
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
