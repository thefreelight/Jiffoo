import { FastifyInstance } from 'fastify';
import { authMiddleware } from '@/core/auth/middleware';
import { requireRole } from '@/core/permissions/middleware';
import { UserRole } from '@/core/permissions/types';
import { DefaultPluginManager } from './manager';

export async function pluginRoutes(fastify: FastifyInstance) {
  // 获取已加载的插件列表 (管理员及以上)
  fastify.get('/list', {
    preHandler: [authMiddleware, requireRole(UserRole.ADMIN)],
    schema: {
      tags: ['plugins'],
      summary: '获取插件列表',
      description: '获取所有已加载的插件信息',
      response: {
        200: {
          type: 'object',
          properties: {
            plugins: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  version: { type: 'string' },
                  description: { type: 'string' },
                  status: { type: 'string', enum: ['loaded', 'error'] }
                }
              }
            },
            total: { type: 'integer' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      // 从 fastify 实例中获取插件管理器
      const pluginManager = (fastify as any).pluginManager as DefaultPluginManager;
      
      if (!pluginManager) {
        return reply.status(500).send({
          error: 'Plugin manager not initialized'
        });
      }

      const loadedPlugins = pluginManager.getLoadedPlugins();
      
      const plugins = loadedPlugins.map(plugin => ({
        name: plugin.name,
        version: plugin.version || 'unknown',
        description: plugin.description || '',
        status: 'loaded'
      }));

      return reply.send({
        plugins,
        total: plugins.length
      });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to get plugin list',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 获取插件详细信息 (管理员及以上)
  fastify.get('/info/:pluginName', {
    preHandler: [authMiddleware, requireRole(UserRole.ADMIN)],
    schema: {
      tags: ['plugins'],
      summary: '获取插件详细信息',
      description: '获取指定插件的详细信息',
      params: {
        type: 'object',
        properties: {
          pluginName: { type: 'string' }
        },
        required: ['pluginName']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            version: { type: 'string' },
            description: { type: 'string' },
            status: { type: 'string' },
            loadedAt: { type: 'string' },
            endpoints: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { pluginName } = request.params as { pluginName: string };
      const pluginManager = (fastify as any).pluginManager as DefaultPluginManager;
      
      if (!pluginManager) {
        return reply.status(500).send({
          error: 'Plugin manager not initialized'
        });
      }

      const loadedPlugins = pluginManager.getLoadedPlugins();
      const plugin = loadedPlugins.find(p => p.name === pluginName);

      if (!plugin) {
        return reply.status(404).send({
          error: 'Plugin not found',
          message: `Plugin '${pluginName}' is not loaded`
        });
      }

      // 尝试获取插件的端点信息
      const endpoints: string[] = [];
      
      // 检查常见的插件端点模式
      const commonEndpoints = [
        `/api/plugins/${pluginName}`,
        `/api/plugins/${pluginName}/health`,
        `/api/plugins/${pluginName}/status`,
        `/api/plugins/${pluginName}/config`
      ];

      for (const endpoint of commonEndpoints) {
        try {
          // 这里可以检查端点是否存在，但需要更复杂的实现
          // 暂时返回预期的端点
          endpoints.push(endpoint);
        } catch (error) {
          // 忽略错误
        }
      }

      return reply.send({
        name: plugin.name,
        version: plugin.version || 'unknown',
        description: plugin.description || '',
        status: 'loaded',
        loadedAt: new Date().toISOString(), // 实际应该记录加载时间
        endpoints
      });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to get plugin info',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 插件系统状态 (管理员及以上)
  fastify.get('/status', {
    preHandler: [authMiddleware, requireRole(UserRole.ADMIN)],
    schema: {
      tags: ['plugins'],
      summary: '获取插件系统状态',
      description: '获取插件系统的整体状态信息',
      response: {
        200: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean' },
            totalPlugins: { type: 'integer' },
            loadedPlugins: { type: 'integer' },
            failedPlugins: { type: 'integer' },
            systemInfo: {
              type: 'object',
              properties: {
                nodeVersion: { type: 'string' },
                platform: { type: 'string' },
                uptime: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const pluginManager = (fastify as any).pluginManager as DefaultPluginManager;
      
      if (!pluginManager) {
        return reply.send({
          enabled: false,
          totalPlugins: 0,
          loadedPlugins: 0,
          failedPlugins: 0,
          systemInfo: {
            nodeVersion: process.version,
            platform: process.platform,
            uptime: process.uptime()
          }
        });
      }

      const loadedPlugins = pluginManager.getLoadedPlugins();

      return reply.send({
        enabled: true,
        totalPlugins: loadedPlugins.length, // 实际应该扫描插件目录
        loadedPlugins: loadedPlugins.length,
        failedPlugins: 0, // 需要实现失败插件跟踪
        systemInfo: {
          nodeVersion: process.version,
          platform: process.platform,
          uptime: process.uptime()
        }
      });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to get plugin system status',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 重新加载插件 (超级管理员)
  fastify.post('/reload', {
    preHandler: [authMiddleware, requireRole(UserRole.SUPER_ADMIN)],
    schema: {
      tags: ['plugins'],
      summary: '重新加载插件',
      description: '重新加载所有插件（需要超级管理员权限）',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            reloadedPlugins: { type: 'integer' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const pluginManager = (fastify as any).pluginManager as DefaultPluginManager;
      
      if (!pluginManager) {
        return reply.status(500).send({
          success: false,
          message: 'Plugin manager not initialized',
          reloadedPlugins: 0
        });
      }

      // 注意：实际的重新加载需要更复杂的实现
      // 这里只是一个示例，真实环境中可能需要重启服务器
      const pluginsDir = require('path').join(__dirname);
      await pluginManager.loadPluginsFromDirectory(pluginsDir);
      
      const loadedPlugins = pluginManager.getLoadedPlugins();

      return reply.send({
        success: true,
        message: 'Plugins reloaded successfully',
        reloadedPlugins: loadedPlugins.length
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        reloadedPlugins: 0
      });
    }
  });

  // 插件健康检查
  fastify.get('/health', {
    schema: {
      tags: ['plugins'],
      summary: '插件系统健康检查',
      description: '检查插件系统是否正常运行',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
            timestamp: { type: 'string' },
            details: {
              type: 'object',
              properties: {
                pluginManagerStatus: { type: 'string' },
                loadedPlugins: { type: 'integer' },
                lastCheck: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const pluginManager = (fastify as any).pluginManager as DefaultPluginManager;
      const timestamp = new Date().toISOString();
      
      if (!pluginManager) {
        return reply.send({
          status: 'degraded',
          timestamp,
          details: {
            pluginManagerStatus: 'not_initialized',
            loadedPlugins: 0,
            lastCheck: timestamp
          }
        });
      }

      const loadedPlugins = pluginManager.getLoadedPlugins();

      return reply.send({
        status: 'healthy',
        timestamp,
        details: {
          pluginManagerStatus: 'running',
          loadedPlugins: loadedPlugins.length,
          lastCheck: timestamp
        }
      });
    } catch (error) {
      return reply.status(500).send({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        details: {
          pluginManagerStatus: 'error',
          loadedPlugins: 0,
          lastCheck: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  });
}
