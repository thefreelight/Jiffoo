import { FastifyInstance } from 'fastify';
import { Plugin } from './types';

const examplePlugin: Plugin = {
  name: 'example-plugin',
  version: '1.0.0',
  description: 'An example plugin for demonstration',
  
  async register(app: FastifyInstance) {
    // Add a simple route
    app.get('/api/plugins/example', async (request, reply) => {
      return {
        message: 'Hello from example plugin!',
        timestamp: new Date().toISOString(),
        plugin: {
          name: this.name,
          version: this.version,
          description: this.description,
        },
      };
    });

    // Add a health check for the plugin
    app.get('/api/plugins/example/health', async (request, reply) => {
      return {
        status: 'healthy',
        plugin: this.name,
        uptime: process.uptime(),
      };
    });

    app.log.info(`Example plugin registered successfully`);
  },
};

export default examplePlugin;
