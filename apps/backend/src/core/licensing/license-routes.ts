import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { enhancedLicenseManager } from './enhanced-license-manager';
import { authMiddleware, adminMiddleware } from '@/core/auth/middleware';
import { z } from 'zod';

// 请求验证模式
const generateLicenseSchema = z.object({
  pluginName: z.string().min(1),
  licenseType: z.enum(['trial', 'monthly', 'yearly', 'lifetime']),
  features: z.array(z.string()),
  usageLimits: z.record(z.number()).optional(),
  durationDays: z.number().optional(),
});

const validateLicenseSchema = z.object({
  pluginName: z.string().min(1),
});

const trackUsageSchema = z.object({
  licenseId: z.string().min(1),
  featureName: z.string().min(1),
  incrementBy: z.number().min(1).optional(),
});

const renewLicenseSchema = z.object({
  durationDays: z.number().min(1),
});

export async function licenseRoutes(fastify: FastifyInstance) {

  /**
   * 生成新的插件许可证
   * POST /api/licenses/generate
   */
  fastify.post('/generate', {
    preHandler: [authMiddleware, adminMiddleware],
    schema: {
      tags: ['licenses'],
      summary: '生成插件许可证',
      description: '为用户生成新的插件许可证',
      body: {
        type: 'object',
        required: ['pluginName', 'licenseType', 'features'],
        properties: {
          pluginName: { type: 'string' },
          licenseType: { type: 'string', enum: ['trial', 'monthly', 'yearly', 'lifetime'] },
          features: { type: 'array', items: { type: 'string' } },
          usageLimits: { type: 'object' },
          durationDays: { type: 'number' },
          targetUserId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            licenseKey: { type: 'string' },
            expiresAt: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      const validation = generateLicenseSchema.parse(body);

      // 确定目标用户ID（管理员可以为其他用户生成许可证）
      const targetUserId = body.targetUserId || (request.user as any).id;

      // 计算过期时间
      let expiresAt: Date | undefined;
      if (validation.licenseType !== 'lifetime' && validation.durationDays) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + validation.durationDays);
      } else if (validation.licenseType === 'monthly') {
        expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      } else if (validation.licenseType === 'yearly') {
        expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      } else if (validation.licenseType === 'trial') {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + (validation.durationDays || 14));
      }

      const licenseKey = await enhancedLicenseManager.generateLicense({
        userId: targetUserId,
        pluginName: validation.pluginName,
        licenseType: validation.licenseType,
        features: validation.features,
        usageLimits: validation.usageLimits,
        expiresAt,
      });

      return reply.send({
        success: true,
        licenseKey,
        expiresAt: expiresAt?.toISOString(),
      });
    } catch (error) {
      return reply.status(400).send({
        error: 'Failed to generate license',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * 验证插件许可证
   * GET /api/licenses/validate
   */
  fastify.get('/validate', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['licenses'],
      summary: '验证插件许可证',
      description: '验证用户的插件许可证是否有效',
      querystring: {
        type: 'object',
        required: ['pluginName'],
        properties: {
          pluginName: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            valid: { type: 'boolean' },
            features: { type: 'array', items: { type: 'string' } },
            usageRemaining: { type: 'object' },
            expiresAt: { type: 'string' },
            reason: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const validation = validateLicenseSchema.parse(query);
      const userId = (request.user as any).id;

      const result = await enhancedLicenseManager.validateLicense(
        validation.pluginName,
        userId
      );

      return reply.send({
        valid: result.valid,
        features: result.features,
        usageRemaining: result.usageRemaining,
        expiresAt: result.expiresAt?.toISOString(),
        reason: result.reason,
      });
    } catch (error) {
      return reply.status(400).send({
        error: 'Failed to validate license',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * 跟踪功能使用情况
   * POST /api/licenses/track-usage
   */
  fastify.post('/track-usage', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['licenses'],
      summary: '跟踪功能使用',
      description: '记录插件功能的使用情况',
      body: {
        type: 'object',
        required: ['licenseId', 'featureName'],
        properties: {
          licenseId: { type: 'string' },
          featureName: { type: 'string' },
          incrementBy: { type: 'number', minimum: 1 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body = request.body as any;
      const validation = trackUsageSchema.parse(body);

      await enhancedLicenseManager.trackUsage({
        licenseId: validation.licenseId,
        featureName: validation.featureName,
        incrementBy: validation.incrementBy || 1,
      });

      return reply.send({
        success: true,
        message: 'Usage tracked successfully',
      });
    } catch (error) {
      return reply.status(400).send({
        error: 'Failed to track usage',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * 续费许可证
   * PUT /api/licenses/:id/renew
   */
  fastify.put('/:id/renew', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['licenses'],
      summary: '续费许可证',
      description: '延长许可证的有效期',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['durationDays'],
        properties: {
          durationDays: { type: 'number', minimum: 1 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            newExpiryDate: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as any;
      const body = request.body as any;
      const validation = renewLicenseSchema.parse(body);

      const newExpiryDate = new Date();
      newExpiryDate.setDate(newExpiryDate.getDate() + validation.durationDays);

      await enhancedLicenseManager.renewLicense(params.id, newExpiryDate);

      return reply.send({
        success: true,
        newExpiryDate: newExpiryDate.toISOString(),
      });
    } catch (error) {
      return reply.status(400).send({
        error: 'Failed to renew license',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * 撤销许可证
   * DELETE /api/licenses/:id
   */
  fastify.delete('/:id', {
    preHandler: [authMiddleware, adminMiddleware],
    schema: {
      tags: ['licenses'],
      summary: '撤销许可证',
      description: '撤销指定的许可证',
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
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as any;

      await enhancedLicenseManager.revokeLicense(params.id);

      return reply.send({
        success: true,
        message: 'License revoked successfully',
      });
    } catch (error) {
      return reply.status(400).send({
        error: 'Failed to revoke license',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * 获取用户的许可证列表
   * GET /api/licenses/my-licenses
   */
  fastify.get('/my-licenses', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['licenses'],
      summary: '获取我的许可证',
      description: '获取当前用户的所有许可证',
      response: {
        200: {
          type: 'object',
          properties: {
            licenses: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  pluginName: { type: 'string' },
                  licenseType: { type: 'string' },
                  status: { type: 'string' },
                  features: { type: 'array' },
                  expiresAt: { type: 'string' },
                  createdAt: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request.user as any).id;

      const licenses = await fastify.prisma.pluginLicense.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      const formattedLicenses = licenses.map(license => ({
        id: license.id,
        pluginName: license.pluginName,
        licenseType: license.licenseType,
        status: license.status,
        features: JSON.parse(license.features),
        expiresAt: license.expiresAt?.toISOString(),
        createdAt: license.createdAt.toISOString(),
      }));

      return reply.send({
        licenses: formattedLicenses,
      });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to fetch licenses',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
