import { prisma } from '@/config/database';
import { ProcessPaymentRequest } from './types';
import { paymentManager } from './payment-manager';
// import { MockPaymentProvider } from './providers/mock-provider';
import {
  PaymentRequest,
  PaymentResult,
  PaymentVerification,
  RefundRequest,
  RefundResult,
  PaymentConfig,
  Currency,
  PaymentStatus,
  PaymentMethod
} from './types';
import { LoggerService } from '@/utils/logger';
import { FastifyInstance } from 'fastify';

export class PaymentService {
  private static initialized = false;

  /**
   * Initialize plugin proxy routes at root level (called from server.ts)
   */
  static async initializePluginProxyRoutes(fastifyInstance: FastifyInstance): Promise<void> {
    try {
      LoggerService.logInfo('Initializing plugin proxy routes at root level...');

      // Initialize payment manager first to ensure plugins are loaded
      await paymentManager.initialize(fastifyInstance);

      // Register plugin proxy routes at root level
      await this.registerPluginProxyRoutes(fastifyInstance);

      LoggerService.logInfo('Plugin proxy routes initialized successfully');
    } catch (error) {
      LoggerService.logError('Failed to initialize plugin proxy routes', error);
      throw error;
    }
  }

  /**
   * Initialize the payment service with new architecture
   */
  static async initialize(fastifyInstance?: FastifyInstance): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      LoggerService.logInfo('Initializing Payment Service');

      // Initialize payment manager with Fastify instance (if not already done)
      if (!paymentManager.initialized) {
        await paymentManager.initialize(fastifyInstance);
      }

      // Plugin proxy routes are now registered at root level in server.ts
      // No need to register them here

      // The mock provider is now loaded as a plugin in the payment manager
      // No need to register it here as it's handled by the plugin system

      // Set up event listeners
      this.setupEventListeners();

