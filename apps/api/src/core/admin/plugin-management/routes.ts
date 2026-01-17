/**
 * Plugin Management Routes
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware, requireAdmin } from '@/core/auth/middleware';
import { PluginManagementService } from './service';
import type { PluginConfig } from './types';

// Built-in plugins that are always available
// Alpha: Only Stripe is included as built-in payment method
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
];

// Plugin categories
const PLUGIN_CATEGORIES = [
  { id: 'payment', name: 'Payment', count: 1 }, // Alpha: Only Stripe
  { id: 'shipping', name: 'Shipping', count: 0 },
  { id: 'marketing', name: 'Marketing', count: 0 },
  { id: 'analytics', name: 'Analytics', count: 0 },
  { id: 'seo', name: 'SEO', count: 0 },
  { id: 'social', name: 'Social', count: 0 },
];

export async function adminPluginRoutes(fastify: FastifyInstance) {
  // ============================================================================
  // Auth middleware: Must run before schema validation
  // ============================================================================
  fastify.addHook('onRequest', authMiddleware);
  fastify.addHook('onRequest', requireAdmin);

  // ============================================================================
  // Alpha Gate: Disable marketplace routes unless explicitly enabled
  // ============================================================================
  fastify.addHook('onRequest', async (request, reply) => {
    const isMarketplaceRoute = request.url.includes('/marketplace');
    if (isMarketplaceRoute && process.env.ENABLE_MARKETPLACE !== 'true') {
      return reply.code(501).send({
        success: false,
        error: 'NOT_IMPLEMENTED',
        message: 'Online marketplace is not available in this version. Please use offline ZIP installation via /api/extensions/*',
      });
    }
  });

  // ============================================================================
  // Marketplace Routes (must be defined before /:slug to avoid conflicts)
  // ============================================================================

  /**
   * GET /api/admin/plugins/marketplace
   * Get plugins from marketplace (built-in + remote)
   */
  fastify.get('/marketplace', {
    schema: {
      tags: ['admin-plugins'],
      summary: 'Get marketplace plugins',
      security: [{ bearerAuth: [] }],
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const query = request.query as any;

      // Alpha: Only built-in plugins are available
      // Remote marketplace is not supported in open-source version
      let plugins: any[] = [...BUILTIN_PLUGINS];

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
    schema: {
      tags: ['admin-plugins'],
      summary: 'Get marketplace plugin details',
      security: [{ bearerAuth: [] }],
    },
  }, async (request: FastifyRequest<{ Params: { slug: string } }>, reply: FastifyReply) => {
    try {
      const { slug } = request.params;

      // Alpha: Only built-in plugins are available
      const builtinPlugin = BUILTIN_PLUGINS.find(p => p.slug === slug);
      if (builtinPlugin) {
        return reply.send({ success: true, data: builtinPlugin });
      }

      // Remote marketplace is not supported in open-source version
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
   * Get installed plugins list
   */
  fastify.get('/', {
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

      // Alpha: Remote marketplace download is not supported
      // Use offline ZIP installation via /api/extensions/plugin/install instead
      return reply.code(400).send({
        success: false,
        error: 'NOT_SUPPORTED',
        message: 'Remote plugin download is not available. Please use offline ZIP installation via /api/extensions/plugin/install',
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to install plugin');
      return reply.code(500).send({ success: false, error: error.message });
    }
  });

  /**
   * GET /api/admin/plugins/:slug
   * Get plugin state
   */
  fastify.get<{ Params: { slug: string } }>('/:slug', {
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
   * Enable a plugin
   */
  fastify.post<{ Params: { slug: string } }>('/:slug/enable', {
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
   * Disable a plugin
   */
  fastify.post<{ Params: { slug: string } }>('/:slug/disable', {
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
   * Update plugin config
   */
  fastify.put<{ Params: { slug: string }; Body: PluginConfig }>('/:slug/config', {
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

