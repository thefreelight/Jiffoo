import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { salesManager } from './sales-manager';
import { authMiddleware } from '@/core/auth/middleware';
import { z } from 'zod';

// 请求验证模式
const processSaleSchema = z.object({
  productType: z.enum(['plugin', 'saas-app', 'template']),
  productId: z.string().min(1),
  productName: z.string().min(1),
  licenseType: z.enum(['trial', 'monthly', 'yearly', 'lifetime']),
  channel: z.enum(['direct', 'oem-tenant']),
  tenantId: z.string().optional(),
  paymentMethod: z.string().optional(),
  paymentReference: z.string().optional()
});

export async function salesRoutes(fastify: FastifyInstance) {
  
  /**
   * 处理产品销售
   * POST /api/sales/process
   */
  fastify.post('/process', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['sales'],
      summary: '处理产品销售',
      description: '统一处理直销和OEM销售',
      body: {
        type: 'object',
        required: ['productType', 'productId', 'productName', 'licenseType', 'channel'],
        properties: {
          productType: { type: 'string', enum: ['plugin', 'saas-app', 'template'] },
          productId: { type: 'string' },
          productName: { type: 'string' },
          licenseType: { type: 'string', enum: ['trial', 'monthly', 'yearly', 'lifetime'] },
          channel: { type: 'string', enum: ['direct', 'oem-tenant'] },
          tenantId: { type: 'string' },
          paymentMethod: { type: 'string' },
          paymentReference: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            saleId: { type: 'string' },
            licenseKey: { type: 'string' },
            pricing: {
              type: 'object',
              properties: {
                sellingPrice: { type: 'number' },
                basePrice: { type: 'number' },
                marginAmount: { type: 'number' },
                jiffooRevenue: { type: 'number' },
                tenantRevenue: { type: 'number' }
              }
            },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      const validation = processSaleSchema.parse(body);
      const userId = (request.user as any).id;
      const userEmail = (request.user as any).email;

      // 验证OEM销售的租户ID
      if (validation.channel === 'oem-tenant' && !validation.tenantId) {
        return reply.status(400).send({
          error: 'Tenant ID required for OEM sales',
          message: 'tenantId is required when channel is oem-tenant'
        });
      }

      const result = await salesManager.processSale({
        productType: validation.productType,
        productId: validation.productId,
        productName: validation.productName,
        customerId: userId,
        customerEmail: userEmail,
        licenseType: validation.licenseType,
        channel: validation.channel,
        tenantId: validation.tenantId,
        paymentMethod: validation.paymentMethod,
        paymentReference: validation.paymentReference
      });

      if (!result.success) {
        return reply.status(400).send({
          error: 'Sale processing failed',
          message: result.error
        });
      }

      return reply.send({
        success: true,
        saleId: result.saleId,
        licenseKey: result.licenseKey,
        pricing: result.pricing,
        message: 'Sale processed successfully'
      });
    } catch (error) {
      return reply.status(400).send({
        error: 'Sale processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 获取销售记录
   * GET /api/sales
   */
  fastify.get('/', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['sales'],
      summary: '获取销售记录',
      description: '获取用户的销售记录',
      querystring: {
        type: 'object',
        properties: {
          channel: { type: 'string', enum: ['direct', 'oem-tenant'] },
          productType: { type: 'string', enum: ['plugin', 'saas-app', 'template'] },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            sales: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  productType: { type: 'string' },
                  productId: { type: 'string' },
                  productName: { type: 'string' },
                  channel: { type: 'string' },
                  sellingPrice: { type: 'number' },
                  licenseType: { type: 'string' },
                  paymentStatus: { type: 'string' },
                  saleDate: { type: 'string' }
                }
              }
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'number' },
                limit: { type: 'number' },
                total: { type: 'number' },
                totalPages: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const userId = (request.user as any).id;

      // 构建查询条件
      const whereClause: any = { customerId: userId };
      
      if (query.channel) {
        whereClause.channel = query.channel;
      }
      
      if (query.productType) {
        whereClause.productType = query.productType;
      }
      
      if (query.startDate || query.endDate) {
        whereClause.saleDate = {};
        if (query.startDate) whereClause.saleDate.gte = new Date(query.startDate);
        if (query.endDate) whereClause.saleDate.lte = new Date(query.endDate);
      }

      // 分页参数
      const page = query.page || 1;
      const limit = query.limit || 20;
      const skip = (page - 1) * limit;

      // 查询销售记录
      const [sales, total] = await Promise.all([
        fastify.prisma.sale.findMany({
          where: whereClause,
          select: {
            id: true,
            productType: true,
            productId: true,
            productName: true,
            channel: true,
            sellingPrice: true,
            currency: true,
            licenseType: true,
            paymentStatus: true,
            saleDate: true,
            tenant: {
              select: {
                id: true,
                companyName: true
              }
            }
          },
          orderBy: { saleDate: 'desc' },
          skip,
          take: limit
        }),
        fastify.prisma.sale.count({ where: whereClause })
      ]);

      const totalPages = Math.ceil(total / limit);

      return reply.send({
        sales,
        pagination: {
          page,
          limit,
          total,
          totalPages
        }
      });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to fetch sales',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 获取销售统计
   * GET /api/sales/stats
   */
  fastify.get('/stats', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['sales'],
      summary: '获取销售统计',
      description: '获取销售统计数据',
      querystring: {
        type: 'object',
        properties: {
          tenantId: { type: 'string' },
          startDate: { type: 'string' },
          endDate: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            stats: {
              type: 'object',
              properties: {
                totalSales: { type: 'number' },
                totalRevenue: { type: 'number' },
                salesByChannel: { type: 'array' },
                salesByProduct: { type: 'array' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      
      const startDate = query.startDate ? new Date(query.startDate) : undefined;
      const endDate = query.endDate ? new Date(query.endDate) : undefined;

      const stats = await salesManager.getSalesStats(query.tenantId, startDate, endDate);

      return reply.send({ stats });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to fetch sales stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 获取销售详情
   * GET /api/sales/:id
   */
  fastify.get('/:id', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['sales'],
      summary: '获取销售详情',
      description: '获取特定销售记录的详细信息',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            sale: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                productType: { type: 'string' },
                productId: { type: 'string' },
                productName: { type: 'string' },
                channel: { type: 'string' },
                sellingPrice: { type: 'number' },
                basePrice: { type: 'number' },
                marginAmount: { type: 'number' },
                jiffooRevenue: { type: 'number' },
                tenantRevenue: { type: 'number' },
                licenseType: { type: 'string' },
                licenseId: { type: 'string' },
                paymentStatus: { type: 'string' },
                saleDate: { type: 'string' },
                tenant: { type: 'object' },
                customer: { type: 'object' }
              }
            }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as any;
      const userId = (request.user as any).id;

      const sale = await fastify.prisma.sale.findFirst({
        where: {
          id: params.id,
          customerId: userId
        },
        include: {
          tenant: {
            select: {
              id: true,
              companyName: true,
              contactName: true,
              contactEmail: true
            }
          },
          customer: {
            select: {
              id: true,
              username: true,
              email: true
            }
          },
          revenueSharing: true
        }
      });

      if (!sale) {
        return reply.status(404).send({ error: 'Sale not found' });
      }

      return reply.send({ sale });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to fetch sale details',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
