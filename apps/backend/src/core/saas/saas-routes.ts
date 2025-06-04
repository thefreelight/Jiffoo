import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { saasManager } from './saas-manager';
import { authMiddleware } from '@/core/auth/middleware';
import { z } from 'zod';

// 请求验证模式
const createInstanceSchema = z.object({
  instanceName: z.string().min(1).max(50),
  subdomain: z.string().min(3).max(30).regex(/^[a-z0-9-]+$/),
  planId: z.string().min(1),
  region: z.string().optional(),
  customDomain: z.string().optional()
});

const recordMetricsSchema = z.object({
  metrics: z.array(z.object({
    type: z.string(),
    value: z.number(),
    unit: z.string()
  }))
});

export async function saasRoutes(fastify: FastifyInstance) {
  
  /**
   * 获取所有SaaS计划
   * GET /api/saas/plans
   */
  fastify.get('/plans', {
    schema: {
      tags: ['saas'],
      summary: '获取SaaS计划',
      description: '获取所有可用的SaaS托管计划',
      response: {
        200: {
          type: 'object',
          properties: {
            plans: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  displayName: { type: 'string' },
                  description: { type: 'string' },
                  price: { type: 'number' },
                  currency: { type: 'string' },
                  billing: { type: 'string' },
                  features: { type: 'array', items: { type: 'string' } },
                  limits: { type: 'object' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const plans = await saasManager.getAllPlans();
      return reply.send({ plans });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to fetch SaaS plans',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 创建SaaS实例
   * POST /api/saas/instances
   */
  fastify.post('/instances', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['saas'],
      summary: '创建SaaS实例',
      description: '为用户创建新的SaaS实例',
      body: {
        type: 'object',
        required: ['instanceName', 'subdomain', 'planId'],
        properties: {
          instanceName: { type: 'string', minLength: 1, maxLength: 50 },
          subdomain: { type: 'string', minLength: 3, maxLength: 30, pattern: '^[a-z0-9-]+$' },
          planId: { type: 'string' },
          region: { type: 'string' },
          customDomain: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            instanceId: { type: 'string' },
            subdomain: { type: 'string' },
            accessUrl: { type: 'string' },
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
      const validation = createInstanceSchema.parse(body);
      const userId = (request.user as any).id;

      const result = await saasManager.createInstance({
        userId,
        instanceName: validation.instanceName,
        subdomain: validation.subdomain,
        planId: validation.planId,
        region: validation.region,
        customDomain: validation.customDomain
      });

      if (!result.success) {
        return reply.status(400).send({
          error: 'Failed to create instance',
          message: result.error
        });
      }

      return reply.send({
        success: true,
        instanceId: result.instanceId,
        subdomain: result.subdomain,
        accessUrl: result.accessUrl,
        message: 'SaaS instance created successfully'
      });
    } catch (error) {
      return reply.status(400).send({
        error: 'Failed to create instance',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 获取用户的SaaS实例
   * GET /api/saas/my-instances
   */
  fastify.get('/my-instances', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['saas'],
      summary: '获取我的SaaS实例',
      description: '获取当前用户的所有SaaS实例',
      response: {
        200: {
          type: 'object',
          properties: {
            instances: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  instanceName: { type: 'string' },
                  subdomain: { type: 'string' },
                  customDomain: { type: 'string' },
                  status: { type: 'string' },
                  accessUrl: { type: 'string' },
                  plan: { type: 'object' },
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
      const instances = await saasManager.getUserInstances(userId);

      return reply.send({ instances });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to fetch instances',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 获取实例详情
   * GET /api/saas/instances/:id
   */
  fastify.get('/instances/:id', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['saas'],
      summary: '获取实例详情',
      description: '获取指定SaaS实例的详细信息',
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
      const userId = (request.user as any).id;

      const instance = await fastify.prisma.saasInstance.findFirst({
        where: {
          id: params.id,
          userId
        },
        include: {
          plan: true,
          backups: {
            orderBy: { createdAt: 'desc' },
            take: 5
          }
        }
      });

      if (!instance) {
        return reply.status(404).send({ error: 'Instance not found' });
      }

      // 获取最近的指标
      const metrics = await saasManager.getInstanceMetrics(params.id, undefined, 24);

      return reply.send({
        instance: {
          id: instance.id,
          instanceName: instance.instanceName,
          subdomain: instance.subdomain,
          customDomain: instance.customDomain,
          status: instance.status,
          region: instance.region,
          version: instance.version,
          settings: JSON.parse(instance.settings),
          resources: JSON.parse(instance.resources),
          accessUrl: instance.customDomain 
            ? `https://${instance.customDomain}`
            : `https://${instance.subdomain}.jiffoo.app`,
          plan: instance.plan,
          backups: instance.backups,
          metrics,
          createdAt: instance.createdAt,
          updatedAt: instance.updatedAt
        }
      });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to fetch instance details',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 记录实例指标
   * POST /api/saas/instances/:id/metrics
   */
  fastify.post('/instances/:id/metrics', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['saas'],
      summary: '记录实例指标',
      description: '记录SaaS实例的性能指标',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['metrics'],
        properties: {
          metrics: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string' },
                value: { type: 'number' },
                unit: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const params = request.params as any;
      const body = request.body as any;
      const validation = recordMetricsSchema.parse(body);
      const userId = (request.user as any).id;

      // 验证实例所有权
      const instance = await fastify.prisma.saasInstance.findFirst({
        where: {
          id: params.id,
          userId
        }
      });

      if (!instance) {
        return reply.status(404).send({ error: 'Instance not found' });
      }

      await saasManager.recordMetrics(params.id, validation.metrics);

      return reply.send({
        success: true,
        message: 'Metrics recorded successfully'
      });
    } catch (error) {
      return reply.status(400).send({
        error: 'Failed to record metrics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 创建实例备份
   * POST /api/saas/instances/:id/backup
   */
  fastify.post('/instances/:id/backup', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['saas'],
      summary: '创建实例备份',
      description: '为SaaS实例创建手动备份',
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
      const userId = (request.user as any).id;

      // 验证实例所有权
      const instance = await fastify.prisma.saasInstance.findFirst({
        where: {
          id: params.id,
          userId
        }
      });

      if (!instance) {
        return reply.status(404).send({ error: 'Instance not found' });
      }

      const backupId = await saasManager.createBackup(params.id, 'manual');

      return reply.send({
        success: true,
        backupId,
        message: 'Backup created successfully'
      });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to create backup',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 暂停实例
   * POST /api/saas/instances/:id/suspend
   */
  fastify.post('/instances/:id/suspend', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['saas'],
      summary: '暂停实例',
      description: '暂停SaaS实例运行',
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
      const userId = (request.user as any).id;

      // 验证实例所有权
      const instance = await fastify.prisma.saasInstance.findFirst({
        where: {
          id: params.id,
          userId
        }
      });

      if (!instance) {
        return reply.status(404).send({ error: 'Instance not found' });
      }

      const success = await saasManager.suspendInstance(params.id);

      if (!success) {
        return reply.status(500).send({ error: 'Failed to suspend instance' });
      }

      return reply.send({
        success: true,
        message: 'Instance suspended successfully'
      });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to suspend instance',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 恢复实例
   * POST /api/saas/instances/:id/resume
   */
  fastify.post('/instances/:id/resume', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['saas'],
      summary: '恢复实例',
      description: '恢复已暂停的SaaS实例',
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
      const userId = (request.user as any).id;

      // 验证实例所有权
      const instance = await fastify.prisma.saasInstance.findFirst({
        where: {
          id: params.id,
          userId
        }
      });

      if (!instance) {
        return reply.status(404).send({ error: 'Instance not found' });
      }

      const success = await saasManager.resumeInstance(params.id);

      if (!success) {
        return reply.status(500).send({ error: 'Failed to resume instance' });
      }

      return reply.send({
        success: true,
        message: 'Instance resumed successfully'
      });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to resume instance',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 删除实例
   * DELETE /api/saas/instances/:id
   */
  fastify.delete('/instances/:id', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['saas'],
      summary: '删除实例',
      description: '永久删除SaaS实例',
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
      const userId = (request.user as any).id;

      // 验证实例所有权
      const instance = await fastify.prisma.saasInstance.findFirst({
        where: {
          id: params.id,
          userId
        }
      });

      if (!instance) {
        return reply.status(404).send({ error: 'Instance not found' });
      }

      const success = await saasManager.deleteInstance(params.id);

      if (!success) {
        return reply.status(500).send({ error: 'Failed to delete instance' });
      }

      return reply.send({
        success: true,
        message: 'Instance deleted successfully'
      });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to delete instance',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
