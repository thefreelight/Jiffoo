import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { pluginStoreManager } from './plugin-store-manager';
import { authMiddleware } from '@/core/auth/middleware';
import { z } from 'zod';

// 请求验证模式
const searchPluginsSchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(50).default(20),
  sort: z.enum(['name', 'rating', 'downloads', 'updated']).default('rating')
});

const purchasePluginSchema = z.object({
  pluginId: z.string().min(1),
  licenseType: z.enum(['trial', 'monthly', 'yearly', 'lifetime']),
  paymentMethodId: z.string().optional()
});

export async function pluginStoreRoutes(fastify: FastifyInstance) {

  /**
   * 获取所有插件
   * GET /api/plugin-store/plugins
   */
  fastify.get('/plugins', {
    schema: {
      tags: ['plugin-store'],
      summary: '获取插件列表',
      description: '获取插件商店中的所有可用插件',
      querystring: {
        type: 'object',
        properties: {
          q: { type: 'string', description: '搜索关键词' },
          category: { type: 'string', description: '插件分类' },
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 50, default: 20 },
          sort: { type: 'string', enum: ['name', 'rating', 'downloads', 'updated'], default: 'rating' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            plugins: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  displayName: { type: 'string' },
                  version: { type: 'string' },
                  description: { type: 'string' },
                  category: { type: 'string' },
                  tags: { type: 'array', items: { type: 'string' } },
                  pricing: { type: 'object' },
                  features: { type: 'array', items: { type: 'string' } },
                  media: { type: 'object' },
                  stats: { type: 'object' },
                  status: { type: 'string' }
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
      const validation = searchPluginsSchema.parse(query);

      let plugins = await pluginStoreManager.searchPlugins(validation.q, validation.category);

      // 排序
      switch (validation.sort) {
        case 'name':
          plugins.sort((a, b) => a.displayName.localeCompare(b.displayName));
          break;
        case 'rating':
          plugins.sort((a, b) => b.stats.rating - a.stats.rating);
          break;
        case 'downloads':
          plugins.sort((a, b) => b.stats.downloads - a.stats.downloads);
          break;
        case 'updated':
          plugins.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
          break;
      }

      // 分页
      const total = plugins.length;
      const totalPages = Math.ceil(total / validation.limit);
      const startIndex = (validation.page - 1) * validation.limit;
      const endIndex = startIndex + validation.limit;
      const paginatedPlugins = plugins.slice(startIndex, endIndex);

      return reply.send({
        plugins: paginatedPlugins,
        pagination: {
          page: validation.page,
          limit: validation.limit,
          total,
          totalPages
        }
      });
    } catch (error) {
      return reply.status(400).send({
        error: 'Failed to fetch plugins',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 获取单个插件详情
   * GET /api/plugin-store/plugins/:id
   */
  fastify.get('/plugins/:id', {
    schema: {
      tags: ['plugin-store'],
      summary: '获取插件详情',
      description: '获取指定插件的详细信息',
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
            plugin: { type: 'object' },
            userLicense: { type: 'object' }
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
      const plugin = await pluginStoreManager.getPluginById(params.id);

      if (!plugin) {
        return reply.status(404).send({ error: 'Plugin not found' });
      }

      // 如果用户已登录，检查是否已有许可证
      let userLicense = null;
      if (request.user) {
        const userId = (request.user as any).id;
        const userPlugins = await pluginStoreManager.getUserPlugins(userId);
        const userPlugin = userPlugins.find(p => p.id === params.id);
        userLicense = userPlugin?.license || null;
      }

      return reply.send({
        plugin,
        userLicense
      });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to fetch plugin details',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 获取插件分类
   * GET /api/plugin-store/categories
   */
  fastify.get('/categories', {
    schema: {
      tags: ['plugin-store'],
      summary: '获取插件分类',
      description: '获取所有可用的插件分类',
      response: {
        200: {
          type: 'object',
          properties: {
            categories: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const categories = await pluginStoreManager.getCategories();
      return reply.send({ categories });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to fetch categories',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 购买插件
   * POST /api/plugin-store/purchase
   */
  fastify.post('/purchase', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['plugin-store'],
      summary: '购买插件',
      description: '购买或试用插件',
      body: {
        type: 'object',
        required: ['pluginId', 'licenseType'],
        properties: {
          pluginId: { type: 'string' },
          licenseType: { type: 'string', enum: ['trial', 'monthly', 'yearly', 'lifetime'] },
          paymentMethodId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            licenseKey: { type: 'string' },
            paymentIntentId: { type: 'string' },
            trialEndsAt: { type: 'string' },
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
      const validation = purchasePluginSchema.parse(body);
      const userId = (request.user as any).id;

      const result = await pluginStoreManager.purchasePlugin({
        userId,
        pluginId: validation.pluginId,
        licenseType: validation.licenseType,
        paymentMethodId: validation.paymentMethodId
      });

      if (!result.success) {
        return reply.status(400).send({
          error: 'Purchase failed',
          message: result.error
        });
      }

      // 更新插件统计
      await pluginStoreManager.updatePluginStats(validation.pluginId, 'install');

      return reply.send({
        success: true,
        licenseKey: result.licenseKey,
        paymentIntentId: result.paymentIntentId,
        trialEndsAt: result.trialEndsAt?.toISOString(),
        message: validation.licenseType === 'trial' ? 'Trial started successfully' : 'Plugin purchased successfully'
      });
    } catch (error) {
      return reply.status(400).send({
        error: 'Purchase failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 获取用户已购买的插件
   * GET /api/plugin-store/my-plugins
   */
  fastify.get('/my-plugins', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['plugin-store'],
      summary: '获取我的插件',
      description: '获取当前用户已购买的所有插件',
      response: {
        200: {
          type: 'object',
          properties: {
            plugins: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  displayName: { type: 'string' },
                  version: { type: 'string' },
                  license: { type: 'object' },
                  status: { type: 'string' }
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
      const userPlugins = await pluginStoreManager.getUserPlugins(userId);

      return reply.send({
        plugins: userPlugins
      });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to fetch user plugins',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 下载插件
   * GET /api/plugin-store/download/:id
   */
  fastify.get('/download/:id', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['plugin-store'],
      summary: '下载插件',
      description: '下载已购买的插件文件',
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

      // 验证用户是否有权限下载此插件
      const userPlugins = await pluginStoreManager.getUserPlugins(userId);
      const hasAccess = userPlugins.some(p => p.id === params.id);

      if (!hasAccess) {
        return reply.status(403).send({
          error: 'Access denied',
          message: 'You do not have a valid license for this plugin'
        });
      }

      // 更新下载统计
      await pluginStoreManager.updatePluginStats(params.id, 'download');

      // 实际实现中，这里应该返回插件文件
      // 暂时返回下载链接
      return reply.send({
        downloadUrl: `/api/plugin-store/files/${params.id}/latest.zip`,
        expiresAt: new Date(Date.now() + 3600000).toISOString() // 1小时后过期
      });
    } catch (error) {
      return reply.status(500).send({
        error: 'Download failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 获取热门插件
   * GET /api/plugin-store/featured
   */
  fastify.get('/featured', {
    schema: {
      tags: ['plugin-store'],
      summary: '获取热门插件',
      description: '获取推荐的热门插件',
      response: {
        200: {
          type: 'object',
          properties: {
            featured: {
              type: 'array',
              items: { type: 'object' }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const allPlugins = await pluginStoreManager.getAllPlugins();

      // 按评分和下载量排序，取前6个
      const featured = allPlugins
        .filter(p => p.status === 'active')
        .sort((a, b) => {
          const scoreA = a.stats.rating * 0.7 + (a.stats.downloads / 1000) * 0.3;
          const scoreB = b.stats.rating * 0.7 + (b.stats.downloads / 1000) * 0.3;
          return scoreB - scoreA;
        })
        .slice(0, 6);

      return reply.send({ featured });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to fetch featured plugins',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
