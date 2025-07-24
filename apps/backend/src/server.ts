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
import { userProfileRoutes } from '@/core/user/profile-routes';
import { paymentRoutes } from '@/core/payment/routes';
import { productRoutes } from '@/core/product/routes';
import { cartRoutes } from '@/core/cart/routes';
import { orderRoutes } from '@/core/order/routes';
import { uploadRoutes } from '@/core/upload/routes';
import { searchRoutes } from '@/core/search/routes';
import { cacheRoutes } from '@/core/cache/routes';
import { statisticsRoutes } from '@/core/statistics/routes';
import { inventoryRoutes } from '@/core/inventory/routes';
import { notificationRoutes } from '@/core/notifications/routes';

// Import plugin system
import { pluginManagementRoutes } from '@/core/plugins/plugin-management-routes';


// Import i18n system
import { i18nRoutes } from '@/core/i18n/routes';
import { I18nMiddleware } from '@/core/i18n/middleware';

// Import commercialization routes
import { licenseRoutes } from '@/core/licensing/license-routes';
import { licenseRoutes as newLicenseRoutes } from '@/routes/license-routes';
import { pluginStoreRoutes } from '@/core/plugin-store/plugin-store-routes';
import { saasRoutes } from '@/core/saas/saas-routes';
import { templateRoutes } from '@/core/templates/template-manager';
import { tenantRoutes } from '@/core/tenant/tenant-routes';
import { salesRoutes } from '@/core/sales/sales-routes';
import { permissionRoutes as authPermissionRoutes } from '@/core/auth/permission-routes';

