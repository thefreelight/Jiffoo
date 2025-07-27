/**
 * Stripe Payment Plugin Microservice
 * 独立的Stripe支付插件微服务，支持真正的热插拔
 */

import Fastify, { FastifyInstance } from 'fastify';
import Stripe from 'stripe';

// 简化的插件类型定义（避免复杂的依赖）
interface PluginContext {
  pluginId: string;
  version: string;
  config: any;
  logger: any;
  registerRouteHandler?: (name: string, handler: Function) => void;
  storage: Map<string, any>;
  events: {
    emit: (event: string, data: any) => void;
    on: (event: string, handler: Function) => void;
  };
}

enum PluginStatus {
  INACTIVE = 'inactive',
  ACTIVE = 'active',
  ERROR = 'error'
}

interface MicroserviceConfig {
  port: number;
  host: string;
  pluginName: string;
  pluginVersion: string;
  environment: string;
  stripeApiKey: string;
  stripeWebhookSecret?: string;
  databaseUrl?: string;
  redisUrl?: string;
}

// 简化的Stripe插件实现
class SimpleStripePlugin {
  private stripe: Stripe;
  private context: PluginContext;
  private initialized: boolean = false;

  constructor(context: PluginContext) {
    this.context = context;
  }

  async install(): Promise<void> {
    this.context.logger.info('Installing Stripe plugin...');
    // 安装逻辑（如果需要）
  }

  async activate(): Promise<void> {
    this.context.logger.info('Activating Stripe plugin...');

    if (!this.context.config.apiKey) {
      throw new Error('Stripe API key is required');
    }

    this.stripe = new Stripe(this.context.config.apiKey, {
      apiVersion: '2023-10-16'
    });

    this.initialized = true;
    this.context.logger.info('Stripe plugin activated successfully');
  }

  async deactivate(): Promise<void> {
    this.context.logger.info('Deactivating Stripe plugin...');
    this.initialized = false;
  }

  async uninstall(): Promise<void> {
    this.context.logger.info('Uninstalling Stripe plugin...');
    // 卸载逻辑（如果需要）
  }

  async healthCheck(): Promise<boolean> {
    if (!this.initialized || !this.stripe) {
      return false;
    }

    try {
      // 简单的健康检查 - 尝试获取账户信息
      await this.stripe.accounts.retrieve();
      return true;
    } catch (error) {
      this.context.logger.error('Stripe health check failed:', error);
      return false;
    }
  }

  // 支付方法实现
  async createCheckoutSession(request: any): Promise<any> {
    if (!this.initialized) {
      throw new Error('Plugin not initialized');
    }

    try {
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: request.line_items,
        mode: 'payment',
        success_url: request.success_url,
        cancel_url: request.cancel_url,
        metadata: request.metadata || {}
      });

      return {
        success: true,
        sessionId: session.id,
        url: session.url
      };
    } catch (error) {
      this.context.logger.error('Failed to create checkout session:', error);
      throw error;
    }
  }

  async createPaymentIntent(request: any): Promise<any> {
    if (!this.initialized) {
      throw new Error('Plugin not initialized');
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: request.amount,
        currency: request.currency || 'usd',
        metadata: request.metadata || {}
      });

      return {
        success: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id
      };
    } catch (error) {
      this.context.logger.error('Failed to create payment intent:', error);
      throw error;
    }
  }

  async verifyPayment(request: any): Promise<any> {
    if (!this.initialized) {
      throw new Error('Plugin not initialized');
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(request.paymentIntentId);

      return {
        success: true,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency
      };
    } catch (error) {
      this.context.logger.error('Failed to verify payment:', error);
      throw error;
    }
  }

  async processRefund(request: any): Promise<any> {
    if (!this.initialized) {
      throw new Error('Plugin not initialized');
    }

    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: request.paymentIntentId,
        amount: request.amount
      });

      return {
        success: true,
        refundId: refund.id,
        status: refund.status,
        amount: refund.amount
      };
    } catch (error) {
      this.context.logger.error('Failed to process refund:', error);
      throw error;
    }
  }

  async handleWebhook(request: any): Promise<any> {
    if (!this.initialized) {
      throw new Error('Plugin not initialized');
    }

    try {
      const sig = request.headers['stripe-signature'];
      const event = this.stripe.webhooks.constructEvent(
        request.body,
        sig,
        this.context.config.webhookSecret
      );

      this.context.logger.info('Webhook event received:', event.type);

      return {
        success: true,
        eventType: event.type,
        eventId: event.id
      };
    } catch (error) {
      this.context.logger.error('Failed to handle webhook:', error);
      throw error;
    }
  }
}

