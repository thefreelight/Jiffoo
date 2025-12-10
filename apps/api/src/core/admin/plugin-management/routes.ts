/**
 * Plugin Management Routes
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Readable } from 'stream';
import * as fs from 'fs';
import { authMiddleware, requireAdmin } from '@/core/auth/middleware';
import { PluginManagementService } from './service';
import type { PluginConfig } from './types';
import {
  checkMarketplaceStatus,
  fetchPlugins,
  fetchPluginDetails,
  downloadPlugin,
} from '@/services/marketplace/client';
import { ExtensionInstaller } from '@/services/extension-installer';

/**
 * Convert Buffer to Readable stream
 */
function bufferToStream(buffer: Buffer): Readable {
  const readable = new Readable();
  readable.push(buffer);
  readable.push(null);
  return readable;
}

// Built-in plugins that are always available
const BUILTIN_PLUGINS = [
  {
    id: 'stripe-payment',
    slug: 'stripe-payment',
    name: 'Stripe Payment',
    description: 'Accept credit card payments with Stripe. Supports one-time payments, subscriptions, and more.',
    version: '1.0.0',
    author: 'Jiffoo Team',
    category: 'payment',
    icon: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/stripe.svg',
    iconBgColor: '#635BFF',
    rating: 4.9,
    installCount: 10000,
    businessModel: 'free',
    price: 0,
    features: [
      'Credit card payments',
      'Apple Pay & Google Pay',
      'Subscription billing',
      'Webhook support',
      'Refund management'
    ],
    screenshots: [],
    isBuiltin: true,
    isOfficial: true, // Jiffoo Team official plugin
    verified: true,
  },
  {
    id: 'paypal-payment',
    slug: 'paypal-payment',
    name: 'PayPal Payment',
    description: 'Accept PayPal payments including PayPal Credit and Pay Later options.',
    version: '1.0.0',
    author: 'Jiffoo Team',
    category: 'payment',
    icon: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/paypal.svg',
    iconBgColor: '#003087',
    rating: 4.7,
    installCount: 8000,
    businessModel: 'free',
    price: 0,
    features: [
      'PayPal checkout',
      'PayPal Credit',
      'Pay Later options',
      'Refund support'
    ],
    screenshots: [],
    isBuiltin: true,
    isOfficial: true,
    verified: true,
  },
  {
    id: 'wechat-payment',
    slug: 'wechat-payment',
    name: 'WeChat Pay',
    description: 'Accept WeChat Pay for Chinese customers. QR code and in-app payments.',
    version: '1.0.0',
    author: 'Jiffoo Team',
    category: 'payment',
    icon: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/wechat.svg',
    iconBgColor: '#07C160',
    rating: 4.8,
    installCount: 5000,
    businessModel: 'free',
    price: 0,
    features: [
      'QR code payments',
      'In-app payments',
      'Mini program support',
      'Refund management'
    ],
    screenshots: [],
    isBuiltin: true,
    isOfficial: true,
    verified: true,
  },
  {
    id: 'alipay-payment',
    slug: 'alipay-payment',
    name: 'Alipay',
    description: 'Accept Alipay payments for Chinese customers.',
    version: '1.0.0',
    author: 'Jiffoo Team',
    category: 'payment',
    icon: 'https://cdn.jsdelivr.net/gh/simple-icons/simple-icons/icons/alipay.svg',
    iconBgColor: '#1677FF',
    rating: 4.8,
    installCount: 4500,
    businessModel: 'free',
    price: 0,
    features: [
      'QR code payments',
      'Mobile payments',
      'Cross-border support',
      'Refund management'
    ],
    screenshots: [],
    isBuiltin: true,
    isOfficial: true,
    verified: true,
  },
];

// Plugin categories
const PLUGIN_CATEGORIES = [
  { id: 'payment', name: 'Payment', count: 4 },
  { id: 'shipping', name: 'Shipping', count: 0 },
  { id: 'marketing', name: 'Marketing', count: 0 },
  { id: 'analytics', name: 'Analytics', count: 0 },
  { id: 'seo', name: 'SEO', count: 0 },
  { id: 'social', name: 'Social', count: 0 },
];

