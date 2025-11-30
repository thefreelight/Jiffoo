import { FastifyInstance, FastifyReply } from 'fastify';
import { AuthGatewayService } from './service';
import { tenantResolver } from '@/core/auth/middleware';

/**
 * Auth Gateway Routes
 * 
 * 统一认证网关路由，提供：
 * 1. GET /api/auth/available-methods - 获取可用认证方式
 */
export async function authGatewayRoutes(fastify: FastifyInstance) {
  /**
   * 获取可用的认证方式
   * 
   * 面向终端用户的端点，只返回完全可用的认证方式
   * 不返回任何额度信息
   * 
   * 注意：此端点不需要认证，因为用户在登录/注册前需要知道有哪些认证方式
   */
  fastify.get('/available-methods', {
    preHandler: [tenantResolver],
    schema: {
      tags: ['auth'],
      summary: 'Get available authentication methods',
      description: 'Get all available authentication methods for the current tenant (end-user facing, no auth required)',
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
                  pluginSlug: { type: 'string' },
                  name: { type: 'string' },
                  displayName: { type: 'string' },
                  icon: { type: 'string' },
                  type: { 
                    type: 'string',
                    enum: ['oauth', 'email', 'sms', 'passwordless']
                  },
                  capabilities: {
                    type: 'object',
                    properties: {
                      supportsRegistration: { type: 'boolean' },
                      supportsLogin: { type: 'boolean' },
                      supportsPasswordReset: { type: 'boolean' },
                      requiresVerification: { type: 'boolean' }
                    }
                  }
                }
              }
            }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request: any, reply: FastifyReply) => {
    try {
      const tenantId = request.tenant.id;

      const availableMethods = await AuthGatewayService.getAvailableAuthMethods(
        fastify,
        tenantId
      );

      return reply.send({
        success: true,
        data: availableMethods
      });
    } catch (error) {
      fastify.log.error({ err: error }, 'Failed to get available auth methods');
      return reply.status(500).send({
        success: false,
        error: 'Failed to get available auth methods'
      });
    }
  });
}

