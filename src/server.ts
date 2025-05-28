import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from '@/config/env';
import { prisma } from '@/config/database';

// Import routes
import { authRoutes } from '@/core/auth/routes';
import { userRoutes } from '@/core/user/routes';
import { productRoutes } from '@/core/product/routes';
import { orderRoutes } from '@/core/order/routes';
import { paymentRoutes } from '@/core/payment/routes';

// Import plugin system
import { DefaultPluginManager } from '@/plugins/manager';
import path from 'path';

const fastify = Fastify({
  logger: {
    level: env.NODE_ENV === 'development' ? 'info' : 'warn',
  },
});

async function buildApp() {
  try {
    // Register CORS
    await fastify.register(cors, {
      origin: env.NODE_ENV === 'development' ? true : false,
      credentials: true,
    });

    // Health check endpoint
    fastify.get('/health', async () => {
      return { 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        environment: env.NODE_ENV,
      };
    });

    // API routes
    await fastify.register(authRoutes, { prefix: '/api/auth' });
    await fastify.register(userRoutes, { prefix: '/api/users' });
    await fastify.register(productRoutes, { prefix: '/api/products' });
    await fastify.register(orderRoutes, { prefix: '/api/orders' });
    await fastify.register(paymentRoutes, { prefix: '/api/payments' });

    // Initialize plugin system
    const pluginManager = new DefaultPluginManager(fastify);
    const pluginsDir = path.join(__dirname, 'plugins');
    await pluginManager.loadPluginsFromDirectory(pluginsDir);

    // Global error handler
    fastify.setErrorHandler((error, request, reply) => {
      fastify.log.error(error);
      
      if (error.validation) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Invalid request data',
          details: error.validation,
        });
      }

      const statusCode = error.statusCode || 500;
      const message = statusCode === 500 ? 'Internal Server Error' : error.message;

      return reply.status(statusCode).send({
        error: 'Request Failed',
        message,
      });
    });

    // 404 handler
    fastify.setNotFoundHandler((request, reply) => {
      return reply.status(404).send({
        error: 'Not Found',
        message: `Route ${request.method} ${request.url} not found`,
      });
    });

    return fastify;
  } catch (error) {
    fastify.log.error('Error building app:', error);
    throw error;
  }
}

async function start() {
  try {
    const app = await buildApp();
    
    // Test database connection
    await prisma.$connect();
    app.log.info('Database connected successfully');

    // Start server
    await app.listen({
      port: env.PORT,
      host: env.HOST,
    });

    app.log.info(`🚀 Server running on http://${env.HOST}:${env.PORT}`);
    app.log.info(`📚 API Documentation available at http://${env.HOST}:${env.PORT}/health`);
    
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await prisma.$disconnect();
  process.exit(0);
});

// Start the server
if (require.main === module) {
  start();
}

export { buildApp };
