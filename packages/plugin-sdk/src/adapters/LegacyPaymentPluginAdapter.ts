/**
 * Legacy Payment Plugin Adapter
 * 
 * 专门用于适配现有支付插件到新微服务架构的适配器
 * 支持的旧插件类型：
 * - BasePaymentPlugin 子类
 * - Stripe, Alipay, WeChat Pay 等现有插件
 * 
 * 提供的微服务API：
 * - POST /api/v1/payments - 创建支付
 * - GET /api/v1/payments/:id - 查询支付
 * - POST /api/v1/payments/:id/verify - 验证支付
 * - POST /api/v1/payments/:id/refund - 退款
 * - POST /api/v1/webhooks - 处理webhook
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { LegacyPluginAdapter, LegacyPlugin, AdapterConfig } from './LegacyPluginAdapter';
import { PluginConfig } from '../core/PluginConfig';
import { ConfigMigrator, LegacyPaymentConfig } from './ConfigMigrator';

/**
 * 旧支付插件接口（基于现有代码分析）
 */
export interface LegacyPaymentPlugin extends LegacyPlugin {
  // 核心支付方法
  createPayment?(request: any): Promise<any>;
  verifyPayment?(paymentId: string): Promise<any>;
  cancelPayment?(paymentId: string): Promise<boolean>;
  refund?(request: any): Promise<any>;
  
  // Webhook处理
  processNotification?(data: any): Promise<any>;
  handleWebhook?(event: any): Promise<void>;
  verifyWebhook?(event: any): Promise<boolean>;
  
  // 可选方法
  getPayment?(paymentId: string): Promise<any>;
  getRefund?(refundId: string): Promise<any>;
  savePaymentMethod?(customerId: string, paymentMethodData: any): Promise<string>;
  getPaymentMethods?(customerId: string): Promise<any[]>;
  deletePaymentMethod?(paymentMethodId: string): Promise<boolean>;
}

/**
 * 支付请求接口
 */
export interface PaymentRequest {
  orderId: string;
  amount: number;
  currency: string;
  description: string;
  customerId?: string;
  paymentMethod?: string;
  metadata?: Record<string, any>;
  returnUrl?: string;
  cancelUrl?: string;
  webhookUrl?: string;
}

/**
 * 退款请求接口
 */
export interface RefundRequest {
  paymentId: string;
  amount?: number; // 部分退款金额，不提供则全额退款
  reason?: string;
  metadata?: Record<string, any>;
}

/**
 * 支付插件适配器
 */
export class LegacyPaymentPluginAdapter extends LegacyPluginAdapter<LegacyPaymentPlugin> {
  
  constructor(
    legacyPlugin: LegacyPaymentPlugin,
    legacyConfig: LegacyPaymentConfig,
    adapterConfig?: AdapterConfig
  ) {
    // 使用配置迁移器转换配置
    const migratedConfig = ConfigMigrator.migratePaymentConfig(legacyConfig);
    
    super(legacyPlugin, migratedConfig, {
      routePrefix: '/api/v1',
      enableAuth: false, // 支付插件通常有自己的认证机制
      enableMetrics: true,
      enableTracing: true,
      timeout: 60000, // 支付操作可能需要更长时间
      ...adapterConfig
    });
  }

  /**
   * 设置支付插件特定的路由
   */
  protected async setupAdapterRoutes(): Promise<void> {
    if (!this.app) return;

    const prefix = this.adapterConfig.routePrefix || '/api/v1';

    // 创建支付
    this.app.post(`${prefix}/payments`, async (request: FastifyRequest, reply: FastifyReply) => {
      return this.handleCreatePayment(request, reply);
    });

    // 查询支付
    this.app.get(`${prefix}/payments/:id`, async (request: FastifyRequest, reply: FastifyReply) => {
      return this.handleGetPayment(request, reply);
    });

    // 验证支付
    this.app.post(`${prefix}/payments/:id/verify`, async (request: FastifyRequest, reply: FastifyReply) => {
      return this.handleVerifyPayment(request, reply);
    });

    // 取消支付
    this.app.post(`${prefix}/payments/:id/cancel`, async (request: FastifyRequest, reply: FastifyReply) => {
      return this.handleCancelPayment(request, reply);
    });

    // 退款
    this.app.post(`${prefix}/payments/:id/refund`, async (request: FastifyRequest, reply: FastifyReply) => {
      return this.handleRefund(request, reply);
    });

    // 查询退款
    this.app.get(`${prefix}/refunds/:id`, async (request: FastifyRequest, reply: FastifyReply) => {
      return this.handleGetRefund(request, reply);
    });

    // Webhook处理
    this.app.post(`${prefix}/webhooks`, async (request: FastifyRequest, reply: FastifyReply) => {
      return this.handleWebhook(request, reply);
    });

    // 支付方法管理（可选）
    if (this.legacyPlugin.savePaymentMethod) {
      this.app.post(`${prefix}/customers/:customerId/payment-methods`, async (request: FastifyRequest, reply: FastifyReply) => {
        return this.handleSavePaymentMethod(request, reply);
      });
    }

    if (this.legacyPlugin.getPaymentMethods) {
      this.app.get(`${prefix}/customers/:customerId/payment-methods`, async (request: FastifyRequest, reply: FastifyReply) => {
        return this.handleGetPaymentMethods(request, reply);
      });
    }

    if (this.legacyPlugin.deletePaymentMethod) {
      this.app.delete(`${prefix}/payment-methods/:id`, async (request: FastifyRequest, reply: FastifyReply) => {
        return this.handleDeletePaymentMethod(request, reply);
      });
    }

    this.adapterLogger.info('Payment plugin routes configured successfully');
  }

