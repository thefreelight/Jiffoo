import { FastifyInstance } from 'fastify';
import { CacheService } from './service';
import { redisCache } from './redis';
import { adminMiddleware, authMiddleware } from '@/core/auth/middleware';

export async function cacheRoutes(fastify: FastifyInstance) {
  // 获取缓存统计信息 (管理员)
  fastify.get('/stats', {
    preHandler: [authMiddleware, adminMiddleware],
    schema: {
      tags: ['cache'],
      summary: '获取缓存统计信息',
      description: '获取 Redis 缓存的统计信息',
      response: {
        200: {
          type: 'object',
          properties: {
            connected: { type: 'boolean' },
            productKeys: { type: 'integer' },
            searchKeys: { type: 'integer' },
            userKeys: { type: 'integer' },
            totalKeys: { type: 'integer' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const stats = await CacheService.getCacheStats();
      return reply.send(stats);
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to get cache stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 缓存健康检查 (管理员)
  fastify.get('/health', {
    preHandler: [authMiddleware, adminMiddleware],
    schema: {
      tags: ['cache'],
      summary: '缓存健康检查',
      description: '检查 Redis 连接状态',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            connected: { type: 'boolean' },
            ping: { type: 'boolean' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const connected = redisCache.getConnectionStatus();
      const ping = await CacheService.healthCheck();
      
      return reply.send({
        status: connected && ping ? 'healthy' : 'unhealthy',
        connected,
        ping
      });
    } catch (error) {
      return reply.status(500).send({
        status: 'unhealthy',
        connected: false,
        ping: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 清除商品缓存 (管理员)
  fastify.delete('/products', {
    preHandler: [authMiddleware, adminMiddleware],
    schema: {
      tags: ['cache'],
      summary: '清除商品缓存',
      description: '清除所有商品相关的缓存',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            deletedKeys: { type: 'integer' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const deletedKeys = await CacheService.clearProductCache();
      
      return reply.send({
        success: true,
        deletedKeys,
        message: `Cleared ${deletedKeys} product cache keys`
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        deletedKeys: 0,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 清除搜索缓存 (管理员)
  fastify.delete('/search', {
    preHandler: [authMiddleware, adminMiddleware],
    schema: {
      tags: ['cache'],
      summary: '清除搜索缓存',
      description: '清除所有搜索相关的缓存',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            deletedKeys: { type: 'integer' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const deletedKeys = await CacheService.clearSearchCache();
      
      return reply.send({
        success: true,
        deletedKeys,
        message: `Cleared ${deletedKeys} search cache keys`
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        deletedKeys: 0,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 清除特定缓存 (管理员)
  fastify.delete('/key/:key', {
    preHandler: [authMiddleware, adminMiddleware],
    schema: {
      tags: ['cache'],
      summary: '删除特定缓存键',
      description: '删除指定的缓存键',
      params: {
        type: 'object',
        properties: {
          key: { type: 'string', description: '缓存键名' }
        },
        required: ['key']
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
  }, async (request, reply) => {
    try {
      const { key } = request.params as { key: string };
      const deleted = await CacheService.delete(key);
      
      return reply.send({
        success: deleted,
        message: deleted ? `Cache key '${key}' deleted` : `Cache key '${key}' not found`
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 获取缓存值 (管理员)
  fastify.get('/key/:key', {
    preHandler: [authMiddleware, adminMiddleware],
    schema: {
      tags: ['cache'],
      summary: '获取缓存值',
      description: '获取指定缓存键的值',
      params: {
        type: 'object',
        properties: {
          key: { type: 'string', description: '缓存键名' }
        },
        required: ['key']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            key: { type: 'string' },
            value: {},
            exists: { type: 'boolean' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { key } = request.params as { key: string };
      const value = await CacheService.get(key);
      
      return reply.send({
        key,
        value,
        exists: value !== null
      });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to get cache value',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
