import { prisma } from '@/config/database';
import { redisCache } from '@/core/cache/redis';
import { enhancedLicenseManager } from '@/core/licensing/enhanced-license-manager';

export interface PluginMetadata {
  id: string;
  name: string;
  displayName: string;
  version: string;
  description: string;
  longDescription?: string;
  category: string;
  tags: string[];
  pricing: {
    type: 'free' | 'paid' | 'freemium';
    price: number;
    currency: string;
    billing: 'monthly' | 'yearly' | 'one-time';
    trialDays?: number;
  };
  features: string[];
  requirements: {
    minVersion: string;
    dependencies: string[];
    permissions: string[];
  };
  media: {
    icon: string;
    screenshots: string[];
    video?: string;
  };
  documentation: {
    readme: string;
    changelog: string;
    apiDocs?: string;
  };
  support: {
    email: string;
    documentation: string;
    community: string;
    issues: string;
  };
  author: {
    name: string;
    email: string;
    website?: string;
  };
  stats: {
    downloads: number;
    activeInstalls: number;
    rating: number;
    reviewCount: number;
  };
  status: 'active' | 'deprecated' | 'beta' | 'coming-soon';
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseRequest {
  userId: string;
  pluginId: string;
  licenseType: 'trial' | 'monthly' | 'yearly' | 'lifetime';
  paymentMethodId?: string;
}

export interface PurchaseResult {
  success: boolean;
  licenseKey?: string;
  paymentIntentId?: string;
  error?: string;
  trialEndsAt?: Date;
}

export class PluginStoreManager {
  private pluginCatalog: Map<string, PluginMetadata> = new Map();
  private initialized = false;

  // 开源版本连接到官方插件商店和授权服务
  private static readonly PLUGIN_STORE_URL = process.env.PLUGIN_STORE_URL || 'https://plugins.jiffoo.com';
  private static readonly LICENSE_SERVER_URL = process.env.LICENSE_SERVER_URL || 'https://license.jiffoo.com';
  private static readonly STORE_API_KEY = process.env.PLUGIN_STORE_API_KEY;
  private static readonly CACHE_TTL = 3600; // 1 hour
  private static readonly CACHE_PREFIX = 'plugin-store:';

  constructor() {
    // 同步初始化插件目录
    this.initializeCatalogSync();
  }

  private async ensureInitialized() {
    // Catalog is already initialized synchronously in constructor
    // No additional async initialization needed
  }

