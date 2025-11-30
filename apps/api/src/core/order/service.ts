/**
 * Order Service
 *
 * Handles order creation and management with support for:
 * - Multi-tenant isolation
 * - Inventory reservation
 * - 🆕 Agent Mall authorization validation (Self path)
 */

import { prisma } from '@/config/database';
import { AdminProductService } from '@/core/admin/product-management/service';
import { InventoryService } from '@/core/inventory/service';
import { AgentAuthorizationService } from '@/plugins/agent/authorization';
import {
  CreateOrderRequest,
  OrderResponse,
  OrderListResponse,
  OrderStatus,
  PaymentStatus,
  OrderStatusType
} from './types';

export class OrderService {
  /**
   * 创建订单（用户）
   * 🆕 使用库存预留机制，不立即扣减库存
   * 🆕 支持 Agent Mall 场景下的授权验证和价格计算
   */
  static async createOrder(
    userId: string,
    data: CreateOrderRequest,
    tenantId: string
  ): Promise<OrderResponse> {
    const tenantIdNum = parseInt(tenantId);

    // 1. 验证agentId（如果提供）- 提前验证以便后续授权检查
    let validAgentId: string | null = null;
    let isAgentMall = false;
    if (data.agentId) {
      const agent = await prisma.agent.findFirst({
        where: {
          id: data.agentId,
          tenantId: tenantIdNum,
          status: 'ACTIVE'
        }
      });
      if (agent) {
        validAgentId = agent.id;
        isAgentMall = true;
      }
      // 如果代理不存在或不活跃，静默忽略（不影响订单创建）
    }

    // 2. 验证商品并计算总价
    let totalAmount = 0;
    const orderItems: Array<{
      productId: string;
      variantId?: string;
      quantity: number;
      unitPrice: number;
    }> = [];

    // 🆕 如果是 Agent Mall，使用授权服务验证
    // ⚠️ Agent Mall 订单必须提供 variantId，不允许 fallback 到 productId
    if (isAgentMall && validAgentId) {
      // 🆕 校验：Agent Mall 订单的每个 item 都必须有 variantId
      const missingVariantItems = data.items.filter(item => !item.variantId);
      if (missingVariantItems.length > 0) {
        const productIds = missingVariantItems.map(item => item.productId).join(', ');
        throw new Error(`Agent Mall orders require variantId for all items. Missing variantId for products: ${productIds}`);
      }

      // 准备订单项用于授权验证
      const itemsForValidation = data.items.map(item => ({
        variantId: item.variantId!, // 上面已经验证了 variantId 存在
        productId: item.productId,
        quantity: item.quantity
      }));

      // 调用授权服务验证
      const authResult = await AgentAuthorizationService.validateOrderAuthorization(
        tenantIdNum,
        'AGENT',
        validAgentId,
        itemsForValidation
      );

      if (!authResult.isValid) {
        const deniedReasons = authResult.deniedItems
          .map(item => `${item.variantId}: ${item.reason}`)
          .join('; ');
        throw new Error(`Order authorization failed: ${deniedReasons}`);
      }

      // 使用授权服务返回的有效价格
      for (const item of data.items) {
        const authItem = authResult.authorizedItems.find(a => a.variantId === item.variantId);

        if (!authItem) {
          throw new Error(`Variant ${item.variantId} not authorized`);
        }

        const itemTotal = authItem.effectivePrice * item.quantity;
        totalAmount += itemTotal;

        orderItems.push({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: authItem.effectivePrice,
        });
      }
    } else {
      // 🆕 Tenant Mall 也使用授权服务
      // 准备订单项用于授权验证（Tenant Mall 允许不提供 variantId）
      const itemsForValidation: Array<{ variantId: string; productId: string; quantity: number }> = [];

      for (const item of data.items) {
        if (item.variantId) {
          // 有 variantId，直接使用
          itemsForValidation.push({
            variantId: item.variantId,
            productId: item.productId,
            quantity: item.quantity
          });
        } else {
          // 没有 variantId，查找该商品的默认变体（第一个活跃变体）
          const defaultVariant = await prisma.productVariant.findFirst({
            where: {
              productId: item.productId,
              tenantId: tenantIdNum,
              isActive: true
            },
            orderBy: { createdAt: 'asc' }
          });

          if (defaultVariant) {
            itemsForValidation.push({
              variantId: defaultVariant.id,
              productId: item.productId,
              quantity: item.quantity
            });
          } else {
            // 没有变体，使用 productId 作为 fallback（向后兼容）
            // 但是授权服务会验证这个 variantId 是否存在
            throw new Error(`Product ${item.productId} has no active variants. Please select a specific variant.`);
          }
        }
      }

      // 调用授权服务验证（使用 TENANT 作为 ownerType）
      const authResult = await AgentAuthorizationService.validateOrderAuthorization(
        tenantIdNum,
        'TENANT',
        tenantId,  // ownerId 使用 tenantId
        itemsForValidation
      );

      if (!authResult.isValid) {
        const deniedReasons = authResult.deniedItems
          .map(item => `${item.variantId}: ${item.reason}`)
          .join('; ');
        throw new Error(`Order authorization failed: ${deniedReasons}`);
      }

      // 使用授权服务返回的有效价格
      for (let i = 0; i < data.items.length; i++) {
        const item = data.items[i];
        const validationItem = itemsForValidation[i];
        const authItem = authResult.authorizedItems.find(a => a.variantId === validationItem.variantId);

        if (!authItem) {
          throw new Error(`Variant ${validationItem.variantId} not authorized`);
        }

        const itemTotal = authItem.effectivePrice * item.quantity;
        totalAmount += itemTotal;

        orderItems.push({
          productId: item.productId,
          variantId: validationItem.variantId,  // 使用实际的 variantId
          quantity: item.quantity,
          unitPrice: authItem.effectivePrice,
        });
      }
    }

    // 3. 🆕 检查可用库存（考虑预留）
    // 🆕 使用变体级库存检查（如果有 variantId）
    const hasVariants = orderItems.some(item => item.variantId);

    if (hasVariants) {
      // 变体级库存检查
      const variantStockCheck = await InventoryService.checkVariantStockAvailability(
        orderItems.filter(item => item.variantId).map(item => ({
          productId: item.productId,
          variantId: item.variantId!,
          quantity: item.quantity
        })),
        tenantIdNum
      );

      if (!variantStockCheck.available) {
        const insufficientVariants = variantStockCheck.insufficientItems
          .map(item => `Variant ${item.variantId}: requested ${item.requested}, available ${item.available}`)
          .join('; ');
        throw new Error(`Insufficient stock: ${insufficientVariants}`);
      }
    } else {
      // 向后兼容：商品级库存检查
      const stockCheck = await InventoryService.checkStockAvailability(
        data.items as Array<{ productId: string; quantity: number }>,
        tenantIdNum
      );

      if (!stockCheck.available) {
        const insufficientProducts = stockCheck.insufficientItems
          .map(item => `Product ${item.productId}: requested ${item.requested}, available ${item.available}`)
          .join('; ');
        throw new Error(`Insufficient stock: ${insufficientProducts}`);
      }
    }

    // 4. 🆕 设置订单过期时间（30分钟后）
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    // 5. 使用事务创建订单和库存预留
    const order = await prisma.$transaction(async (tx) => {
      // 5.1 创建订单
      const newOrder = await tx.order.create({
        data: {
          totalAmount,
          customerEmail: data.customerEmail,
          shippingAddress: JSON.stringify(data.shippingAddress),
          status: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.UNPAID,  // 🆕 设置支付状态
          expiresAt,  // 🆕 设置过期时间
          // 🆕 关联代理（三级代理分润）- 使用connect语法
          ...(validAgentId ? { agent: { connect: { id: validAgentId } } } : {}),
          user: {
            connect: { id: userId }
          },
          tenant: {
            connect: { id: tenantIdNum }
          },
          items: {
            create: orderItems.map(item => ({
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              product: {
                connect: { id: item.productId }
              },
              tenant: {
                connect: { id: tenantIdNum }
              }
            }))
          }
        },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  images: true,
                },
              },
            },
          },
        },
      });

      // 5.2 🆕 创建库存预留（不扣减实际库存）
      // 🆕 使用变体级库存预留（如果有 variantId）
      if (hasVariants) {
        await InventoryService.createVariantReservations(
          newOrder.id,
          orderItems.filter(item => item.variantId).map(item => ({
            productId: item.productId,
            variantId: item.variantId!,
            quantity: item.quantity
          })),
          tenantIdNum,
          expiresAt,
          tx
        );
      } else {
        // 向后兼容：商品级库存预留
        await InventoryService.createReservations(
          newOrder.id,
          data.items as Array<{ productId: string; quantity: number }>,
          tenantIdNum,
          expiresAt,
          tx
        );
      }

      return newOrder;
    });

    // 5. 转换为响应格式
    return this.formatOrderResponse(order);
  }

  /**
   * 获取用户订单列表
   */
  static async getUserOrders(
    userId: string,
    page = 1,
    limit = 10,
    tenantId: string
  ): Promise<OrderListResponse> {
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: {
          userId,
          tenantId: parseInt(tenantId)
        },
        skip,
        take: limit,
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  images: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      prisma.order.count({
        where: {
          userId,
          tenantId: parseInt(tenantId)
        }
      }),
    ]);

    return {
      success: true,
      data: orders.map(order => this.formatOrderResponse(order)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 获取用户订单详情
   */
  static async getUserOrderById(
    orderId: string,
    userId: string,
    tenantId: string
  ): Promise<OrderResponse | null> {
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
        tenantId: parseInt(tenantId)
      },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                images: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return null;
    }

    return this.formatOrderResponse(order);
  }

  /**
   * 格式化订单响应
   */
  private static formatOrderResponse(order: any): OrderResponse {
    return {
      id: order.id,
      userId: order.userId,
      status: order.status as OrderStatusType,
      paymentStatus: order.paymentStatus,  // 🆕 新增字段
      expiresAt: order.expiresAt,  // 🆕 新增字段
      paymentAttempts: order.paymentAttempts || 0,  // 🆕 新增字段
      lastPaymentAttemptAt: order.lastPaymentAttemptAt,  // 🆕 新增字段
      totalAmount: order.totalAmount,
      customerEmail: order.customerEmail,
      shippingAddress: JSON.parse(order.shippingAddress),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: order.items.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        product: {
          id: item.product.id,
          name: item.product.name,
          images: item.product.images,
        },
      })),
    };
  }

  /**
   * 🆕 重新支付订单
   *
   * 智能Session复用和API次数扣除逻辑：
   * - 如果使用相同支付方式且Session未过期：复用原Session，不扣除API次数
   * - 如果使用相同支付方式但Session已过期：创建新Session，不扣除API次数
   * - 如果切换到新支付方式：创建新Session，扣除新支付方式的API次数
   */
  static async retryPayment(
    orderId: string,
    userId: string,
    tenantId: number,
    paymentMethod: string,
    fastify: any
  ): Promise<{ sessionId: string; url: string; expiresAt: string }> {
    // 1. 验证订单
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
        tenantId,
        status: 'PENDING',
        paymentStatus: 'UNPAID'
      },
      include: {
        items: {
          include: { product: true, variant: true }
        }
      }
    });

    if (!order) {
      throw new Error('Order not found or already paid');
    }

    // 2. 检查订单是否过期
    if (order.expiresAt && new Date() > order.expiresAt) {
      throw new Error('Order has expired. Please create a new order.');
    }

    // 3. 检查库存是否仍然充足
    // 🆕 使用变体级库存检查（如果有 variantId）
    const hasVariants = order.items.some(item => item.variantId);

    if (hasVariants) {
      const variantStockCheck = await InventoryService.checkVariantStockAvailability(
        order.items.filter(item => item.variantId).map(item => ({
          productId: item.productId,
          variantId: item.variantId!,
          quantity: item.quantity
        })),
        tenantId
      );

      if (!variantStockCheck.available) {
        throw new Error('Some items are no longer available in sufficient quantity');
      }
    } else {
      const stockCheck = await InventoryService.checkStockAvailability(
        order.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity
        })),
        tenantId
      );

      if (!stockCheck.available) {
        throw new Error('Some items are no longer available in sufficient quantity');
      }
    }

    // 🆕 4. 智能Session复用逻辑
    // 如果使用相同支付方式，检查是否有未过期的Session可以复用
    if (order.lastPaymentMethod === paymentMethod) {
      const existingPayment = await prisma.payment.findFirst({
        where: {
          orderId,
          paymentMethod: 'stripe',  // 目前只支持Stripe
          status: 'PENDING',
          expiresAt: { gt: new Date() }  // Session未过期
        },
        orderBy: {
          createdAt: 'desc'  // 获取最新的Payment记录
        }
      });

      if (existingPayment && existingPayment.sessionUrl) {
        fastify.log.info(`Reusing existing Stripe Session for order ${orderId}, session: ${existingPayment.sessionId}`);

        // 更新支付尝试次数（但不创建新Session）
        await prisma.order.update({
          where: { id: orderId },
          data: {
            paymentAttempts: { increment: 1 },
            lastPaymentAttemptAt: new Date()
          }
        });

        return {
          sessionId: existingPayment.sessionId!,
          url: existingPayment.sessionUrl,
          expiresAt: order.expiresAt!.toISOString()
        };
      }
    }

    // 5. 创建新的支付会话（Session不存在或已过期，或切换了支付方式）
    fastify.log.info(`Creating new Stripe Session for order ${orderId}, payment method: ${paymentMethod}`);

    // 更新订单：支付尝试次数
    await prisma.order.update({
      where: { id: orderId },
      data: {
        paymentAttempts: { increment: 1 },
        lastPaymentAttemptAt: new Date()
      }
    });

    const paymentRequest = {
      amount: order.totalAmount,
      currency: 'USD',
      orderId: order.id,
      customerEmail: order.customerEmail,
      successUrl: `${process.env.NEXT_PUBLIC_SHOP_URL || 'http://localhost:3004'}/order-success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${process.env.NEXT_PUBLIC_SHOP_URL || 'http://localhost:3004'}/orders/${orderId}`,
      items: order.items.map(item => ({
        name: item.product.name,
        price: item.unitPrice,
        quantity: item.quantity
      }))
    };

    // 🔧 修复：使用正确的插件路径前缀
    // stripe插件注册在 /api/plugins/stripe/api
    const pluginEndpoint = paymentMethod === 'stripe'
      ? '/api/plugins/stripe/api/create-checkout-session'
      : `/api/plugins/${paymentMethod}/api/create-checkout-session`;

    const response = await fastify.inject({
      method: 'POST',
      url: pluginEndpoint,
      headers: {
        'content-type': 'application/json',
        'x-tenant-id': tenantId.toString(),
        'x-user-id': userId
      },
      payload: paymentRequest
    });

    const sessionData = JSON.parse(response.body);

    if (!sessionData.success) {
      throw new Error(sessionData.error || 'Failed to create payment session');
    }

    return sessionData.data;
  }

  /**
   * 🆕 取消订单
   */
  static async cancelOrder(
    orderId: string,
    userId: string,
    tenantId: number,
    reason?: string
  ): Promise<void> {
    // 1. 验证订单
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
        tenantId,
        status: 'PENDING',
        paymentStatus: 'UNPAID'
      }
    });

    if (!order) {
      throw new Error('Order not found or cannot be cancelled');
    }

    // 2. 使用事务取消订单并释放库存
    await prisma.$transaction(async (tx) => {
      // 2.1 更新订单状态
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'CANCELLED',
          paymentStatus: 'FAILED',
          cancelReason: reason || 'Cancelled by user',
          cancelledAt: new Date()
        }
      });

      // 2.2 释放库存预留
      await tx.inventoryReservation.updateMany({
        where: {
          orderId,
          status: 'ACTIVE'
        },
        data: {
          status: 'RELEASED'
        }
      });
    });
  }
}