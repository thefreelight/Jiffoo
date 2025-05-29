import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import staticFiles from '@fastify/static';
import path from 'path';
import { env } from '@/config/env';
import { prisma } from '@/config/database';
import { redisCache } from '@/core/cache/redis';
import { logger, LoggerService } from '@/core/logger/logger';
import { accessLogMiddleware, errorLogMiddleware } from '@/core/logger/middleware';

// Import routes
import { authRoutes } from '@/core/auth/routes';
import { userRoutes } from '@/core/user/routes';
import { productRoutes } from '@/core/product/routes';
import { orderRoutes } from '@/core/order/routes';
import { paymentRoutes } from '@/core/payment/routes';
import { uploadRoutes } from '@/core/upload/routes';
import { searchRoutes } from '@/core/search/routes';
import { cacheRoutes } from '@/core/cache/routes';
import { statisticsRoutes } from '@/core/statistics/routes';
import { permissionRoutes } from '@/core/permissions/routes';
import { inventoryRoutes } from '@/core/inventory/routes';
import { notificationRoutes } from '@/core/notifications/routes';

// Import plugin system
import { DefaultPluginManager } from '@/plugins/manager';
import { pluginRoutes } from '@/plugins/routes';

const fastify = Fastify({
  logger: {
    level: env.NODE_ENV === 'development' ? 'info' : 'warn',
  },
});

