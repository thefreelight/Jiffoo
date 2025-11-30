import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware, tenantMiddleware } from '@/core/auth/middleware';
import { DomainSettingsService } from './service';
import { UpdateDomainSettingsSchema } from './types';

/**
 * 域名配置路由
 * 租户管理员可以配置自定义域名和子域名
 */
export async function domainSettingsRoutes(fastify: FastifyInstance) {
  /**
   * 获取当前租户的域名配置
   * GET /api/admin/domain-settings
   */
  fastify.get('/', {
    preHandler: [authMiddleware, tenantMiddleware],
    schema: {
      tags: ['admin-domain-settings'],
      summary: 'Get domain settings',
      description: 'Get current tenant domain and subdomain configuration',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                tenantId: { type: 'string' },
                companyName: { type: 'string' },
                domain: { type: ['string', 'null'] },
                subdomain: { type: ['string', 'null'] },
                domainStatus: { type: 'string', enum: ['not_configured', 'pending_dns', 'active'] },
                accessUrls: { type: 'object' },
                dnsInstructions: { type: 'object' },
              },
            },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tenantId = request.user!.tenantId;
      const result = await DomainSettingsService.getDomainSettings(tenantId);

      if (!result.success) {
        return reply.status(404).send(result);
      }

      return reply.send(result);
    } catch (error) {
      fastify.log.error({ err: error }, 'Get domain settings error');
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * 更新域名配置
   * PUT /api/admin/domain-settings
   */
  fastify.put('/', {
    preHandler: [authMiddleware, tenantMiddleware],
    schema: {
      tags: ['admin-domain-settings'],
      summary: 'Update domain settings',
      description: 'Update tenant domain and subdomain configuration',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          domain: { type: ['string', 'null'], description: 'Custom domain (e.g., nike.com)' },
          subdomain: { type: ['string', 'null'], description: 'Subdomain (e.g., nike)' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
            message: { type: 'string' },
          },
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // 验证请求数据
      const validatedData = UpdateDomainSettingsSchema.parse(request.body);
      const tenantId = request.user!.tenantId;

      // 更新域名配置
      const result = await DomainSettingsService.updateDomainSettings(tenantId, validatedData);

      if (!result.success) {
        return reply.status(400).send(result);
      }

      return reply.send({
        ...result,
        message: 'Domain settings updated successfully',
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return reply.status(400).send({
          success: false,
          error: 'Validation error',
          message: error.message,
        });
      }

      fastify.log.error({ err: error }, 'Update domain settings error');
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * 验证域名可用性
   * GET /api/admin/domain-settings/validate-domain
   */
  fastify.get('/validate-domain', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['admin-domain-settings'],
      summary: 'Validate domain availability',
      description: 'Check if a domain is available for use',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        required: ['domain'],
        properties: {
          domain: { type: 'string', description: 'Domain to validate' },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { domain } = request.query as { domain: string };
      const result = await DomainSettingsService.validateDomain(domain);
      return reply.send(result);
    } catch (error) {
      fastify.log.error({ err: error }, 'Validate domain error');
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * 验证子域名可用性
   * GET /api/admin/domain-settings/validate-subdomain
   */
  fastify.get('/validate-subdomain', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['admin-domain-settings'],
      summary: 'Validate subdomain availability',
      description: 'Check if a subdomain is available for use',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        required: ['subdomain'],
        properties: {
          subdomain: { type: 'string', description: 'Subdomain to validate' },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { subdomain } = request.query as { subdomain: string };
      const result = await DomainSettingsService.validateSubdomain(subdomain);
      return reply.send(result);
    } catch (error) {
      fastify.log.error({ err: error }, 'Validate subdomain error');
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * 检查域名DNS配置状态
   * GET /api/admin/domain-settings/check-status
   */
  fastify.get('/check-status', {
    preHandler: [authMiddleware, tenantMiddleware],
    schema: {
      tags: ['admin-domain-settings'],
      summary: 'Check domain DNS status',
      description: 'Check if domain DNS is properly configured',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        required: ['domain'],
        properties: {
          domain: { type: 'string', description: 'Domain to check' },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { domain } = request.query as { domain: string };
      const result = await DomainSettingsService.checkDomainStatus(domain);
      return reply.send(result);
    } catch (error) {
      fastify.log.error({ err: error }, 'Check domain status error');
      return reply.status(500).send({
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}

