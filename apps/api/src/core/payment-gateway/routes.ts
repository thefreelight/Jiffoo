import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware, tenantMiddleware } from '@/core/auth/middleware';
import { PaymentGatewayService } from './service';
import { CreatePaymentSessionRequest } from './types';

/**
 * Payment Gateway Routes
 * 
 * 统一支付网关路由,提供:
 * 1. GET  /api/payments/available-methods - 获取可用支付方式
 * 2. POST /api/payments/create-session    - 创建支付会话
 */
export async function paymentGatewayRoutes(fastify: FastifyInstance) {
  /**
   * 获取可用的支付方式
   * 
   * 面向终端用户的端点,只返回完全可用的支付方式
   * 不返回任何额度信息
   */
  fastify.get('/available-methods', {
    preHandler: [authMiddleware, tenantMiddleware],
    schema: {
      tags: ['payments'],
      summary: 'Get available payment methods',
      description: 'Get all available payment methods for the current tenant (end-user facing)',
      security: [{ bearerAuth: [] }],
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
                  pluginSlug: { type: 'string' },
                  name: { type: 'string' },
                  displayName: { type: 'string' },
                  icon: { type: 'string' },
                  supportedCurrencies: {
                    type: 'array',
                    items: { type: 'string' }
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
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request: any, reply: FastifyReply) => {
    try {
      const tenantId = request.tenant.id;

      const availableMethods = await PaymentGatewayService.getAvailablePaymentMethods(
        fastify,
        tenantId
      );

      return reply.send({
        success: true,
        data: availableMethods
      });
    } catch (error) {
      fastify.log.error('Failed to get available payment methods:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get available payment methods'
      });
    }
  });

  /**
   * 创建支付会话
   * 
   * 统一的支付会话创建端点,路由到对应的支付插件
   */
  fastify.post('/create-session', {
    preHandler: [authMiddleware, tenantMiddleware],
    schema: {
      tags: ['payments'],
      summary: 'Create payment session',
      description: 'Create a payment session with the selected payment method',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['paymentMethod', 'orderId'],
        properties: {
          paymentMethod: {
            type: 'string',
            description: 'Plugin slug (e.g., stripe)'
          },
          orderId: { type: 'string' },
          successUrl: { type: 'string' },
          cancelUrl: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              additionalProperties: true  // 🔧 允许任意字段,因为不同支付插件返回的数据结构不同
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        },
        429: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (
    request: FastifyRequest<{
      Body: CreatePaymentSessionRequest;
    }>,
    reply: FastifyReply
  ) => {
    try {
      const { paymentMethod, orderId, successUrl, cancelUrl } = request.body;
      const tenantId = (request as any).tenant.id;
      const userId = (request as any).user.id;

      fastify.log.info(
        `Creating payment session for tenant ${tenantId}, order ${orderId}, method ${paymentMethod}`
      );

      // 1. 验证订单存在且属于该租户
      const order = await fastify.prisma.order.findFirst({
        where: {
          id: orderId,
          tenantId,
          status: 'PENDING'
        },
        include: {
          items: {
            include: {
              product: true
            }
          }
        }
      });

      if (!order) {
        return reply.status(404).send({
          success: false,
          error: 'Order not found or already processed'
        });
      }

      // 🔥 智能判断是否需要记录API调用次数
      // 如果订单的lastPaymentMethod与当前支付方式相同，说明是重试相同支付方式，不扣API次数
      const shouldRecordApiCall = order.lastPaymentMethod !== paymentMethod;

      fastify.log.info(
        `🔍 [create-session] Order ${orderId}: lastPaymentMethod=${order.lastPaymentMethod}, ` +
        `currentPaymentMethod=${paymentMethod}, shouldRecordApiCall=${shouldRecordApiCall}`
      );

      // 🔥 更新订单的lastPaymentMethod（首次或切换支付方式时）
      if (shouldRecordApiCall) {
        await fastify.prisma.order.update({
          where: { id: orderId },
          data: { lastPaymentMethod: paymentMethod }
        });
        fastify.log.info(`✅ Updated order ${orderId} lastPaymentMethod to ${paymentMethod}`);
      }

      // 2. 获取插件信息
      const plugin = await fastify.prisma.plugin.findUnique({
        where: { slug: paymentMethod }
      });

      if (!plugin) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid payment method'
        });
      }

      // 3. 再次验证支付方式可用性(防止竞态条件)
      const validation = await PaymentGatewayService.validatePaymentMethod(
        fastify,
        tenantId,
        paymentMethod
      );

      if (!validation.valid) {
        const statusCode = validation.reason === 'PLUGIN_NOT_FOUND' ? 400 : 429;
        return reply.status(statusCode).send({
          success: false,
          error: validation.reason || 'Payment method not available',
          message: validation.message || 'This payment method is currently unavailable'
        });
      }

      // 4. 构造支付请求数据
      const paymentRequest = {
        amount: order.totalAmount,
        currency: 'USD',
        orderId: order.id,
        customerEmail: order.customerEmail,
        successUrl:
          successUrl ||
          `${process.env.NEXT_PUBLIC_SHOP_URL || 'http://localhost:3004'}/order-success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: cancelUrl || `${process.env.NEXT_PUBLIC_SHOP_URL || 'http://localhost:3004'}/checkout`,
        items: order.items.map(item => {
          // 🔧 安全解析images字段
          let images: string[] = [];
          if (item.product.images) {
            try {
              // 如果已经是数组,直接使用
              if (Array.isArray(item.product.images)) {
                images = item.product.images;
              } else if (typeof item.product.images === 'string') {
                // 如果是字符串,尝试解析
                images = JSON.parse(item.product.images);
              }
            } catch (e) {
              fastify.log.warn(`Failed to parse product images for ${item.product.id}:`, e);
              images = [];
            }
          }

          return {
            name: item.product.name,
            description: item.product.description || item.product.name,
            quantity: item.quantity,
            price: item.unitPrice,
            images
          };
        }),
        metadata: {
          orderId: order.id,
          tenantId: tenantId.toString(),
          userId: userId,
          pluginId: plugin.id
        }
      };

      // 5. 路由到对应的插件API
      // 🔧 修复: 使用正确的插件路径前缀
      // Stripe插件注册在 /api/plugins/stripe/api
      const pluginEndpoint = `/api/plugins/stripe/api/create-checkout-session`;

      fastify.log.info(`Routing payment request to ${pluginEndpoint}`);
      fastify.log.info(`Payment request data:`, paymentRequest);

      // 🔧 修复: 使用fastify.inject时,需要传递完整的headers以便插件端点能够访问tenant和user信息
      const response = await fastify.inject({
        method: 'POST',
        url: pluginEndpoint,
        headers: {
          'content-type': 'application/json',
          authorization: request.headers.authorization, // 认证token
          'x-tenant-id': tenantId.toString(), // 传递tenant ID
          'x-user-id': userId // 传递user ID
        },
        payload: paymentRequest // 直接传递对象,不需要手动序列化
      });

      if (response.statusCode !== 200) {
        fastify.log.error(`Plugin ${paymentMethod} returned error:`, response.body);
        return reply.status(response.statusCode).send(response.json());
      }

      // 🔧 修复: fastify.inject返回的response.body是字符串,需要解析
      const sessionData = JSON.parse(response.body as string);

      // 🔍 调试: 打印sessionData的实际内容
      fastify.log.info(`Session data from plugin: ${JSON.stringify(sessionData)}`);

      // 6. 🔥 智能记录API调用次数（只在需要时记录）
      if (shouldRecordApiCall) {
        await (fastify as any).recordPluginUsage(tenantId, paymentMethod, 'api_calls');
        fastify.log.info(`✅ Recorded API call for ${paymentMethod} (tenant ${tenantId})`);
      } else {
        fastify.log.info(`⏭️ Skipped API call recording for ${paymentMethod} (same payment method retry)`);
      }

      fastify.log.info(
        `Payment session created successfully for tenant ${tenantId}, order ${orderId}`
      );

      return reply.send({
        success: true,
        data: sessionData
      });
    } catch (error) {
      fastify.log.error('Failed to create payment session:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to create payment session',
        message: 'An error occurred while processing your payment. Please try again.'
      });
    }
  });
}

