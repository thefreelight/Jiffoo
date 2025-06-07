import { FastifyInstance } from 'fastify';
import { StatisticsService } from './service';
import { authMiddleware } from '@/core/auth/middleware';
import { requirePermission, requireRole } from '@/core/permissions/middleware';
import { Resource, Action, UserRole } from '@/core/permissions/types';

export async function statisticsRoutes(fastify: FastifyInstance) {
  // 获取仪表板统计 (管理员及以上)
  fastify.get('/dashboard', {
    preHandler: [authMiddleware, requireRole(UserRole.MANAGER)],
    schema: {
      tags: ['statistics'],
      summary: '获取仪表板统计数据',
      description: '获取系统总体统计数据，包括用户、商品、订单、收入等',
      response: {
        200: {
          type: 'object',
          properties: {
            totalUsers: { type: 'integer' },
            totalProducts: { type: 'integer' },
            totalOrders: { type: 'integer' },
            totalRevenue: { type: 'number' },
            todayOrders: { type: 'integer' },
            todayRevenue: { type: 'number' },
            userGrowth: { type: 'number' },
            orderGrowth: { type: 'number' },
            revenueGrowth: { type: 'number' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const stats = await StatisticsService.getDashboardStats();
      return reply.send(stats);
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to get dashboard stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 获取销售统计 (管理员及以上)
  fastify.get('/sales', {
    preHandler: [authMiddleware, requireRole(UserRole.MANAGER)],
    schema: {
      tags: ['statistics'],
      summary: '获取销售统计数据',
      description: '获取指定时间段的销售统计数据',
      querystring: {
        type: 'object',
        properties: {
          days: { 
            type: 'integer', 
            minimum: 1, 
            maximum: 365, 
            default: 30,
            description: '统计天数'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            period: { type: 'string' },
            totalOrders: { type: 'integer' },
            totalRevenue: { type: 'number' },
            averageOrderValue: { type: 'number' },
            topProducts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  totalSold: { type: 'integer' },
                  revenue: { type: 'number' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { days = 30 } = request.query as { days?: number };
      const stats = await StatisticsService.getSalesStats(days);
      return reply.send(stats);
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to get sales stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 获取用户统计 (管理员及以上)
  fastify.get('/users', {
    preHandler: [authMiddleware, requireRole(UserRole.ADMIN)],
    schema: {
      tags: ['statistics'],
      summary: '获取用户统计数据',
      description: '获取用户相关的统计数据',
      response: {
        200: {
          type: 'object',
          properties: {
            totalUsers: { type: 'integer' },
            activeUsers: { type: 'integer' },
            newUsers: { type: 'integer' },
            usersByRole: { type: 'object' },
            userGrowthTrend: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date: { type: 'string' },
                  count: { type: 'integer' }
                }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const stats = await StatisticsService.getUserStats();
      return reply.send(stats);
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to get user stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 获取商品统计 (管理员及以上)
  fastify.get('/products', {
    preHandler: [authMiddleware, requireRole(UserRole.MANAGER)],
    schema: {
      tags: ['statistics'],
      summary: '获取商品统计数据',
      description: '获取商品相关的统计数据',
      response: {
        200: {
          type: 'object',
          properties: {
            totalProducts: { type: 'integer' },
            lowStockProducts: { type: 'integer' },
            outOfStockProducts: { type: 'integer' },
            topSellingProducts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  totalSold: { type: 'integer' },
                  revenue: { type: 'number' },
                  stock: { type: 'integer' }
                }
              }
            },
            categoryStats: { type: 'array' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const stats = await StatisticsService.getProductStats();
      return reply.send(stats);
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to get product stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 获取实时统计 (管理员及以上)
  fastify.get('/realtime', {
    preHandler: [authMiddleware, requireRole(UserRole.MANAGER)],
    schema: {
      tags: ['statistics'],
      summary: '获取实时统计数据',
      description: '获取系统实时运行数据',
      response: {
        200: {
          type: 'object',
          properties: {
            onlineUsers: { type: 'integer' },
            todayVisitors: { type: 'integer' },
            activeOrders: { type: 'integer' },
            systemLoad: { type: 'number' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const stats = await StatisticsService.getRealTimeStats();
      return reply.send(stats);
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to get realtime stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 清除统计缓存 (超级管理员)
  fastify.delete('/cache', {
    preHandler: [authMiddleware, requirePermission(Resource.STATISTICS, Action.MANAGE)],
    schema: {
      tags: ['statistics'],
      summary: '清除统计缓存',
      description: '清除所有统计数据的缓存',
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
      await StatisticsService.clearStatsCache();
      return reply.send({
        success: true,
        message: 'Statistics cache cleared successfully'
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 获取权限统计 (超级管理员)
  fastify.get('/permissions', {
    preHandler: [authMiddleware, requirePermission(Resource.SYSTEM, Action.READ)],
    schema: {
      tags: ['statistics'],
      summary: '获取权限统计数据',
      description: '获取权限系统的统计数据',
      response: {
        200: {
          type: 'object',
          properties: {
            totalChecks: { type: 'integer' },
            allowedChecks: { type: 'integer' },
            deniedChecks: { type: 'integer' },
            cacheHitRate: { type: 'number' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { PermissionService } = await import('@/core/permissions/service');
      const stats = await PermissionService.getPermissionStats();
      return reply.send(stats);
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to get permission stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
