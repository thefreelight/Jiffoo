import { FastifyInstance } from 'fastify';
import { OrderService } from './service';
import { CreateOrderSchema } from './types';
import { authMiddleware, tenantMiddleware } from '@/core/auth/middleware';
import { withTenantContext } from '@/core/database/tenant-middleware';

export async function orderRoutes(fastify: FastifyInstance) {
  // 创建订单
  fastify.post('/', {
    preHandler: [authMiddleware, tenantMiddleware],
    schema: {
      tags: ['orders'],
      summary: 'Create order',
      description: 'Create a new order from cart items',
      body: {
        type: 'object',
        required: ['items', 'shippingAddress', 'customerEmail'],
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['productId', 'quantity'],
              properties: {
                productId: { type: 'string' },
                quantity: { type: 'integer', minimum: 1 }
              }
            }
          },
          shippingAddress: {
            type: 'object',
            required: ['firstName', 'lastName', 'address', 'city', 'postalCode', 'country'],
            properties: {
              firstName: { type: 'string' },
              lastName: { type: 'string' },
              address: { type: 'string' },
              city: { type: 'string' },
              postalCode: { type: 'string' },
              country: { type: 'string' }
            }
          },
          customerEmail: { type: 'string', format: 'email' },
          agentId: { type: 'string', description: 'Agent ID for three-level commission calculation' }
        }
      },
      response: {
        201: {
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
                          images: { type: 'string' }
                        }
                      }
                    }
                  }
                }
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
      const validatedData = CreateOrderSchema.parse(request.body);
      const userId = request.user!.userId;
      const tenantId = request.user!.tenantId.toString();

      // 直接调用OrderService（手动处理租户关系，避免自动注入tenantId）
      const order = await OrderService.createOrder(
        userId,
        validatedData,
        tenantId
      );
      
      return reply.status(201).send({
        success: true,
        data: order,
        message: 'Order created successfully'
      });
    } catch (error) {
      return reply.status(400).send({
        success: false,
        error: 'Order creation failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 获取我的订单列表
  fastify.get('/', {
    preHandler: [authMiddleware, tenantMiddleware],
    schema: {
      tags: ['orders'],
      summary: 'Get my orders',
      description: 'Get current user\'s order list with pagination',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 10 }
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
                  updatedAt: { type: 'string' }
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
      const { page = 1, limit = 10 } = request.query as any;
      const userId = request.user!.userId;
      const tenantId = request.user!.tenantId.toString();

      const result = await withTenantContext(parseInt(tenantId), userId, async () => {
        return await OrderService.getUserOrders(
          userId,
          Number(page),
          Number(limit),
          tenantId
        );
      });
      
      return reply.send(result);
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to get orders',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 获取我的订单详情
  fastify.get('/:id', {
    preHandler: [authMiddleware, tenantMiddleware],
    schema: {
      tags: ['orders'],
      summary: 'Get my order details',
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
                paymentStatus: { type: 'string' },
                totalAmount: { type: 'number' },
                customerEmail: { type: 'string' },
                expiresAt: { type: 'string' },
                lastPaymentAttemptAt: { type: 'string' },
                paymentAttempts: { type: 'integer' },
                lastPaymentMethod: { type: 'string' },
                cancelReason: { type: 'string' },
                cancelledAt: { type: 'string' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
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
                          images: { type: 'string' }
                        }
                      }
                    }
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
      const userId = request.user!.userId;
      const tenantId = request.user!.tenantId.toString();

      const order = await withTenantContext(parseInt(tenantId), userId, async () => {
        return await OrderService.getUserOrderById(
          id,
          userId,
          tenantId
        );
      });

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

  // 🆕 重新支付订单
  fastify.post('/:id/retry-payment', {
    preHandler: [authMiddleware, tenantMiddleware],
    schema: {
      tags: ['orders'],
      summary: 'Retry payment for pending order',
      description: 'Create a new payment session for an unpaid order',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Order ID' }
        }
      },
      body: {
        type: 'object',
        required: ['paymentMethod'],
        properties: {
          paymentMethod: {
            type: 'string',
            description: 'Payment plugin slug (e.g., stripe)'
          }
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
                sessionId: { type: 'string' },
                url: { type: 'string' },
                expiresAt: { type: 'string' }
              }
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { id: orderId } = request.params as { id: string };
    const { paymentMethod } = request.body as { paymentMethod: string };
    const userId = request.user!.userId;
    const tenantId = request.user!.tenantId;

    try {
      const result = await OrderService.retryPayment(
        orderId,
        userId,
        tenantId,
        paymentMethod,
        fastify
      );

      return reply.send({
        success: true,
        data: result
      });
    } catch (error: any) {
      fastify.log.error('Failed to retry payment:', error);
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to retry payment'
      });
    }
  });

  // 🆕 取消订单
  fastify.post('/:id/cancel', {
    preHandler: [authMiddleware, tenantMiddleware],
    schema: {
      tags: ['orders'],
      summary: 'Cancel pending order',
      description: 'Cancel an unpaid order and release inventory reservations',
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', description: 'Order ID' }
        }
      },
      body: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Cancellation reason' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { id: orderId } = request.params as { id: string };
    const { reason } = request.body as { reason?: string };
    const userId = request.user!.userId;
    const tenantId = request.user!.tenantId;

    try {
      await OrderService.cancelOrder(orderId, userId, tenantId, reason);
      return reply.send({ success: true });
    } catch (error: any) {
      fastify.log.error('Failed to cancel order:', error);
      return reply.status(400).send({
        success: false,
        error: error.message || 'Failed to cancel order'
      });
    }
  });
}