export async function adminPluginRoutes(fastify: FastifyInstance) {
  // ============================================================================
  // Marketplace Routes (must be defined before /:slug to avoid conflicts)
  // ============================================================================

  /**
   * GET /api/admin/plugins/marketplace
   * Get plugins from marketplace (built-in + remote)
   */
  fastify.get('/marketplace', {
    preHandler: [authMiddleware, requireAdmin],
    schema: {
      tags: ['admin-plugins'],
      summary: 'Get marketplace plugins',
      security: [{ bearerAuth: [] }],
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;

      // Start with built-in plugins
      let plugins: any[] = [...BUILTIN_PLUGINS];

      // Try to fetch from remote marketplace
      try {
        const status = await checkMarketplaceStatus();
        if (status.online) {
          const remotePlugins = await fetchPlugins({
            category: query.category,
            search: query.search,
            priceType: query.priceType,
            sortBy: query.sortBy || 'popular',
            page: parseInt(query.page || '1', 10),
            limit: parseInt(query.limit || '20', 10),
          });
          if (remotePlugins.items) {
            plugins = [...plugins, ...remotePlugins.items];
          }
        }
      } catch {
        // Remote marketplace unavailable, use built-in only
      }

      // Filter by category if specified
      if (query.category && query.category !== 'all') {
        plugins = plugins.filter(p => p.category === query.category);
      }

      // Filter by search term
      if (query.search) {
        const search = query.search.toLowerCase();
        plugins = plugins.filter(p =>
          p.name.toLowerCase().includes(search) ||
          p.description.toLowerCase().includes(search)
        );
      }

      return reply.send({
        success: true,
        data: {
          plugins,
          total: plugins.length,
          page: 1,
          limit: 20,
        },
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to fetch marketplace plugins');
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/admin/plugins/marketplace/search
   * Search plugins in marketplace
   */
  fastify.get('/marketplace/search', {
    preHandler: [authMiddleware, requireAdmin],
    schema: {
      tags: ['admin-plugins'],
      summary: 'Search marketplace plugins',
      security: [{ bearerAuth: [] }],
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;
      const searchTerm = (query.q || '').toLowerCase();

      let plugins = BUILTIN_PLUGINS.filter(p =>
        p.name.toLowerCase().includes(searchTerm) ||
        p.description.toLowerCase().includes(searchTerm) ||
        p.category.toLowerCase().includes(searchTerm)
      );

      if (query.category && query.category !== 'all') {
        plugins = plugins.filter(p => p.category === query.category);
      }

      return reply.send({
        success: true,
        data: {
          plugins,
          total: plugins.length,
        },
      });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/admin/plugins/marketplace/:slug
   * Get plugin details from marketplace
   */
  fastify.get('/marketplace/:slug', {
    preHandler: [authMiddleware, requireAdmin],
    schema: {
      tags: ['admin-plugins'],
      summary: 'Get marketplace plugin details',
      security: [{ bearerAuth: [] }],
    },
  }, async (request: FastifyRequest<{ Params: { slug: string } }>, reply: FastifyReply) => {
    try {
      const { slug } = request.params;

      // Check built-in plugins first
      const builtinPlugin = BUILTIN_PLUGINS.find(p => p.slug === slug);
      if (builtinPlugin) {
        return reply.send({ success: true, data: builtinPlugin });
      }

      // Try remote marketplace
      try {
        const plugin = await fetchPluginDetails(slug);
        if (plugin) {
          return reply.send({ success: true, data: plugin });
        }
      } catch {
        // Remote unavailable
      }

      return reply.code(404).send({ success: false, error: 'Plugin not found' });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/admin/plugins/categories
   * Get plugin categories
   */
  fastify.get('/categories', {
    preHandler: [authMiddleware, requireAdmin],
    schema: {
      tags: ['admin-plugins'],
      summary: 'Get plugin categories',
      security: [{ bearerAuth: [] }],
    },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      return reply.send({
        success: true,
        data: {
          categories: PLUGIN_CATEGORIES,
        },
      });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/admin/plugins/installed
   * Get installed plugins list
   */
  fastify.get('/installed', {
    preHandler: [authMiddleware, requireAdmin],
    schema: {
      tags: ['admin-plugins'],
      summary: 'Get installed plugins list',
      security: [{ bearerAuth: [] }],
    },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await PluginManagementService.getInstalledPlugins();
      // Transform to expected format: { plugins: [{ plugin: { slug, ... }, enabled }] }
      const transformedPlugins = result.plugins.map(p => ({
        plugin: {
          slug: p.slug,
          name: p.name,
          version: p.version,
          description: p.description,
          author: p.author,
          category: p.category,
          icon: p.icon,
        },
        enabled: p.enabled,
      }));
      return reply.send({ success: true, data: { plugins: transformedPlugins } });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  // ============================================================================
  // Plugin Management Routes
  // ============================================================================

  /**
   * GET /api/admin/plugins
   * 获取已安装插件列表
   */
  fastify.get('/', {
    preHandler: [authMiddleware, requireAdmin],
    schema: {
      tags: ['admin-plugins'],
      summary: 'Get installed plugins list',
      security: [{ bearerAuth: [] }],
    },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await PluginManagementService.getInstalledPlugins();
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/admin/plugins/:slug/install
   * Install a plugin
   */
  fastify.post<{ Params: { slug: string } }>('/:slug/install', {
    preHandler: [authMiddleware, requireAdmin],
    schema: {
      tags: ['admin-plugins'],
      summary: 'Install a plugin',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    try {
      const { slug } = request.params;

      // Check if it's a built-in plugin
      const builtinPlugin = BUILTIN_PLUGINS.find(p => p.slug === slug);
      if (builtinPlugin) {
        // For built-in plugins, just enable them
        const result = await PluginManagementService.installBuiltinPlugin(slug, builtinPlugin);
        return reply.send({
          success: true,
          data: result,
          message: `Plugin "${slug}" installed successfully`,
        });
      }

      // Try to download from marketplace
      const downloadResult = await downloadPlugin(slug);
      if (!downloadResult.success || !downloadResult.zipPath) {
        return reply.code(400).send({
          success: false,
          error: downloadResult.error || 'Download failed',
        });
      }

      // Install using ExtensionInstaller
      const zipBuffer = fs.readFileSync(downloadResult.zipPath);
      const zipStream = bufferToStream(zipBuffer);
      const installer = new ExtensionInstaller();
      const installResult = await installer.installFromZip('plugin', zipStream);

      // Clean up temp file
      fs.unlinkSync(downloadResult.zipPath);

      return reply.send({
        success: true,
        data: {
          slug: installResult.slug,
          version: installResult.version,
        },
        message: `Plugin "${slug}" installed successfully`,
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to install plugin');
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/admin/plugins/:slug
   * 获取插件状态
   */
  fastify.get<{ Params: { slug: string } }>('/:slug', {
    preHandler: [authMiddleware, requireAdmin],
    schema: {
      tags: ['admin-plugins'],
      summary: 'Get plugin state',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          slug: { type: 'string' },
        },
        required: ['slug'],
      },
    },
  }, async (request, reply) => {
    try {
      const { slug } = request.params;
      const state = await PluginManagementService.getPluginState(slug);
      if (!state) {
        return reply.code(404).send({ success: false, error: 'Plugin not found' });
      }
      return reply.send({ success: true, data: state });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/admin/plugins/:slug/enable
   * 启用插件
   */
  fastify.post<{ Params: { slug: string } }>('/:slug/enable', {
    preHandler: [authMiddleware, requireAdmin],
    schema: {
      tags: ['admin-plugins'],
      summary: 'Enable a plugin',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          slug: { type: 'string' },
        },
        required: ['slug'],
      },
    },
  }, async (request, reply) => {
    try {
      const { slug } = request.params;
      const result = await PluginManagementService.enablePlugin(slug);
      return reply.send({ success: true, data: result, message: `Plugin "${slug}" enabled` });
    } catch (error: any) {
      return reply.code(400).send({ success: false, error: error.message });
    }
  });

  /**
   * POST /api/admin/plugins/:slug/disable
   * 禁用插件
   */
  fastify.post<{ Params: { slug: string } }>('/:slug/disable', {
    preHandler: [authMiddleware, requireAdmin],
    schema: {
      tags: ['admin-plugins'],
      summary: 'Disable a plugin',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          slug: { type: 'string' },
        },
        required: ['slug'],
      },
    },
  }, async (request, reply) => {
    try {
      const { slug } = request.params;
      const result = await PluginManagementService.disablePlugin(slug);
      return reply.send({ success: true, data: result, message: `Plugin "${slug}" disabled` });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  /**
   * PUT /api/admin/plugins/:slug/config
   * 更新插件配置
   */
  fastify.put<{ Params: { slug: string }; Body: PluginConfig }>('/:slug/config', {
    preHandler: [authMiddleware, requireAdmin],
    schema: {
      tags: ['admin-plugins'],
      summary: 'Update plugin config',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          slug: { type: 'string' },
        },
        required: ['slug'],
      },
      body: {
        type: 'object',
      },
    },
  }, async (request, reply) => {
    try {
      const { slug } = request.params;
      // Support both { configData: {...} } and direct config object
      const body = request.body as any;
      const config = body.configData || body;
      const result = await PluginManagementService.updatePluginConfig(slug, config);
      return reply.send({ success: true, data: result });
    } catch (error: any) {
      return reply.code(500).send({ success: false, error: error.message });
    }
  });
}