  /**
   * 处理创建支付请求
   */
  private async handleCreatePayment(request: FastifyRequest, reply: FastifyReply) {
    try {
      const paymentRequest = request.body as PaymentRequest;
      
      // 验证请求参数
      if (!paymentRequest.orderId || !paymentRequest.amount || !paymentRequest.currency) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'orderId, amount, and currency are required'
        });
      }

      if (!this.legacyPlugin.createPayment) {
        return reply.status(501).send({
          error: 'Not Implemented',
          message: 'Payment creation is not supported by this plugin'
        });
      }

      const result = await this.wrapLegacyCall(
        'createPayment',
        () => this.legacyPlugin.createPayment!(paymentRequest),
        { orderId: paymentRequest.orderId, amount: paymentRequest.amount }
      );

      // TODO: 发送事件 (待实现事件系统)
      this.adapterLogger.info('Payment created', {
        pluginId: this.legacyPlugin.pluginId,
        paymentId: result.id || result.paymentId,
        orderId: paymentRequest.orderId
      });

      return reply.status(201).send(result);
      
    } catch (error: any) {
      this.adapterLogger.error('Failed to create payment', error);
      return reply.status(500).send({
        error: 'Payment Creation Failed',
        message: error.message || 'Unknown error'
      });
    }
  }

  /**
   * 处理查询支付请求
   */
  private async handleGetPayment(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };

      if (!this.legacyPlugin.getPayment && !this.legacyPlugin.verifyPayment) {
        return reply.status(501).send({
          error: 'Not Implemented',
          message: 'Payment query is not supported by this plugin'
        });
      }

      const method = this.legacyPlugin.getPayment || this.legacyPlugin.verifyPayment!;
      const result = await this.wrapLegacyCall(
        'getPayment',
        () => method(id),
        { paymentId: id }
      );

      return reply.send(result);
      
    } catch (error: any) {
      this.adapterLogger.error('Failed to get payment', error);
      return reply.status(500).send({
        error: 'Payment Query Failed',
        message: error.message || 'Unknown error'
      });
    }
  }

  /**
   * 处理验证支付请求
   */
  private async handleVerifyPayment(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };

      if (!this.legacyPlugin.verifyPayment) {
        return reply.status(501).send({
          error: 'Not Implemented',
          message: 'Payment verification is not supported by this plugin'
        });
      }

      const result = await this.wrapLegacyCall(
        'verifyPayment',
        () => this.legacyPlugin.verifyPayment!(id),
        { paymentId: id }
      );

      return reply.send(result);
      
    } catch (error: any) {
      this.adapterLogger.error('Failed to verify payment', error);
      return reply.status(500).send({
        error: 'Payment Verification Failed',
        message: error.message || 'Unknown error'
      });
    }
  }

  /**
   * 处理取消支付请求
   */
  private async handleCancelPayment(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };

      if (!this.legacyPlugin.cancelPayment) {
        return reply.status(501).send({
          error: 'Not Implemented',
          message: 'Payment cancellation is not supported by this plugin'
        });
      }

      const result = await this.wrapLegacyCall(
        'cancelPayment',
        () => this.legacyPlugin.cancelPayment!(id),
        { paymentId: id }
      );

      // TODO: 发送事件 (待实现事件系统)
      this.adapterLogger.info('Payment cancelled', {
        pluginId: this.legacyPlugin.pluginId,
        paymentId: id
      });

      return reply.send({ cancelled: result });
      
    } catch (error) {
      this.adapterLogger.error('Failed to cancel payment', error);
      return reply.status(500).send({
        error: 'Payment Cancellation Failed',
        message: error.message
      });
    }
  }

  /**
   * 处理退款请求
   */
  private async handleRefund(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };
      const refundRequest = request.body as RefundRequest;

      if (!this.legacyPlugin.refund) {
        return reply.status(501).send({
          error: 'Not Implemented',
          message: 'Refund is not supported by this plugin'
        });
      }

      const result = await this.wrapLegacyCall(
        'refund',
        () => this.legacyPlugin.refund!({ ...refundRequest, paymentId: id }),
        { paymentId: id, amount: refundRequest.amount }
      );

      // TODO: 发送事件 (待实现事件系统)
      this.adapterLogger.info('Payment refunded', {
        pluginId: this.legacyPlugin.pluginId,
        paymentId: id,
        refundId: result.id || result.refundId
      });

      return reply.status(201).send(result);
      
    } catch (error) {
      this.adapterLogger.error('Failed to process refund', error);
      return reply.status(500).send({
        error: 'Refund Failed',
        message: error.message
      });
    }
  }

  /**
   * 处理查询退款请求
   */
  private async handleGetRefund(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };

      if (!this.legacyPlugin.getRefund) {
        return reply.status(501).send({
          error: 'Not Implemented',
          message: 'Refund query is not supported by this plugin'
        });
      }

      const result = await this.wrapLegacyCall(
        'getRefund',
        () => this.legacyPlugin.getRefund!(id),
        { refundId: id }
      );

      return reply.send(result);
      
    } catch (error) {
      this.adapterLogger.error('Failed to get refund', error);
      return reply.status(500).send({
        error: 'Refund Query Failed',
        message: error.message
      });
    }
  }

  /**
   * 处理Webhook请求
   */
  private async handleWebhook(request: FastifyRequest, reply: FastifyReply) {
    try {
      const webhookData = request.body;

      // 优先使用 handleWebhook，然后是 processNotification
      const handler = this.legacyPlugin.handleWebhook || this.legacyPlugin.processNotification;
      
      if (!handler) {
        return reply.status(501).send({
          error: 'Not Implemented',
          message: 'Webhook handling is not supported by this plugin'
        });
      }

      // 如果有webhook验证方法，先验证
      if (this.legacyPlugin.verifyWebhook) {
        const isValid = await this.wrapLegacyCall(
          'verifyWebhook',
          () => this.legacyPlugin.verifyWebhook!(webhookData),
          { webhookType: 'verification' }
        );

        if (!isValid) {
          return reply.status(400).send({
            error: 'Invalid Webhook',
            message: 'Webhook verification failed'
          });
        }
      }

      const result = await this.wrapLegacyCall(
        'handleWebhook',
        () => handler(webhookData),
        { webhookType: 'processing' }
      );

      // TODO: 发送事件 (待实现事件系统)
      this.adapterLogger.info('Webhook received', {
        pluginId: this.legacyPlugin.pluginId,
        webhookType: 'payment'
      });

      return reply.send({ processed: true, result });
      
    } catch (error) {
      this.adapterLogger.error('Failed to handle webhook', error);
      return reply.status(500).send({
        error: 'Webhook Processing Failed',
        message: error.message
      });
    }
  }

  /**
   * 处理保存支付方法请求
   */
  private async handleSavePaymentMethod(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { customerId } = request.params as { customerId: string };
      const paymentMethodData = request.body;

      const paymentMethodId = await this.wrapLegacyCall(
        'savePaymentMethod',
        () => this.legacyPlugin.savePaymentMethod!(customerId, paymentMethodData),
        { customerId }
      );

      return reply.status(201).send({ paymentMethodId });
      
    } catch (error) {
      this.adapterLogger.error('Failed to save payment method', error);
      return reply.status(500).send({
        error: 'Save Payment Method Failed',
        message: error.message
      });
    }
  }

  /**
   * 处理获取支付方法请求
   */
  private async handleGetPaymentMethods(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { customerId } = request.params as { customerId: string };

      const paymentMethods = await this.wrapLegacyCall(
        'getPaymentMethods',
        () => this.legacyPlugin.getPaymentMethods!(customerId),
        { customerId }
      );

      return reply.send({ paymentMethods });
      
    } catch (error) {
      this.adapterLogger.error('Failed to get payment methods', error);
      return reply.status(500).send({
        error: 'Get Payment Methods Failed',
        message: error.message
      });
    }
  }

  /**
   * 处理删除支付方法请求
   */
  private async handleDeletePaymentMethod(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { id } = request.params as { id: string };

      const deleted = await this.wrapLegacyCall(
        'deletePaymentMethod',
        () => this.legacyPlugin.deletePaymentMethod!(id),
        { paymentMethodId: id }
      );

      return reply.send({ deleted });
      
    } catch (error) {
      this.adapterLogger.error('Failed to delete payment method', error);
      return reply.status(500).send({
        error: 'Delete Payment Method Failed',
        message: error.message
      });
    }
  }
}
