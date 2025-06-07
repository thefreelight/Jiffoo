import { FastifyInstance } from 'fastify';
import { Plugin, PluginLicenseType } from './types';
import { authMiddleware } from '@/core/auth/middleware';
import { requireRole } from '@/core/permissions/middleware';
import { UserRole } from '@/core/permissions/types';
import { prisma } from '@/config/database';

interface AnalyticsData {
  endpoint: string;
  method: string;
  statusCode: number;
  responseTime: number;
  timestamp: Date;
  userAgent?: string;
  ip?: string;
}

class AnalyticsCollector {
  private data: AnalyticsData[] = [];
  private maxEntries = 1000;

  addEntry(entry: AnalyticsData) {
    this.data.push(entry);
    
    // 保持数据量在限制内
    if (this.data.length > this.maxEntries) {
      this.data = this.data.slice(-this.maxEntries);
    }
  }

  getStats(hours: number = 24) {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recentData = this.data.filter(entry => entry.timestamp >= cutoff);

    const totalRequests = recentData.length;
    const avgResponseTime = recentData.length > 0 
      ? recentData.reduce((sum, entry) => sum + entry.responseTime, 0) / recentData.length 
      : 0;

    const statusCodes = recentData.reduce((acc, entry) => {
      acc[entry.statusCode] = (acc[entry.statusCode] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    const endpoints = recentData.reduce((acc, entry) => {
      const key = `${entry.method} ${entry.endpoint}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topEndpoints = Object.entries(endpoints)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([endpoint, count]) => ({ endpoint, count }));

    return {
      period: `${hours} hours`,
      totalRequests,
      avgResponseTime: Math.round(avgResponseTime * 100) / 100,
      statusCodes,
      topEndpoints,
      errorRate: totalRequests > 0 
        ? Math.round((recentData.filter(e => e.statusCode >= 400).length / totalRequests) * 100 * 100) / 100
        : 0
    };
  }

  getRecentActivity(limit: number = 50) {
    return this.data
      .slice(-limit)
      .reverse()
      .map(entry => ({
        timestamp: entry.timestamp.toISOString(),
        method: entry.method,
        endpoint: entry.endpoint,
        statusCode: entry.statusCode,
        responseTime: entry.responseTime,
        userAgent: entry.userAgent?.substring(0, 50) + '...'
      }));
  }
}

const analyticsPlugin: Plugin = {
  name: 'analytics-plugin',
  version: '1.0.0',
  description: 'Advanced analytics and monitoring plugin for API usage tracking',
  license: {
    type: PluginLicenseType.MIT
  },
  
  async register(app: FastifyInstance) {
    const collector = new AnalyticsCollector();

    // 添加请求跟踪中间件
    app.addHook('onRequest', async (request, reply) => {
      (request as any).startTime = Date.now();
    });

    app.addHook('onResponse', async (request, reply) => {
      const startTime = (request as any).startTime;
      const responseTime = startTime ? Date.now() - startTime : 0;

      collector.addEntry({
        endpoint: request.url,
        method: request.method,
        statusCode: reply.statusCode,
        responseTime,
        timestamp: new Date(),
        userAgent: request.headers['user-agent'],
        ip: request.ip
      });
    });

    // 获取分析统计 (管理员及以上)
    app.get('/api/plugins/analytics/stats', {
      preHandler: [authMiddleware, requireRole(UserRole.ADMIN)],
      schema: {
        tags: ['analytics'],
        summary: '获取API使用统计',
        description: '获取API请求的统计分析数据',
        querystring: {
          type: 'object',
          properties: {
            hours: { 
              type: 'integer', 
              minimum: 1, 
              maximum: 168, 
              default: 24,
              description: '统计时间范围（小时）'
            }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              period: { type: 'string' },
              totalRequests: { type: 'integer' },
              avgResponseTime: { type: 'number' },
              statusCodes: { type: 'object' },
              topEndpoints: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    endpoint: { type: 'string' },
                    count: { type: 'integer' }
                  }
                }
              },
              errorRate: { type: 'number' }
            }
          }
        }
      }
    }, async (request, reply) => {
      const { hours = 24 } = request.query as { hours?: number };
      const stats = collector.getStats(hours);
      return reply.send(stats);
    });

    // 获取最近活动 (管理员及以上)
    app.get('/api/plugins/analytics/activity', {
      preHandler: [authMiddleware, requireRole(UserRole.ADMIN)],
      schema: {
        tags: ['analytics'],
        summary: '获取最近API活动',
        description: '获取最近的API请求活动记录',
        querystring: {
          type: 'object',
          properties: {
            limit: { 
              type: 'integer', 
              minimum: 1, 
              maximum: 200, 
              default: 50,
              description: '返回记录数量'
            }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              activity: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    timestamp: { type: 'string' },
                    method: { type: 'string' },
                    endpoint: { type: 'string' },
                    statusCode: { type: 'integer' },
                    responseTime: { type: 'number' },
                    userAgent: { type: 'string' }
                  }
                }
              },
              total: { type: 'integer' }
            }
          }
        }
      }
    }, async (request, reply) => {
      const { limit = 50 } = request.query as { limit?: number };
      const activity = collector.getRecentActivity(limit);
      
      return reply.send({
        activity,
        total: activity.length
      });
    });

    // 获取数据库统计 (管理员及以上)
    app.get('/api/plugins/analytics/database', {
      preHandler: [authMiddleware, requireRole(UserRole.ADMIN)],
      schema: {
        tags: ['analytics'],
        summary: '获取数据库统计',
        description: '获取数据库表的记录统计',
        response: {
          200: {
            type: 'object',
            properties: {
              tables: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    count: { type: 'integer' }
                  }
                }
              },
              totalRecords: { type: 'integer' }
            }
          }
        }
      }
    }, async (request, reply) => {
      try {
        const [
          userCount,
          productCount,
          orderCount,
          inventoryRecordCount,
          notificationCount
        ] = await Promise.all([
          prisma.user.count(),
          prisma.product.count(),
          prisma.order.count(),
          prisma.inventoryRecord.count(),
          prisma.notification.count()
        ]);

        const tables = [
          { name: 'users', count: userCount },
          { name: 'products', count: productCount },
          { name: 'orders', count: orderCount },
          { name: 'inventory_records', count: inventoryRecordCount },
          { name: 'notifications', count: notificationCount }
        ];

        const totalRecords = tables.reduce((sum, table) => sum + table.count, 0);

        return reply.send({
          tables,
          totalRecords
        });
      } catch (error) {
        return reply.status(500).send({
          error: 'Failed to get database statistics',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // 插件健康检查
    app.get('/api/plugins/analytics/health', async (request, reply) => {
      return {
        status: 'healthy',
        plugin: this.name,
        version: this.version,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        dataPoints: collector.getRecentActivity(1).length > 0 ? 'collecting' : 'no_data'
      };
    });

    // 插件配置信息
    app.get('/api/plugins/analytics/config', {
      preHandler: [authMiddleware, requireRole(UserRole.ADMIN)],
      schema: {
        tags: ['analytics'],
        summary: '获取插件配置',
        description: '获取分析插件的配置信息',
        response: {
          200: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              version: { type: 'string' },
              description: { type: 'string' },
              settings: {
                type: 'object',
                properties: {
                  maxEntries: { type: 'integer' },
                  trackingEnabled: { type: 'boolean' },
                  retentionHours: { type: 'integer' }
                }
              }
            }
          }
        }
      }
    }, async (request, reply) => {
      return {
        name: this.name,
        version: this.version,
        description: this.description,
        settings: {
          maxEntries: 1000,
          trackingEnabled: true,
          retentionHours: 168 // 7 days
        }
      };
    });

    app.log.info(`Analytics plugin registered successfully`);
  },
};

export default analyticsPlugin;
