import { FastifyInstance } from 'fastify';
import { authMiddleware, requireRole } from '@/middleware/auth';
import { UserRole } from '@prisma/client';
import { licenseService } from './license-service';

// 模拟插件商店数据
const pluginStore = [
  {
    id: 'premium-analytics',
    name: 'Premium Analytics',
    description: 'Advanced analytics and reporting with real-time dashboard',
    version: '2.0.0',
    author: 'Jiffoo Team',
    category: 'Analytics',
    price: 99.00,
    currency: 'USD',
    billing: 'monthly',
    features: [
      'Advanced Reports',
      'Real-time Dashboard', 
      'Data Export (CSV/JSON)',
      'Custom Metrics',
      'API Access'
    ],
    screenshots: [
      'https://example.com/screenshots/analytics-1.png',
      'https://example.com/screenshots/analytics-2.png'
    ],
    rating: 4.8,
    downloads: 1250,
    license: 'PREMIUM',
    compatibility: ['1.0.0', '2.0.0'],
    tags: ['analytics', 'reports', 'dashboard']
  },
  {
    id: 'advanced-seo',
    name: 'Advanced SEO Tools',
    description: 'Complete SEO optimization suite for e-commerce',
    version: '1.5.0',
    author: 'SEO Experts',
    category: 'Marketing',
    price: 49.00,
    currency: 'USD',
    billing: 'monthly',
    features: [
      'Meta Tag Optimization',
      'Sitemap Generation',
      'Schema Markup',
      'SEO Analytics',
      'Keyword Tracking'
    ],
    screenshots: [
      'https://example.com/screenshots/seo-1.png'
    ],
    rating: 4.6,
    downloads: 890,
    license: 'COMMERCIAL',
    compatibility: ['1.0.0', '2.0.0'],
    tags: ['seo', 'marketing', 'optimization']
  },
  {
    id: 'inventory-alerts',
    name: 'Smart Inventory Alerts',
    description: 'Intelligent inventory management with predictive alerts',
    version: '1.2.0',
    author: 'Inventory Solutions',
    category: 'Inventory',
    price: 29.00,
    currency: 'USD',
    billing: 'monthly',
    features: [
      'Low Stock Alerts',
      'Demand Forecasting',
      'Automated Reordering',
      'Supplier Integration',
      'Custom Thresholds'
    ],
    screenshots: [],
    rating: 4.4,
    downloads: 650,
    license: 'COMMERCIAL',
    compatibility: ['1.0.0', '2.0.0'],
    tags: ['inventory', 'alerts', 'automation']
  }
];

