import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { tenantManager } from './tenant-manager';
import { salesManager } from '@/core/sales/sales-manager';
import { authMiddleware, adminMiddleware } from '@/core/auth/middleware';
import { z } from 'zod';

// 请求验证模式
const registerTenantSchema = z.object({
  companyName: z.string().min(1),
  contactName: z.string().min(1),
  contactEmail: z.string().email(),
  contactPhone: z.string().optional(),
  agencyLevel: z.enum(['basic', 'industry', 'global']),
  domain: z.string().optional(),
  subdomain: z.string().optional(),
  branding: z.object({
    logo: z.string().optional(),
    primaryColor: z.string().optional(),
    secondaryColor: z.string().optional(),
    companyName: z.string().optional(),
    website: z.string().optional(),
    supportEmail: z.string().email().optional(),
    supportPhone: z.string().optional()
  }).optional()
});

const setPriceControlSchema = z.object({
  productType: z.enum(['plugin', 'saas-app', 'template']),
  productId: z.string().min(1),
  productName: z.string().min(1),
  basePrice: z.number().min(0),
  currency: z.string().default('USD'),
  minMargin: z.number().min(0).default(0),
  maxDiscount: z.number().min(0).default(0)
});

const setTenantPricingSchema = z.object({
  priceControlId: z.string().min(1),
  sellingPrice: z.number().min(0)
});

const grantLicenseSchema = z.object({
  productType: z.enum(['plugin', 'saas-app', 'template']),
  productId: z.string().min(1),
  licenseType: z.enum(['oem', 'reseller', 'distributor']),
  authorizedFeatures: z.array(z.string()),
  brandingRights: z.boolean().default(false),
  resaleRights: z.boolean().default(false),
  maxUsers: z.number().optional(),
  maxInstances: z.number().optional(),
  expiresAt: z.string().optional()
});