class StripePluginMicroservice {
  private fastify: FastifyInstance;
  private plugin: SimpleStripePlugin;
  private config: MicroserviceConfig;
  private pluginContext: PluginContext;
  private isReady: boolean = false;

  constructor(config: MicroserviceConfig) {
    this.config = config;
    this.fastify = Fastify({
      logger: {
        level: process.env.LOG_LEVEL || 'info',
        prettyPrint: process.env.NODE_ENV !== 'production'
      }
    });

    this.setupPluginContext();
    this.plugin = new SimpleStripePlugin(this.pluginContext);
    this.setupRoutes();
    this.setupHealthChecks();
  }

  private setupPluginContext(): void {
    this.pluginContext = {
      pluginId: 'stripe-official',
      version: this.config.pluginVersion,
      config: {
        apiKey: this.config.stripeApiKey,
        webhookSecret: this.config.stripeWebhookSecret,
        environment: this.config.environment === 'production' ? 'live' : 'test',
        currency: 'USD',
        captureMethod: 'automatic',
        enableSavedCards: true
      },
      logger: this.fastify.log,
      registerRouteHandler: (name: string, handler: Function) => {
        this.fastify.log.info(`Registering route handler: ${name}`);
        // 在微服务中，我们直接注册路由
        this.registerMicroserviceRoute(name, handler);
      },
      storage: new Map(),
      events: {
        emit: (event: string, data: any) => {
          this.fastify.log.info(`Plugin event: ${event}`, data);
        },
        on: (event: string, handler: Function) => {
          this.fastify.log.info(`Plugin event listener registered: ${event}`);
        }
      }
    };
  }

