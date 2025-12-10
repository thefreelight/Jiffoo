/**
 * Jiffoo Mall API Server (单商户版本)
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import staticFiles from '@fastify/static';
import cookie from '@fastify/cookie';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import path from 'path';
import fs from 'fs/promises';
import { env } from '@/config/env';
import { prisma } from '@/config/database';
import { redisCache } from '@/core/cache/redis';
import { LoggerService, logger, unifiedLogger } from '@/core/logger/unified-logger';
import { logMonitor } from '@/core/logger/log-monitor';
import { accessLogMiddleware, errorLogMiddleware } from '@/core/logger/middleware';
import { registerRoutes } from '@/routes';
import { performHealthCheck, livenessCheck, readinessCheck } from '@/utils/health-check';
import { loadAllPlugins } from '@/services/extension-installer/plugin-loader';

const fastify = Fastify({
  logger: false,
  disableRequestLogging: false
});

async function buildApp() {
  try {
    // Initialize Redis connection
    try {
      await redisCache.connect();
      LoggerService.logSystem('Redis connected successfully');
      fastify.decorate('redis', redisCache);
    } catch (error) {
      LoggerService.logError(error as Error, { context: 'Redis connection' });
      if (env.NODE_ENV !== 'development') {
        throw error;
      }
    }

    // Register cookie support
    await fastify.register(cookie, {
      secret: env.JWT_SECRET,
      parseOptions: {}
    });

    // Register multipart for file uploads
    await fastify.register(multipart, {
      limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1
      }
    });

    // Ensure uploads directory exists
    const uploadsPath = path.join(process.cwd(), 'uploads');
    try {
      await fs.access(uploadsPath);
    } catch {
      await fs.mkdir(uploadsPath, { recursive: true });
      LoggerService.logSystem(`Created uploads directory at ${uploadsPath}`);
    }

    // Register static files
    await fastify.register(staticFiles, {
      root: uploadsPath,
      prefix: '/uploads/'
    });

    // Register CORS
    if (env.CORS_ENABLED) {
      const corsOrigins = env.CORS_ORIGIN
        ? env.CORS_ORIGIN.split(',').map(origin => origin.trim())
        : (env.NODE_ENV === 'development' ? true : false);

      await fastify.register(cors, {
        origin: corsOrigins,
        credentials: env.CORS_CREDENTIALS,
        allowedHeaders: ['Authorization', 'Content-Type', 'X-App-Type', 'X-Client-Version'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      });
    }

    // Add Prisma to Fastify instance
    fastify.decorate('prisma', prisma as any);

    // Swagger documentation
    await fastify.register(swagger, {
      openapi: {
        info: {
          title: 'Jiffoo Mall API',
          description: 'Single-tenant E-commerce System',
          version: '1.0.0'
        },
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
              description: 'JWT authentication token'
            }
          }
        },
        servers: [
          {
            url: `http://${env.API_HOST}:${env.API_PORT}`,
            description: `${env.NODE_ENV} server`
          }
        ]
      }
    });

    await fastify.register(swaggerUI, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: true
      },
      staticCSP: true
    });

    // Add middleware
    fastify.addHook('onRequest', accessLogMiddleware);
    fastify.addHook('onError', errorLogMiddleware);

    // Root endpoint
    fastify.get('/', {
      schema: {
        tags: ['system'],
        summary: 'API root'
      }
    }, async () => {
      return {
        name: 'Jiffoo Mall API',
        version: '1.0.0',
        description: 'Single-tenant E-commerce System',
        environment: env.NODE_ENV,
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/health',
          auth: '/api/auth',
          products: '/api/products',
          cart: '/api/cart',
          orders: '/api/orders',
          admin: {
            users: '/api/admin/users',
            products: '/api/admin/products',
            orders: '/api/admin/orders'
          }
        }
      };
    });

    // Health check endpoints
    fastify.get('/health', {
      schema: { tags: ['system'], summary: 'Full health check' }
    }, async () => {
      return performHealthCheck(fastify);
    });

    fastify.get('/health/live', {
      schema: { tags: ['system'], summary: 'Liveness probe' }
    }, async () => {
      return livenessCheck();
    });

    fastify.get('/health/ready', {
      schema: { tags: ['system'], summary: 'Readiness probe' }
    }, async (request, reply) => {
      const result = await readinessCheck();
      if (result.status === 'not_ready') {
        return reply.status(503).send(result);
      }
      return result;
    });

    // Payment redirect routes
    fastify.get('/success', {
      schema: { tags: ['payments'], summary: 'Payment success redirect' }
    }, async (request, reply) => {
      const sessionId = (request.query as any).session_id;
      const shopUrl = env.NEXT_PUBLIC_SHOP_URL;
      const redirectUrl = sessionId
        ? `${shopUrl}/order-success?session_id=${sessionId}`
        : `${shopUrl}/order-success`;
      return reply.redirect(redirectUrl);
    });

    fastify.get('/cancel', {
      schema: { tags: ['payments'], summary: 'Payment cancel redirect' }
    }, async (_request, reply) => {
      const shopUrl = env.NEXT_PUBLIC_SHOP_URL;
      return reply.redirect(`${shopUrl}/order-cancelled`);
    });

    // Load dynamic plugins
    try {
      const loadedPlugins = await loadAllPlugins(fastify, { skipOnError: true });
      const successCount = loadedPlugins.filter(p => p.status === 'loaded').length;
      const failedCount = loadedPlugins.filter(p => p.status === 'failed').length;
      if (loadedPlugins.length > 0) {
        LoggerService.logSystem(`Dynamic plugins loaded: ${successCount} success, ${failedCount} failed`);
      }
    } catch (error) {
      LoggerService.logError(error as Error, { context: 'Dynamic plugin loading' });
    }

    // Register all core API routes
    await registerRoutes(fastify);

    return fastify;
  } catch (error) {
    LoggerService.logError(error as Error, { context: 'App building' });
    throw error;
  }
}

async function start() {
  try {
    const app = await buildApp();

    await prisma.$connect();
    app.log.info('Database connected successfully');

    await app.listen({
      port: env.API_PORT,
      host: env.API_HOST,
    });

    app.log.info(`Server running on http://${env.API_HOST}:${env.API_PORT}`);
    app.log.info(`API Documentation available at http://${env.API_HOST}:${env.API_PORT}/docs`);

    logMonitor.start(60000);

    LoggerService.logSystem('Server started successfully', {
      port: env.API_PORT,
      host: env.API_HOST,
      environment: env.NODE_ENV
    });

  } catch (error) {
    LoggerService.logError(error as Error, { context: 'Server startup' });
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

const gracefulShutdown = async (signal: string) => {
  LoggerService.logSystem(`Received ${signal}, shutting down gracefully`);

  try {
    logMonitor.stop();
    await redisCache.disconnect();
    await prisma.$disconnect();
    LoggerService.logSystem('Server shutdown completed');
    process.exit(0);
  } catch (error) {
    LoggerService.logError(error as Error, { context: 'Graceful shutdown' });
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

if (require.main === module) {
  start();
}

export { buildApp };
