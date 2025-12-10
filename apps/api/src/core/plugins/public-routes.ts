/**
 * Public Plugin API Routes
 * 
 * 公开的插件 API，不需要认证
 * 用于 Shop 前端获取可用插件列表
 * 
 * Base path: /api/plugins
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface PluginListQuery {
  category?: string;
  type?: 'theme' | 'plugin';
  target?: 'shop' | 'admin';
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'rating' | 'installCount' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

interface PluginDetailParams {
  slug: string;
}

/**
 * 公开插件路由
 */
export async function publicPluginRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/plugins
   * 获取公开的插件列表（不需要认证）
   */
  fastify.get('/', {
    schema: {
      tags: ['Plugins - Public'],
      summary: 'Get Public Plugin List',
      description: 'Get list of available plugins and themes (no authentication required)',
      querystring: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Filter by category' },
          type: { type: 'string', enum: ['theme', 'plugin'], description: 'Filter by type' },
          target: { type: 'string', enum: ['shop', 'admin'], description: 'Filter by target (for themes)' },
          page: { type: 'integer', default: 1, minimum: 1 },
          limit: { type: 'integer', default: 20, minimum: 1, maximum: 100 },
          sortBy: { type: 'string', enum: ['name', 'rating', 'installCount', 'createdAt'], default: 'name' },
          sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: PluginListQuery }>, reply: FastifyReply) => {
    try {
      const { category, type, target, page = 1, limit = 20, sortBy = 'name', sortOrder = 'asc' } = request.query;

      // 构建查询条件
      const where: any = {
        status: 'ACTIVE',
      };

      if (category) {
        where.category = category;
      }

      if (type === 'theme') {
        where.category = 'theme';
        if (target) {
          // 通过 tags 过滤 target
          where.tags = { contains: `"target":"${target}"` };
        }
      } else if (type === 'plugin') {
        where.category = { not: 'theme' };
      }

      // 查询数据库
      const [plugins, total] = await Promise.all([
        fastify.prisma.plugin.findMany({
          where,
          orderBy: { [sortBy]: sortOrder },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            subscriptionPlans: {
              select: {
                amount: true,
              },
              take: 1,
            },
          },
        }),
        fastify.prisma.plugin.count({ where }),
      ]);

      // 转换数据
      const items = plugins.map((plugin) => {
        const tags = plugin.tags ? JSON.parse(plugin.tags) : {};
        // 从订阅计划推断商业模式
        const hasPlans = plugin.subscriptionPlans && plugin.subscriptionPlans.length > 0;
        const isFree = !hasPlans || plugin.subscriptionPlans.every((p) => p.amount === 0);
        return {
          id: plugin.id,
          slug: plugin.slug,
          name: plugin.name,
          description: plugin.description,
          category: plugin.category,
          version: plugin.version,
          icon: plugin.iconUrl,
          rating: plugin.rating,
          installCount: plugin.installCount,
          developer: plugin.developer,
          isFree,
          target: tags.target,
          style: tags.style,
          industries: tags.industries,
          featured: tags.featured === true,
        };
      });

      return reply.send({
        success: true,
        data: {
          items,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to get public plugin list');
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to retrieve plugins',
      });
    }
  });

  /**
   * GET /api/plugins/:slug
   * 获取插件详情（不需要认证）
   */
  fastify.get('/:slug', {
    schema: {
      tags: ['Plugins - Public'],
      summary: 'Get Plugin Details',
      description: 'Get detailed information about a specific plugin (no authentication required)',
      params: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'Plugin slug' },
        },
        required: ['slug'],
      },
    },
  }, async (request: FastifyRequest<{ Params: PluginDetailParams }>, reply: FastifyReply) => {
    try {
      const { slug } = request.params;

      const plugin = await fastify.prisma.plugin.findFirst({
        where: { slug, status: 'ACTIVE' },
        include: {
          subscriptionPlans: {
            select: {
              id: true,
              planId: true,
              name: true,
              amount: true,
              currency: true,
              billingCycle: true,
              features: true,
            },
          },
        },
      });

      if (!plugin) {
        return reply.status(404).send({
          success: false,
          error: 'Plugin not found',
        });
      }

      const tags = plugin.tags ? JSON.parse(plugin.tags) : {};
      const screenshots = plugin.screenshots ? JSON.parse(plugin.screenshots) : [];

      // 从订阅计划推断商业模式
      const hasPlans = plugin.subscriptionPlans && plugin.subscriptionPlans.length > 0;
      const isFree = !hasPlans || plugin.subscriptionPlans.every((p) => p.amount === 0);

      return reply.send({
        success: true,
        data: {
          id: plugin.id,
          slug: plugin.slug,
          name: plugin.name,
          description: plugin.description,
          longDescription: plugin.longDescription,
          category: plugin.category,
          version: plugin.version,
          icon: plugin.iconUrl,
          screenshots,
          rating: plugin.rating,
          installCount: plugin.installCount,
          developer: plugin.developer,
          isFree,
          plans: plugin.subscriptionPlans.map((p) => ({
            id: p.id,
            planId: p.planId,
            name: p.name,
            price: p.amount,
            currency: p.currency,
            interval: p.billingCycle,
            features: p.features ? JSON.parse(p.features) : [],
          })),
          target: tags.target,
          style: tags.style,
          industries: tags.industries,
          features: tags.features,
          demoUrl: tags.demoUrl,
          documentationUrl: tags.documentationUrl,
          supportUrl: tags.supportUrl,
          createdAt: plugin.createdAt,
          updatedAt: plugin.updatedAt,
        },
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to get plugin details');
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to retrieve plugin details',
      });
    }
  });
}