async function buildApp() {
  try {
    // Initialize Redis connection
    try {
      await redisCache.connect();
      LoggerService.logSystem('Redis connected successfully');
    } catch (error) {
      LoggerService.logError(error as Error, { context: 'Redis connection' });
      if (env.NODE_ENV !== 'development') {
        throw error;
      }
    }

    // Register multipart for file uploads
    await fastify.register(multipart, {
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
        files: 1
      }
    });

    // Register static files
    await fastify.register(staticFiles, {
      root: path.join(process.cwd(), 'uploads'),
      prefix: '/uploads/'
    });

    // Register CORS
    await fastify.register(cors, {
      origin: env.NODE_ENV === 'development' ? true : false,
      credentials: true,
    });

    // Add access logging middleware
    fastify.addHook('onRequest', accessLogMiddleware);

    // Add error handling
    fastify.setErrorHandler(errorLogMiddleware);

    // Root endpoint - Welcome page
    fastify.get('/', async () => {
      return {
        name: 'Jiffoo Mall API',
        version: '1.0.0',
        description: 'Fastify + TypeScript 商城系统',
        environment: env.NODE_ENV,
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/health',
          auth: '/api/auth',
          users: '/api/users',
          products: '/api/products',
          orders: '/api/orders',
          payments: '/api/payments',
          upload: '/api/upload',
          search: '/api/search',
          cache: '/api/cache',
          statistics: '/api/statistics',
          permissions: '/api/permissions',
          inventory: '/api/inventory',
          notifications: '/api/notifications',
          plugins: '/api/plugins'
        },
        documentation: {
          swagger_ui: '/docs',
          openapi_json: '/openapi.json',
          health_check: 'GET /health',
          api_base: '/api'
        }
      };
    });

    // OpenAPI JSON endpoint
    fastify.get('/openapi.json', async () => {
      return {
        openapi: '3.0.0',
        info: {
          title: 'Jiffoo Mall API',
          description: 'Fastify + TypeScript 商城系统 API 文档',
          version: '1.0.0',
          contact: {
            name: 'Jiffoo Team',
            email: 'support@jiffoo.com'
          },
          license: {
            name: 'MIT',
            url: 'https://opensource.org/licenses/MIT'
          }
        },
        servers: [
          {
            url: `http://${env.HOST}:${env.PORT}`,
            description: '开发环境'
          }
        ],
        tags: [
          { name: 'auth', description: '认证相关接口' },
          { name: 'users', description: '用户管理接口' },
          { name: 'products', description: '商品管理接口' },
          { name: 'orders', description: '订单管理接口' },
          { name: 'payments', description: '支付管理接口' },
          { name: 'system', description: '系统接口' }
        ],
        paths: {
          '/': {
            get: {
              tags: ['system'],
              summary: 'API 欢迎页面',
              description: '显示 API 基本信息和可用端点',
              responses: {
                '200': {
                  description: 'API 信息',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          name: { type: 'string' },
                          version: { type: 'string' },
                          description: { type: 'string' },
                          environment: { type: 'string' },
                          timestamp: { type: 'string', format: 'date-time' }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '/health': {
            get: {
              tags: ['system'],
              summary: '健康检查',
              description: '检查服务器运行状态',
              responses: {
                '200': {
                  description: '服务器状态',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          status: { type: 'string', enum: ['ok'] },
                          timestamp: { type: 'string', format: 'date-time' },
                          environment: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '/api/products': {
            get: {
              tags: ['products'],
              summary: '获取商品列表',
              description: '获取所有商品的分页列表，支持搜索',
              parameters: [
                {
                  name: 'page',
                  in: 'query',
                  description: '页码',
                  schema: { type: 'integer', minimum: 1, default: 1 }
                },
                {
                  name: 'limit',
                  in: 'query',
                  description: '每页数量',
                  schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 }
                },
                {
                  name: 'search',
                  in: 'query',
                  description: '搜索关键词',
                  schema: { type: 'string' }
                }
              ],
              responses: {
                '200': {
                  description: '商品列表',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          products: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                name: { type: 'string' },
                                description: { type: 'string' },
                                price: { type: 'number' },
                                stock: { type: 'integer' },
                                images: { type: 'string' },
                                createdAt: { type: 'string', format: 'date-time' },
                                updatedAt: { type: 'string', format: 'date-time' }
                              }
                            }
                          },
                          pagination: {
                            type: 'object',
                            properties: {
                              page: { type: 'integer' },
                              limit: { type: 'integer' },
                              total: { type: 'integer' },
                              totalPages: { type: 'integer' }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '/api/search/products': {
            get: {
              tags: ['search'],
              summary: '高级商品搜索',
              description: '支持关键词、价格范围、分类等多维度搜索',
              parameters: [
                {
                  name: 'q',
                  in: 'query',
                  description: '搜索关键词',
                  schema: { type: 'string' }
                },
                {
                  name: 'minPrice',
                  in: 'query',
                  description: '最低价格',
                  schema: { type: 'number', minimum: 0 }
                },
                {
                  name: 'maxPrice',
                  in: 'query',
                  description: '最高价格',
                  schema: { type: 'number', minimum: 0 }
                },
                {
                  name: 'inStock',
                  in: 'query',
                  description: '是否有库存',
                  schema: { type: 'boolean' }
                }
              ],
              responses: {
                '200': {
                  description: '搜索结果',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          products: { type: 'array' },
                          pagination: { type: 'object' },
                          filters: { type: 'object' },
                          sort: { type: 'object' }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '/api/upload/product-image': {
            post: {
              tags: ['upload'],
              summary: '上传商品图片',
              description: '上传商品图片，支持 JPEG、PNG、WebP 格式，最大 5MB',
              security: [{ bearerAuth: [] }],
              requestBody: {
                content: {
                  'multipart/form-data': {
                    schema: {
                      type: 'object',
                      properties: {
                        file: {
                          type: 'string',
                          format: 'binary'
                        }
                      }
                    }
                  }
                }
              },
              responses: {
                '200': {
                  description: '上传成功',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          success: { type: 'boolean' },
                          data: {
                            type: 'object',
                            properties: {
                              filename: { type: 'string' },
                              url: { type: 'string' },
                              size: { type: 'number' }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT'
            }
          }
        }
      };
    });

    // Swagger UI endpoint
    fastify.get('/docs', async (request, reply) => {
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Jiffoo Mall API Documentation</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
    <style>
        html {
            box-sizing: border-box;
            overflow: -moz-scrollbars-vertical;
            overflow-y: scroll;
        }
        *, *:before, *:after {
            box-sizing: inherit;
        }
        body {
            margin:0;
            background: #fafafa;
        }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-standalone-preset.js"></script>
    <script>
        window.onload = function() {
            const ui = SwaggerUIBundle({
                url: '/openapi.json',
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: "StandaloneLayout",
                tryItOutEnabled: true,
                requestInterceptor: function(request) {
                    // 可以在这里添加认证头等
                    return request;
                }
            });
        };
    </script>
</body>
</html>`;

      reply.type('text/html').send(html);
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
    await fastify.register(uploadRoutes, { prefix: '/api/upload' });
    await fastify.register(searchRoutes, { prefix: '/api/search' });
    await fastify.register(cacheRoutes, { prefix: '/api/cache' });
    await fastify.register(statisticsRoutes, { prefix: '/api/statistics' });
    await fastify.register(permissionRoutes, { prefix: '/api/permissions' });
    await fastify.register(inventoryRoutes, { prefix: '/api/inventory' });
    await fastify.register(notificationRoutes, { prefix: '/api/notifications' });
    await fastify.register(pluginRoutes, { prefix: '/api/plugins' });

    // Initialize plugin system
    const pluginManager = new DefaultPluginManager(fastify);
    const pluginsDir = path.join(__dirname, 'plugins');
    await pluginManager.loadPluginsFromDirectory(pluginsDir);

    // Store plugin manager in fastify instance for access in routes
    (fastify as any).pluginManager = pluginManager;

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
    app.log.info(`📚 API Documentation available at http://${env.HOST}:${env.PORT}/docs`);
    app.log.info(`🔍 Search API available at http://${env.HOST}:${env.PORT}/api/search`);
    app.log.info(`📁 Upload API available at http://${env.HOST}:${env.PORT}/api/upload`);
    app.log.info(`💾 Cache API available at http://${env.HOST}:${env.PORT}/api/cache`);
    app.log.info(`📊 Statistics API available at http://${env.HOST}:${env.PORT}/api/statistics`);
    app.log.info(`🔐 Permissions API available at http://${env.HOST}:${env.PORT}/api/permissions`);
    app.log.info(`📦 Inventory API available at http://${env.HOST}:${env.PORT}/api/inventory`);
    app.log.info(`📧 Notifications API available at http://${env.HOST}:${env.PORT}/api/notifications`);
    app.log.info(`🔌 Plugins API available at http://${env.HOST}:${env.PORT}/api/plugins`);

    LoggerService.logSystem('Server started successfully', {
      port: env.PORT,
      host: env.HOST,
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
