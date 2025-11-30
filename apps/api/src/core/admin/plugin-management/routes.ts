import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware, tenantMiddleware, adminMiddleware } from '@/core/auth/middleware';
import { AdminPluginService } from './service';
import {
  InstallPluginSchema,
  ConfigurePluginSchema,
  TogglePluginSchema,
  MarketplaceQuerySchema,
  InstalledQuerySchema,
  MarketplaceQuery,
  InstalledQuery,
  InstallPluginRequest,
  ConfigurePluginRequest,
  TogglePluginRequest
} from './types';

/**
 * Admin Plugin Management Routes
 * 
 * Provides plugin lifecycle management APIs for tenant administrators.
 * All routes require authentication, tenant context, and admin privileges.
 * 
 * Base path: /api/admin/plugins
 */
export async function adminPluginRoutes(fastify: FastifyInstance) {
  
  // ============================================
  // Plugin Discovery (插件发现)
  // ============================================
  
  /**
   * GET /api/admin/plugins/marketplace
   * Get all available plugins in marketplace
   * 
   * Query Parameters:
   * - category: Filter by category
   * - businessModel: Filter by business model (free, freemium, subscription, usage_based)
   * - sortBy: Sort field (name, rating, installCount, createdAt)
   * - sortOrder: Sort order (asc, desc)
   */
  fastify.get('/marketplace', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      tags: ['Admin - Plugin Management'],
      summary: 'Get Plugin Marketplace',
      description: 'Get all available plugins with filtering and sorting options',
      querystring: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Filter by category' },
          businessModel: { 
            type: 'string', 
            enum: ['free', 'freemium', 'subscription', 'usage_based'],
            description: 'Filter by business model'
          },
          sortBy: { 
            type: 'string', 
            enum: ['name', 'rating', 'installCount', 'createdAt'],
            default: 'name',
            description: 'Sort field'
          },
          sortOrder: { 
            type: 'string', 
            enum: ['asc', 'desc'],
            default: 'asc',
            description: 'Sort order'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                plugins: { type: 'array' },
                total: { type: 'number' }
              }
            }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Querystring: MarketplaceQuery }>, reply: FastifyReply) => {
    try {
      // Validate query parameters
      const filters = MarketplaceQuerySchema.parse(request.query);
      
      // Get marketplace plugins
      const result = await AdminPluginService.getMarketplacePlugins(fastify, filters);
      
      return reply.send({
        success: true,
        data: result
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to get marketplace plugins');
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to retrieve marketplace plugins'
      });
    }
  });
  
  // ============================================
  // Plugin Installation (插件安装)
  // ============================================
  
  /**
   * GET /api/admin/plugins/installed
   * Get all installed plugins for current tenant
   * 
   * Query Parameters:
   * - status: Filter by status (ACTIVE, INACTIVE, TRIAL, EXPIRED)
   * - enabled: Filter by enabled status (true, false)
   */
  fastify.get('/installed', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      tags: ['Admin - Plugin Management'],
      summary: 'Get Installed Plugins',
      description: 'Get all installed plugins for the current tenant with filtering options',
      querystring: {
        type: 'object',
        properties: {
          status: { 
            type: 'string', 
            enum: ['ACTIVE', 'INACTIVE', 'TRIAL', 'EXPIRED'],
            description: 'Filter by status'
          },
          enabled: { 
            type: 'boolean',
            description: 'Filter by enabled status'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                plugins: { type: 'array' },
                total: { type: 'number' }
              }
            }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Querystring: InstalledQuery }>, reply: FastifyReply) => {
    try {
      const tenantId = (request as any).tenant.id;
      
      // Validate query parameters
      const filters = InstalledQuerySchema.parse(request.query);
      
      // Get installed plugins
      const result = await AdminPluginService.getInstalledPlugins(fastify, tenantId, filters);
      
      return reply.send({
        success: true,
        data: result
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to get installed plugins');
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to retrieve installed plugins'
      });
    }
  });
  
  /**
   * POST /api/admin/plugins/:slug/install
   * Install a plugin for current tenant
   *
   * Path Parameters:
   * - slug: Plugin slug (e.g., "stripe")
   * 
   * Body:
   * - planId: Subscription plan ID (optional, required for subscription plugins)
   * - startTrial: Whether to start trial period (default: true)
   * - configData: Initial plugin configuration (optional)
   */
  fastify.post('/:slug/install', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      tags: ['Admin - Plugin Management'],
      summary: 'Install Plugin',
      description: 'Install a plugin for the current tenant',
      params: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'Plugin slug' }
        },
        required: ['slug']
      },
      body: {
        type: 'object',
        properties: {
          planId: { type: 'string', description: 'Subscription plan ID (for subscription plugins)' },
          startTrial: { type: 'boolean', default: true, description: 'Start trial period' },
          configData: { type: 'object', description: 'Initial configuration' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (
    request: FastifyRequest<{ 
      Params: { slug: string }; 
      Body: InstallPluginRequest 
    }>, 
    reply: FastifyReply
  ) => {
    try {
      const { slug } = request.params;
      const tenantId = (request as any).tenant.id;
      
      // Validate request body
      const options = InstallPluginSchema.parse(request.body);
      
      // Install plugin
      const result = await AdminPluginService.installPlugin(fastify, tenantId, slug, options);
      
      return reply.send({
        success: true,
        data: result
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to install plugin');
      
      // Handle specific errors
      if (error.message === 'Plugin not found') {
        return reply.status(404).send({
          success: false,
          error: 'Plugin not found'
        });
      } else if (error.message === 'Plugin is already installed') {
        return reply.status(400).send({
          success: false,
          error: 'Plugin is already installed'
        });
      } else if (error.message === 'Plugin is not available for installation') {
        return reply.status(400).send({
          success: false,
          error: 'Plugin is not available for installation'
        });
      } else {
        return reply.status(500).send({
          success: false,
          error: error.message || 'Failed to install plugin'
        });
      }
    }
  });
  
  // ============================================
  // Plugin Configuration (插件配置)
  // ============================================
  
  /**
   * GET /api/admin/plugins/:slug/config
   * Get plugin configuration
   * 
   * Path Parameters:
   * - slug: Plugin slug
   */
  fastify.get('/:slug/config', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      tags: ['Admin - Plugin Management'],
      summary: 'Get Plugin Configuration',
      description: 'Get configuration data for an installed plugin',
      params: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'Plugin slug' }
        },
        required: ['slug']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' }
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (
    request: FastifyRequest<{ Params: { slug: string } }>, 
    reply: FastifyReply
  ) => {
    try {
      const { slug } = request.params;
      const tenantId = (request as any).tenant.id;
      
      // Get plugin configuration
      const result = await AdminPluginService.getPluginConfig(fastify, tenantId, slug);
      
      return reply.send({
        success: true,
        data: result
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to get plugin config');
      
      if (error.message === 'Plugin is not installed') {
        return reply.status(404).send({
          success: false,
          error: 'Plugin is not installed'
        });
      } else {
        return reply.status(500).send({
          success: false,
          error: error.message || 'Failed to retrieve plugin configuration'
        });
      }
    }
  });

  /**
   * PUT /api/admin/plugins/:slug/config
   * Update plugin configuration
   *
   * Path Parameters:
   * - slug: Plugin slug
   *
   * Body:
   * - configData: Plugin configuration data (object)
   */
  fastify.put('/:slug/config', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      tags: ['Admin - Plugin Management'],
      summary: 'Update Plugin Configuration',
      description: 'Update configuration data for an installed plugin',
      params: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'Plugin slug' }
        },
        required: ['slug']
      },
      body: {
        type: 'object',
        properties: {
          configData: {
            type: 'object',
            description: 'Plugin configuration data'
          }
        },
        required: ['configData']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' }
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (
    request: FastifyRequest<{
      Params: { slug: string };
      Body: ConfigurePluginRequest
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { slug } = request.params;
      const tenantId = (request as any).tenant.id;

      // Validate request body
      const { configData } = ConfigurePluginSchema.parse(request.body);

      // Update plugin configuration
      const result = await AdminPluginService.updatePluginConfig(fastify, tenantId, slug, configData);

      return reply.send({
        success: true,
        data: result
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to update plugin config');

      if (error.message === 'Plugin is not installed') {
        return reply.status(404).send({
          success: false,
          error: 'Plugin is not installed'
        });
      } else {
        return reply.status(500).send({
          success: false,
          error: error.message || 'Failed to update plugin configuration'
        });
      }
    }
  });

  // ============================================
  // Advanced Plugin Discovery (高级插件发现)
  // ============================================

  /**
   * GET /api/admin/plugins/marketplace/search
   * Search plugins by keyword
   *
   * Query Parameters:
   * - q: Search query (required)
   * - category: Filter by category (optional)
   */
  fastify.get('/marketplace/search', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      tags: ['Admin - Plugin Management'],
      summary: 'Search Plugins',
      description: 'Search plugins by keyword with optional category filter',
      querystring: {
        type: 'object',
        properties: {
          q: {
            type: 'string',
            description: 'Search query',
            minLength: 1
          },
          category: {
            type: 'string',
            description: 'Filter by category'
          }
        },
        required: ['q']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                query: { type: 'string' },
                results: { type: 'array' },
                total: { type: 'number' }
              }
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (
    request: FastifyRequest<{ Querystring: { q: string; category?: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { q, category } = request.query;

      if (!q || q.trim().length === 0) {
        return reply.status(400).send({
          success: false,
          error: 'Search query is required'
        });
      }

      // Search plugins
      const result = await AdminPluginService.searchPlugins(fastify, q, category);

      return reply.send({
        success: true,
        data: result
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to search plugins');
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to search plugins'
      });
    }
  });

  /**
   * GET /api/admin/plugins/marketplace/:slug
   * Get detailed information about a specific plugin
   *
   * Path Parameters:
   * - slug: Plugin slug
   */
  fastify.get('/marketplace/:slug', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      tags: ['Admin - Plugin Management'],
      summary: 'Get Plugin Details',
      description: 'Get detailed information about a specific plugin including installation status',
      params: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'Plugin slug' }
        },
        required: ['slug']
      }
      // Response schema removed to allow full data serialization
      // Fastify's JSON Schema serializer was filtering out nested properties
    }
  }, async (
    request: FastifyRequest<{ Params: { slug: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { slug } = request.params;
      const tenantId = (request as any).tenant.id;

      // Get plugin details
      const result = await AdminPluginService.getPluginDetails(fastify, slug, tenantId);

      fastify.log.info(`[routes] Result from service: ${result ? 'EXISTS' : 'NULL'}`);
      fastify.log.info(`[routes] Result type: ${typeof result}`);
      fastify.log.info(`[routes] Result keys: ${result ? Object.keys(result).join(', ') : 'N/A'}`);
      fastify.log.info(`[routes] subscriptionPlans: ${result?.subscriptionPlans?.length || 0}`);

      // Extract subscription plans from result
      const { subscriptionPlans, ...pluginData } = result;

      fastify.log.info(`[routes] After destructuring - pluginData keys: ${Object.keys(pluginData).join(', ')}`);
      fastify.log.info(`[routes] After destructuring - plans count: ${subscriptionPlans?.length || 0}`);

      const responseData = {
        plugin: pluginData,
        plans: subscriptionPlans || []
      };

      fastify.log.info(`[routes] Sending response with plugin: ${responseData.plugin ? 'EXISTS' : 'NULL'}, plans: ${responseData.plans.length}`);

      return reply.send({
        success: true,
        data: responseData
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to get plugin details');

      if (error.message === 'Plugin not found') {
        return reply.status(404).send({
          success: false,
          error: 'Plugin not found'
        });
      } else {
        return reply.status(500).send({
          success: false,
          error: error.message || 'Failed to retrieve plugin details'
        });
      }
    }
  });

  /**
   * GET /api/admin/plugins/categories
   * Get all plugin categories
   */
  fastify.get('/categories', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      tags: ['Admin - Plugin Management'],
      summary: 'Get Plugin Categories',
      description: 'Get all available plugin categories with plugin counts',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                categories: { type: 'array' }
              }
            }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Get categories
      const result = await AdminPluginService.getCategories(fastify);

      return reply.send({
        success: true,
        data: result
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to get plugin categories');
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to retrieve plugin categories'
      });
    }
  });

  // ============================================
  // Advanced Plugin Management (高级插件管理)
  // ============================================

  /**
   * DELETE /api/admin/plugins/:slug/uninstall
   * Uninstall a plugin
   *
   * Path Parameters:
   * - slug: Plugin slug
   */
  fastify.delete('/:slug/uninstall', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      tags: ['Admin - Plugin Management'],
      summary: 'Uninstall Plugin',
      description: 'Uninstall a plugin and cancel any active subscriptions',
      params: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'Plugin slug' }
        },
        required: ['slug']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                message: { type: 'string' }
              }
            }
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (
    request: FastifyRequest<{ Params: { slug: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { slug } = request.params;
      const tenantId = (request as any).tenant.id;

      // Uninstall plugin
      const result = await AdminPluginService.uninstallPlugin(fastify, tenantId, slug);

      return reply.send({
        success: true,
        data: result
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to uninstall plugin');

      if (error.message === 'Plugin is not installed') {
        return reply.status(404).send({
          success: false,
          error: 'Plugin is not installed'
        });
      } else {
        return reply.status(500).send({
          success: false,
          error: error.message || 'Failed to uninstall plugin'
        });
      }
    }
  });

  /**
   * GET /api/admin/plugins/installed/:slug/usage
   * Get plugin usage statistics for current tenant
   *
   * Path Parameters:
   * - slug: Plugin slug
   */
  fastify.get('/installed/:slug/usage', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      tags: ['Admin - Plugin Management'],
      summary: 'Get Plugin Usage Statistics',
      description: 'Get usage statistics for an installed plugin',
      params: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'Plugin slug' }
        },
        required: ['slug']
      }
    }
  }, async (
    request: FastifyRequest<{ Params: { slug: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { slug } = request.params;
      const tenantId = (request as any).tenant.id;

      // Get plugin usage statistics
      const result = await AdminPluginService.getPluginUsage(fastify, tenantId, slug);

      return reply.send({
        success: true,
        data: result
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to get plugin usage');

      if (error.message === 'Plugin is not installed') {
        return reply.status(404).send({
          success: false,
          error: 'Plugin is not installed'
        });
      } else {
        return reply.status(500).send({
          success: false,
          error: error.message || 'Failed to retrieve plugin usage'
        });
      }
    }
  });

  /**
   * GET /api/admin/plugins/installed/:slug/subscription
   * Get plugin subscription information for current tenant
   *
   * Path Parameters:
   * - slug: Plugin slug
   */
  fastify.get('/installed/:slug/subscription', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      tags: ['Admin - Plugin Management'],
      summary: 'Get Plugin Subscription',
      description: 'Get subscription information for an installed plugin',
      params: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'Plugin slug' }
        },
        required: ['slug']
      }
    }
  }, async (
    request: FastifyRequest<{ Params: { slug: string } }>,
    reply: FastifyReply
  ) => {
    try {
      const { slug } = request.params;
      const tenantId = (request as any).tenant.id;

      // Get plugin subscription
      const result = await AdminPluginService.getPluginSubscription(fastify, tenantId, slug);

      return reply.send({
        success: true,
        data: result
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to get plugin subscription');

      if (error.message === 'Plugin is not installed') {
        return reply.status(404).send({
          success: false,
          error: 'Plugin is not installed'
        });
      } else if (error.message === 'No active subscription found') {
        return reply.status(404).send({
          success: false,
          error: 'No active subscription found'
        });
      } else {
        return reply.status(500).send({
          success: false,
          error: error.message || 'Failed to retrieve plugin subscription'
        });
      }
    }
  });

  /**
   * POST /api/admin/plugins/installed/:slug/upgrade
   * Create upgrade checkout session for plugin subscription
   *
   * Path Parameters:
   * - slug: Plugin slug
   *
   * Body:
   * - planId: New plan ID to upgrade to
   * - successUrl: URL to redirect after successful payment (optional)
   * - cancelUrl: URL to redirect if payment is cancelled (optional)
   */
  fastify.post('/installed/:slug/upgrade', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      tags: ['Admin - Plugin Management'],
      summary: 'Upgrade Plugin Subscription',
      description: 'Create checkout session for upgrading to a different subscription plan',
      params: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'Plugin slug' }
        },
        required: ['slug']
      },
      body: {
        type: 'object',
        properties: {
          planId: { type: 'string', description: 'New plan ID' },
          successUrl: { type: 'string', description: 'Success redirect URL' },
          cancelUrl: { type: 'string', description: 'Cancel redirect URL' }
        },
        required: ['planId']
      }
    }
  }, async (
    request: FastifyRequest<{
      Params: { slug: string };
      Body: { planId: string; successUrl?: string; cancelUrl?: string }
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { slug } = request.params;
      const { planId, successUrl, cancelUrl } = request.body;
      const tenantId = (request as any).tenant.id;

      // Default URLs if not provided
      const defaultSuccessUrl = successUrl || `${process.env.ADMIN_URL || 'http://localhost:3003'}/plugins/installed/${slug}?upgrade=success`;
      const defaultCancelUrl = cancelUrl || `${process.env.ADMIN_URL || 'http://localhost:3003'}/plugins/installed/${slug}?upgrade=cancelled`;

      // Create upgrade checkout session
      const result = await AdminPluginService.createUpgradeCheckoutSession(
        fastify,
        tenantId,
        slug,
        planId,
        defaultSuccessUrl,
        defaultCancelUrl
      );

      return reply.send({
        success: true,
        data: result
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to create upgrade checkout session');

      if (error.message === 'Plugin is not installed') {
        return reply.status(404).send({
          success: false,
          error: 'Plugin is not installed'
        });
      } else if (error.message.includes('Plan not found') || error.message.includes('Invalid plan')) {
        return reply.status(400).send({
          success: false,
          error: error.message
        });
      } else {
        return reply.status(500).send({
          success: false,
          error: error.message || 'Failed to create upgrade checkout session'
        });
      }
    }
  });

  /**
   * POST /api/admin/plugins/installed/:slug/verify-checkout
   * Verify Stripe Checkout session and update subscription
   *
   * Path Parameters:
   * - slug: Plugin slug
   *
   * Body:
   * - sessionId: Stripe Checkout session ID
   */
  fastify.post('/installed/:slug/verify-checkout', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      tags: ['Admin - Plugin Management'],
      summary: 'Verify Checkout Session',
      description: 'Verify Stripe Checkout session and update subscription after successful payment',
      params: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'Plugin slug' }
        },
        required: ['slug']
      },
      body: {
        type: 'object',
        properties: {
          sessionId: { type: 'string', description: 'Stripe Checkout session ID' }
        },
        required: ['sessionId']
      }
    }
  }, async (
    request: FastifyRequest<{
      Params: { slug: string };
      Body: { sessionId: string }
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { slug } = request.params;
      const { sessionId } = request.body;
      const tenantId = (request as any).tenant.id;

      // Verify checkout session and update subscription
      const result = await AdminPluginService.verifyCheckoutSession(
        fastify,
        tenantId,
        slug,
        sessionId
      );

      return reply.send({
        success: true,
        data: result
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to verify checkout session');

      if (error.message === 'Plugin is not installed') {
        return reply.status(404).send({
          success: false,
          error: 'Plugin is not installed'
        });
      } else if (error.message === 'Payment not completed') {
        return reply.status(400).send({
          success: false,
          error: 'Payment not completed'
        });
      } else if (error.message.includes('Plan') || error.message.includes('session')) {
        return reply.status(400).send({
          success: false,
          error: error.message
        });
      } else {
        return reply.status(500).send({
          success: false,
          error: error.message || 'Failed to verify checkout session'
        });
      }
    }
  });

  /**
   * PATCH /api/admin/plugins/:slug/toggle
   * Enable or disable a plugin
   *
   * Path Parameters:
   * - slug: Plugin slug
   *
   * Body:
   * - enabled: Whether to enable or disable the plugin
   */
  fastify.patch('/:slug/toggle', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      tags: ['Admin - Plugin Management'],
      summary: 'Toggle Plugin Status',
      description: 'Enable or disable an installed plugin',
      params: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'Plugin slug' }
        },
        required: ['slug']
      },
      body: {
        type: 'object',
        properties: {
          enabled: {
            type: 'boolean',
            description: 'Whether to enable or disable the plugin'
          }
        },
        required: ['enabled']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (
    request: FastifyRequest<{
      Params: { slug: string };
      Body: TogglePluginRequest
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { slug } = request.params;
      const tenantId = (request as any).tenant.id;

      // Validate request body
      const { enabled } = TogglePluginSchema.parse(request.body);

      // Toggle plugin
      const result = await AdminPluginService.togglePlugin(fastify, tenantId, slug, enabled);

      return reply.send({
        success: true,
        data: result
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to toggle plugin');

      if (error.message === 'Plugin is not installed') {
        return reply.status(404).send({
          success: false,
          error: 'Plugin is not installed'
        });
      } else if (error.message.includes('Cannot enable expired plugin')) {
        return reply.status(400).send({
          success: false,
          error: 'Cannot enable expired plugin. Please renew subscription.'
        });
      } else {
        return reply.status(500).send({
          success: false,
          error: error.message || 'Failed to toggle plugin status'
        });
      }
    }
  });

  // ============================================
  // OAuth Installation Flow (阶段3)
  // ============================================

  /**
   * GET /api/admin/plugins/oauth/callback
   * OAuth callback endpoint for external plugin installation
   *
   * Query Parameters:
   * - code: Authorization code from external plugin
   * - state: State parameter for validation
   */
  fastify.get('/oauth/callback', {
    schema: {
      hide: true,
      tags: ['Admin - Plugin Management'],
      summary: 'OAuth Callback for External Plugin Installation',
      description: 'Handle OAuth callback from external plugins during installation',
      querystring: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Authorization code' },
          state: { type: 'string', description: 'State parameter' }
        },
        required: ['code', 'state']
      }
    }
  }, async (request: FastifyRequest<{ Querystring: { code: string; state: string } }>, reply: FastifyReply) => {
    try {
      const { code, state } = request.query;

      // Retrieve state data from Redis
      const stateKey = `oauth:install:${state}`;
      const stateDataStr = await fastify.redis.get(stateKey);

      if (!stateDataStr) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid or expired state parameter'
        });
      }

      const stateData = JSON.parse(stateDataStr as string);
      const { tenantId, pluginId, expiresAt } = stateData;

      // Check if state has expired
      if (new Date() > new Date(expiresAt)) {
        await fastify.redis.del(stateKey);
        return reply.status(400).send({
          success: false,
          error: 'State parameter has expired'
        });
      }

      // Get plugin information
      const plugin = await fastify.prisma.plugin.findUnique({
        where: { id: pluginId }
      });

      if (!plugin || plugin.runtimeType !== 'external-http') {
        await fastify.redis.del(stateKey);
        return reply.status(400).send({
          success: false,
          error: 'Invalid plugin for OAuth installation'
        });
      }

      // Parse OAuth config
      const oauthConfig = JSON.parse(plugin.oauthConfig || '{}');
      if (!oauthConfig.tokenUrl) {
        await fastify.redis.del(stateKey);
        return reply.status(500).send({
          success: false,
          error: 'Plugin OAuth configuration incomplete'
        });
      }

      // Exchange code for access token
      const tokenResponse = await fetch(oauthConfig.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: process.env.PLATFORM_CLIENT_ID || 'jiffoo-platform',
          client_secret: process.env.PLATFORM_CLIENT_SECRET || '',
          code,
          redirect_uri: oauthConfig.redirectUri || `${process.env.API_URL}/api/admin/plugins/oauth/callback`,
          grant_type: 'authorization_code'
        })
      });

      if (!tokenResponse.ok) {
        fastify.log.error('Failed to exchange code for token:', await tokenResponse.text());
        await fastify.redis.del(stateKey);
        return reply.status(500).send({
          success: false,
          error: 'Failed to obtain access token'
        });
      }

      const tokenData = await tokenResponse.json();
      const {
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: expiresIn,
        external_installation_id: externalInstallationId,
        account_id: accountId,
        scopes,
        metadata
      } = tokenData;

      // Create plugin installation
      const installation = await fastify.prisma.pluginInstallation.create({
        data: {
          tenantId,
          pluginId,
          status: 'ACTIVE',
          enabled: true,
          externalInstallationId,
          accessToken,
          refreshToken,
          tokenExpiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : null,
          configData: JSON.stringify({
            accountId,
            scopes,
            metadata
          })
        }
      });

      // Call external plugin's /install endpoint
      if (plugin.externalBaseUrl) {
        try {
          const installUrl = `${plugin.externalBaseUrl}/install`;
          const timestamp = new Date().toISOString();

          // Generate HMAC signature for /install call
          const sharedSecret = plugin.integrationSecrets ? JSON.parse(plugin.integrationSecrets).sharedSecret : '';
          const installBody = JSON.stringify({
            tenantId,
            installationId: installation.id,
            environment: process.env.NODE_ENV || 'development',
            planId: 'default', // TODO: Get actual plan ID
            config: {
              accountId,
              scopes,
              metadata
            },
            platform: {
              baseUrl: process.env.API_URL || 'http://localhost:3001',
              pluginSlug: plugin.slug
            }
          });

          const { generateSignature } = await import('../../../utils/signature');
          const signature = generateSignature(sharedSecret, 'POST', '/install', installBody, timestamp);

          const installResponse = await fetch(installUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Platform-Id': 'jiffoo',
              'X-Platform-Env': process.env.NODE_ENV || 'development',
              'X-Platform-Timestamp': timestamp,
              'X-Plugin-Slug': plugin.slug,
              'X-Tenant-ID': tenantId.toString(),
              'X-Installation-ID': installation.id,
              'X-Platform-Signature': signature
            },
            body: installBody
          });

          if (!installResponse.ok) {
            fastify.log.warn('External plugin /install call failed:', await installResponse.text());
            // Don't fail the installation, just log the warning
          }
        } catch (error) {
          fastify.log.warn('Failed to call external plugin /install:', error);
          // Don't fail the installation
        }
      }

      // Clean up state
      await fastify.redis.del(stateKey);

      // Redirect to success page
      const adminUrl = process.env.ADMIN_URL || 'http://localhost:3003';
      const successUrl = `${adminUrl}/plugins/installed/${plugin.slug}?install=success`;

      return reply.redirect(successUrl);

    } catch (error: any) {
      fastify.log.error({ err: error }, 'OAuth callback failed');
      return reply.status(500).send({
        success: false,
        error: 'OAuth installation failed'
      });
    }
  });

}

