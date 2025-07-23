import { prisma } from '@/config/database';
import { redisCache } from '@/core/cache/redis';

export interface TemplateMetadata {
  id: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  tags: string[];
  pricing: {
    type: 'free' | 'paid';
    price: number;
    currency: string;
    licenses: {
      single: number;    // 单站点许可
      extended: number;  // 扩展许可
      developer: number; // 开发者许可
    };
  };
  features: string[];
  preview: string;
  demoUrl?: string;
  downloadUrl?: string;
  version: string;
  author: string;
  authorEmail: string;
  stats: {
    downloads: number;
    rating: number;
    reviewCount: number;
  };
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseTemplateRequest {
  userId: string;
  templateId: string;
  licenseType: 'single' | 'extended' | 'developer';
}

export class TemplateManager {
  private templates: Map<string, TemplateMetadata> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  /**
   * 初始化模板目录
   */
  private initializeTemplates() {
    // 现代电商模板
    const modernEcommerce: TemplateMetadata = {
      id: 'modern-ecommerce',
      name: 'modern-ecommerce',
      displayName: 'Modern E-commerce',
      description: 'A sleek and modern e-commerce template with advanced features',
      category: 'ecommerce',
      tags: ['modern', 'responsive', 'dark-mode', 'animations'],
      pricing: {
        type: 'paid',
        price: 49,
        currency: 'USD',
        licenses: {
          single: 49,
          extended: 149,
          developer: 299
        }
      },
      features: [
        'Responsive design',
        'Dark mode support',
        'Product quick view',
        'Advanced filtering',
        'Wishlist functionality',
        'Multi-currency support',
        'SEO optimized',
        'Performance optimized'
      ],
      preview: '/templates/modern-ecommerce/preview.jpg',
      demoUrl: 'https://demo.jiffoo.com/modern-ecommerce',
      downloadUrl: '/templates/modern-ecommerce/download',
      version: '2.1.0',
      author: 'Jiffoo Design Team',
      authorEmail: 'design@jiffoo.com',
      stats: {
        downloads: 1250,
        rating: 4.8,
        reviewCount: 89
      },
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 极简商店模板
    const minimalistStore: TemplateMetadata = {
      id: 'minimalist-store',
      name: 'minimalist-store',
      displayName: 'Minimalist Store',
      description: 'Clean and minimalist design perfect for fashion and lifestyle brands',
      category: 'ecommerce',
      tags: ['minimalist', 'clean', 'fashion', 'lifestyle'],
      pricing: {
        type: 'paid',
        price: 39,
        currency: 'USD',
        licenses: {
          single: 39,
          extended: 119,
          developer: 239
        }
      },
      features: [
        'Minimalist design',
        'Mobile-first approach',
        'Instagram integration',
        'Newsletter signup',
        'Product galleries',
        'Customer reviews',
        'Social sharing',
        'Fast loading'
      ],
      preview: '/templates/minimalist-store/preview.jpg',
      demoUrl: 'https://demo.jiffoo.com/minimalist-store',
      downloadUrl: '/templates/minimalist-store/download',
      version: '1.5.0',
      author: 'Jiffoo Design Team',
      authorEmail: 'design@jiffoo.com',
      stats: {
        downloads: 890,
        rating: 4.6,
        reviewCount: 67
      },
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 免费基础模板
    const basicStore: TemplateMetadata = {
      id: 'basic-store',
      name: 'basic-store',
      displayName: 'Basic Store',
      description: 'Free starter template for small businesses',
      category: 'ecommerce',
      tags: ['free', 'basic', 'starter', 'simple'],
      pricing: {
        type: 'free',
        price: 0,
        currency: 'USD',
        licenses: {
          single: 0,
          extended: 0,
          developer: 0
        }
      },
      features: [
        'Basic e-commerce layout',
        'Product catalog',
        'Shopping cart',
        'Contact form',
        'Responsive design',
        'Basic SEO'
      ],
      preview: '/templates/basic-store/preview.jpg',
      demoUrl: 'https://demo.jiffoo.com/basic-store',
      downloadUrl: '/templates/basic-store/download',
      version: '1.0.0',
      author: 'Jiffoo Team',
      authorEmail: 'templates@jiffoo.com',
      stats: {
        downloads: 3450,
        rating: 4.2,
        reviewCount: 156
      },
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // 企业级模板
    const enterpriseStore: TemplateMetadata = {
      id: 'enterprise-store',
      name: 'enterprise-store',
      displayName: 'Enterprise Store',
      description: 'Professional template for large-scale e-commerce operations',
      category: 'ecommerce',
      tags: ['enterprise', 'professional', 'b2b', 'advanced'],
      pricing: {
        type: 'paid',
        price: 199,
        currency: 'USD',
        licenses: {
          single: 199,
          extended: 499,
          developer: 999
        }
      },
      features: [
        'B2B functionality',
        'Bulk ordering',
        'Customer accounts',
        'Advanced search',
        'Multi-vendor support',
        'Inventory management',
        'Analytics dashboard',
        'API integration ready'
      ],
      preview: '/templates/enterprise-store/preview.jpg',
      demoUrl: 'https://demo.jiffoo.com/enterprise-store',
      downloadUrl: '/templates/enterprise-store/download',
      version: '3.0.0',
      author: 'Jiffoo Enterprise Team',
      authorEmail: 'enterprise@jiffoo.com',
      stats: {
        downloads: 234,
        rating: 4.9,
        reviewCount: 45
      },
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.templates.set('modern-ecommerce', modernEcommerce);
    this.templates.set('minimalist-store', minimalistStore);
    this.templates.set('basic-store', basicStore);
    this.templates.set('enterprise-store', enterpriseStore);
  }

  /**
   * 获取所有模板
   */
  async getAllTemplates(): Promise<TemplateMetadata[]> {
    const cached = await redisCache.get('template-catalog');
    if (cached) {
      return JSON.parse(cached as string);
    }

    const templates = Array.from(this.templates.values());
    await redisCache.set('template-catalog', JSON.stringify(templates), 3600);
    return templates;
  }

  /**
   * 根据ID获取模板
   */
  async getTemplateById(id: string): Promise<TemplateMetadata | null> {
    return this.templates.get(id) || null;
  }

  /**
   * 搜索模板
   */
  async searchTemplates(query?: string, category?: string): Promise<TemplateMetadata[]> {
    const allTemplates = await this.getAllTemplates();

    return allTemplates.filter(template => {
      const matchesQuery = !query ||
        template.displayName.toLowerCase().includes(query.toLowerCase()) ||
        template.description.toLowerCase().includes(query.toLowerCase()) ||
        template.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()));

      const matchesCategory = !category || template.category === category;

      return matchesQuery && matchesCategory && template.status === 'active';
    });
  }

  /**
   * 获取模板分类
   */
  async getCategories(): Promise<string[]> {
    const templates = await this.getAllTemplates();
    const categories = [...new Set(templates.map(t => t.category))];
    return categories.sort();
  }

  /**
   * 购买模板
   */
  async purchaseTemplate(request: PurchaseTemplateRequest): Promise<{
    success: boolean;
    purchaseId?: string;
    downloadUrl?: string;
    error?: string;
  }> {
    try {
      const template = await this.getTemplateById(request.templateId);
      if (!template) {
        return { success: false, error: 'Template not found' };
      }

      // 检查是否已购买
      const existingPurchase = await prisma.templatePurchase.findFirst({
        where: {
          userId: request.userId,
          templateId: request.templateId,
          status: 'completed'
        }
      });

      if (existingPurchase) {
        return {
          success: true,
          purchaseId: existingPurchase.id,
          downloadUrl: template.downloadUrl
        };
      }

      // 计算价格
      const price = template.pricing.licenses[request.licenseType];

      // 创建购买记录
      const purchase = await prisma.templatePurchase.create({
        data: {
          userId: request.userId,
          templateId: request.templateId,
          price,
          currency: template.pricing.currency,
          licenseType: request.licenseType,
          status: template.pricing.type === 'free' ? 'completed' : 'pending',
          maxDownloads: request.licenseType === 'developer' ? 100 : 5
        }
      });

      // 如果是免费模板，直接完成
      if (template.pricing.type === 'free') {
        await this.updateTemplateStats(request.templateId, 'download');

        return {
          success: true,
          purchaseId: purchase.id,
          downloadUrl: template.downloadUrl
        };
      }

      // 付费模板需要支付处理
      // 这里应该集成支付系统

      return {
        success: true,
        purchaseId: purchase.id
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Purchase failed'
      };
    }
  }

  /**
   * 获取用户购买的模板
   */
  async getUserTemplates(userId: string): Promise<any[]> {
    const purchases = await prisma.templatePurchase.findMany({
      where: {
        userId,
        status: 'completed'
      },
      include: {
        template: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return purchases.map(purchase => {
      const template = JSON.parse(JSON.stringify(purchase.template));
      return {
        purchaseId: purchase.id,
        template: {
          id: template.id,
          name: template.name,
          displayName: template.displayName,
          description: template.description,
          category: template.category,
          preview: template.preview,
          demoUrl: template.demoUrl,
          version: template.version
        },
        licenseType: purchase.licenseType,
        downloadCount: purchase.downloadCount,
        maxDownloads: purchase.maxDownloads,
        purchaseDate: purchase.createdAt,
        downloadUrl: template.downloadUrl
      };
    });
  }

  /**
   * 下载模板
   */
  async downloadTemplate(userId: string, purchaseId: string): Promise<{
    success: boolean;
    downloadUrl?: string;
    error?: string;
  }> {
    try {
      const purchase = await prisma.templatePurchase.findFirst({
        where: {
          id: purchaseId,
          userId,
          status: 'completed'
        },
        include: {
          template: true
        }
      });

      if (!purchase) {
        return { success: false, error: 'Purchase not found or not completed' };
      }

      // 检查下载限制
      if (purchase.downloadCount >= purchase.maxDownloads) {
        return { success: false, error: 'Download limit exceeded' };
      }

      // 更新下载次数
      await prisma.templatePurchase.update({
        where: { id: purchaseId },
        data: { downloadCount: { increment: 1 } }
      });

      // 更新模板统计
      await this.updateTemplateStats(purchase.templateId, 'download');

      const template = JSON.parse(JSON.stringify(purchase.template));

      return {
        success: true,
        downloadUrl: template.downloadUrl
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Download failed'
      };
    }
  }

  /**
   * 更新模板统计
   */
  async updateTemplateStats(templateId: string, action: 'download' | 'view'): Promise<void> {
    const template = this.templates.get(templateId);
    if (!template) return;

    switch (action) {
      case 'download':
        template.stats.downloads++;
        break;
      case 'view':
        // 可以添加浏览量统计
        break;
    }

    template.updatedAt = new Date().toISOString();

    // 清除缓存
    await redisCache.del('template-catalog');
  }

  /**
   * 获取热门模板
   */
  async getFeaturedTemplates(): Promise<TemplateMetadata[]> {
    const allTemplates = await this.getAllTemplates();

    return allTemplates
      .filter(t => t.status === 'active')
      .sort((a, b) => {
        const scoreA = a.stats.rating * 0.7 + (a.stats.downloads / 1000) * 0.3;
        const scoreB = b.stats.rating * 0.7 + (b.stats.downloads / 1000) * 0.3;
        return scoreB - scoreA;
      })
      .slice(0, 6);
  }
}

// 单例实例
export const templateManager = new TemplateManager();

// 导出路由
export async function templateRoutes(fastifyInstance: any) {
  // Temporarily disable Fastify type imports
  // const fastifyModule = await import('fastify');
  // const FastifyInstance = fastifyModule.FastifyInstance;
  // const FastifyRequest = fastifyModule.FastifyRequest;
  // const FastifyReply = fastifyModule.FastifyReply;
  const { authMiddleware } = await import('@/core/auth/middleware');
  const { z } = await import('zod');

  // 请求验证模式
  const purchaseTemplateSchema = z.object({
    templateId: z.string().min(1),
    licenseType: z.enum(['single', 'extended', 'developer'])
  });

  const searchTemplatesSchema = z.object({
    q: z.string().optional(),
    category: z.string().optional(),
    page: z.number().min(1).default(1),
    limit: z.number().min(1).max(50).default(20)
  });

  /**
   * 获取所有模板
   * GET /api/templates
   */
  fastifyInstance.get('/', {
    schema: {
      tags: ['templates'],
      summary: '获取模板列表',
      description: '获取模板市场中的所有可用模板',
      querystring: {
        type: 'object',
        properties: {
          q: { type: 'string', description: '搜索关键词' },
          category: { type: 'string', description: '模板分类' },
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 50, default: 20 }
        }
      }
    }
  }, async (request: any, reply: any) => {
    try {
      const query = request.query;
      const validation = searchTemplatesSchema.parse(query);

      let templates = await templateManager.searchTemplates(validation.q, validation.category);

      // 分页
      const total = templates.length;
      const totalPages = Math.ceil(total / validation.limit);
      const startIndex = (validation.page - 1) * validation.limit;
      const endIndex = startIndex + validation.limit;
      const paginatedTemplates = templates.slice(startIndex, endIndex);

      return reply.send({
        templates: paginatedTemplates,
        pagination: {
          page: validation.page,
          limit: validation.limit,
          total,
          totalPages
        }
      });
    } catch (error) {
      return reply.status(400).send({
        error: 'Failed to fetch templates',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 获取单个模板详情
   * GET /api/templates/:id
   */
  fastifyInstance.get('/:id', {
    schema: {
      tags: ['templates'],
      summary: '获取模板详情',
      description: '获取指定模板的详细信息',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      }
    }
  }, async (request: any, reply: any) => {
    try {
      const params = request.params;
      const template = await templateManager.getTemplateById(params.id);

      if (!template) {
        return reply.status(404).send({ error: 'Template not found' });
      }

      // 如果用户已登录，检查是否已购买
      let userPurchase = null;
      if (request.user) {
        const userId = request.user.id;
        const userTemplates = await templateManager.getUserTemplates(userId);
        userPurchase = userTemplates.find(t => t.template.id === params.id);
      }

      return reply.send({
        template,
        userPurchase
      });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to fetch template details',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 获取模板分类
   * GET /api/templates/categories
   */
  fastifyInstance.get('/categories', {
    schema: {
      tags: ['templates'],
      summary: '获取模板分类',
      description: '获取所有可用的模板分类'
    }
  }, async (request: any, reply: any) => {
    try {
      const categories = await templateManager.getCategories();
      return reply.send({ categories });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to fetch categories',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 购买模板
   * POST /api/templates/purchase
   */
  fastifyInstance.post('/purchase', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['templates'],
      summary: '购买模板',
      description: '购买或下载模板',
      body: {
        type: 'object',
        required: ['templateId', 'licenseType'],
        properties: {
          templateId: { type: 'string' },
          licenseType: { type: 'string', enum: ['single', 'extended', 'developer'] }
        }
      }
    }
  }, async (request: any, reply: any) => {
    try {
      const body = request.body;
      const validation = purchaseTemplateSchema.parse(body);
      const userId = request.user.id;

      const result = await templateManager.purchaseTemplate({
        userId,
        templateId: validation.templateId,
        licenseType: validation.licenseType
      });

      if (!result.success) {
        return reply.status(400).send({
          error: 'Purchase failed',
          message: result.error
        });
      }

      return reply.send({
        success: true,
        purchaseId: result.purchaseId,
        downloadUrl: result.downloadUrl,
        message: 'Template purchased successfully'
      });
    } catch (error) {
      return reply.status(400).send({
        error: 'Purchase failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 获取用户已购买的模板
   * GET /api/templates/my-templates
   */
  fastifyInstance.get('/my-templates', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['templates'],
      summary: '获取我的模板',
      description: '获取当前用户已购买的所有模板'
    }
  }, async (request: any, reply: any) => {
    try {
      const userId = request.user.id;
      const userTemplates = await templateManager.getUserTemplates(userId);

      return reply.send({
        templates: userTemplates
      });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to fetch user templates',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 下载模板
   * GET /api/templates/download/:purchaseId
   */
  fastifyInstance.get('/download/:purchaseId', {
    preHandler: [authMiddleware],
    schema: {
      tags: ['templates'],
      summary: '下载模板',
      description: '下载已购买的模板文件',
      params: {
        type: 'object',
        properties: {
          purchaseId: { type: 'string' }
        }
      }
    }
  }, async (request: any, reply: any) => {
    try {
      const params = request.params;
      const userId = request.user.id;

      const result = await templateManager.downloadTemplate(userId, params.purchaseId);

      if (!result.success) {
        return reply.status(400).send({
          error: 'Download failed',
          message: result.error
        });
      }

      return reply.send({
        success: true,
        downloadUrl: result.downloadUrl,
        message: 'Download ready'
      });
    } catch (error) {
      return reply.status(500).send({
        error: 'Download failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * 获取热门模板
   * GET /api/templates/featured
   */
  fastifyInstance.get('/featured', {
    schema: {
      tags: ['templates'],
      summary: '获取热门模板',
      description: '获取推荐的热门模板'
    }
  }, async (request: any, reply: any) => {
    try {
      const featured = await templateManager.getFeaturedTemplates();
      return reply.send({ featured });
    } catch (error) {
      return reply.status(500).send({
        error: 'Failed to fetch featured templates',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