  /**
   * 同步初始化插件目录
   */
  private initializeCatalogSync() {
    // 高级分析插件
    const advancedAnalytics: PluginMetadata = {
      id: 'advanced-analytics',
      name: 'advanced-analytics',
      displayName: 'Advanced Analytics Pro',
      version: '2.0.0',
      description: 'Professional analytics and business intelligence for your e-commerce store',
      longDescription: `
        Transform your e-commerce data into actionable insights with Advanced Analytics Pro.
        This powerful plugin provides real-time dashboards, predictive analytics, custom reporting,
        and advanced customer segmentation to help you make data-driven decisions and grow your business.

        Key Features:
        • Real-time sales dashboard with key metrics
        • Predictive analytics for revenue forecasting
        • Custom report builder with 50+ metrics
        • Advanced customer segmentation and cohort analysis
        • Automated insights and recommendations
        • Data export in multiple formats (CSV, Excel, PDF)
        • API access for custom integrations
      `,
      category: 'Analytics',
      tags: ['analytics', 'reporting', 'business-intelligence', 'dashboard', 'insights'],
      pricing: {
        type: 'paid',
        price: 99,
        currency: 'USD',
        billing: 'monthly',
        trialDays: 14
      },
      features: [
        'real-time-dashboard',
        'predictive-analytics',
        'custom-reports',
        'data-export',
        'advanced-segmentation',
        'cohort-analysis',
        'revenue-forecasting',
        'api-access'
      ],
      requirements: {
        minVersion: '1.0.0',
        dependencies: [],
        permissions: ['read:orders', 'read:products', 'read:customers', 'read:analytics']
      },
      media: {
        icon: '/plugins/advanced-analytics/icon.png',
        screenshots: [
          '/plugins/advanced-analytics/screenshot1.png',
          '/plugins/advanced-analytics/screenshot2.png',
          '/plugins/advanced-analytics/screenshot3.png'
        ],
        video: '/plugins/advanced-analytics/demo.mp4'
      },
      documentation: {
        readme: '/plugins/advanced-analytics/README.md',
        changelog: '/plugins/advanced-analytics/CHANGELOG.md',
        apiDocs: '/plugins/advanced-analytics/api-docs.html'
      },
      support: {
        email: 'support@jiffoo.com',
        documentation: 'https://docs.jiffoo.com/plugins/advanced-analytics',
        community: 'https://community.jiffoo.com/c/plugins/advanced-analytics',
        issues: 'https://github.com/jiffoo/advanced-analytics/issues'
      },
      author: {
        name: 'Jiffoo Team',
        email: 'plugins@jiffoo.com',
        website: 'https://jiffoo.com'
      },
      stats: {
        downloads: 1250,
        activeInstalls: 890,
        rating: 4.8,
        reviewCount: 127
      },
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 营销自动化插件
    const marketingAutomation: PluginMetadata = {
      id: 'marketing-automation',
      name: 'marketing-automation',
      displayName: 'Marketing Automation Suite',
      version: '1.5.0',
      description: 'Automate your marketing campaigns and boost customer engagement',
      longDescription: `
        Supercharge your marketing efforts with our comprehensive automation suite.
        Create personalized customer journeys, automate email campaigns, segment customers
        intelligently, and track performance with detailed analytics.
      `,
      category: 'Marketing',
      tags: ['marketing', 'automation', 'email', 'campaigns', 'segmentation'],
      pricing: {
        type: 'paid',
        price: 149,
        currency: 'USD',
        billing: 'monthly',
        trialDays: 14
      },
      features: [
        'email-automation',
        'customer-segmentation',
        'campaign-builder',
        'ab-testing',
        'conversion-tracking',
        'personalization',
        'workflow-automation'
      ],
      requirements: {
        minVersion: '1.0.0',
        dependencies: [],
        permissions: ['read:customers', 'write:emails', 'read:orders', 'write:campaigns']
      },
      media: {
        icon: '/plugins/marketing-automation/icon.png',
        screenshots: [
          '/plugins/marketing-automation/screenshot1.png',
          '/plugins/marketing-automation/screenshot2.png'
        ]
      },
      documentation: {
        readme: '/plugins/marketing-automation/README.md',
        changelog: '/plugins/marketing-automation/CHANGELOG.md'
      },
      support: {
        email: 'support@jiffoo.com',
        documentation: 'https://docs.jiffoo.com/plugins/marketing-automation',
        community: 'https://community.jiffoo.com/c/plugins/marketing-automation',
        issues: 'https://github.com/jiffoo/marketing-automation/issues'
      },
      author: {
        name: 'Jiffoo Team',
        email: 'plugins@jiffoo.com',
        website: 'https://jiffoo.com'
      },
      stats: {
        downloads: 890,
        activeInstalls: 650,
        rating: 4.6,
        reviewCount: 89
      },
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 企业集成插件
    const enterpriseIntegration: PluginMetadata = {
      id: 'enterprise-integration',
      name: 'enterprise-integration',
      displayName: 'Enterprise Integration Hub',
      version: '1.0.0',
      description: 'Connect your store with enterprise systems like ERP, CRM, and more',
      longDescription: `
        Seamlessly integrate your e-commerce store with enterprise systems.
        Connect with popular ERP, CRM, accounting, and inventory management systems
        to streamline your business operations.
      `,
      category: 'Integration',
      tags: ['integration', 'erp', 'crm', 'enterprise', 'sync'],
      pricing: {
        type: 'paid',
        price: 299,
        currency: 'USD',
        billing: 'monthly',
        trialDays: 30
      },
      features: [
        'erp-integration',
        'crm-sync',
        'inventory-sync',
        'financial-integration',
        'data-mapping',
        'real-time-sync',
        'webhook-support'
      ],
      requirements: {
        minVersion: '1.0.0',
        dependencies: [],
        permissions: ['read:all', 'write:all', 'admin:integrations']
      },
      media: {
        icon: '/plugins/enterprise-integration/icon.png',
        screenshots: [
          '/plugins/enterprise-integration/screenshot1.png'
        ]
      },
      documentation: {
        readme: '/plugins/enterprise-integration/README.md',
        changelog: '/plugins/enterprise-integration/CHANGELOG.md'
      },
      support: {
        email: 'enterprise@jiffoo.com',
        documentation: 'https://docs.jiffoo.com/plugins/enterprise-integration',
        community: 'https://community.jiffoo.com/c/plugins/enterprise',
        issues: 'https://github.com/jiffoo/enterprise-integration/issues'
      },
      author: {
        name: 'Jiffoo Team',
        email: 'plugins@jiffoo.com',
        website: 'https://jiffoo.com'
      },
      stats: {
        downloads: 245,
        activeInstalls: 180,
        rating: 4.9,
        reviewCount: 34
      },
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Stripe 支付插件
    const stripePayment: PluginMetadata = {
      id: 'stripe-official',
      name: 'stripe-official',
      displayName: 'Stripe 支付 (官方版)',
      version: '1.0.0',
      description: 'Stripe 官方支付插件，支持信用卡和借记卡支付',
      longDescription: `
        Stripe 官方支付插件提供以下功能：
        - 创建支付意图 (PaymentIntent)
        - 处理 3D Secure 验证
        - 支持保存支付方式
        - 处理退款和部分退款
        - Webhook 事件处理
        - 支持多种货币和地区

        Stripe 是全球领先的在线支付处理平台，支持 135+ 种货币。
      `,
      category: 'Payment',
      tags: ['payment', 'stripe', 'credit-card', 'official'],
      pricing: {
        type: 'free',
        price: 0,
        currency: 'USD',
        billing: 'one-time'
      },
      features: [
        'payment-intent',
        'credit-card-processing',
        '3d-secure',
        'saved-payment-methods',
        'refunds',
        'webhooks',
        'multi-currency',
        'real-time-processing'
      ],
      requirements: {
        minVersion: '2.0.0',
        dependencies: [],
        permissions: ['payment.create', 'payment.verify', 'payment.refund', 'payment.webhook']
      },
      media: {
        icon: '/plugins/stripe-official/icon.png',
        screenshots: [
          '/plugins/stripe-official/screenshot1.png',
          '/plugins/stripe-official/screenshot2.png'
        ]
      },
      documentation: {
        readme: '/plugins/stripe-official/README.md',
        changelog: '/plugins/stripe-official/CHANGELOG.md',
        apiDocs: '/plugins/stripe-official/api-docs.html'
      },
      support: {
        email: 'support@jiffoo.com',
        documentation: 'https://docs.jiffoo.com/plugins/stripe-official',
        community: 'https://community.jiffoo.com/c/plugins/stripe',
        issues: 'https://github.com/jiffoo/stripe-official/issues'
      },
      author: {
        name: 'Jiffoo Team',
        email: 'plugins@jiffoo.com',
        website: 'https://jiffoo.com'
      },
      stats: {
        downloads: 5420,
        activeInstalls: 3890,
        rating: 4.9,
        reviewCount: 234
      },
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 添加到目录
    this.pluginCatalog.set('advanced-analytics', advancedAnalytics);
    this.pluginCatalog.set('marketing-automation', marketingAutomation);
    this.pluginCatalog.set('enterprise-integration', enterpriseIntegration);
    this.pluginCatalog.set('stripe-official', stripePayment);

    this.initialized = true;
  }



  /**
   * 获取所有插件
   */
  async getAllPlugins(): Promise<PluginMetadata[]> {
    const cached = await redisCache.get('plugin-catalog');
    if (cached) {
      return JSON.parse(cached as string);
    }

    const plugins = Array.from(this.pluginCatalog.values());
    await redisCache.set('plugin-catalog', JSON.stringify(plugins), 3600);
    return plugins;
  }

  /**
   * 根据ID获取插件
   */
  async getPluginById(id: string): Promise<PluginMetadata | null> {
    console.log(`Looking for plugin: ${id}`);
    console.log(`Plugin catalog size: ${this.pluginCatalog.size}`);
    console.log(`Plugin catalog keys: ${Array.from(this.pluginCatalog.keys())}`);
    const plugin = this.pluginCatalog.get(id);
    console.log(`Found plugin: ${plugin ? 'yes' : 'no'}`);
    return plugin || null;
  }

  /**
   * 搜索插件
   */
  async searchPlugins(query: string, category?: string): Promise<PluginMetadata[]> {
    const allPlugins = await this.getAllPlugins();

    return allPlugins.filter(plugin => {
      const matchesQuery = !query ||
        plugin.displayName.toLowerCase().includes(query.toLowerCase()) ||
        plugin.description.toLowerCase().includes(query.toLowerCase()) ||
        plugin.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()));

      const matchesCategory = !category || plugin.category === category;

      return matchesQuery && matchesCategory && plugin.status === 'active';
    });
  }

  /**
   * 获取插件分类
   */
  async getCategories(): Promise<string[]> {
    const plugins = await this.getAllPlugins();
    const categories = [...new Set(plugins.map(p => p.category))];
    return categories.sort();
  }

  /**
   * 购买插件
   */
  async purchasePlugin(request: PurchaseRequest): Promise<PurchaseResult> {
    try {
      const plugin = await this.getPluginById(request.pluginId);
      if (!plugin) {
        return { success: false, error: 'Plugin not found' };
      }

      // 检查是否已有有效许可证
      const existingLicense = await enhancedLicenseManager.validateLicense(
        request.pluginId,
        request.userId
      );

      if (existingLicense.valid) {
        return { success: false, error: 'You already have a valid license for this plugin' };
      }

      // 处理试用版
      if (request.licenseType === 'trial') {
        if (!plugin.pricing.trialDays) {
          return { success: false, error: 'Trial not available for this plugin' };
        }

        const trialEndsAt = new Date();
        trialEndsAt.setDate(trialEndsAt.getDate() + plugin.pricing.trialDays);

        const licenseKey = await enhancedLicenseManager.generateLicense({
          userId: request.userId,
          pluginName: request.pluginId,
          licenseType: 'trial',
          features: plugin.features,
          expiresAt: trialEndsAt
        });

        return {
          success: true,
          licenseKey,
          trialEndsAt
        };
      }

      // 处理付费许可证
      // 这里需要集成支付系统 (Stripe)
      // 暂时返回成功，实际实现需要处理支付

      let expiresAt: Date | undefined;
      if (plugin.pricing.billing === 'monthly') {
        expiresAt = new Date();
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      } else if (plugin.pricing.billing === 'yearly') {
        expiresAt = new Date();
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      }

      const licenseKey = await enhancedLicenseManager.generateLicense({
        userId: request.userId,
        pluginName: request.pluginId,
        licenseType: request.licenseType,
        features: plugin.features,
        expiresAt
      });

      return {
        success: true,
        licenseKey
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Purchase failed'
      };
    }
  }

  /**
   * 获取用户已购买的插件
   */
  async getUserPlugins(userId: string): Promise<any[]> {
    const licenses = await prisma.pluginLicense.findMany({
      where: { userId, status: 'active' },
      orderBy: { createdAt: 'desc' }
    });

    const userPlugins = [];
    for (const license of licenses) {
      const plugin = await this.getPluginById(license.pluginName);
      if (plugin) {
        userPlugins.push({
          ...plugin,
          license: {
            id: license.id,
            type: license.licenseType,
            expiresAt: license.expiresAt,
            features: JSON.parse(license.features)
          }
        });
      }
    }

    return userPlugins;
  }

  /**
   * 缓存插件目录
   */
  private async cachePluginCatalog(): Promise<void> {
    const plugins = Array.from(this.pluginCatalog.values());
    await redisCache.set('plugin-catalog', JSON.stringify(plugins), 3600);
  }

  /**
   * 更新插件统计
   */
  async updatePluginStats(pluginId: string, action: 'download' | 'install' | 'uninstall'): Promise<void> {
    const plugin = this.pluginCatalog.get(pluginId);
    if (!plugin) return;

    switch (action) {
      case 'download':
        plugin.stats.downloads++;
        break;
      case 'install':
        plugin.stats.activeInstalls++;
        break;
      case 'uninstall':
        plugin.stats.activeInstalls = Math.max(0, plugin.stats.activeInstalls - 1);
        break;
    }

    plugin.updatedAt = new Date().toISOString();
    await this.cachePluginCatalog();
  }
}

// 单例实例
export const pluginStoreManager = new PluginStoreManager();
