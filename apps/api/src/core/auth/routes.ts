/**
 * Auth Routes
 * 
 * Simplified version, removed multi-tenant related logic.
 */

import { FastifyInstance } from 'fastify';
import { AuthService } from './service';
import { authMiddleware, requireAdmin } from './middleware';
import { prisma } from '@/config/database';
import { PasswordUtils } from '@/utils/password';

export async function authRoutes(fastify: FastifyInstance) {
  // Register
  fastify.post('/register', {
    schema: {
      tags: ['auth'],
      summary: 'Register new user',
      body: {
        type: 'object',
        required: ['email', 'username', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          username: { type: 'string', minLength: 3 },
          password: { type: 'string', minLength: 6 },
          referralCode: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { email, username, password } = request.body as any;
      const result = await AuthService.register({ email, username, password });
      return reply.code(201).send({
        success: true,
        data: result,
        message: 'Registration successful'
      });
    } catch (error: any) {
      return reply.code(400).send({
        success: false,
        error: error.message
      });
    }
  });

  // Login
  fastify.post('/login', {
    schema: {
      tags: ['auth'],
      summary: 'User login',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { email, password } = request.body as any;
      const result = await AuthService.login({ email, password });
      return reply.send({
        success: true,
        data: result
      });
    } catch (error: any) {
      return reply.code(401).send({
        success: false,
        error: error.message
      });
    }
  });

  // Get current user
  fastify.get('/me', {
    onRequest: [authMiddleware],
    schema: {
      tags: ['auth'],
      summary: 'Get current user info',
      security: [{ bearerAuth: [] }]
    }
  }, async (request, reply) => {
    try {
      const user = await AuthService.getCurrentUser(request.user!.id);
      return reply.send({
        success: true,
        data: user // Directly return UserProfile, no nesting
      });
    } catch (error: any) {
      return reply.code(401).send({
        success: false,
        error: error.message
      });
    }
  });

  // Refresh token
  fastify.post('/refresh', {
    // No authMiddleware needed, relying on refresh_token verification
    schema: {
      tags: ['auth'],
      summary: 'Refresh access token',
      body: {
        type: 'object',
        required: ['refresh_token'],
        properties: {
          refresh_token: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { refresh_token } = request.body as any;
      if (!refresh_token) {
        throw new Error('Refresh token is required');
      }
      const result = await AuthService.refreshSession(refresh_token);
      return reply.send({
        success: true,
        data: result
      });
    } catch (error: any) {
      return reply.code(401).send({
        success: false,
        error: error.message
      });
    }
  });

  // Logout (client-side token removal)
  fastify.post('/logout', {
    schema: {
      tags: ['auth'],
      summary: 'User logout'
    }
  }, async (_request, reply) => {
    return reply.send({
      success: true,
      message: 'Logged out successfully'
    });
  });

  // Change password
  fastify.post('/change-password', {
    onRequest: [authMiddleware],
    schema: {
      tags: ['auth'],
      summary: 'Change password',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string' },
          newPassword: { type: 'string', minLength: 6 }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { currentPassword, newPassword } = request.body as any;
      const user = await prisma.user.findUnique({
        where: { id: request.user!.id }
      });

      if (!user) {
        return reply.code(404).send({
          success: false,
          error: 'User not found'
        });
      }

      const isValid = await PasswordUtils.verify(currentPassword, user.password);
      if (!isValid) {
        return reply.code(400).send({
          success: false,
          error: 'Current password is incorrect'
        });
      }

      const hashedPassword = await PasswordUtils.hash(newPassword);
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword }
      });

      return reply.send({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error: any) {
      return reply.code(500).send({
        success: false,
        error: error.message
      });
    }
  });
}
