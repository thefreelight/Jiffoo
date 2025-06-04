import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Plugin, PluginLicenseType } from '../types';
import { enhancedLicenseManager } from '@/core/licensing/enhanced-license-manager';
import { authMiddleware } from '@/core/auth/middleware';
import { prisma } from '@/config/database';
import { redisCache } from '@/core/cache/redis';

/**
 * 高级分析插件 - 付费插件
 * 提供深度的商业分析和数据洞察功能
 */
const advancedAnalyticsPlugin: Plugin = {
  name: 'advanced-analytics',
  version: '2.0.0',
  description: 'Advanced analytics plugin with deep business insights and predictive analytics',
  author: 'Jiffoo Team',
  license: {
    type: PluginLicenseType.PREMIUM,
    features: [
      'real-time-dashboard',
      'predictive-analytics',
      'custom-reports',
      'data-export',
      'advanced-segmentation',
      'cohort-analysis',
      'revenue-forecasting'
    ]
  },

  async register(app: FastifyInstance) {
    // 许可证验证中间件
    const licenseMiddleware = async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request.user as any)?.id;

      if (!userId) {
        return reply.status(401).send({ error: 'Authentication required' });
      }

      const validation = await enhancedLicenseManager.validateLicense('advanced-analytics', userId);

      if (!validation.valid) {
        return reply.status(403).send({
          error: 'Premium license required',
          message: validation.reason,
          upgradeUrl: '/plugin-store/advanced-analytics'
        });
      }

      // 将许可证信息添加到请求上下文
      (request as any).license = validation;
    };

    /**
     * 实时销售仪表板
     * GET /api/plugins/advanced-analytics/dashboard
     */
    app.get('/api/plugins/advanced-analytics/dashboard', {
      preHandler: [authMiddleware, licenseMiddleware],
      schema: {
        tags: ['advanced-analytics'],
        summary: '实时销售仪表板',
        description: '获取实时销售数据和关键指标',
        querystring: {
          type: 'object',
          properties: {
            period: { type: 'string', enum: ['today', '7days', '30days', '90days'], default: '30days' },
            timezone: { type: 'string', default: 'UTC' }
          }
        },
        response: {
          200: {
            type: 'object',
            properties: {
              summary: {
                type: 'object',
                properties: {
                  totalRevenue: { type: 'number' },
                  totalOrders: { type: 'number' },
                  averageOrderValue: { type: 'number' },
                  conversionRate: { type: 'number' },
                  revenueGrowth: { type: 'number' },
                  orderGrowth: { type: 'number' }
                }
              },
              charts: {
                type: 'object',
                properties: {
                  revenueChart: { type: 'array' },
                  ordersChart: { type: 'array' },
                  topProducts: { type: 'array' },
                  customerSegments: { type: 'array' }
                }
              }
            }
          }
        }
      }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as any;
        const license = (request as any).license;

        // 检查功能权限
        if (!license.features.includes('real-time-dashboard')) {
          return reply.status(403).send({ error: 'Feature not available in your license' });
        }

        // 跟踪使用情况
        await enhancedLicenseManager.trackUsage({
          licenseId: license.license.id,
          featureName: 'real-time-dashboard'
        });

        const period = query.period || '30days';
        const cacheKey = `analytics:dashboard:${period}:${(request.user as any).id}`;

        // 尝试从缓存获取
        const cached = await redisCache.get(cacheKey);
        if (cached) {
          return reply.send(JSON.parse(cached));
        }

        // 计算日期范围
        const endDate = new Date();
        const startDate = new Date();

        switch (period) {
          case 'today':
            startDate.setHours(0, 0, 0, 0);
            break;
          case '7days':
            startDate.setDate(startDate.getDate() - 7);
            break;
          case '30days':
            startDate.setDate(startDate.getDate() - 30);
            break;
          case '90days':
            startDate.setDate(startDate.getDate() - 90);
            break;
        }

        // 获取销售数据
        const orders = await prisma.order.findMany({
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          },
          include: {
            items: {
              include: {
                product: true
              }
            }
          }
        });

        // 计算汇总指标
        const totalRevenue = orders.reduce((sum, order) => sum + order.totalAmount, 0);
        const totalOrders = orders.length;
        const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        // 计算增长率（与上一个周期比较）
        const previousStartDate = new Date(startDate);
        const previousEndDate = new Date(startDate);
        const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        previousStartDate.setDate(previousStartDate.getDate() - periodDays);

        const previousOrders = await prisma.order.findMany({
          where: {
            createdAt: {
              gte: previousStartDate,
              lte: previousEndDate
            }
          }
        });

        const previousRevenue = previousOrders.reduce((sum, order) => sum + order.totalAmount, 0);
        const revenueGrowth = previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;
        const orderGrowth = previousOrders.length > 0 ? ((totalOrders - previousOrders.length) / previousOrders.length) * 100 : 0;

        // 生成图表数据
        const revenueChart = await this.generateRevenueChart(startDate, endDate);
        const ordersChart = await this.generateOrdersChart(startDate, endDate);
        const topProducts = await this.getTopProducts(startDate, endDate);
        const customerSegments = await this.getCustomerSegments(startDate, endDate);

        const dashboardData = {
          summary: {
            totalRevenue,
            totalOrders,
            averageOrderValue,
            conversionRate: 0, // 需要实现转化率计算
            revenueGrowth,
            orderGrowth
          },
          charts: {
            revenueChart,
            ordersChart,
            topProducts,
            customerSegments
          }
        };

        // 缓存结果
        await redisCache.set(cacheKey, JSON.stringify(dashboardData), 300); // 缓存5分钟

        return reply.send(dashboardData);
      } catch (error) {
        app.log.error('Dashboard error:', error);
        return reply.status(500).send({ error: 'Failed to generate dashboard' });
      }
    });

    /**
     * 预测性分析
     * GET /api/plugins/advanced-analytics/predictions
     */
    app.get('/api/plugins/advanced-analytics/predictions', {
      preHandler: [authMiddleware, licenseMiddleware],
      schema: {
        tags: ['advanced-analytics'],
        summary: '预测性分析',
        description: '基于历史数据进行销售预测',
        querystring: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['revenue', 'orders', 'inventory'], default: 'revenue' },
            period: { type: 'string', enum: ['week', 'month', 'quarter'], default: 'month' }
          }
        }
      }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as any;
        const license = (request as any).license;

        // 检查功能权限
        if (!license.features.includes('predictive-analytics')) {
          return reply.status(403).send({ error: 'Feature not available in your license' });
        }

        // 跟踪使用情况
        await enhancedLicenseManager.trackUsage({
          licenseId: license.license.id,
          featureName: 'predictive-analytics'
        });

        // 实现预测算法（简化版）
        const predictions = await this.generatePredictions(query.type, query.period);

        return reply.send({
          type: query.type,
          period: query.period,
          predictions,
          confidence: 0.85, // 预测置信度
          generatedAt: new Date().toISOString()
        });
      } catch (error) {
        app.log.error('Predictions error:', error);
        return reply.status(500).send({ error: 'Failed to generate predictions' });
      }
    });

    /**
     * 自定义报表生成
     * POST /api/plugins/advanced-analytics/reports
     */
    app.post('/api/plugins/advanced-analytics/reports', {
      preHandler: [authMiddleware, licenseMiddleware],
      schema: {
        tags: ['advanced-analytics'],
        summary: '生成自定义报表',
        description: '根据用户定义的参数生成自定义报表',
        body: {
          type: 'object',
          required: ['reportType', 'dateRange'],
          properties: {
            reportType: { type: 'string', enum: ['sales', 'products', 'customers', 'inventory'] },
            dateRange: {
              type: 'object',
              properties: {
                start: { type: 'string' },
                end: { type: 'string' }
              }
            },
            filters: { type: 'object' },
            groupBy: { type: 'string' },
            metrics: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const body = request.body as any;
        const license = (request as any).license;

        // 检查功能权限
        if (!license.features.includes('custom-reports')) {
          return reply.status(403).send({ error: 'Feature not available in your license' });
        }

        // 跟踪使用情况
        await enhancedLicenseManager.trackUsage({
          licenseId: license.license.id,
          featureName: 'custom-reports'
        });

        // 生成自定义报表
        const report = await this.generateCustomReport(body);

        return reply.send({
          reportId: `report_${Date.now()}`,
          reportType: body.reportType,
          data: report,
          generatedAt: new Date().toISOString(),
          downloadUrl: `/api/plugins/advanced-analytics/reports/download/${Date.now()}`
        });
      } catch (error) {
        app.log.error('Custom report error:', error);
        return reply.status(500).send({ error: 'Failed to generate custom report' });
      }
    });

    /**
     * 数据导出
     * GET /api/plugins/advanced-analytics/export
     */
    app.get('/api/plugins/advanced-analytics/export', {
      preHandler: [authMiddleware, licenseMiddleware],
      schema: {
        tags: ['advanced-analytics'],
        summary: '导出分析数据',
        description: '导出分析数据为CSV或Excel格式',
        querystring: {
          type: 'object',
          properties: {
            format: { type: 'string', enum: ['csv', 'excel'], default: 'csv' },
            dataType: { type: 'string', enum: ['orders', 'products', 'customers'], default: 'orders' },
            dateRange: { type: 'string' }
          }
        }
      }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const query = request.query as any;
        const license = (request as any).license;

        // 检查功能权限
        if (!license.features.includes('data-export')) {
          return reply.status(403).send({ error: 'Feature not available in your license' });
        }

        // 跟踪使用情况
        await enhancedLicenseManager.trackUsage({
          licenseId: license.license.id,
          featureName: 'data-export'
        });

        // 生成导出文件
        const exportData = await this.generateExportData(query.dataType, query.dateRange);

        if (query.format === 'csv') {
          reply.header('Content-Type', 'text/csv');
          reply.header('Content-Disposition', `attachment; filename="${query.dataType}_export.csv"`);
          return reply.send(this.convertToCSV(exportData));
        } else {
          // Excel导出逻辑
          reply.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          reply.header('Content-Disposition', `attachment; filename="${query.dataType}_export.xlsx"`);
          return reply.send(await this.convertToExcel(exportData));
        }
      } catch (error) {
        app.log.error('Export error:', error);
        return reply.status(500).send({ error: 'Failed to export data' });
      }
    });

    app.log.info('Advanced Analytics Plugin registered successfully');
  },

  // 辅助方法
  async generateRevenueChart(startDate: Date, endDate: Date) {
    // 实现收入图表数据生成
    return [];
  },

  async generateOrdersChart(startDate: Date, endDate: Date) {
    // 实现订单图表数据生成
    return [];
  },

  async getTopProducts(startDate: Date, endDate: Date) {
    // 实现热销商品数据获取
    return [];
  },

  async getCustomerSegments(startDate: Date, endDate: Date) {
    // 实现客户分群数据获取
    return [];
  },

  async generatePredictions(type: string, period: string) {
    // 实现预测算法
    return [];
  },

  async generateCustomReport(params: any) {
    // 实现自定义报表生成
    return {};
  },

  async generateExportData(dataType: string, dateRange: string) {
    // 实现数据导出
    return [];
  },

  convertToCSV(data: any[]) {
    // 实现CSV转换
    return '';
  },

  async convertToExcel(data: any[]) {
    // 实现Excel转换
    return Buffer.from('');
  }
};

export default advancedAnalyticsPlugin;
