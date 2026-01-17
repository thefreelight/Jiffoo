/**
 * Public Plugin API Routes
 * 
 * Public plugin API for listing locally installed plugins.
 * No authentication required.
 * 
 * Base path: /api/plugins
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PluginManagementService } from '@/core/admin/plugin-management/service';

interface PluginListQuery {
  category?: string;
  enabled?: boolean;
  page?: number;
  limit?: number;
}

interface PluginDetailParams {
  slug: string;
}

/**
 * Public plugin routes - lists locally installed plugins only
 */
export async function publicPluginRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/plugins
   * Get list of locally installed plugins (no authentication required)
   */
  fastify.get('/', {
    schema: {
      tags: ['Plugins - Public'],
      summary: 'Get Installed Plugin List',
      description: 'Get list of locally installed plugins (no authentication required)',
      querystring: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Filter by category' },
          enabled: { type: 'boolean', description: 'Filter by enabled status' },
          page: { type: 'integer', default: 1, minimum: 1 },
          limit: { type: 'integer', default: 20, minimum: 1, maximum: 100 },
        },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: PluginListQuery }>, reply: FastifyReply) => {
    try {
      const { category, enabled, page = 1, limit = 20 } = request.query;

      // Get installed plugins from local state
      const result = await PluginManagementService.getInstalledPlugins();
      let plugins = result.plugins;

      // Apply filters
      if (category) {
        plugins = plugins.filter(p => p.category === category);
      }

      if (enabled !== undefined) {
        plugins = plugins.filter(p => p.enabled === enabled);
      }

      // Pagination
      const total = plugins.length;
      const start = (page - 1) * limit;
      const end = start + limit;
      const items = plugins.slice(start, end);

      return reply.send({
        success: true,
        data: {
          items: items.map(p => ({
            slug: p.slug,
            name: p.name,
            description: p.description,
            version: p.version,
            author: p.author,
            category: p.category,
            icon: p.icon,
            enabled: p.enabled,
          })),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to get installed plugin list');
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to retrieve plugins',
      });
    }
  });

  /**
   * GET /api/plugins/:slug
   * Get plugin details (no authentication required)
   */
  fastify.get('/:slug', {
    schema: {
      tags: ['Plugins - Public'],
      summary: 'Get Plugin Details',
      description: 'Get detailed information about a locally installed plugin (no authentication required)',
      params: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'Plugin slug' },
        },
        required: ['slug'],
      },
    },
  }, async (request: FastifyRequest<{ Params: PluginDetailParams }>, reply: FastifyReply) => {
    try {
      const { slug } = request.params;

      const state = await PluginManagementService.getPluginState(slug);

      if (!state) {
        return reply.status(404).send({
          success: false,
          error: 'Plugin not found',
        });
      }

      return reply.send({
        success: true,
        data: {
          slug: state.slug,
          name: state.name,
          description: state.description,
          version: state.version,
          author: state.author,
          category: state.category,
          icon: state.icon,
          enabled: state.enabled,
          config: state.config,
        },
      });
    } catch (error: any) {
      fastify.log.error({ err: error }, 'Failed to get plugin details');
      return reply.status(500).send({
        success: false,
        error: error.message || 'Failed to retrieve plugin details',
      });
    }
  });
}
