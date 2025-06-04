import { FastifyInstance } from 'fastify';
import { Plugin, PluginLicenseType } from './types';
import { licenseService } from './license-service';
import { authMiddleware, requireRole } from '@/middleware/auth';
import { UserRole } from '@prisma/client';

const premiumAnalyticsPlugin: Plugin = {
  name: 'premium-analytics-plugin',
  version: '2.0.0',
  description: 'Premium analytics plugin with advanced features',
  author: 'Jiffoo Team',
  license: {
    type: PluginLicenseType.PREMIUM,
    key: process.env.PREMIUM_ANALYTICS_LICENSE_KEY,
    features: ['advanced-reports', 'real-time-dashboard', 'export-data', 'custom-metrics']
  },

  async register(app: FastifyInstance) {
    // 验证许可证功能
    const hasAdvancedReports = licenseService.hasFeature(this.license, 'advanced-reports');
    const hasRealTimeDashboard = licenseService.hasFeature(this.license, 'real-time-dashboard');
    const hasExportData = licenseService.hasFeature(this.license, 'export-data');

    // 基础分析端点（所有许可证类型都可用）
    app.get('/api/plugins/premium-analytics/basic', {
      preHandler: [authMiddleware, requireRole(UserRole.ADMIN)]
    }, async (request, reply) => {
      return {
        message: 'Basic analytics data',
        data: {
          totalUsers: 1250,
          totalOrders: 3420,
          revenue: 125000
        },
        license: this.license.type
      };
    });

    // 高级报告（仅限 PREMIUM 许可证）
    if (hasAdvancedReports) {
      app.get('/api/plugins/premium-analytics/advanced-reports', {
        preHandler: [authMiddleware, requireRole(UserRole.ADMIN)]
      }, async (request, reply) => {
        return {
          message: 'Advanced analytics reports',
          data: {
            userSegmentation: {
              newUsers: 320,
              returningUsers: 930,
              vipUsers: 45
            },
            salesTrends: {
              daily: [1200, 1350, 1100, 1450, 1600],
              weekly: [8500, 9200, 8800, 10100],
              monthly: [35000, 38000, 42000]
            },
            productPerformance: [
              { id: 1, name: 'Product A', sales: 450, revenue: 22500 },
              { id: 2, name: 'Product B', sales: 320, revenue: 16000 },
              { id: 3, name: 'Product C', sales: 280, revenue: 14000 }
            ]
          },
          generatedAt: new Date().toISOString()
        };
      });
    }

    // 实时仪表板（仅限 PREMIUM 许可证）
    if (hasRealTimeDashboard) {
      app.get('/api/plugins/premium-analytics/realtime', {
        preHandler: [authMiddleware, requireRole(UserRole.ADMIN)]
      }, async (request, reply) => {
        return {
          message: 'Real-time dashboard data',
          data: {
            activeUsers: Math.floor(Math.random() * 100) + 50,
            currentOrders: Math.floor(Math.random() * 20) + 5,
            realtimeRevenue: Math.floor(Math.random() * 1000) + 500,
            serverLoad: Math.random() * 100,
            responseTime: Math.random() * 200 + 50
          },
          timestamp: new Date().toISOString()
        };
      });
    }

    // 数据导出（仅限 PREMIUM 许可证）
    if (hasExportData) {
      app.get('/api/plugins/premium-analytics/export', {
        preHandler: [authMiddleware, requireRole(UserRole.ADMIN)]
      }, async (request, reply) => {
        const { format = 'json' } = request.query as { format?: string };
        
        const data = {
          exportedAt: new Date().toISOString(),
          totalRecords: 10000,
          data: [
            { date: '2024-01-01', users: 120, orders: 45, revenue: 2250 },
            { date: '2024-01-02', users: 135, orders: 52, revenue: 2600 },
            { date: '2024-01-03', users: 142, orders: 48, revenue: 2400 }
          ]
        };

        if (format === 'csv') {
          reply.header('Content-Type', 'text/csv');
          reply.header('Content-Disposition', 'attachment; filename="analytics-export.csv"');
          
          const csv = [
            'Date,Users,Orders,Revenue',
            ...data.data.map(row => `${row.date},${row.users},${row.orders},${row.revenue}`)
          ].join('\n');
          
          return csv;
        }

        return data;
      });
    }

    // 许可证状态检查端点
    app.get('/api/plugins/premium-analytics/license-status', {
      preHandler: [authMiddleware, requireRole(UserRole.SUPER_ADMIN)]
    }, async (request, reply) => {
      const validation = await licenseService.validateLicense(this.name, this.license);
      
      return {
        plugin: this.name,
        version: this.version,
        license: {
          type: this.license.type,
          valid: validation.valid,
          features: validation.features,
          expiresAt: validation.expiresAt,
          reason: validation.reason
        },
        availableFeatures: {
          advancedReports: hasAdvancedReports,
          realTimeDashboard: hasRealTimeDashboard,
          exportData: hasExportData
        }
      };
    });

    // 功能受限的端点示例
    app.get('/api/plugins/premium-analytics/custom-metrics', {
      preHandler: [authMiddleware, requireRole(UserRole.ADMIN)]
    }, async (request, reply) => {
      const hasCustomMetrics = licenseService.hasFeature(this.license, 'custom-metrics');
      
      if (!hasCustomMetrics) {
        return reply.status(403).send({
          error: 'Feature not available',
          message: 'Custom metrics require a PREMIUM license',
          upgradeUrl: 'https://jiffoo.com/pricing'
        });
      }

      return {
        message: 'Custom metrics data',
        metrics: [
          { name: 'Conversion Rate', value: 3.2, unit: '%' },
          { name: 'Average Order Value', value: 85.50, unit: 'USD' },
          { name: 'Customer Lifetime Value', value: 245.30, unit: 'USD' }
        ]
      };
    });

    app.log.info(`Premium Analytics plugin registered successfully with license: ${this.license.type}`);
  },

  // 自定义许可证验证
  async validateLicense(): Promise<boolean> {
    const result = await licenseService.validateLicense(this.name, this.license);
    return result.valid;
  }
};

export default premiumAnalyticsPlugin;
