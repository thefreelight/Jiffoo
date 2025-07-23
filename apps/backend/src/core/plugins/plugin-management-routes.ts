import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '@/core/auth/middleware';
import { paymentManager } from '@/core/payment/payment-manager';
import { PluginStatus, UnifiedPlugin } from '@/../../plugins/core/types';
import { z } from 'zod';

// 请求验证模式
const pluginIdSchema = z.object({
  pluginId: z.string().min(1, 'Plugin ID is required')
});

const installPluginSchema = z.object({
  config: z.record(z.any()).optional(),
  licenseKey: z.string().optional(),
  tenantId: z.string().optional()
});

const configurePluginSchema = z.object({
  config: z.record(z.any())
});

/**
 * 统一插件管理路由
 *
 * 这个文件包含所有插件生命周期管理的API端点：
 * - 插件列表查询
 * - 插件安装/激活/停用/卸载
 * - 插件配置管理
 * - 插件状态查询
 */
export async function pluginManagementRoutes(fastify: FastifyInstance) {
  // 获取统一插件管理器实例
  const getUnifiedManager = () => {
    try {
      const manager = paymentManager.getUnifiedPluginManager();
      if (!manager) {
        throw new Error('Plugin system not initialized. Please ensure the payment manager is properly initialized.');
      }
      return manager;
    } catch (error) {
      throw new Error('Plugin system not initialized. Please ensure the payment manager is properly initialized.');
    }
  };

  /**
   * 获取已安装插件列表
   * GET /api/plugins
   */
  fastify.get('/', {
    preHandler: [authMiddleware],
    schema: {
      summary: '获取已安装插件列表',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                plugins: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                      version: { type: 'string' },
                      status: { type: 'string' },
                      type: { type: 'string' }
                    }
                  }
                },
                total: { type: 'number' },
                active: { type: 'number' },
                inactive: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const unifiedManager = getUnifiedManager();

      // 获取所有插件
      const installedPlugins = await unifiedManager.getPlugins();
      const activePlugins = unifiedManager.getActivePlugins();

      // 转换为API响应格式
      const pluginsData = installedPlugins.map((plugin: UnifiedPlugin) => ({
        id: plugin.metadata.id,
        name: plugin.metadata.name,
        displayName: plugin.metadata.displayName,
        version: plugin.metadata.version,
        description: plugin.metadata.description,
        author: plugin.metadata.author,
        type: plugin.metadata.type,
        status: activePlugins.some((ap: UnifiedPlugin) => ap.metadata.id === plugin.metadata.id) ? 'ACTIVE' : 'INACTIVE',
        category: plugin.metadata.category,
        icon: plugin.metadata.icon
      }));

      return reply.send({
        success: true,
        data: {
          plugins: pluginsData,
          total: installedPlugins.length,
          active: activePlugins.length,
          inactive: installedPlugins.length - activePlugins.length
        }
      });
    } catch (error) {
      fastify.log.error('Failed to get installed plugins:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get installed plugins',
        message: (error as Error).message || 'Unknown error'
      });
    }
  });

  /**
   * 获取可安装插件列表
   * GET /api/plugins/available
   */
  fastify.get('/available', {
    preHandler: [authMiddleware],
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                plugins: { type: 'array' },
                total: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const unifiedManager = getUnifiedManager();

      // 获取可用插件（从插件注册表）
      const availablePlugins = unifiedManager.getAvailablePlugins();

      // 获取已安装插件用于状态对比
      const installedPlugins = await unifiedManager.getPlugins();
      const activePlugins = unifiedManager.getActivePlugins();

      // 合并状态信息
      const pluginsWithStatus = availablePlugins.map((plugin: UnifiedPlugin) => {
        const isInstalled = installedPlugins.some((ip: UnifiedPlugin) => ip.metadata.id === plugin.metadata.id);
        const isActive = activePlugins.some((ap: UnifiedPlugin) => ap.metadata.id === plugin.metadata.id);

        return {
          id: plugin.metadata.id,
          name: plugin.metadata.name,
          displayName: plugin.metadata.displayName,
          version: plugin.metadata.version,
          description: plugin.metadata.description,
          author: plugin.metadata.author,
          type: plugin.metadata.type,
          category: plugin.metadata.category,
          icon: plugin.metadata.icon,
          license: plugin.metadata.license,
          pricing: plugin.metadata.pricing,
          installed: isInstalled,
          active: isActive,
          status: isActive ? 'ACTIVE' : (isInstalled ? 'INACTIVE' : 'NOT_INSTALLED')
        };
      });

      return reply.send({
        success: true,
        data: {
          plugins: pluginsWithStatus,
          total: availablePlugins.length
        }
      });
    } catch (error) {
      fastify.log.error('Failed to get available plugins:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get available plugins',
        message: (error as Error).message || 'Unknown error'
      });
    }
  });

  /**
   * 获取单个插件详情
   * GET /api/plugins/:pluginId
   */
  fastify.get('/:pluginId', {
    preHandler: [authMiddleware]
  }, async (request: any, reply: FastifyReply) => {
    try {
      const { pluginId } = request.params;
      const unifiedManager = getUnifiedManager();

      // 获取插件详情
      const plugin = await unifiedManager.getPlugin(pluginId);

      if (!plugin) {
        return reply.status(404).send({
          success: false,
          error: 'Plugin not found',
          message: `Plugin ${pluginId} is not installed`
        });
      }

      // 获取插件健康状态
      const healthCheck = await unifiedManager.checkPluginHealth(pluginId);

      return reply.send({
        success: true,
        data: {
          plugin: {
            id: plugin.metadata.id,
            name: plugin.metadata.name,
            displayName: plugin.metadata.displayName,
            version: plugin.metadata.version,
            description: plugin.metadata.description,
            longDescription: plugin.metadata.longDescription,
            author: plugin.metadata.author,
            homepage: plugin.metadata.homepage,
            repository: plugin.metadata.repository,
            keywords: plugin.metadata.keywords,
            category: plugin.metadata.category,
            type: plugin.metadata.type,
            icon: plugin.metadata.icon,
            screenshots: plugin.metadata.screenshots,
            license: plugin.metadata.license,
            pricing: plugin.metadata.pricing,
            dependencies: plugin.metadata.dependencies,
            peerDependencies: plugin.metadata.peerDependencies,
            conflicts: plugin.metadata.conflicts,
            minCoreVersion: plugin.metadata.minCoreVersion,
            maxCoreVersion: plugin.metadata.maxCoreVersion,
            supportedPlatforms: plugin.metadata.supportedPlatforms
          },
          health: healthCheck
        }
      });
    } catch (error) {
      fastify.log.error(`Failed to get plugin ${(request.params as any).pluginId}:`, error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get plugin details',
        message: (error as Error).message || 'Unknown error'
      });
    }
  });

  /**
   * 获取插件状态和数据库实例
   * GET /api/plugins/:pluginId/status
   */
  fastify.get('/:pluginId/status', {
    preHandler: [authMiddleware]
  }, async (request: any, reply: FastifyReply) => {
    try {
      const { pluginId } = request.params;
      const unifiedManager = getUnifiedManager();

      // 获取插件状态
      const pluginStatus = await unifiedManager.getPluginStatus(pluginId);

      // 获取插件数据库实例（如果有）
      const dbInstance = await unifiedManager.getPluginDatabaseInstance(pluginId);

      return reply.send({
        success: true,
        data: {
          status: pluginStatus,
          database: dbInstance ? {
            connected: true,
            type: 'postgresql', // 假设使用PostgreSQL
            tables: [] // 可以扩展以显示表信息
          } : null
        }
      });
    } catch (error) {
      fastify.log.error(`Failed to get plugin status ${(request.params as any).pluginId}:`, error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get plugin status',
        message: (error as Error).message || 'Unknown error'
      });
    }
  });

  /**
   * 安装插件
   * POST /api/plugins/:pluginId/install
   */
  fastify.post('/:pluginId/install', {
    preHandler: [authMiddleware]
  }, async (request: any, reply: FastifyReply) => {
    try {
      const { pluginId } = request.params;
      const { config, licenseKey, tenantId } = request.body;
      const unifiedManager = getUnifiedManager();

      // 安装插件
      const result = await unifiedManager.installPlugin(pluginId, {
        config,
        licenseKey,
        tenantId,
        autoActivate: true // 默认自动激活
      });

      return reply.send({
        success: true,
        message: `Plugin ${pluginId} installed successfully`,
        data: result
      });
    } catch (error) {
      console.error(`Failed to install plugin ${(request.params as any).pluginId}:`, error);
      return reply.status(500).send({
        success: false,
        error: 'Plugin installation failed',
        message: (error as Error).message,
        stack: (error as Error).stack,
        name: (error as Error).name
      });
    }
  });

  /**
   * 激活插件
   * POST /api/plugins/:pluginId/activate
   */
  fastify.post('/:pluginId/activate', {
    preHandler: [authMiddleware]
  }, async (request: any, reply: FastifyReply) => {
    try {
      const { pluginId } = request.params;
      const { config } = request.body;
      const unifiedManager = getUnifiedManager();

      // 检查插件是否存在
      const plugin = await unifiedManager.getPlugin(pluginId);
      if (!plugin) {
        return reply.status(404).send({
          success: false,
          error: 'Plugin not found',
          message: `Plugin ${pluginId} is not installed`
        });
      }

      // 更新配置（如果提供）
      if (config && Object.keys(config).length > 0) {
        await unifiedManager.updatePluginConfig(pluginId, config);
      }

      // 激活插件
      await unifiedManager.activatePlugin(pluginId);

      return reply.send({
        success: true,
        message: `Plugin ${pluginId} activated successfully`
      });
    } catch (error) {
      fastify.log.error(`Failed to activate plugin ${(request.params as any).pluginId}:`, error);
      return reply.status(500).send({
        success: false,
        error: 'Plugin activation failed',
        message: (error as Error).message || 'Unknown error'
      });
    }
  });

  /**
   * 停用插件
   * POST /api/plugins/:pluginId/deactivate
   */
  fastify.post('/:pluginId/deactivate', {
    preHandler: [authMiddleware]
  }, async (request: any, reply: FastifyReply) => {
    try {
      const { pluginId } = request.params;
      const unifiedManager = getUnifiedManager();

      // 检查插件是否存在
      const plugin = await unifiedManager.getPlugin(pluginId);
      if (!plugin) {
        return reply.status(404).send({
          success: false,
          error: 'Plugin not found',
          message: `Plugin ${pluginId} is not installed`
        });
      }

      // 停用插件
      await unifiedManager.deactivatePlugin(pluginId);

      return reply.send({
        success: true,
        message: `Plugin ${pluginId} deactivated successfully`
      });
    } catch (error) {
      fastify.log.error(`Failed to deactivate plugin ${(request.params as any).pluginId}:`, error);
      return reply.status(500).send({
        success: false,
        error: 'Plugin deactivation failed',
        message: (error as Error).message || 'Unknown error'
      });
    }
  });

  /**
   * 卸载插件
   * DELETE /api/plugins/:pluginId
   */
  fastify.delete('/:pluginId', {
    preHandler: [authMiddleware]
  }, async (request: any, reply: FastifyReply) => {
    try {
      const { pluginId } = request.params;
      const unifiedManager = getUnifiedManager();

      // 检查插件是否存在
      const plugin = await unifiedManager.getPlugin(pluginId);
      if (!plugin) {
        return reply.status(404).send({
          success: false,
          error: 'Plugin not found',
          message: `Plugin ${pluginId} is not installed`
        });
      }

      // 卸载插件
      await unifiedManager.uninstallPlugin(pluginId);

      return reply.send({
        success: true,
        message: `Plugin ${pluginId} uninstalled successfully`
      });
    } catch (error) {
      fastify.log.error(`Failed to uninstall plugin ${(request.params as any).pluginId}:`, error);
      return reply.status(500).send({
        success: false,
        error: 'Plugin uninstallation failed',
        message: (error as Error).message || 'Unknown error'
      });
    }
  });

  /**
   * 获取插件配置
   * GET /api/plugins/:pluginId/config
   */
  fastify.get('/:pluginId/config', {
    preHandler: [authMiddleware]
  }, async (request: any, reply: FastifyReply) => {
    try {
      const { pluginId } = request.params;
      const unifiedManager = getUnifiedManager();

      // 检查插件是否存在
      const plugin = await unifiedManager.getPlugin(pluginId);
      if (!plugin) {
        return reply.status(404).send({
          success: false,
          error: 'Plugin not found',
          message: `Plugin ${pluginId} is not installed`
        });
      }

      // 获取插件配置
      const config = await unifiedManager.getPluginConfig(pluginId);
      const configSchema = plugin.getConfigSchema();

      return reply.send({
        success: true,
        data: {
          config,
          schema: configSchema,
          defaultConfig: plugin.getDefaultConfig()
        }
      });
    } catch (error) {
      fastify.log.error(`Failed to get plugin config ${(request.params as any).pluginId}:`, error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get plugin configuration',
        message: (error as Error).message || 'Unknown error'
      });
    }
  });

  /**
   * 更新插件配置
   * PUT /api/plugins/:pluginId/config
   */
  fastify.put('/:pluginId/config', {
    preHandler: [authMiddleware]
  }, async (request: any, reply: FastifyReply) => {
    try {
      const { pluginId } = request.params;
      const { config } = request.body;
      const unifiedManager = getUnifiedManager();

      // 检查插件是否存在
      const plugin = await unifiedManager.getPlugin(pluginId);
      if (!plugin) {
        return reply.status(404).send({
          success: false,
          error: 'Plugin not found',
          message: `Plugin ${pluginId} is not installed`
        });
      }

      // 更新插件配置
      await unifiedManager.updatePluginConfig(pluginId, config);

      return reply.send({
        success: true,
        message: `Plugin ${pluginId} configuration updated successfully`
      });
    } catch (error) {
      fastify.log.error(`Failed to update plugin config ${(request.params as any).pluginId}:`, error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to update plugin configuration',
        message: (error as Error).message || 'Unknown error'
      });
    }
  });

  /**
   * 插件健康检查
   * GET /api/plugins/:pluginId/health
   */
  fastify.get('/:pluginId/health', {
    preHandler: [authMiddleware]
  }, async (request: any, reply: FastifyReply) => {
    try {
      const { pluginId } = request.params;
      const unifiedManager = getUnifiedManager();

      // 检查插件是否存在
      const plugin = await unifiedManager.getPlugin(pluginId);
      if (!plugin) {
        return reply.status(404).send({
          success: false,
          error: 'Plugin not found',
          message: `Plugin ${pluginId} is not installed`
        });
      }

      // 执行健康检查
      const healthCheck = await unifiedManager.checkPluginHealth(pluginId);

      return reply.send({
        success: true,
        data: healthCheck
      });
    } catch (error) {
      fastify.log.error(`Failed to check plugin health ${(request.params as any).pluginId}:`, error);
      return reply.status(500).send({
        success: false,
        error: 'Plugin health check failed',
        message: (error as Error).message || 'Unknown error'
      });
    }
  });

  /**
   * 获取插件系统统计信息
   * GET /api/plugins/stats
   */
  fastify.get('/stats', {
    preHandler: [authMiddleware],
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const unifiedManager = getUnifiedManager();

      // 获取插件统计信息
      const installedPlugins = await unifiedManager.getPlugins();
      const activePlugins = unifiedManager.getActivePlugins();
      const availablePlugins = unifiedManager.getAvailablePlugins();

      // 按类型分组统计
      const pluginsByType = installedPlugins.reduce((acc: Record<string, number>, plugin: UnifiedPlugin) => {
        const type = plugin.metadata.type;
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // 按状态分组统计
      const pluginsByStatus = {
        active: activePlugins.length,
        inactive: installedPlugins.length - activePlugins.length,
        available: availablePlugins.length - installedPlugins.length
      };

      return reply.send({
        success: true,
        data: {
          total: {
            installed: installedPlugins.length,
            active: activePlugins.length,
            inactive: installedPlugins.length - activePlugins.length,
            available: availablePlugins.length
          },
          byType: pluginsByType,
          byStatus: pluginsByStatus,
          systemHealth: {
            healthy: activePlugins.length,
            unhealthy: 0, // 可以扩展以实际检查健康状态
            lastCheck: new Date()
          }
        }
      });
    } catch (error) {
      fastify.log.error('Failed to get plugin statistics:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get plugin statistics',
        message: (error as Error).message || 'Unknown error'
      });
    }
  });
}
