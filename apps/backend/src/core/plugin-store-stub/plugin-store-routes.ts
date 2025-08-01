/**
 * Plugin Store Routes - Open Source Stub Version
 */

import { FastifyInstance } from 'fastify';
import { pluginStoreManager } from './plugin-store-manager';

export async function pluginStoreRoutes(fastify: FastifyInstance) {
  // Get available plugins
  fastify.get('/plugins', async (request, reply) => {
    try {
      const plugins = await pluginStoreManager.getAvailablePlugins();
      return {
        success: true,
        data: plugins,
        message: 'Open source plugins available. Commercial plugins require upgrade.'
      };
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch plugins'
      });
    }
  });

  // Search plugins
  fastify.get('/search', async (request: any, reply) => {
    try {
      const { q: query, category } = request.query;
      const plugins = await pluginStoreManager.searchPlugins(query, category);
      return {
        success: true,
        data: plugins
      };
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to search plugins'
      });
    }
  });

  // Get plugin details
  fastify.get('/plugins/:id', async (request: any, reply) => {
    try {
      const plugin = await pluginStoreManager.getPlugin(request.params.id);
      if (!plugin) {
        return reply.status(404).send({
          success: false,
          error: 'Plugin not found'
        });
      }
      return {
        success: true,
        data: plugin
      };
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch plugin details'
      });
    }
  });

  // Purchase plugin (stub)
  fastify.post('/purchase', async (request, reply) => {
    return reply.status(501).send({
      success: false,
      error: 'Plugin purchases are available in the commercial version',
      message: 'Upgrade to Jiffoo Mall Commercial for plugin marketplace access'
    });
  });

  console.log('✅ Plugin store routes (open source stub) registered');
}