      this.initialized = true;
      LoggerService.logInfo('Payment Service initialized successfully');

    } catch (error) {
      LoggerService.logError('Failed to initialize Payment Service', error);
      throw error;
    }
  }

  /**
   * 预注册插件代理路由
   */
  private static async registerPluginProxyRoutes(fastify: FastifyInstance): Promise<void> {
    try {
      LoggerService.logInfo('Registering plugin proxy routes...');

      // 注册通用代理路由来处理所有插件路由
      const proxyHandler = async (request: any, reply: any) => {
        console.log(`🔄 Proxy handler called: ${request.method} ${request.url}`);
        console.log(`🔄 Request params:`, request.params);

        const { pluginId } = request.params;
        const method = request.method.toUpperCase();
        const url = request.url;

        // 提取插件特定的路径
        // 路由模式: /plugins/:pluginId/api/*
        // 我们需要提取 /api/* 后面的部分
        const pluginPath = url.replace(`/plugins/${pluginId}/api`, '');

        console.log(`🔄 Proxy request: ${method} ${url} -> Plugin: ${pluginId}, Path: ${pluginPath}`);

        // 获取统一插件管理器
        const paymentManagerInstance = paymentManager;
        const unifiedManager = paymentManagerInstance.getUnifiedManager();

        if (!unifiedManager) {
          return reply.status(503).send({
            error: 'Service unavailable',
            message: 'Plugin system not initialized'
          });
        }

        // 委托给路由管理器处理
        const routeManager = (unifiedManager as any).routeManager;
        if (routeManager && typeof routeManager.handleProxyRequest === 'function') {
          return await routeManager.handleProxyRequest(request, reply);
        }

        return reply.status(404).send({
          error: 'Plugin not found',
          message: `Plugin ${pluginId} is not installed or active`
        });
      };

      // 注册通配符路由来捕获所有插件请求
      // 使用更具体的路由模式避免与现有路由冲突
      // 现有路由使用 /plugins/:pluginId/activate 等模式
      // 我们使用 /plugins/:pluginId/api/* 来避免冲突
      // Fastify 通配符语法: 使用 * 来捕获剩余路径
      const pluginRoutePattern = '/plugins/:pluginId/api/*';

      // 添加测试路由来验证路由注册
      fastify.get('/plugins/test-route', async (request, reply) => {
        return reply.send({ message: 'Test route works!' });
      });

      fastify.all(pluginRoutePattern, proxyHandler);

      console.log(`🔧 Registered proxy route pattern: ${pluginRoutePattern}`);

      LoggerService.logInfo('Plugin proxy routes registered successfully');
    } catch (error) {
      LoggerService.logError('Failed to register plugin proxy routes', error);
      throw error;
    }
  }

  /**
   * Get payment manager instance
   */
  static getPaymentManager() {
    return paymentManager;
  }

  /**
   * Process payment using new architecture
   */
  static async processOrderPayment(
    orderId: string,
    paymentMethod: PaymentMethod = PaymentMethod.MOCK,
    providerName?: string
  ): Promise<PaymentResult> {
    await this.ensureInitialized();

    try {
      // Get order details
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          user: true,
        },
      });

      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      if (order.status !== 'PENDING') {
        throw new Error(`Order ${orderId} is not in a payable state`);
      }

      // Build payment request
      const paymentRequest: PaymentRequest = {
        orderId: order.id,
        amount: {
          value: order.totalAmount,
          currency: Currency.USD,
        },
        customer: {
          id: order.userId || undefined,
          email: order.user?.email || 'guest@example.com',
          name: order.user?.username || 'Guest User',
        },
        items: order.items.map(item => ({
          id: item.id,
          name: item.product.name,
          description: item.product.description || '',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.quantity * item.unitPrice,
        })),
        description: `Payment for order ${order.id}`,
        metadata: {
          orderId: order.id,
          userId: order.userId,
          paymentMethod,
        },
      };

      // Process payment
      const result = await paymentManager.processPayment(paymentRequest, providerName);

      // Store payment record in database
      await this.storePaymentRecord(result, order.id, paymentMethod);

      // Update order status based on payment result
      if (result.success && result.status === PaymentStatus.COMPLETED) {
        await this.updateOrderStatus(orderId, 'PAID');
      } else if (result.status === PaymentStatus.PENDING) {
        await this.updateOrderStatus(orderId, 'PENDING_PAYMENT');
      } else if (!result.success) {
        await this.updateOrderStatus(orderId, 'PAYMENT_FAILED');
      }

      LoggerService.logInfo(`Payment processed for order ${orderId}: ${result.status}`);

      return result;

    } catch (error) {
      LoggerService.logError(`Payment processing failed for order ${orderId}`, error);

      // Update order status to failed
      try {
        await this.updateOrderStatus(orderId, 'PAYMENT_FAILED');
      } catch (updateError) {
        LoggerService.logError(`Failed to update order status for ${orderId}`, updateError);
      }

      throw error;
    }
  }

  /**
   * Legacy payment processing method (for backward compatibility)
   */
  static async processPayment(userId: string, data: ProcessPaymentRequest) {
    // Verify order belongs to user and is in correct status
    const order = await prisma.order.findFirst({
      where: {
        id: data.orderId,
        userId,
        status: 'PENDING',
      },
    });

    if (!order) {
      throw new Error('Order not found or not eligible for payment');
    }

    // Verify payment amount matches order total
    if (data.paymentDetails.amount !== order.totalAmount) {
      throw new Error('Payment amount does not match order total');
    }

    // Simulate payment processing
    // In a real application, this would integrate with payment providers
    const isPaymentSuccessful = await this.simulatePaymentProcessing(data);

    if (isPaymentSuccessful) {
      // Update order status to PAID
      await prisma.order.update({
        where: { id: data.orderId },
        data: { status: 'PAID' },
      });

      return {
        id: `payment_${Date.now()}`,
        orderId: data.orderId,
        amount: data.paymentDetails.amount,
        status: 'COMPLETED' as const,
        paymentMethod: data.paymentMethod,
        transactionId: `txn_${Date.now()}`,
        createdAt: new Date(),
      };
    } else {
      return {
        id: `payment_${Date.now()}`,
        orderId: data.orderId,
        amount: data.paymentDetails.amount,
        status: 'FAILED' as const,
        paymentMethod: data.paymentMethod,
        createdAt: new Date(),
      };
    }
  }

  private static async simulatePaymentProcessing(data: ProcessPaymentRequest): Promise<boolean> {
    // Simulate payment processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Simulate 90% success rate
    return Math.random() > 0.1;
  }

  static async getPaymentStatus(orderId: string, userId: string) {
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
      select: {
        id: true,
        status: true,
        totalAmount: true,
      },
    });

    if (!order) {
      throw new Error('Order not found');
    }

    return {
      orderId: order.id,
      status: order.status,
      amount: order.totalAmount,
      isPaid: order.status === 'PAID',
    };
  }

  /**
   * Verify a payment using new architecture
   */
  static async verifyPayment(
    paymentId: string,
    providerName?: string
  ): Promise<PaymentVerification> {
    await this.ensureInitialized();

    try {
      const verification = await paymentManager.verifyPayment(paymentId, providerName);

      // Update payment record in database
      await this.updatePaymentRecord(paymentId, verification.status);

      return verification;

    } catch (error) {
      LoggerService.logError(`Payment verification failed for ${paymentId}`, error);
      throw error;
    }
  }

  /**
   * Process a refund
   */
  static async processRefund(
    paymentId: string,
    amount?: number,
    reason?: string,
    providerName?: string
  ): Promise<RefundResult> {
    await this.ensureInitialized();

    try {
      // Get payment record
      const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
      });

      if (!payment) {
        throw new Error(`Payment ${paymentId} not found`);
      }

      const refundRequest: RefundRequest = {
        paymentId,
        amount: amount ? {
          value: amount,
          currency: Currency.USD,
        } : undefined,
        reason,
        metadata: {
          paymentId,
          orderId: payment.orderId,
        },
      };

      const result = await paymentManager.processRefund(refundRequest, providerName);

      // Store refund record in database
      if (result.success) {
        await this.storeRefundRecord(result, paymentId);
      }

      return result;

    } catch (error) {
      LoggerService.logError(`Refund processing failed for payment ${paymentId}`, error);
      throw error;
    }
  }

  /**
   * Get available payment providers
   */
  static getAvailableProviders(): string[] {
    return paymentManager.getProviderNames();
  }

  /**
   * Get payment provider capabilities
   */
  static getProviderCapabilities(providerName?: string) {
    const provider = paymentManager.getProvider(providerName);
    return provider.capabilities;
  }

  /**
   * Health check for payment providers
   */
  static async healthCheck(): Promise<Record<string, boolean>> {
    await this.ensureInitialized();
    return paymentManager.healthCheck();
  }

  // === PRIVATE HELPER METHODS ===

  /**
   * Store payment record in database
   */
  private static async storePaymentRecord(
    result: PaymentResult,
    orderId: string,
    paymentMethod: PaymentMethod
  ): Promise<void> {
    try {
      await prisma.payment.create({
        data: {
          id: result.paymentId,
          orderId,
          amount: result.amount.value,
          currency: result.amount.currency,
          method: paymentMethod.toUpperCase(), // Legacy field
          paymentMethod: paymentMethod.toUpperCase(), // New field
          status: result.status.toUpperCase() as any,
          provider: 'mock', // Provider name
          transactionId: result.transactionId,
          providerResponse: result.providerResponse ? JSON.stringify(result.providerResponse) : null,
          metadata: result.metadata ? JSON.stringify(result.metadata) : null,
          createdAt: result.createdAt,
          updatedAt: result.updatedAt,
        },
      });
    } catch (error) {
      LoggerService.logError(`Failed to store payment record ${result.paymentId}`, error);
    }
  }

  /**
   * Update payment record in database
   */
  private static async updatePaymentRecord(
    paymentId: string,
    status: PaymentStatus
  ): Promise<void> {
    try {
      await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: status.toUpperCase() as any,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      LoggerService.logError(`Failed to update payment record ${paymentId}`, error);
    }
  }

  /**
   * Store refund record in database
   */
  private static async storeRefundRecord(
    result: RefundResult,
    paymentId: string
  ): Promise<void> {
    try {
      await prisma.refund.create({
        data: {
          id: result.refundId,
          paymentId,
          amount: result.amount.value,
          currency: result.amount.currency,
          status: result.status.toUpperCase() as any,
          createdAt: result.createdAt,
        },
      });
    } catch (error) {
      LoggerService.logError(`Failed to store refund record ${result.refundId}`, error);
    }
  }

  /**
   * Update order status
   */
  private static async updateOrderStatus(
    orderId: string,
    status: string
  ): Promise<void> {
    await prisma.order.update({
      where: { id: orderId },
      data: { status },
    });
  }

  /**
   * Set up event listeners for payment events
   */
  private static setupEventListeners(): void {
    paymentManager.on('payment.event', (event) => {
      LoggerService.logInfo(`Payment event: ${event.type}`, event);
    });

    paymentManager.on('provider.registered', (event) => {
      LoggerService.logInfo(`Payment provider registered: ${event.providerName}`);
    });

    paymentManager.on('provider.unregistered', (event) => {
      LoggerService.logInfo(`Payment provider unregistered: ${event.providerName}`);
    });
  }

  /**
   * Ensure payment service is initialized
   */
  private static async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}
