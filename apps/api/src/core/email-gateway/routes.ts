/**
 * Email Gateway Routes
 *
 * 统一邮件网关的路由定义
 */

import { FastifyInstance } from 'fastify';
import { authMiddleware, tenantMiddleware } from '@/core/auth/middleware';
import { EmailGatewayService } from './service';

export async function emailGatewayRoutes(fastify: FastifyInstance) {
  /**
   * 获取可用的邮件提供商
   */
  fastify.get('/available-providers', {
    preHandler: [authMiddleware, tenantMiddleware],
    schema: {
      tags: ['emails'],
      summary: 'Get available email providers',
      description: 'Get list of available email providers for the tenant',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            providers: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  pluginSlug: { type: 'string' },
                  name: { type: 'string' },
                  displayName: { type: 'string' },
                  icon: { type: 'string' },
                  current: { type: 'number' },
                  limit: { type: 'number' },
                  percentage: { type: 'number' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request: any) => {
    const providers = await EmailGatewayService.getAvailableProviders(
      fastify,
      request.tenant.id
    );
    
    return {
      success: true,
      providers
    };
  });

  /**
   * 发送邮件（统一入口）
   */
  fastify.post('/send', {
    preHandler: [authMiddleware, tenantMiddleware],
    schema: {
      tags: ['emails'],
      summary: 'Send email',
      description: 'Send email through unified email gateway',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['to', 'subject'],
        properties: {
          to: { 
            oneOf: [
              { type: 'string' },
              { type: 'array', items: { type: 'string' } }
            ]
          },
          from: { type: 'string' },
          fromName: { type: 'string' },
          subject: { type: 'string' },
          html: { type: 'string' },
          text: { type: 'string' },
          replyTo: { type: 'string' },
          cc: { type: 'array', items: { type: 'string' } },
          bcc: { type: 'array', items: { type: 'string' } },
          provider: { type: 'string' },
          templateSlug: { type: 'string' },
          templateVariables: { type: 'object' },
          tags: { type: 'array', items: { type: 'string' } },
          metadata: { type: 'object' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            messageId: { type: 'string' },
            provider: { type: 'string' }
          }
        }
      }
    }
  }, async (request: any, reply: any) => {
    try {
      const result = await EmailGatewayService.sendEmail(
        fastify,
        request.tenant.id,
        request.body
      );
      
      return result;
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Email gateway error');
      return reply.status(500).send({
        success: false,
        error: error.message
      });
    }
  });

  /**
   * 获取邮件日志
   */
  fastify.get('/logs', {
    preHandler: [authMiddleware, tenantMiddleware],
    schema: {
      tags: ['emails'],
      summary: 'Get email logs',
      description: 'Get email sending logs for the tenant',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', default: 1 },
          limit: { type: 'integer', default: 20 },
          status: { type: 'string' },
          provider: { type: 'string' }
        }
      }
    }
  }, async (request: any) => {
    const { page = 1, limit = 20, status, provider } = request.query;
    
    const where: any = {
      tenantId: request.tenant.id
    };
    
    if (status) where.status = status;
    if (provider) where.provider = provider;
    
    const [logs, total] = await Promise.all([
      fastify.prisma.emailLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          provider: true,
          messageId: true,
          to: true,
          from: true,
          subject: true,
          status: true,
          sentAt: true,
          deliveredAt: true,
          openedAt: true,
          clickedAt: true,
          openCount: true,
          clickCount: true,
          errorMessage: true,
          createdAt: true
        }
      }),
      fastify.prisma.emailLog.count({ where })
    ]);
    
    return {
      success: true,
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  });

  /**
   * 获取邮件日志详情
   */
  fastify.get('/logs/:id', {
    preHandler: [authMiddleware, tenantMiddleware],
    schema: {
      tags: ['emails'],
      summary: 'Get email log details',
      description: 'Get detailed information about a specific email',
      security: [{ bearerAuth: [] }]
    }
  }, async (request: any, reply: any) => {
    const { id } = request.params;
    
    const log = await fastify.prisma.emailLog.findFirst({
      where: {
        id,
        tenantId: request.tenant.id
      }
    });
    
    if (!log) {
      return reply.status(404).send({
        success: false,
        error: 'Email log not found'
      });
    }
    
    return {
      success: true,
      data: log
    };
  });

  /**
   * 获取邮件统计
   */
  fastify.get('/stats', {
    preHandler: [authMiddleware, tenantMiddleware],
    schema: {
      tags: ['emails'],
      summary: 'Get email statistics',
      description: 'Get email sending statistics for the tenant',
      security: [{ bearerAuth: [] }]
    }
  }, async (request: any) => {
    const tenantId = request.tenant.id;
    
    // 获取各状态的邮件数量
    const statusCounts = await fastify.prisma.emailLog.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: true
    });
    
    // 获取各提供商的邮件数量
    const providerCounts = await fastify.prisma.emailLog.groupBy({
      by: ['provider'],
      where: { tenantId },
      _count: true
    });
    
    // 获取总打开率和点击率
    const totalEmails = await fastify.prisma.emailLog.count({
      where: { tenantId, status: { in: ['sent', 'delivered', 'opened', 'clicked'] } }
    });
    
    const openedEmails = await fastify.prisma.emailLog.count({
      where: { tenantId, status: { in: ['opened', 'clicked'] } }
    });
    
    const clickedEmails = await fastify.prisma.emailLog.count({
      where: { tenantId, status: 'clicked' }
    });
    
    return {
      success: true,
      stats: {
        total: totalEmails,
        byStatus: statusCounts.reduce((acc, item) => {
          acc[item.status] = item._count;
          return acc;
        }, {} as Record<string, number>),
        byProvider: providerCounts.reduce((acc, item) => {
          acc[item.provider] = item._count;
          return acc;
        }, {} as Record<string, number>),
        openRate: totalEmails > 0 ? (openedEmails / totalEmails * 100).toFixed(2) : '0.00',
        clickRate: totalEmails > 0 ? (clickedEmails / totalEmails * 100).toFixed(2) : '0.00'
      }
    };
  });
}
