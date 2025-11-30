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
import { generateTenantDocumentation } from '@/utils/swagger-tenant-schemas';
import { performHealthCheck, livenessCheck, readinessCheck } from '@/utils/health-check';

// ============================================
// 禁用 Fastify 内置日志，使用统一日志系统
// ============================================
const fastify = Fastify({
  logger: false, // 禁用 Fastify 的内置 Pino logger，使用我们的统一日志系统
  disableRequestLogging: false
});

async function buildApp() {
  try {
    // Initialize Redis connection
    try {
      await redisCache.connect();
      LoggerService.logSystem('Redis connected successfully');

      // 🆕 将Redis实例注册到fastify
      fastify.decorate('redis', redisCache);
    } catch (error) {
      LoggerService.logError(error as Error, { context: 'Redis connection' });
      if (env.NODE_ENV !== 'development') {
        throw error;
      }
    }

    // Register cookie support for httpOnly cookies
    await fastify.register(cookie, {
      secret: env.JWT_SECRET, //
      parseOptions: {}
    });

    // Register multipart for file uploads
    await fastify.register(multipart, {
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
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
        allowedHeaders: ['X-Tenant-ID', 'x-tenant-id', 'Authorization', 'Content-Type', 'X-App-Type', 'X-Client-Version'],
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      });
    } else {
      LoggerService.logSystem('CORS middleware is disabled via CORS_ENABLED=false');
    }

    // Add Prisma to Fastify instance
    fastify.decorate('prisma', prisma as any);

    // ============================================
    // Swagger / OpenAPI documentation
    // ============================================
    const tenantDocs = generateTenantDocumentation();

    await fastify.register(swagger, {
      openapi: {
        info: {
          title: 'Jiffoo Mall API',
          description: 'Fastify + TypeScript E-commerce System',
          version: '1.0.0'
        },
        tags: tenantDocs.tags,
        components: tenantDocs.components,
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

    // ============================================
    // 插件系统注册 - 按Fastify官方推荐顺序
    // ============================================

    // 1. 基础设施插件（按正确顺序）
    const tenantContext = await import('./plugins/tenant-context');
    const pluginTenantIsolation = await import('./plugins/plugin-tenant-isolation');
    const commercialSupport = await import('./plugins/commercial-support');
    const pluginRegistry = await import('./plugins/plugin-registry');
    const pluginInstaller = await import('./plugins/plugin-installer');
    const pluginGateway = await import('./plugins/plugin-gateway');

    await fastify.register(tenantContext.default);
    await fastify.register(pluginTenantIsolation.default);  // 租户隔离中间件（在其他插件之前）
    await fastify.register(commercialSupport.default);
    await fastify.register(pluginRegistry.default);
    await fastify.register(pluginInstaller.default);
    await fastify.register(pluginGateway.default);

    // 自动化任务插件
    const automationTasks = await import('./plugins/automation-tasks');
    await fastify.register(automationTasks.default);

    // 2. 业务插件 - 支付
    const stripe = await import('./plugins/stripe');
    await fastify.register(stripe.default, {
      prefix: '/api/plugins/stripe/api',
      secretKey: env.STRIPE_SECRET_KEY,
      webhookSecret: env.STRIPE_WEBHOOK_SECRET
    });

    // 3. 业务插件 - 邮件
    const resend = await import('./plugins/resend');
    await fastify.register(resend.default, {
      prefix: '/api/plugins/resend/api',
      apiKey: env.RESEND_API_KEY
    });

    // 4. 业务插件 - Google OAuth
    const google = await import('./plugins/google');
    await fastify.register(google.default, {
      prefix: '/api/plugins/google/api',
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: env.GOOGLE_REDIRECT_URI,
      jwtSecret: env.JWT_SECRET
    });

    // 5. 业务插件 - Affiliate (分销分润)
    const affiliate = await import('./plugins/affiliate');
    await fastify.register(affiliate.default, {
      prefix: '/api/plugins/affiliate/api'
    });

    // 6. 业务插件 - Agent (三级代理系统)
    const agent = await import('./plugins/agent');
    await fastify.register(agent.default, {
      prefix: '/api/plugins/agent/api'
    });

    // Add middleware
    fastify.addHook('onRequest', accessLogMiddleware);
    fastify.addHook('onError', errorLogMiddleware);

    // Root endpoint - Welcome page
    fastify.get('/', {
      schema: {
        tags: ['system'],
        summary: 'API root',
        response: {
          200: {
            type: 'object',
            additionalProperties: true
          }
        }
      }
    }, async () => {
      return {
        name: 'Jiffoo Mall API',
        version: '1.0.0',
        description: 'Fastify + TypeScript E-commerce System',
        environment: env.NODE_ENV,
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/health',
          auth: '/api/auth',
          users: '/api/users',
          products: '/api/products',
          cart: '/api/cart',
          orders: '/api/orders',
          upload: '/api/upload',
          cache: '/api/cache',
          // Removed i18n endpoint
          superAdmin: {
            users: '/api/super-admin/users',
            products: '/api/super-admin/products',
            orders: '/api/super-admin/orders',
            tenants: '/api/super-admin/tenants',
            plugins: '/api/super-admin/plugins'
          }
        }
      };
    });

    // Health check endpoint - full status with all checks
    fastify.get('/health', {
      schema: {
        tags: ['system'],
        summary: 'Full health check with dependency status',
        description: 'Returns detailed health status including database, Redis, and plugin status. Used for monitoring dashboards.',
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['ok', 'degraded', 'unhealthy'] },
              version: { type: 'string' },
              git_sha: { type: 'string' },
              build_time: { type: 'string' },
              environment: { type: 'string' },
              timestamp: { type: 'string' },
              uptime_seconds: { type: 'number' },
              checks: {
                type: 'object',
                properties: {
                  database: { type: 'object' },
                  redis: { type: 'object' },
                  plugins: { type: 'object' }
                }
              }
            }
          }
        }
      }
    }, async () => {
      return performHealthCheck(fastify);
    });

    // Liveness probe - simple check if process is running
    fastify.get('/health/live', {
      schema: {
        tags: ['system'],
        summary: 'Liveness probe for K8s',
        description: 'Simple check that returns ok if the process is running. Use for K8s livenessProbe.',
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              timestamp: { type: 'string' }
            }
          }
        }
      }
    }, async () => {
      return livenessCheck();
    });

    // Readiness probe - checks if app can serve traffic
    fastify.get('/health/ready', {
      schema: {
        tags: ['system'],
        summary: 'Readiness probe for K8s',
        description: 'Checks database and Redis connectivity. Use for K8s readinessProbe.',
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['ok', 'not_ready'] },
              checks: { type: 'object' }
            }
          },
          503: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              checks: { type: 'object' }
            }
          }
        }
      }
    }, async (request, reply) => {
      const result = await readinessCheck();
      if (result.status === 'not_ready') {
        return reply.status(503).send(result);
      }
      return result;
    });

    // Payment redirect routes (public, no auth required)
    // These routes redirect users from Stripe checkout back to the frontend
    fastify.get('/success', {
      schema: {
        tags: ['payments', 'system'],
        summary: 'Stripe success redirect',
        querystring: {
          type: 'object',
          properties: {
            session_id: { type: 'string' }
          }
        },
        response: {
          302: {
            type: 'null',
            description: 'Redirects user to frontend success page'
          }
        }
      }
    }, async (request, reply) => {
      const sessionId = (request.query as any).session_id;
      // 使用新命名：NEXT_PUBLIC_SHOP_URL（商城前台）
      const shopUrl = env.NEXT_PUBLIC_SHOP_URL;

      const redirectUrl = sessionId
        ? `${shopUrl}/order-success?session_id=${sessionId}`
        : `${shopUrl}/order-success`;

      return reply.redirect(redirectUrl);
    });

    fastify.get('/cancel', {
      schema: {
        tags: ['payments', 'system'],
        summary: 'Stripe cancel redirect',
        response: {
          302: {
            type: 'null',
            description: 'Redirects user to frontend cancel page'
          }
        }
      }
    }, async (_request, reply) => {
      // 使用新命名：NEXT_PUBLIC_SHOP_URL（商城前台）
      const shopUrl = env.NEXT_PUBLIC_SHOP_URL;

      return reply.redirect(`${shopUrl}/order-cancelled`);
    });

    // Stripe Webhook routes - forward to plugin webhook endpoint
    // This allows Stripe CLI to send webhooks to both /webhooks/stripe and /api/webhooks/stripe

    // Route for /webhooks/stripe (Stripe CLI default)
    fastify.post('/webhooks/stripe', {
      onRequest: [], // Skip all middleware including auth
      config: {
        rawBody: true // Enable rawBody for Stripe signature verification
      },
      schema: {
        hide: true,
        tags: ['payments', 'webhook'],
        summary: 'Stripe webhook (CLI default)',
        response: {
          200: {
            type: 'object',
            additionalProperties: true
          }
        }
      }
    }, async (request: any, reply: any) => {
      // Forward to the plugin webhook endpoint using inject
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/plugins/stripe/api/webhook',
        headers: request.headers,
        payload: request.rawBody || request.body
      });

      return reply
        .status(response.statusCode)
        .headers(response.headers)
        .send(response.body);
    });

    // Route for /api/webhooks/stripe (alternative path)
    fastify.post('/api/webhooks/stripe', {
      onRequest: [], // Skip all middleware including auth
      config: {
        rawBody: true // Enable rawBody for Stripe signature verification
      },
      schema: {
        hide: true,
        tags: ['payments', 'webhook'],
        summary: 'Stripe webhook (API path)',
        response: {
          200: {
            type: 'object',
            additionalProperties: true
          }
        }
      }
    }, async (request: any, reply: any) => {
      // Forward to the plugin webhook endpoint using inject
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/plugins/stripe/api/webhook',
        headers: request.headers,
        payload: request.rawBody || request.body
      });

      return reply
        .status(response.statusCode)
        .headers(response.headers)
        .send(response.body);
    });

    LoggerService.logSystem('Plugin system removed, ready for rewrite');

    // Register all core API routes
    await registerRoutes(fastify);

    // Additional feature routes
    // Removed i18n routes registration
    return fastify;
  } catch (error) {
    LoggerService.logError(error as Error, { context: 'App building' });
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
      port: env.API_PORT,
      host: env.API_HOST,
    });

    app.log.info(`Server running on http://${env.API_HOST}:${env.API_PORT}`);
    app.log.info(`API Documentation available at http://${env.API_HOST}:${env.API_PORT}/docs`);
    app.log.info(`Upload API available at http://${env.API_HOST}:${env.API_PORT}/api/upload`);
    app.log.info(`Cache API available at http://${env.API_HOST}:${env.API_PORT}/api/cache`);
    app.log.info('Plugin system removed, ready for rewrite');

    // 启动日志监控
    logMonitor.start(60000); // 每分钟检查一次

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

// Handle graceful shutdown
const gracefulShutdown = async (signal: string) => {
  LoggerService.logSystem(`Received ${signal}, shutting down gracefully`);

  try {
    // 停止日志监控
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

// Start the server
if (require.main === module) {
  start();
}

export { buildApp };



