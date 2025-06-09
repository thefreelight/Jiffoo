import { FastifyInstance } from 'fastify';
import { paymentManager } from './payment-manager';
import { authMiddleware } from '@/core/auth/middleware';

export async function paymentPluginRoutes(fastify: FastifyInstance) {
  // Get available plugins from registry
  fastify.get('/plugins/available', {
    schema: {
      summary: 'Get available payment plugins',
      description: 'Get list of available payment plugins from the registry'
    }
  }, async (request, reply) => {
    try {
      const availablePlugins = paymentManager.getAvailablePlugins();
      
      return reply.send({
        success: true,
        data: {
          plugins: availablePlugins,
          total: availablePlugins.length
        }
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to get available plugins',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get installed plugins
  fastify.get('/plugins/installed', {
    preHandler: [authMiddleware],
    schema: {
      summary: 'Get installed payment plugins',
      description: 'Get list of installed payment plugins'
    }
  }, async (request, reply) => {
    try {
      const installedPlugins = paymentManager.getInstalledPlugins();
      const pluginManager = paymentManager.getPluginManager();
      const stats = pluginManager.getPluginStats();
      
      return reply.send({
        success: true,
        data: {
          plugins: installedPlugins.map(plugin => ({
            id: plugin.metadata.id,
            name: plugin.metadata.name,
            description: plugin.metadata.description,
            version: plugin.metadata.version,
            author: plugin.metadata.author,
            license: plugin.metadata.license,
            isActive: plugin.isActive,
            providerName: plugin.provider.name,
            capabilities: plugin.provider.capabilities,
          })),
          stats
        }
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to get installed plugins',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Install a plugin
  fastify.post('/plugins/:pluginId/install', {
    preHandler: [authMiddleware],
    schema: {
      summary: 'Install a payment plugin',
      description: 'Install a payment plugin from the registry',
      params: {
        type: 'object',
        required: ['pluginId'],
        properties: {
          pluginId: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        properties: {
          licenseKey: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { pluginId } = request.params as { pluginId: string };
      const { licenseKey } = request.body as any;

      await paymentManager.installPlugin(pluginId, licenseKey);

      return reply.send({
        success: true,
        message: `Plugin ${pluginId} installed successfully`
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: 'Plugin installation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Uninstall a plugin
  fastify.delete('/plugins/:pluginId', {
    preHandler: [authMiddleware],
    schema: {
      summary: 'Uninstall a payment plugin',
      description: 'Uninstall a payment plugin',
      params: {
        type: 'object',
        required: ['pluginId'],
        properties: {
          pluginId: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { pluginId } = request.params as { pluginId: string };

      await paymentManager.uninstallPlugin(pluginId);

      return reply.send({
        success: true,
        message: `Plugin ${pluginId} uninstalled successfully`
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: 'Plugin uninstallation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Activate a plugin
  fastify.post('/plugins/:pluginId/activate', {
    preHandler: [authMiddleware],
    schema: {
      summary: 'Activate a payment plugin',
      description: 'Activate an installed payment plugin',
      params: {
        type: 'object',
        required: ['pluginId'],
        properties: {
          pluginId: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { pluginId } = request.params as { pluginId: string };
      const pluginManager = paymentManager.getPluginManager();

      await pluginManager.activatePlugin(pluginId);

      return reply.send({
        success: true,
        message: `Plugin ${pluginId} activated successfully`
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: 'Plugin activation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Deactivate a plugin
  fastify.post('/plugins/:pluginId/deactivate', {
    preHandler: [authMiddleware],
    schema: {
      summary: 'Deactivate a payment plugin',
      description: 'Deactivate an installed payment plugin',
      params: {
        type: 'object',
        required: ['pluginId'],
        properties: {
          pluginId: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { pluginId } = request.params as { pluginId: string };
      const pluginManager = paymentManager.getPluginManager();

      await pluginManager.deactivatePlugin(pluginId);

      return reply.send({
        success: true,
        message: `Plugin ${pluginId} deactivated successfully`
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: 'Plugin deactivation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get plugin health status
  fastify.get('/plugins/health', {
    preHandler: [authMiddleware],
    schema: {
      summary: 'Get plugin health status',
      description: 'Get health status of all installed payment plugins'
    }
  }, async (request, reply) => {
    try {
      const pluginManager = paymentManager.getPluginManager();
      const healthStatus = await pluginManager.healthCheck();

      return reply.send({
        success: true,
        data: {
          plugins: healthStatus,
          overall: Object.values(healthStatus).every(status => status)
        }
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Plugin health check failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get plugin by license type
  fastify.get('/plugins/by-license/:license', {
    schema: {
      summary: 'Get plugins by license type',
      description: 'Get available plugins filtered by license type',
      params: {
        type: 'object',
        required: ['license'],
        properties: {
          license: { 
            type: 'string',
            enum: ['free', 'basic', 'premium', 'enterprise']
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { license } = request.params as { license: 'free' | 'basic' | 'premium' | 'enterprise' };
      const availablePlugins = paymentManager.getAvailablePlugins();
      const filteredPlugins = availablePlugins.filter(plugin => plugin.license === license);

      return reply.send({
        success: true,
        data: {
          plugins: filteredPlugins,
          total: filteredPlugins.length,
          license
        }
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to get plugins by license',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get plugin marketplace info
  fastify.get('/plugins/marketplace', {
    schema: {
      summary: 'Get plugin marketplace information',
      description: 'Get information about the plugin marketplace'
    }
  }, async (request, reply) => {
    try {
      const availablePlugins = paymentManager.getAvailablePlugins();
      const installedPlugins = paymentManager.getInstalledPlugins();
      
      const marketplace = {
        totalAvailable: availablePlugins.length,
        totalInstalled: installedPlugins.length,
        byLicense: {
          free: availablePlugins.filter(p => p.license === 'free').length,
          basic: availablePlugins.filter(p => p.license === 'basic').length,
          premium: availablePlugins.filter(p => p.license === 'premium').length,
          enterprise: availablePlugins.filter(p => p.license === 'enterprise').length,
        },
        featured: availablePlugins.slice(0, 3), // Featured plugins
        newest: availablePlugins.sort((a, b) => b.version.localeCompare(a.version)).slice(0, 3),
        popular: availablePlugins.filter(p => ['stripe-payment-plugin', 'paypal-payment-plugin'].includes(p.id)),
      };

      return reply.send({
        success: true,
        data: marketplace
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to get marketplace information',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
