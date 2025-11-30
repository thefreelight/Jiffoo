import { FastifyInstance } from 'fastify';
import { SuperAdminOrderService } from './service';
import { UpdateOrderStatusSchema, BatchOrderOperationSchema } from './types';
import { authMiddleware, superAdminMiddleware } from '@/core/auth/middleware';

export async function superAdminOrderRoutes(fastify: FastifyInstance) {
  // 获取所有订单（超级管理员）- 跨租户
  fastify.get('/', {
    preHandler: [authMiddleware, superAdminMiddleware],
    schema: {
      hide: true,
      tags: ['super-admin-orders'],
      summary: 'Get all orders (Super Admin)',
      description: 'Get all orders across all tenants with pagination, search and filtering',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
          search: { type: 'string', description: 'Search by customer email, username, or tenant name' },
          status: { type: 'string', enum: ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'] },
          tenantId: { type: 'string', description: 'Filter by specific tenant ID' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  userId: { type: 'string' },
                  status: { type: 'string' },
                  totalAmount: { type: 'number' },
                  customerEmail: { type: 'string' },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                  tenantId: { type: 'integer' },
                  tenant: {
                    type: 'object',
                    properties: {
                      id: { type: 'integer' },
                      companyName: { type: 'string' },
                      contactEmail: { type: 'string' }
                    }
                  },
                  user: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      username: { type: 'string' },
                      email: { type: 'string' }
                    }
                  }
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
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { page = 1, limit = 10, search, status, tenantId } = request.query as any;
      const result = await SuperAdminOrderService.getAllOrders(
        Number(page),
        Number(limit),
        search,
        status,
        tenantId
      );

      return reply.send(result);
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to get orders',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 获取订单详情（超级管理员）
  fastify.get('/:id', {
    preHandler: [authMiddleware, superAdminMiddleware],
    schema: {
      hide: true,
      tags: ['super-admin-orders'],
      summary: 'Get order details (Super Admin)',
      description: 'Get detailed information about a specific order across any tenant',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                userId: { type: 'string' },
                status: { type: 'string' },
                totalAmount: { type: 'number' },
                customerEmail: { type: 'string' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
                tenantId: { type: 'integer' },
                tenant: {
                  type: 'object',
                  properties: {
                    id: { type: 'integer' },
                    companyName: { type: 'string' },
                    contactEmail: { type: 'string' }
                  }
                },
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      productId: { type: 'string' },
                      quantity: { type: 'integer' },
                      unitPrice: { type: 'number' },
                      product: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          name: { type: 'string' },
                          images: { type: 'string' },
                          category: { type: 'string' }
                        }
                      }
                    }
                  }
                },
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    username: { type: 'string' },
                    email: { type: 'string' }
                  }
                }
              }
            }
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const order = await SuperAdminOrderService.getOrderById(id);

      if (!order) {
        return reply.status(404).send({
          success: false,
          error: 'Order not found'
        });
      }

      return reply.send({
        success: true,
        data: order
      });
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to get order details',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 更新订单状态（超级管理员）
  fastify.patch('/:id/status', {
    preHandler: [authMiddleware, superAdminMiddleware],
    schema: {
      hide: true,
      tags: ['super-admin-orders'],
      summary: 'Update order status (Super Admin)',
      description: 'Update the status of any order across any tenant',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'] }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                status: { type: 'string' },
                updatedAt: { type: 'string' },
                tenantId: { type: 'integer' }
              }
            },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const validatedData = UpdateOrderStatusSchema.parse(request.body);

      const order = await SuperAdminOrderService.updateOrderStatus(id, validatedData);

      return reply.send({
        success: true,
        data: order,
        message: `Order status updated to ${validatedData.status}`
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: 'Failed to update order status',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 批量操作订单（超级管理员）
  fastify.post('/batch', {
    preHandler: [authMiddleware, superAdminMiddleware],
    schema: {
      hide: true,
      tags: ['super-admin-orders'],
      summary: 'Batch order operations (Super Admin)',
      description: 'Perform batch operations on multiple orders across any tenant',
      body: {
        type: 'object',
        required: ['action', 'orderIds'],
        properties: {
          action: { type: 'string', enum: ['updateStatus', 'delete'] },
          orderIds: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1
          },
          status: { type: 'string', enum: ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'] }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                action: { type: 'string' },
                processedCount: { type: 'integer' },
                orderIds: {
                  type: 'array',
                  items: { type: 'string' }
                },
                status: { type: 'string' }
              }
            },
            message: { type: 'string' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const validatedData = BatchOrderOperationSchema.parse(request.body);

      const result = await SuperAdminOrderService.batchOperation(validatedData);

      return reply.send(result);
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: 'Batch operation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 获取订单统计信息（超级管理员）- 跨租户统计
  fastify.get('/stats', {
    preHandler: [authMiddleware, superAdminMiddleware],
    schema: {
      hide: true,
      tags: ['super-admin-orders'],
      summary: 'Get order statistics (Super Admin)',
      description: 'Get comprehensive order statistics and analytics across all tenants',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                totalOrders: { type: 'integer' },
                totalRevenue: { type: 'number' },
                ordersByStatus: {
                  type: 'object',
                  properties: {
                    PENDING: { type: 'integer' },
                    PAID: { type: 'integer' },
                    SHIPPED: { type: 'integer' },
                    DELIVERED: { type: 'integer' },
                    CANCELLED: { type: 'integer' }
                  }
                },
                ordersByTenant: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      tenantId: { type: 'integer' },
                      tenantName: { type: 'string' },
                      orderCount: { type: 'integer' },
                      revenue: { type: 'number' }
                    }
                  }
                },
                recentOrders: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      status: { type: 'string' },
                      totalAmount: { type: 'number' },
                      createdAt: { type: 'string' },
                      tenantId: { type: 'integer' }
                    }
                  }
                },
                topProducts: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      productId: { type: 'string' },
                      productName: { type: 'string' },
                      totalQuantity: { type: 'integer' },
                      totalRevenue: { type: 'number' },
                      tenantId: { type: 'integer' },
                      tenantName: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const stats = await SuperAdminOrderService.getOrderStats();

      return reply.send(stats);
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to get order statistics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