// Import OAuth 2.0 and SaaS marketplace routes
import { oauth2Routes } from '@/core/auth/oauth2-routes';
import { saasMarketplaceRoutes } from '@/core/saas-marketplace/saas-routes';

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

    // Register Prisma client as a decorator
    fastify.decorate('prisma', prisma);

    // Add content type parser for application/x-www-form-urlencoded
    fastify.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, function (req, body, done) {
      try {
        // For empty body, return empty object
        const bodyStr = typeof body === 'string' ? body : body.toString();
        if (!bodyStr || bodyStr.trim() === '') {
          done(null, {});
        } else {
          // Parse URL-encoded data
          const parsed = new URLSearchParams(bodyStr);
          const result: Record<string, any> = {};
          for (const [key, value] of parsed) {
            result[key] = value;
          }
          done(null, result);
        }
      } catch (err) {
        done(err as Error, undefined);
      }
    });

    // Register i18n middleware globally
    await fastify.register(async function (fastify) {
      fastify.addHook('onRequest', I18nMiddleware.create());
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
          cart: '/api/cart',
          orders: '/api/orders',
          payments: '/api/payments',
          upload: '/api/upload',
          search: '/api/search',
          cache: '/api/cache',
          statistics: '/api/statistics',
          permissions: '/api/permissions',
          inventory: '/api/inventory',
          notifications: '/api/notifications',
          plugins: '/api/plugins',
          i18n: '/api/i18n',
          licenses: '/api/licenses',
          pluginStore: '/api/plugin-store',
          saas: '/api/saas',
          templates: '/api/templates',
          tenants: '/api/tenants',
          sales: '/api/sales'
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
          description: 'Fastify + TypeScript 商城系统 API 文档 - 现代化电商平台完整API',
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
          { name: 'system', description: '系统接口' },
          { name: 'auth', description: '认证相关接口' },
          { name: 'users', description: '用户管理接口' },
          { name: 'products', description: '商品管理接口' },
          { name: 'cart', description: '购物车接口' },
          { name: 'orders', description: '订单管理接口' },
          { name: 'payments', description: '支付管理接口' },
          { name: 'upload', description: '文件上传接口' },
          { name: 'search', description: '搜索接口' },
          { name: 'cache', description: '缓存管理接口' },
          { name: 'statistics', description: '统计分析接口' },
          { name: 'inventory', description: '库存管理接口' },
          { name: 'notifications', description: '通知系统接口' },
          { name: 'plugins', description: '插件系统接口' },
          { name: 'i18n', description: '国际化接口' },
          { name: 'licenses', description: '许可证管理接口' },
          { name: 'plugin-store', description: '插件商店接口' },
          { name: 'saas', description: 'SaaS服务接口' },
          { name: 'templates', description: '模板市场接口' },
          { name: 'tenants', description: '租户管理接口' },
          { name: 'sales', description: '销售管理接口' },
          { name: 'permissions', description: '权限管理接口' }
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
                          timestamp: { type: 'string', format: 'date-time' },
                          endpoints: { type: 'object' },
                          documentation: { type: 'object' }
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
          '/api/auth/register': {
            post: {
              tags: ['auth'],
              summary: '用户注册',
              description: '注册新用户账户',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['email', 'password', 'name'],
                      properties: {
                        email: { type: 'string', format: 'email' },
                        password: { type: 'string', minLength: 6 },
                        name: { type: 'string' }
                      }
                    }
                  }
                }
              },
              responses: {
                '201': {
                  description: '注册成功',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          user: { type: 'object' },
                          token: { type: 'string' }
                        }
                      }
                    }
                  }
                },
                '400': {
                  description: '注册失败',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          error: { type: 'string' },
                          message: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '/api/auth/login': {
            post: {
              tags: ['auth'],
              summary: '用户登录',
              description: '用户登录获取访问令牌',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['email', 'password'],
                      properties: {
                        email: { type: 'string', format: 'email' },
                        password: { type: 'string' }
                      }
                    }
                  }
                }
              },
              responses: {
                '200': {
                  description: '登录成功',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          user: { type: 'object' },
                          token: { type: 'string' }
                        }
                      }
                    }
                  }
                },
                '401': {
                  description: '登录失败',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          error: { type: 'string' },
                          message: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '/api/auth/me': {
            get: {
              tags: ['auth'],
              summary: '获取当前用户信息',
              description: '获取当前登录用户的详细信息',
              security: [{ bearerAuth: [] }],
              responses: {
                '200': {
                  description: '用户信息',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          user: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              email: { type: 'string' },
                              name: { type: 'string' },
                              role: { type: 'string' },
                              createdAt: { type: 'string', format: 'date-time' }
                            }
                          }
                        }
                      }
                    }
                  }
                },
                '401': {
                  description: '未授权',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          error: { type: 'string' }
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
              description: '获取所有商品的分页列表，支持搜索和筛选',
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
                },
                {
                  name: 'category',
                  in: 'query',
                  description: '商品分类',
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
                },
                {
                  name: 'sortBy',
                  in: 'query',
                  description: '排序字段',
                  schema: { type: 'string', enum: ['name', 'price', 'createdAt', 'stock'], default: 'createdAt' }
                },
                {
                  name: 'sortOrder',
                  in: 'query',
                  description: '排序方向',
                  schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }
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
                                category: { type: 'string' },
                                totalSold: { type: 'integer' },
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
            },
            post: {
              tags: ['products'],
              summary: '创建商品',
              description: '创建新商品（管理员权限）',
              security: [{ bearerAuth: [] }],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['name', 'description', 'price', 'stock'],
                      properties: {
                        name: { type: 'string' },
                        description: { type: 'string' },
                        price: { type: 'number', minimum: 0 },
                        stock: { type: 'integer', minimum: 0 },
                        category: { type: 'string' },
                        images: { type: 'string' }
                      }
                    }
                  }
                }
              },
              responses: {
                '201': {
                  description: '商品创建成功',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          product: { type: 'object' }
                        }
                      }
                    }
                  }
                },
                '400': {
                  description: '创建失败',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          error: { type: 'string' },
                          message: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '/api/products/{id}': {
            get: {
              tags: ['products'],
              summary: '获取商品详情',
              description: '根据ID获取商品详细信息',
              parameters: [
                {
                  name: 'id',
                  in: 'path',
                  required: true,
                  description: '商品ID',
                  schema: { type: 'string' }
                }
              ],
              responses: {
                '200': {
                  description: '商品详情',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          product: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              name: { type: 'string' },
                              description: { type: 'string' },
                              price: { type: 'number' },
                              stock: { type: 'integer' },
                              images: { type: 'string' },
                              category: { type: 'string' },
                              totalSold: { type: 'integer' },
                              createdAt: { type: 'string', format: 'date-time' },
                              updatedAt: { type: 'string', format: 'date-time' }
                            }
                          }
                        }
                      }
                    }
                  }
                },
                '404': {
                  description: '商品不存在',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          error: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              }
            },
            put: {
              tags: ['products'],
              summary: '更新商品',
              description: '更新商品信息（管理员权限）',
              security: [{ bearerAuth: [] }],
              parameters: [
                {
                  name: 'id',
                  in: 'path',
                  required: true,
                  description: '商品ID',
                  schema: { type: 'string' }
                }
              ],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        description: { type: 'string' },
                        price: { type: 'number', minimum: 0 },
                        stock: { type: 'integer', minimum: 0 },
                        category: { type: 'string' },
                        images: { type: 'string' }
                      }
                    }
                  }
                }
              },
              responses: {
                '200': {
                  description: '更新成功',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          product: { type: 'object' }
                        }
                      }
                    }
                  }
                },
                '404': {
                  description: '商品不存在'
                }
              }
            },
            delete: {
              tags: ['products'],
              summary: '删除商品',
              description: '删除商品（管理员权限）',
              security: [{ bearerAuth: [] }],
              parameters: [
                {
                  name: 'id',
                  in: 'path',
                  required: true,
                  description: '商品ID',
                  schema: { type: 'string' }
                }
              ],
              responses: {
                '204': {
                  description: '删除成功'
                },
                '404': {
                  description: '商品不存在'
                }
              }
            }
          },
          '/api/cart': {
            get: {
              tags: ['cart'],
              summary: '获取购物车',
              description: '获取当前用户的购物车内容',
              responses: {
                '200': {
                  description: '购物车内容',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          success: { type: 'boolean' },
                          data: {
                            type: 'object',
                            properties: {
                              items: {
                                type: 'array',
                                items: {
                                  type: 'object',
                                  properties: {
                                    id: { type: 'string' },
                                    productId: { type: 'string' },
                                    productName: { type: 'string' },
                                    productImage: { type: 'string' },
                                    price: { type: 'number' },
                                    quantity: { type: 'integer' },
                                    variantId: { type: 'string' },
                                    variantName: { type: 'string' },
                                    maxQuantity: { type: 'integer' }
                                  }
                                }
                              },
                              total: { type: 'number' },
                              itemCount: { type: 'integer' },
                              subtotal: { type: 'number' },
                              tax: { type: 'number' },
                              shipping: { type: 'number' }
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
          '/api/cart/add': {
            post: {
              tags: ['cart'],
              summary: '添加商品到购物车',
              description: '将商品添加到购物车',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['productId', 'quantity'],
                      properties: {
                        productId: { type: 'string' },
                        quantity: { type: 'integer', minimum: 1 },
                        variantId: { type: 'string' }
                      }
                    }
                  }
                }
              },
              responses: {
                '200': {
                  description: '添加成功',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          success: { type: 'boolean' },
                          data: { type: 'object' }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '/api/orders': {
            get: {
              tags: ['orders'],
              summary: '获取订单列表',
              description: '获取用户的订单列表（用户）或所有订单（管理员）',
              security: [{ bearerAuth: [] }],
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
                }
              ],
              responses: {
                '200': {
                  description: '订单列表',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          orders: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                userId: { type: 'string' },
                                status: { type: 'string' },
                                total: { type: 'number' },
                                items: { type: 'array' },
                                createdAt: { type: 'string', format: 'date-time' },
                                updatedAt: { type: 'string', format: 'date-time' }
                              }
                            }
                          },
                          pagination: { type: 'object' }
                        }
                      }
                    }
                  }
                }
              }
            },
            post: {
              tags: ['orders'],
              summary: '创建订单',
              description: '创建新订单',
              security: [{ bearerAuth: [] }],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['items'],
                      properties: {
                        items: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              productId: { type: 'string' },
                              quantity: { type: 'integer', minimum: 1 },
                              price: { type: 'number', minimum: 0 }
                            }
                          }
                        },
                        shippingAddress: { type: 'object' },
                        paymentMethod: { type: 'string' }
                      }
                    }
                  }
                }
              },
              responses: {
                '201': {
                  description: '订单创建成功',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          order: { type: 'object' }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '/api/orders/{id}': {
            get: {
              tags: ['orders'],
              summary: '获取订单详情',
              description: '根据ID获取订单详细信息',
              security: [{ bearerAuth: [] }],
              parameters: [
                {
                  name: 'id',
                  in: 'path',
                  required: true,
                  description: '订单ID',
                  schema: { type: 'string' }
                }
              ],
              responses: {
                '200': {
                  description: '订单详情',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          order: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              userId: { type: 'string' },
                              status: { type: 'string' },
                              total: { type: 'number' },
                              items: { type: 'array' },
                              shippingAddress: { type: 'object' },
                              paymentMethod: { type: 'string' },
                              createdAt: { type: 'string', format: 'date-time' },
                              updatedAt: { type: 'string', format: 'date-time' }
                            }
                          }
                        }
                      }
                    }
                  }
                },
                '404': {
                  description: '订单不存在'
                }
              }
            }
          },
          '/api/payments/process': {
            post: {
              tags: ['payments'],
              summary: '处理支付',
              description: '处理订单支付',
              security: [{ bearerAuth: [] }],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['orderId', 'paymentMethod'],
                      properties: {
                        orderId: { type: 'string' },
                        paymentMethod: { type: 'string', enum: ['STRIPE', 'MOCK', 'PAYPAL'] },
                        amount: { type: 'number', minimum: 0 },
                        currency: { type: 'string', default: 'USD' }
                      }
                    }
                  }
                }
              },
              responses: {
                '200': {
                  description: '支付处理成功',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          success: { type: 'boolean' },
                          payment: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              status: { type: 'string' },
                              amount: { type: 'number' },
                              currency: { type: 'string' },
                              transactionId: { type: 'string' }
                            }
                          },
                          message: { type: 'string' }
                        }
                      }
                    }
                  }
                },
                '400': {
                  description: '支付处理失败'
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
                  name: 'category',
                  in: 'query',
                  description: '商品分类',
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
                },
                {
                  name: 'sortBy',
                  in: 'query',
                  description: '排序字段',
                  schema: { type: 'string', enum: ['name', 'price', 'createdAt', 'updatedAt', 'stock'], default: 'createdAt' }
                },
                {
                  name: 'sortOrder',
                  in: 'query',
                  description: '排序方向',
                  schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' }
                },
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
                                totalSold: { type: 'integer' },
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
                          },
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
          },
          '/api/plugin-store/plugins': {
            get: {
              tags: ['plugin-store'],
              summary: '获取插件列表',
              description: '获取插件商店中的所有可用插件',
              parameters: [
                {
                  name: 'q',
                  in: 'query',
                  description: '搜索关键词',
                  schema: { type: 'string' }
                },
                {
                  name: 'category',
                  in: 'query',
                  description: '插件分类',
                  schema: { type: 'string' }
                },
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
                  schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 }
                },
                {
                  name: 'sort',
                  in: 'query',
                  description: '排序方式',
                  schema: { type: 'string', enum: ['name', 'rating', 'downloads', 'updated'], default: 'rating' }
                }
              ],
              responses: {
                '200': {
                  description: '插件列表',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          plugins: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                name: { type: 'string' },
                                displayName: { type: 'string' },
                                version: { type: 'string' },
                                description: { type: 'string' },
                                category: { type: 'string' },
                                tags: { type: 'array', items: { type: 'string' } },
                                pricing: { type: 'object' },
                                features: { type: 'array', items: { type: 'string' } },
                                stats: { type: 'object' },
                                status: { type: 'string' }
                              }
                            }
                          },
                          pagination: { type: 'object' }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '/api/plugin-store/plugins/{id}': {
            get: {
              tags: ['plugin-store'],
              summary: '获取插件详情',
              description: '获取指定插件的详细信息',
              parameters: [
                {
                  name: 'id',
                  in: 'path',
                  required: true,
                  description: '插件ID',
                  schema: { type: 'string' }
                }
              ],
              responses: {
                '200': {
                  description: '插件详情',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          plugin: { type: 'object' },
                          userLicense: { type: 'object' }
                        }
                      }
                    }
                  }
                },
                '404': {
                  description: '插件不存在'
                }
              }
            }
          },
          '/api/licenses/generate': {
            post: {
              tags: ['licenses'],
              summary: '生成插件许可证',
              description: '为用户生成新的插件许可证（管理员权限）',
              security: [{ bearerAuth: [] }],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['pluginName', 'licenseType', 'features'],
                      properties: {
                        pluginName: { type: 'string' },
                        licenseType: { type: 'string', enum: ['trial', 'monthly', 'yearly', 'lifetime'] },
                        features: { type: 'array', items: { type: 'string' } },
                        usageLimits: { type: 'object' },
                        durationDays: { type: 'integer' },
                        targetUserId: { type: 'string' }
                      }
                    }
                  }
                }
              },
              responses: {
                '200': {
                  description: '许可证生成成功',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          success: { type: 'boolean' },
                          licenseKey: { type: 'string' },
                          expiresAt: { type: 'string', format: 'date-time' }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '/api/licenses/validate': {
            get: {
              tags: ['licenses'],
              summary: '验证插件许可证',
              description: '验证用户的插件许可证是否有效',
              security: [{ bearerAuth: [] }],
              parameters: [
                {
                  name: 'pluginName',
                  in: 'query',
                  required: true,
                  description: '插件名称',
                  schema: { type: 'string' }
                }
              ],
              responses: {
                '200': {
                  description: '许可证验证结果',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          valid: { type: 'boolean' },
                          features: { type: 'array', items: { type: 'string' } },
                          usageRemaining: { type: 'object' },
                          expiresAt: { type: 'string', format: 'date-time' },
                          reason: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '/api/saas/plans': {
            get: {
              tags: ['saas'],
              summary: '获取SaaS计划',
              description: '获取所有可用的SaaS托管计划',
              responses: {
                '200': {
                  description: 'SaaS计划列表',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          plans: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                name: { type: 'string' },
                                displayName: { type: 'string' },
                                description: { type: 'string' },
                                price: { type: 'number' },
                                currency: { type: 'string' },
                                billing: { type: 'string' },
                                features: { type: 'array', items: { type: 'string' } },
                                limits: { type: 'object' }
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
          '/api/saas/instances': {
            post: {
              tags: ['saas'],
              summary: '创建SaaS实例',
              description: '为用户创建新的SaaS实例',
              security: [{ bearerAuth: [] }],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['instanceName', 'subdomain', 'planId'],
                      properties: {
                        instanceName: { type: 'string', minLength: 1, maxLength: 50 },
                        subdomain: { type: 'string', minLength: 3, maxLength: 30, pattern: '^[a-z0-9-]+$' },
                        planId: { type: 'string' },
                        region: { type: 'string' },
                        customDomain: { type: 'string' }
                      }
                    }
                  }
                }
              },
              responses: {
                '200': {
                  description: 'SaaS实例创建成功',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          success: { type: 'boolean' },
                          instanceId: { type: 'string' },
                          subdomain: { type: 'string' },
                          accessUrl: { type: 'string' },
                          message: { type: 'string' }
                        }
                      }
                    }
                  }
                },
                '400': {
                  description: '创建失败'
                }
              }
            }
          },
          '/api/templates': {
            get: {
              tags: ['templates'],
              summary: '获取模板列表',
              description: '获取模板市场中的所有可用模板',
              parameters: [
                {
                  name: 'q',
                  in: 'query',
                  description: '搜索关键词',
                  schema: { type: 'string' }
                },
                {
                  name: 'category',
                  in: 'query',
                  description: '模板分类',
                  schema: { type: 'string' }
                },
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
                  schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 }
                }
              ],
              responses: {
                '200': {
                  description: '模板列表',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          templates: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                id: { type: 'string' },
                                name: { type: 'string' },
                                displayName: { type: 'string' },
                                description: { type: 'string' },
                                category: { type: 'string' },
                                tags: { type: 'array', items: { type: 'string' } },
                                pricing: { type: 'object' },
                                features: { type: 'array', items: { type: 'string' } },
                                preview: { type: 'string' },
                                demoUrl: { type: 'string' },
                                version: { type: 'string' },
                                author: { type: 'string' },
                                stats: { type: 'object' },
                                status: { type: 'string' }
                              }
                            }
                          },
                          pagination: { type: 'object' }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '/api/templates/purchase': {
            post: {
              tags: ['templates'],
              summary: '购买模板',
              description: '购买或下载模板',
              security: [{ bearerAuth: [] }],
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['templateId', 'licenseType'],
                      properties: {
                        templateId: { type: 'string' },
                        licenseType: { type: 'string', enum: ['single', 'extended', 'developer'] }
                      }
                    }
                  }
                }
              },
              responses: {
                '200': {
                  description: '购买成功',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          success: { type: 'boolean' },
                          purchaseId: { type: 'string' },
                          downloadUrl: { type: 'string' },
                          message: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '/api/statistics/dashboard': {
            get: {
              tags: ['statistics'],
              summary: '获取仪表板统计数据',
              description: '获取系统总体统计数据，包括用户、商品、订单、收入等（管理员权限）',
              security: [{ bearerAuth: [] }],
              responses: {
                '200': {
                  description: '仪表板统计数据',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          totalUsers: { type: 'integer' },
                          totalProducts: { type: 'integer' },
                          totalOrders: { type: 'integer' },
                          totalRevenue: { type: 'number' },
                          todayOrders: { type: 'integer' },
                          todayRevenue: { type: 'number' },
                          userGrowth: { type: 'number' },
                          orderGrowth: { type: 'number' },
                          revenueGrowth: { type: 'number' }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          '/api/i18n/languages': {
            get: {
              tags: ['i18n'],
              summary: '获取支持的语言列表',
              description: '获取系统支持的所有语言信息',
              responses: {
                '200': {
                  description: '语言列表',
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          languages: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                code: { type: 'string' },
                                name: { type: 'string' },
                                nativeName: { type: 'string' },
                                direction: { type: 'string', enum: ['ltr', 'rtl'] },
                                region: { type: 'string' },
                                flag: { type: 'string' },
                                enabled: { type: 'boolean' }
                              }
                            }
                          },
                          total: { type: 'integer' }
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
        hotReload: '🔥 热更新功能正常工作！',
        version: '0.2.0-hot-updated',
      };
    });

    // Initialize payment service first to set up plugin proxy routes at root level
    const { PaymentService } = await import('@/core/payment/service');
    await PaymentService.initializePluginProxyRoutes(fastify);

    // API routes
    await fastify.register(authRoutes, { prefix: '/api/auth' });
    await fastify.register(userRoutes, { prefix: '/api/users' });
    await fastify.register(userProfileRoutes, { prefix: '/api/user' });
    await fastify.register(paymentRoutes, { prefix: '/api/payments' });
    await fastify.register(productRoutes, { prefix: '/api/products' });
    await fastify.register(cartRoutes, { prefix: '/api/cart' });
    await fastify.register(orderRoutes, { prefix: '/api/orders' });
    await fastify.register(uploadRoutes, { prefix: '/api/upload' });
    await fastify.register(searchRoutes, { prefix: '/api/search' });
    await fastify.register(cacheRoutes, { prefix: '/api/cache' });
    await fastify.register(statisticsRoutes, { prefix: '/api/statistics' });
    await fastify.register(inventoryRoutes, { prefix: '/api/inventory' });
    await fastify.register(notificationRoutes, { prefix: '/api/notifications' });
    // Legacy plugin routes removed - now handled by payment plugin routes
    await fastify.register(i18nRoutes, { prefix: '/api/i18n' });

    // Plugin management routes
    await fastify.register(pluginManagementRoutes, { prefix: '/api/plugins' });



    // Commercialization routes
    await fastify.register(licenseRoutes, { prefix: '/api/licenses' });
    await fastify.register(newLicenseRoutes, { prefix: '/api' });
    await fastify.register(pluginStoreRoutes, { prefix: '/api/plugin-store' });
    await fastify.register(saasRoutes, { prefix: '/api/saas' });
    await fastify.register(templateRoutes, { prefix: '/api/templates' });
    await fastify.register(tenantRoutes, { prefix: '/api/tenants' });
    await fastify.register(salesRoutes, { prefix: '/api/sales' });
    await fastify.register(authPermissionRoutes, { prefix: '/api/permissions' });

    // OAuth 2.0 and SaaS marketplace routes
    await fastify.register(oauth2Routes, { prefix: '' }); // No prefix for OAuth routes
    await fastify.register(saasMarketplaceRoutes, { prefix: '/api' });

    // Legacy plugin system initialization removed - now using unified plugin manager

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
    app.log.info(`📦 Inventory API available at http://${env.HOST}:${env.PORT}/api/inventory`);
    app.log.info(`📧 Notifications API available at http://${env.HOST}:${env.PORT}/api/notifications`);
    app.log.info(`🔌 Plugins API available at http://${env.HOST}:${env.PORT}/api/plugins`);
    app.log.info(`🌍 i18n API available at http://${env.HOST}:${env.PORT}/api/i18n`);
    app.log.info(`🔑 Licenses API available at http://${env.HOST}:${env.PORT}/api/licenses`);
    app.log.info(`🏪 Plugin Store API available at http://${env.HOST}:${env.PORT}/api/plugin-store`);
    app.log.info(`☁️ SaaS API available at http://${env.HOST}:${env.PORT}/api/saas`);
    app.log.info(`🎨 Templates API available at http://${env.HOST}:${env.PORT}/api/templates`);
    app.log.info(`🏢 Tenants API available at http://${env.HOST}:${env.PORT}/api/tenants`);
    app.log.info(`💰 Sales API available at http://${env.HOST}:${env.PORT}/api/sales`);
    app.log.info(`🔐 Permissions API available at http://${env.HOST}:${env.PORT}/api/permissions`);

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