  private registerMicroserviceRoute(name: string, handler: Function): void {
    const routeMap: Record<string, { method: string; path: string }> = {
      createPaymentIntent: { method: 'POST', path: '/create-payment-intent' },
      createCheckoutSession: { method: 'POST', path: '/create-checkout-session' },
      confirmPayment: { method: 'POST', path: '/confirm-payment' },
      verifyPayment: { method: 'POST', path: '/verify-payment' },
      processRefund: { method: 'POST', path: '/refund' },
      handleWebhook: { method: 'POST', path: '/webhook' },
      verifySession: { method: 'GET', path: '/verify-session' }
    };

    const route = routeMap[name];
    if (!route) {
      this.fastify.log.warn(`Unknown route handler: ${name}`);
      return;
    }

    this.fastify.route({
      method: route.method as any,
      url: route.path,
      handler: async (request, reply) => {
        try {
          const result = await handler(request.body || request.query);
          return reply.send(result);
        } catch (error) {
          this.fastify.log.error(`Error in ${name}:`, error);
          return reply.status(500).send({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    });

    this.fastify.log.info(`Registered route: ${route.method} ${route.path}`);
  }

  private setupRoutes(): void {
    // CORS支持
    this.fastify.register(require('@fastify/cors'), {
      origin: true,
      credentials: true
    });

    // 插件信息路由
    this.fastify.get('/info', async (request, reply) => {
      return {
        pluginId: 'stripe-official',
        name: this.config.pluginName,
        version: this.config.pluginVersion,
        status: this.isReady ? PluginStatus.ACTIVE : PluginStatus.INACTIVE,
        environment: this.config.environment,
        metadata: this.plugin.metadata
      };
    });

    // 插件配置路由
    this.fastify.get('/config', async (request, reply) => {
      return {
        schema: {}, // 简化版本暂时不提供schema
        current: {
          environment: this.pluginContext.config.environment,
          currency: this.pluginContext.config.currency,
          captureMethod: this.pluginContext.config.captureMethod,
          enableSavedCards: this.pluginContext.config.enableSavedCards
        }
      };
    });

    // 插件控制路由
    this.fastify.post('/activate', async (request, reply) => {
      try {
        await this.plugin.activate(this.pluginContext);
        this.isReady = true;
        return { success: true, message: 'Plugin activated successfully' };
      } catch (error) {
        this.fastify.log.error('Failed to activate plugin:', error);
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Activation failed'
        });
      }
    });

    this.fastify.post('/deactivate', async (request, reply) => {
      try {
        await this.plugin.deactivate(this.pluginContext);
        this.isReady = false;
        return { success: true, message: 'Plugin deactivated successfully' };
      } catch (error) {
        this.fastify.log.error('Failed to deactivate plugin:', error);
        return reply.status(500).send({
          success: false,
          error: error instanceof Error ? error.message : 'Deactivation failed'
        });
      }
    });
  }

  private setupHealthChecks(): void {
    // 健康检查
    this.fastify.get('/health', async (request, reply) => {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        plugin: {
          id: 'stripe-official',
          status: this.isReady ? 'active' : 'inactive',
          version: this.config.pluginVersion
        },
        service: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          environment: this.config.environment
        }
      };

      if (this.isReady && this.plugin.implementation) {
        try {
          const pluginHealthy = await this.plugin.implementation.healthCheck();
          health.plugin.status = pluginHealthy ? 'healthy' : 'unhealthy';
        } catch (error) {
          health.plugin.status = 'error';
          health.status = 'degraded';
        }
      }

      const statusCode = health.status === 'healthy' ? 200 : 503;
      return reply.status(statusCode).send(health);
    });

    // 就绪检查
    this.fastify.get('/health/ready', async (request, reply) => {
      if (this.isReady) {
        return reply.send({ status: 'ready' });
      } else {
        return reply.status(503).send({ status: 'not ready' });
      }
    });

    // 存活检查
    this.fastify.get('/health/live', async (request, reply) => {
      return reply.send({ status: 'alive' });
    });
  }

  async start(): Promise<void> {
    try {
      // 安装插件
      await this.plugin.install(this.pluginContext);
      this.fastify.log.info('Plugin installed successfully');

      // 激活插件
      await this.plugin.activate(this.pluginContext);
      this.isReady = true;
      this.fastify.log.info('Plugin activated successfully');

      // 启动服务器
      await this.fastify.listen({
        port: this.config.port,
        host: this.config.host
      });

      this.fastify.log.info(`Stripe Plugin Microservice started on ${this.config.host}:${this.config.port}`);
    } catch (error) {
      this.fastify.log.error('Failed to start microservice:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      if (this.isReady) {
        await this.plugin.deactivate(this.pluginContext);
        await this.plugin.uninstall(this.pluginContext);
      }
      await this.fastify.close();
      this.fastify.log.info('Stripe Plugin Microservice stopped');
    } catch (error) {
      this.fastify.log.error('Error stopping microservice:', error);
      throw error;
    }
  }
}

// 启动微服务
async function startMicroservice() {
  const config: MicroserviceConfig = {
    port: parseInt(process.env.PORT || '3001'),
    host: process.env.HOST || '0.0.0.0',
    pluginName: process.env.PLUGIN_NAME || 'stripe-payment-provider',
    pluginVersion: process.env.PLUGIN_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    stripeApiKey: process.env.STRIPE_SECRET_KEY || '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL
  };

  if (!config.stripeApiKey) {
    console.error('STRIPE_SECRET_KEY environment variable is required');
    process.exit(1);
  }

  const microservice = new StripePluginMicroservice(config);

  // 优雅关闭处理
  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    await microservice.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down gracefully...');
    await microservice.stop();
    process.exit(0);
  });

  await microservice.start();
}

// 如果直接运行此文件，启动微服务
if (require.main === module) {
  startMicroservice().catch((error) => {
    console.error('Failed to start microservice:', error);
    process.exit(1);
  });
}

export { StripePluginMicroservice, MicroserviceConfig };
