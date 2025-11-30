import { FastifyInstance } from 'fastify';
import { AdminOrderService } from './service';
import { UpdateOrderStatusSchema, BatchOrderOperationSchema } from './types';
import { authMiddleware, adminMiddleware, tenantMiddleware } from '@/core/auth/middleware';
import { withTenantContext } from '@/core/database/tenant-middleware';

export async function adminOrderRoutes(fastify: FastifyInstance) {
  // 获取所有订单（管理员）
  fastify.get('/', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      tags: ['admin-orders'],
      summary: 'Get all orders (Admin)',
      description: 'Get all orders with pagination, search and filtering',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 },
          search: { type: 'string' },
          status: { type: 'string', enum: ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'] }
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
      const { page = 1, limit = 10, search, status } = request.query as any;
      const result = await withTenantContext(
        request.user!.tenantId,
        request.user!.id,
        () => AdminOrderService.getAllOrders(
          Number(page),
          Number(limit),
          request.user!.tenantId.toString(),
          search,
          status
        )
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

  // 获取订单详情（管理员）
  fastify.get('/:id', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      tags: ['admin-orders'],
      summary: 'Get order details (Admin)',
      description: 'Get detailed information about a specific order',
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
      const order = await withTenantContext(
        request.user!.tenantId,
        request.user!.id,
        () => AdminOrderService.getOrderById(
          id,
          request.user!.tenantId.toString()
        )
      );

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

  // 更新订单状态（管理员）
  fastify.patch('/:id/status', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      tags: ['admin-orders'],
      summary: 'Update order status (Admin)',
      description: 'Update the status of a specific order',
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
                updatedAt: { type: 'string' }
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

      const order = await withTenantContext(
        request.user!.tenantId,
        request.user!.id,
        () => AdminOrderService.updateOrderStatus(
          id,
          validatedData,
          request.user!.tenantId.toString()
        )
      );

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

  // 批量操作订单（管理员）
  fastify.post('/batch', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      tags: ['admin-orders'],
      summary: 'Batch order operations (Admin)',
      description: 'Perform batch operations on multiple orders',
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

      const result = await withTenantContext(
        request.user!.tenantId,
        request.user!.id,
        () => AdminOrderService.batchOperation(
          validatedData,
          request.user!.tenantId.toString()
        )
      );

      return reply.send(result);
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: 'Batch operation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 获取订单统计信息（管理员）
  fastify.get('/stats', {
    preHandler: [authMiddleware, tenantMiddleware, adminMiddleware],
    schema: {
      tags: ['admin-orders'],
      summary: 'Get order statistics (Admin)',
      description: 'Get comprehensive order statistics and analytics',
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
                recentOrders: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      status: { type: 'string' },
                      totalAmount: { type: 'number' },
                      createdAt: { type: 'string' }
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
                      totalRevenue: { type: 'number' }
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
      const stats = await withTenantContext(
        request.user!.tenantId,
        request.user!.id,
        () => AdminOrderService.getOrderStats(
          request.user!.tenantId.toString()
        )
      );

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
