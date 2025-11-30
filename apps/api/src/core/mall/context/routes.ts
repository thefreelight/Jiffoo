import { FastifyInstance } from 'fastify';
import { MallContextService } from './service';

/**
 * Mall Context Routes
 * Public API endpoint for getting tenant context information
 * No authentication required - used before user login/registration
 *
 * Supports three access modes:
 * 1. Tenant Mall: ?tenant=<id> or custom domain
 * 2. Agent Mall: ?agent=<code> or ?tenant=<id>&agent=<code> or agent custom domain
 * 3. Platform Mall: ?tenant=<id> (default tenant)
 */
export async function mallContextRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/mall/context
   * Get tenant/agent context information based on domain, tenant ID, or agent code
   *
   * Query Parameters (any one or combination):
   * - domain: Custom domain (e.g., nike.com or agent-shop.com)
   * - tenant: Tenant ID (e.g., 1, 2, 3)
   * - agent: Agent code (e.g., AG123456) - returns agent mall context
   */
  fastify.get('/context', {
    schema: {
      tags: ['mall'],
      summary: 'Get mall context',
      description: 'Get tenant/agent context information for mall frontend. Used before authentication to identify the tenant or agent mall.',
      querystring: {
        type: 'object',
        properties: {
          domain: {
            type: 'string',
            description: 'Custom domain (e.g., nike.com or agent-shop.com)'
          },
          tenant: {
            type: 'string',
            description: 'Tenant ID (numeric only, e.g., 1, 2, 3)'
          },
          agent: {
            type: 'string',
            description: 'Agent code (e.g., AG123456) - returns agent mall context'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                tenantId: { type: 'string' },
                tenantName: { type: 'string' },
                subdomain: { type: ['string', 'null'] },
                domain: { type: ['string', 'null'] },
                logo: { type: ['string', 'null'] },
                theme: { type: ['object', 'null'] },
                settings: { type: ['object', 'null'] },
                status: { type: 'string' },
                defaultLocale: { type: 'string' },
                supportedLocales: { type: 'array', items: { type: 'string' } },
                isAgentMall: { type: 'boolean' },
                agent: {
                  type: ['object', 'null'],
                  properties: {
                    agentId: { type: 'string' },
                    agentCode: { type: 'string' },
                    agentName: { type: 'string' },
                    agentLevel: { type: 'number' },
                    theme: { type: ['object', 'null'] },
                    settings: { type: ['object', 'null'] }
                  }
                }
              }
            },
            message: { type: 'string' }
          }
        },
        404: {
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
      const { domain, tenant, agent } = request.query as {
        domain?: string;
        tenant?: string;
        agent?: string;
      };

      // 🎯 情况1：没有任何参数 - 直接返回 Store not found，不再 fallback 到默认租户
      // 主域名必须通过 ?tenant=<id> 或 ?agent=<code> 访问，不提供任何默认值
      if (!domain && !tenant && !agent) {
        return reply.status(404).send({
          success: false,
          error: 'Store not found',
          message: 'No tenant identifier provided. Please use ?tenant=<id> or ?agent=<code> to specify a store.'
        });
      }

      const context = await MallContextService.getContext({
        domain,
        tenant,
        agent
      });

      // 🎯 情况2：找不到租户或代理 - 显示"Store not found"
      if (!context) {
        return reply.status(404).send({
          success: false,
          error: 'Store not found',
          message: agent ? 'Agent mall not found' : 'Store not found'
        });
      }

      return reply.send({
        success: true,
        data: context,
        message: context.isAgentMall
          ? 'Agent mall context retrieved successfully'
          : 'Mall context retrieved successfully'
      });
    } catch (error) {
      fastify.log.error('Error getting mall context:', error);
      return (reply as any).status(500).send({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}