export async function tenantRoutes(fastify: FastifyInstance) {
  
  /**
   * 注册新租户
   * POST /api/tenants/register
   */
  fastify.post('/register', {
    schema: {
      tags: ['tenants'],
      summary: '注册租户',
      description: '注册新的OEM租户',
      body: {
        type: 'object',
        required: ['companyName', 'contactName', 'contactEmail', 'agencyLevel'],
        properties: {
          companyName: { type: 'string' },
          contactName: { type: 'string' },
          contactEmail: { type: 'string', format: 'email' },
          contactPhone: { type: 'string' },
          agencyLevel: { type: 'string', enum: ['basic', 'industry', 'global'] },
          domain: { type: 'string' },
          subdomain: { type: 'string' },
          branding: { type: 'object' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            tenantId: { type: 'string' },
            agencyFee: { type: 'number' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      const validation = registerTenantSchema.parse(body);

      const result = await tenantManager.registerTenant(validation);

      if (!result.success) {
        return reply.status(400).send({
          error: 'Registration failed',
          message: result.error
        });
      }

      return reply.send({
        success: true,
        tenantId: result.tenantId,
        agencyFee: result.agencyFee,
        message: 'Tenant registered successfully. Please pay the agency fee to activate.'
      });
    } catch (error) {
      return reply.status(400).send({
        error: 'Registration failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 激活租户
   * POST /api/tenants/:id/activate
   */
  fastify.post('/:id/activate', {
    preHandler: [authMiddleware, adminMiddleware],
    schema: {
      tags: ['tenants'],
      summary: '激活租户',
      description: '激活已付费的租户',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          paymentReference: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as any;
      const body = request.body as any;

      const success = await tenantManager.activateTenant(params.id, body.paymentReference);

      if (!success) {
        return reply.status(400).send({
          error: 'Activation failed',
          message: 'Failed to activate tenant'
        });
      }

      return reply.send({
        success: true,
        message: 'Tenant activated successfully'
      });
    } catch (error) {
      return reply.status(500).send({
        error: 'Activation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 设置产品价格控制
   * POST /api/tenants/price-controls
   */
  fastify.post('/price-controls', {
    preHandler: [authMiddleware, adminMiddleware],
    schema: {
      tags: ['tenants'],
      summary: '设置价格控制',
      description: '设置产品的底价和加价规则',
      body: {
        type: 'object',
        required: ['productType', 'productId', 'productName', 'basePrice'],
        properties: {
          productType: { type: 'string', enum: ['plugin', 'saas-app', 'template'] },
          productId: { type: 'string' },
          productName: { type: 'string' },
          basePrice: { type: 'number', minimum: 0 },
          currency: { type: 'string', default: 'USD' },
          minMargin: { type: 'number', minimum: 0, default: 0 },
          maxDiscount: { type: 'number', minimum: 0, default: 0 }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      const validation = setPriceControlSchema.parse(body);

      const priceControlId = await tenantManager.setPriceControl(validation);

      return reply.send({
        success: true,
        priceControlId,
        message: 'Price control set successfully'
      });
    } catch (error) {
      return reply.status(400).send({
        error: 'Failed to set price control',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 设置租户定价
   * POST /api/tenants/:id/pricing
   */
  fastify.post('/:id/pricing', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['tenants'],
      summary: '设置租户定价',
      description: '租户设置自己的销售价格',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['priceControlId', 'sellingPrice'],
        properties: {
          priceControlId: { type: 'string' },
          sellingPrice: { type: 'number', minimum: 0 }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as any;
      const body = request.body as any;
      const validation = setTenantPricingSchema.parse(body);

      const result = await tenantManager.setTenantPricing({
        tenantId: params.id,
        priceControlId: validation.priceControlId,
        sellingPrice: validation.sellingPrice
      });

      if (!result.success) {
        return reply.status(400).send({
          error: 'Failed to set pricing',
          message: result.error
        });
      }

      return reply.send({
        success: true,
        pricingId: result.pricingId,
        message: 'Pricing set successfully'
      });
    } catch (error) {
      return reply.status(400).send({
        error: 'Failed to set pricing',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 授权租户产品
   * POST /api/tenants/:id/licenses
   */
  fastify.post('/:id/licenses', {
    preHandler: [authMiddleware, adminMiddleware],
    schema: {
      tags: ['tenants'],
      summary: '授权租户产品',
      description: '为租户授权特定产品的销售权限',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['productType', 'productId', 'licenseType', 'authorizedFeatures'],
        properties: {
          productType: { type: 'string', enum: ['plugin', 'saas-app', 'template'] },
          productId: { type: 'string' },
          licenseType: { type: 'string', enum: ['oem', 'reseller', 'distributor'] },
          authorizedFeatures: { type: 'array', items: { type: 'string' } },
          brandingRights: { type: 'boolean', default: false },
          resaleRights: { type: 'boolean', default: false },
          maxUsers: { type: 'number' },
          maxInstances: { type: 'number' },
          expiresAt: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as any;
      const body = request.body as any;
      const validation = grantLicenseSchema.parse(body);

      const licenseId = await tenantManager.grantTenantLicense(
        params.id,
        validation.productType,
        validation.productId,
        {
          licenseType: validation.licenseType,
          authorizedFeatures: validation.authorizedFeatures,
          brandingRights: validation.brandingRights,
          resaleRights: validation.resaleRights,
          maxUsers: validation.maxUsers,
          maxInstances: validation.maxInstances,
          expiresAt: validation.expiresAt ? new Date(validation.expiresAt) : undefined
        }
      );

      return reply.send({
        success: true,
        licenseId,
        message: 'License granted successfully'
      });
    } catch (error) {
      return reply.status(400).send({
        error: 'Failed to grant license',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 获取租户信息
   * GET /api/tenants/:id
   */
  fastify.get('/:id', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['tenants'],
      summary: '获取租户信息',
      description: '获取租户的详细信息',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as any;
      const tenant = await tenantManager.getTenant(params.id);

      if (!tenant) {
        return reply.status(404).send({ error: 'Tenant not found' });
      }

      return reply.send({ tenant });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to fetch tenant',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 获取租户定价
   * GET /api/tenants/:id/pricing
   */
  fastify.get('/:id/pricing', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['tenants'],
      summary: '获取租户定价',
      description: '获取租户的产品定价信息',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          productType: { type: 'string', enum: ['plugin', 'saas-app', 'template'] }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as any;
      const query = request.query as any;

      const pricing = await tenantManager.getTenantPricing(params.id, query.productType);

      return reply.send({ pricing });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to fetch pricing',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 获取销售统计
   * GET /api/tenants/:id/sales-stats
   */
  fastify.get('/:id/sales-stats', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['tenants'],
      summary: '获取销售统计',
      description: '获取租户的销售统计数据',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string' },
          endDate: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as any;
      const query = request.query as any;

      const startDate = query.startDate ? new Date(query.startDate) : undefined;
      const endDate = query.endDate ? new Date(query.endDate) : undefined;

      const stats = await salesManager.getSalesStats(params.id, startDate, endDate);

      return reply.send({ stats });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to fetch sales stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
