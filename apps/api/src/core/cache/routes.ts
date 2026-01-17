import { FastifyInstance } from 'fastify';
import { CacheService } from './service';
import { redisCache } from './redis';
import { adminMiddleware, authMiddleware } from '@/core/auth/middleware';

export async function cacheRoutes(fastify: FastifyInstance) {
  // Get cache statistics (Admin)
  fastify.get('/stats', {
    preHandler: [authMiddleware, adminMiddleware],
    schema: {
      hide: true,
      tags: ['cache'],
      summary: 'Get Cache Statistics',
      description: 'Get Redis cache statistics',
      security: [{ bearerAuth: [] }],
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
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
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

  // Cache health check (Admin)
  fastify.get('/health', {
    preHandler: [authMiddleware, adminMiddleware],
    schema: {
      tags: ['cache'],
      summary: 'Cache Health Check',
      description: 'Check Redis connection status',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            connected: { type: 'boolean' },
            ping: { type: 'boolean' }
          }
        },
        500: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            connected: { type: 'boolean' },
            ping: { type: 'boolean' },
            error: { type: 'string' }
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

  // Clear product cache (Admin)
  fastify.delete('/products', {
    preHandler: [authMiddleware, adminMiddleware],
    schema: {
      hide: true,
      tags: ['cache'],
      summary: 'Clear Product Cache',
      description: 'Clear all product-related cache',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            deletedKeys: { type: 'integer' },
            message: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' },
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

  // Clear search cache (Admin)
  fastify.delete('/search', {
    preHandler: [authMiddleware, adminMiddleware],
    schema: {
      hide: true,
      tags: ['cache'],
      summary: 'Clear Search Cache',
      description: 'Clear all search-related cache',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            deletedKeys: { type: 'integer' },
            message: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' },
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

  // Delete specific cache (Admin)
  fastify.delete('/key/:key', {
    preHandler: [authMiddleware, adminMiddleware],
    schema: {
      hide: true,
      tags: ['cache'],
      summary: 'Delete Specific Cache Key',
      description: 'Delete specified cache key',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Cache key name' }
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
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' },
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

  // Get cache value (Admin)
  fastify.get('/key/:key', {
    preHandler: [authMiddleware, adminMiddleware],
    schema: {
      hide: true,
      tags: ['cache'],
      summary: 'Get Cache Value',
      description: 'Get value of specified cache key',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          key: { type: 'string', description: 'Cache key name' }
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
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
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
