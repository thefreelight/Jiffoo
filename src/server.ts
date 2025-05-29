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
          payments: '/api/payments'
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