export async function pluginStoreRoutes(fastify: FastifyInstance) {
  // 获取插件商店列表
  fastify.get('/store', {
    preHandler: [authMiddleware, requireRole(UserRole.ADMIN)],
    schema: {
      tags: ['plugin-store'],
      summary: '获取插件商店列表',
      querystring: {
        type: 'object',
        properties: {
          category: { type: 'string' },
          search: { type: 'string' },
          sort: { type: 'string', enum: ['name', 'price', 'rating', 'downloads'] },
          order: { type: 'string', enum: ['asc', 'desc'] }
        }
      }
    }
  }, async (request, reply) => {
    const { category, search, sort = 'downloads', order = 'desc' } = request.query as any;
    
    let filteredPlugins = [...pluginStore];
    
    // 分类筛选
    if (category) {
      filteredPlugins = filteredPlugins.filter(p => p.category.toLowerCase() === category.toLowerCase());
    }
    
    // 搜索筛选
    if (search) {
      const searchLower = search.toLowerCase();
      filteredPlugins = filteredPlugins.filter(p => 
        p.name.toLowerCase().includes(searchLower) ||
        p.description.toLowerCase().includes(searchLower) ||
        p.tags.some(tag => tag.includes(searchLower))
      );
    }
    
    // 排序
    filteredPlugins.sort((a, b) => {
      const aVal = a[sort as keyof typeof a];
      const bVal = b[sort as keyof typeof b];
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return order === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return order === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      return 0;
    });
    
    return {
      plugins: filteredPlugins,
      total: filteredPlugins.length,
      categories: [...new Set(pluginStore.map(p => p.category))],
      filters: { category, search, sort, order }
    };
  });

  // 获取插件详情
  fastify.get('/store/:pluginId', {
    preHandler: [authMiddleware, requireRole(UserRole.ADMIN)],
    schema: {
      tags: ['plugin-store'],
      summary: '获取插件详情',
      params: {
        type: 'object',
        properties: {
          pluginId: { type: 'string' }
        },
        required: ['pluginId']
      }
    }
  }, async (request, reply) => {
    const { pluginId } = request.params as { pluginId: string };
    
    const plugin = pluginStore.find(p => p.id === pluginId);
    if (!plugin) {
      return reply.status(404).send({
        error: 'Plugin not found',
        message: `Plugin with ID '${pluginId}' not found in store`
      });
    }
    
    return plugin;
  });

  // 购买插件（生成许可证）
  fastify.post('/store/:pluginId/purchase', {
    preHandler: [authMiddleware, requireRole(UserRole.ADMIN)],
    schema: {
      tags: ['plugin-store'],
      summary: '购买插件',
      params: {
        type: 'object',
        properties: {
          pluginId: { type: 'string' }
        },
        required: ['pluginId']
      },
      body: {
        type: 'object',
        properties: {
          billingPeriod: { type: 'string', enum: ['monthly', 'yearly'] },
          paymentMethod: { type: 'string' }
        },
        required: ['billingPeriod', 'paymentMethod']
      }
    }
  }, async (request, reply) => {
    const { pluginId } = request.params as { pluginId: string };
    const { billingPeriod } = request.body as { billingPeriod: string };
    
    const plugin = pluginStore.find(p => p.id === pluginId);
    if (!plugin) {
      return reply.status(404).send({
        error: 'Plugin not found'
      });
    }
    
    // 模拟支付处理
    const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const licenseKey = `license_${pluginId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 计算许可证有效期
    const validUntil = new Date();
    if (billingPeriod === 'yearly') {
      validUntil.setFullYear(validUntil.getFullYear() + 1);
    } else {
      validUntil.setMonth(validUntil.getMonth() + 1);
    }
    
    return {
      success: true,
      orderId,
      plugin: {
        id: plugin.id,
        name: plugin.name,
        version: plugin.version
      },
      license: {
        key: licenseKey,
        type: plugin.license,
        validUntil: validUntil.toISOString(),
        features: plugin.features
      },
      billing: {
        period: billingPeriod,
        amount: plugin.price,
        currency: plugin.currency,
        nextBilling: validUntil.toISOString()
      },
      downloadUrl: `https://api.jiffoo.com/plugins/download/${pluginId}?license=${licenseKey}`
    };
  });

  // 获取试用许可证
  fastify.post('/store/:pluginId/trial', {
    preHandler: [authMiddleware, requireRole(UserRole.ADMIN)],
    schema: {
      tags: ['plugin-store'],
      summary: '获取插件试用许可证'
    }
  }, async (request, reply) => {
    const { pluginId } = request.params as { pluginId: string };
    
    const plugin = pluginStore.find(p => p.id === pluginId);
    if (!plugin) {
      return reply.status(404).send({
        error: 'Plugin not found'
      });
    }
    
    // 生成试用许可证
    const trialLicense = licenseService.generateTrialLicense(pluginId, 14); // 14天试用
    
    return {
      success: true,
      plugin: {
        id: plugin.id,
        name: plugin.name,
        version: plugin.version
      },
      trial: {
        license: trialLicense,
        durationDays: 14,
        limitations: [
          'Limited to 100 API calls per day',
          'Basic features only',
          'No premium support'
        ]
      },
      downloadUrl: `https://api.jiffoo.com/plugins/download/${pluginId}?trial=true`
    };
  });
}
