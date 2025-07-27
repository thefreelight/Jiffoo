"use strict";
/**
 * Stripe 官方支付插件
 *
 * 基于统一插件架构的 Stripe 支付集成
 * 整合了原有的 StripePaymentProvider 功能
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripePaymentPlugin = exports.configSchema = exports.metadata = void 0;
const types_1 = require("../../../core/types");
// 导入原有的 Stripe Provider 作为实现基础
const stripe_provider_1 = require("../../../../apps/backend/src/core/payment/providers/stripe-provider");
// ==================== 插件元数据 ====================
const metadata = {
    id: 'stripe-official',
    name: 'stripe-official',
    displayName: 'Stripe 支付 (官方版)',
    version: '1.0.0',
    description: 'Stripe 官方支付插件，支持信用卡和借记卡支付',
    longDescription: `
    Stripe 官方支付插件提供以下功能：
    - 创建支付意图 (PaymentIntent)
    - 处理 3D Secure 验证
    - 支持保存支付方式
    - 处理退款和部分退款
    - Webhook 事件处理
    - 支持多种货币和地区
    
    Stripe 是全球领先的在线支付处理平台，支持 135+ 种货币。
  `,
    author: 'Jiffoo Team',
    homepage: 'https://jiffoo.com/plugins/stripe',
    repository: 'https://github.com/jiffoo/plugins/stripe',
    keywords: ['payment', 'stripe', 'credit-card', 'official'],
    category: 'payment',
    type: types_1.PluginType.PAYMENT,
    // 路由定义
    routes: [
        {
            method: 'POST',
            url: '/create-payment-intent',
            handler: 'createPaymentIntent',
            auth: true,
            schema: {
                body: {
                    type: 'object',
                    required: ['amount', 'currency', 'orderId'],
                    properties: {
                        amount: { type: 'number', minimum: 0.5 },
                        currency: { type: 'string', enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'] },
                        orderId: { type: 'string' },
                        customerId: { type: 'string' },
                        description: { type: 'string' },
                        returnUrl: { type: 'string' },
                        metadata: { type: 'object' }
                    }
                }
            }
        },
        {
            method: 'POST',
            url: '/create-checkout-session',
            handler: 'createCheckoutSession',
            auth: true,
            schema: {
                body: {
                    type: 'object',
                    required: ['amount', 'currency', 'orderId', 'successUrl', 'cancelUrl'],
                    properties: {
                        amount: { type: 'number', minimum: 0.5 },
                        currency: { type: 'string', enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'] },
                        orderId: { type: 'string' },
                        customerId: { type: 'string' },
                        customerEmail: { type: 'string', format: 'email' },
                        description: { type: 'string' },
                        successUrl: { type: 'string', format: 'uri' },
                        cancelUrl: { type: 'string', format: 'uri' },
                        items: {
                            type: 'array',
                            items: {
                                type: 'object',
                                required: ['name', 'quantity', 'price'],
                                properties: {
                                    name: { type: 'string' },
                                    description: { type: 'string' },
                                    quantity: { type: 'number', minimum: 1 },
                                    price: { type: 'number', minimum: 0.01 },
                                    images: {
                                        type: 'array',
                                        items: { type: 'string', format: 'uri' }
                                    }
                                }
                            }
                        },
                        metadata: { type: 'object' }
                    }
                }
            }
        },
        {
            method: 'POST',
            url: '/confirm-payment',
            handler: 'confirmPayment',
            auth: true,
            schema: {
                body: {
                    type: 'object',
                    required: ['paymentIntentId'],
                    properties: {
                        paymentIntentId: { type: 'string' },
                        paymentMethodId: { type: 'string' }
                    }
                }
            }
        },
        {
            method: 'POST',
            url: '/verify-payment',
            handler: 'verifyPayment',
            auth: true,
            schema: {
                body: {
                    type: 'object',
                    required: ['paymentId'],
                    properties: {
                        paymentId: { type: 'string' }
                    }
                }
            }
        },
        {
            method: 'POST',
            url: '/refund',
            handler: 'processRefund',
            auth: true,
            schema: {
                body: {
                    type: 'object',
                    required: ['paymentId'],
                    properties: {
                        paymentId: { type: 'string' },
                        amount: { type: 'number', minimum: 0.01 },
                        reason: { type: 'string' }
                    }
                }
            }
        },
        {
            method: 'POST',
            url: '/webhook',
            handler: 'handleWebhook',
            auth: false
        },
        {
            method: 'GET',
            url: '/verify-session',
            handler: 'verifySession',
            auth: false,
            schema: {
                querystring: {
                    type: 'object',
                    required: ['session_id'],
                    properties: {
                        session_id: { type: 'string' }
                    }
                }
            }
        }
    ],
    // 权限要求
    permissions: {
        api: ['payment.create', 'payment.verify', 'payment.refund', 'payment.webhook'],
        database: ['orders', 'payments', 'customers'],
        network: ['api.stripe.com']
    },
    // 资源限制
    resources: {
        memory: 256, // 256MB
        cpu: 15, // 15%
        requests: 2000 // 每分钟2000次请求
    },
    // 许可证信息
    license: {
        type: 'MIT'
    },
    // 定价信息
    pricing: {
        type: 'free'
    },
    // 依赖关系
    dependencies: [],
    // 最小核心版本
    minCoreVersion: '2.0.0',
    // 支持的平台
    supportedPlatforms: ['web', 'mobile']
};
exports.metadata = metadata;
// ==================== 配置模式 ====================
const configSchema = {
    type: 'object',
    required: ['apiKey'],
    properties: {
        apiKey: {
            type: 'string',
            title: 'Stripe API Key',
            description: 'Your Stripe secret API key (starts with sk_)',
            format: 'password'
        },
        webhookSecret: {
            type: 'string',
            title: 'Webhook Secret',
            description: 'Stripe webhook endpoint secret for signature verification',
            format: 'password'
        },
        environment: {
            type: 'string',
            title: 'Environment',
            description: 'Stripe environment',
            enum: ['test', 'live'],
            default: 'test'
        },
        currency: {
            type: 'string',
            title: 'Default Currency',
            description: 'Default currency for payments',
            enum: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
            default: 'USD'
        },
        captureMethod: {
            type: 'string',
            title: 'Capture Method',
            description: 'When to capture the payment',
            enum: ['automatic', 'manual'],
            default: 'automatic'
        },
        enableSavedCards: {
            type: 'boolean',
            title: 'Enable Saved Cards',
            description: 'Allow customers to save payment methods',
            default: true
        }
    }
};
exports.configSchema = configSchema;
// ==================== Stripe 支付实现 ====================
class StripePaymentImplementation {
    provider;
    context;
    initialized = false;
    constructor(context) {
        this.context = context;
        this.provider = new stripe_provider_1.StripePaymentProvider();
    }
    async initialize() {
        try {
            const config = this.context.config;
            if (!config.apiKey) {
                throw new Error('Stripe API key is required');
            }
            // 初始化 Stripe Provider
            await this.provider.initialize({
                apiKey: config.apiKey,
                webhookSecret: config.webhookSecret,
                environment: config.environment || 'test',
                currency: config.currency || 'USD'
            });
            this.initialized = true;
            this.context.logger.info('Stripe payment implementation initialized');
        }
        catch (error) {
            this.context.logger.error('Failed to initialize Stripe payment implementation:', error);
            throw error;
        }
    }
    async destroy() {
        if (this.provider) {
            await this.provider.destroy();
        }
        this.initialized = false;
        this.context.logger.info('Stripe payment implementation destroyed');
    }
    async healthCheck() {
        try {
            return this.provider.isInitialized();
        }
        catch (error) {
            this.context.logger.error('Stripe health check failed:', error);
            return false;
        }
    }
    async validateConfig(config) {
        try {
            if (!config.apiKey || typeof config.apiKey !== 'string') {
                return false;
            }
            if (!config.apiKey.startsWith('sk_')) {
                return false;
            }
            return true;
        }
        catch (error) {
            return false;
        }
    }
    // ==================== 支付处理方法 ====================
    async createPaymentIntent(request) {
        if (!this.initialized) {
            throw new Error('Stripe plugin not initialized');
        }
        try {
            // Import Currency enum from payment types
            const { Currency } = await Promise.resolve().then(() => __importStar(require('../../../../apps/backend/src/core/payment/types')));
            // 从请求体中获取数据
            const body = request.body || request;
            // Validate required fields
            if (!body.amount || !body.currency || !body.orderId) {
                throw new Error('Missing required fields: amount, currency, orderId');
            }
            // Convert currency string to Currency enum
            const currencyEnum = Currency[body.currency];
            if (!currencyEnum) {
                throw new Error(`Unsupported currency: ${body.currency}`);
            }
            const paymentRequest = {
                orderId: body.orderId,
                amount: {
                    value: body.amount,
                    currency: currencyEnum
                },
                customer: {
                    id: body.customerId || undefined,
                    email: body.customerEmail || 'guest@example.com',
                    name: body.customerName || 'Guest User'
                },
                items: body.items || [{
                        id: 'default-item',
                        name: body.description || 'Payment',
                        description: body.description || 'Payment for order',
                        quantity: 1,
                        unitPrice: body.amount,
                        totalPrice: body.amount
                    }],
                description: body.description,
                returnUrl: body.returnUrl,
                metadata: body.metadata
            };
            const result = await this.provider.createPayment(paymentRequest);
            return {
                success: true,
                paymentIntentId: result.paymentId,
                clientSecret: result.clientSecret,
                status: result.status
            };
        }
        catch (error) {
            this.context.logger.error('Failed to create payment intent:', error);
            throw error;
        }
    }
    async createCheckoutSession(request) {
        if (!this.initialized) {
            throw new Error('Stripe plugin not initialized');
        }
        try {
            // 从请求体中获取数据
            const body = request.body || request;
            console.log('🔍 Stripe createCheckoutSession request body:', JSON.stringify(body, null, 2));

            // Validate required fields
            if (!body.amount || !body.currency || !body.orderId || !body.successUrl || !body.cancelUrl) {
                throw new Error('Missing required fields: amount, currency, orderId, successUrl, cancelUrl');
            }

            // 获取 Stripe 实例
            const stripeProvider = this.provider;
            const stripe = stripeProvider.stripe;

            // Check if we're in demo mode
            const config = this.context.config;
            const isDemoMode = process.env.STRIPE_DEMO_MODE === 'true' ||
                              (config.apiKey && config.apiKey.includes('demo')) ||
                              (config.apiKey && config.apiKey.includes('test_demo'));

            if (isDemoMode || !stripe) {
                // Return mock checkout session for demo mode
                const mockSessionId = `cs_demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                const mockUrl = `${body.successUrl.split('?')[0]}?session_id=${mockSessionId}&demo=true`;

                this.context.logger.info(`Demo Stripe checkout session created: ${mockSessionId} for order ${body.orderId}`);

                return {
                    success: true,
                    sessionId: mockSessionId,
                    url: mockUrl,
                    status: 'created',
                    demo: true
                };
            }
            // Convert amount to cents (Stripe uses smallest currency unit)
            const amountInCents = Math.round(body.amount * 100);
            // Prepare line items for checkout session
            const lineItems = body.items ? body.items.map((item) => ({
                price_data: {
                    currency: body.currency.toLowerCase(),
                    product_data: {
                        name: item.name,
                        description: item.description,
                        images: item.images || []
                    },
                    unit_amount: Math.round(item.price * 100)
                },
                quantity: item.quantity
            })) : [{
                    price_data: {
                        currency: body.currency.toLowerCase(),
                        product_data: {
                            name: body.description || `Order ${body.orderId}`,
                            description: body.description || `Payment for order ${body.orderId}`
                        },
                        unit_amount: amountInCents
                    },
                    quantity: 1
                }];

            console.log('🔍 Stripe line_items:', JSON.stringify(lineItems, null, 2));

            // Create checkout session parameters
            const sessionParams = {
                payment_method_types: ['card'],
                line_items: lineItems,
                mode: 'payment',
                success_url: body.successUrl,
                cancel_url: body.cancelUrl,
                metadata: {
                    orderId: body.orderId,
                    ...body.metadata
                }
            };
            // Add customer information if provided
            if (body.customerEmail) {
                sessionParams.customer_email = body.customerEmail;
            }
            if (body.customerId && body.customerId.startsWith('cus_')) {
                sessionParams.customer = body.customerId;
            }
            // Create the checkout session
            const session = await stripe.checkout.sessions.create(sessionParams);
            this.context.logger.info(`Stripe checkout session created: ${session.id} for order ${body.orderId}`);
            return {
                success: true,
                sessionId: session.id,
                url: session.url,
                status: 'created'
            };
        }
        catch (error) {
            this.context.logger.error('Failed to create checkout session:', error);
            throw error;
        }
    }
    async confirmPayment(request) {
        // 实现支付确认逻辑
        // 这里可以调用 Stripe 的 confirm API
        return { success: true, status: 'confirmed' };
    }
    async verifyPayment(request) {
        if (!this.initialized) {
            throw new Error('Stripe plugin not initialized');
        }
        try {
            const body = request.body || request;
            const verification = await this.provider.verifyPayment(body.paymentId);
            return {
                success: true,
                status: verification.status,
                amount: verification.amount,
                currency: verification.currency
            };
        }
        catch (error) {
            this.context.logger.error('Failed to verify payment:', error);
            throw error;
        }
    }
    async processRefund(request) {
        if (!this.initialized) {
            throw new Error('Stripe plugin not initialized');
        }
        try {
            const body = request.body || request;
            const refundRequest = {
                paymentId: body.paymentId,
                amount: body.amount,
                reason: body.reason
            };
            const result = await this.provider.refundPayment(refundRequest);
            return {
                success: true,
                refundId: result.refundId,
                amount: result.amount,
                status: result.status
            };
        }
        catch (error) {
            this.context.logger.error('Failed to process refund:', error);
            throw error;
        }
    }
    async handleWebhook(request) {
        if (!this.initialized) {
            throw new Error('Stripe plugin not initialized');
        }
        try {
            const signature = request.headers['stripe-signature'];
            const body = request.body || request;
            // For testing purposes, if no valid signature, process the event directly
            if (!signature || signature === 'test-signature') {
                this.context.logger.info('Processing test webhook event');
                // Parse the event from request body
                const event = typeof body === 'string' ? JSON.parse(body) : body;
                if (!event || !event.type) {
                    throw new Error('Invalid webhook event received');
                }
                // 处理不同类型的 webhook 事件
                switch (event.type) {
                    case 'payment_intent.succeeded':
                        this.context.logger.info('Payment succeeded webhook received');
                        break;
                    case 'payment_intent.payment_failed':
                        this.context.logger.info('Payment failed webhook received');
                        break;
                    default:
                        this.context.logger.info(`Unhandled webhook event: ${event.type}`);
                }
                return { received: true, event: event.type };
            }
            // For production, use Stripe's webhook verification
            const payload = typeof body === 'string' ? body : JSON.stringify(body);
            const event = await this.provider.handleWebhook(payload, signature);
            if (!event || !event.type) {
                throw new Error('Invalid webhook event received');
            }
            // 处理不同类型的 webhook 事件
            switch (event.type) {
                case 'payment_intent.succeeded':
                    this.context.logger.info('Payment succeeded webhook received');
                    break;
                case 'payment_intent.payment_failed':
                    this.context.logger.info('Payment failed webhook received');
                    break;
                default:
                    this.context.logger.info(`Unhandled webhook event: ${event.type}`);
            }
            return { received: true, event: event.type };
        }
        catch (error) {
            this.context.logger.error('Failed to handle webhook:', error);
            throw error;
        }
    }
    async verifySession(request) {
        if (!this.initialized) {
            throw new Error('Stripe plugin not initialized');
        }
        try {
            // 从查询参数中获取 session_id
            const sessionId = request.query?.session_id || request.params?.session_id;
            if (!sessionId) {
                throw new Error('Missing session_id parameter');
            }
            // 获取 Stripe 实例
            const stripeProvider = this.provider;
            const stripe = stripeProvider.stripe;
            if (!stripe) {
                throw new Error('Stripe instance not available');
            }
            // 检索 checkout session
            const session = await stripe.checkout.sessions.retrieve(sessionId);
            this.context.logger.info(`Stripe session verified: ${sessionId}, status: ${session.payment_status}`);
            return {
                success: true,
                sessionId: session.id,
                paymentStatus: session.payment_status,
                orderId: session.metadata?.orderId,
                customerEmail: session.customer_details?.email,
                amountTotal: session.amount_total,
                currency: session.currency
            };
        }
        catch (error) {
            this.context.logger.error('Failed to verify Stripe session:', error);
            throw error;
        }
    }
}
// ==================== 插件主类 ====================
class StripeOfficialPlugin {
    metadata = metadata;
    configSchema = configSchema;
    implementation;
    // 统一管理器期望的方法
    async install(context) {
        context.logger.info('Installing Stripe Official Plugin...');
        // 强制使用环境变量中的配置
        const apiKey = process.env.STRIPE_SECRET_KEY;
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        // 验证配置
        if (!apiKey) {
            throw new Error('Stripe API key is required for installation. Please provide it in config or set STRIPE_SECRET_KEY environment variable.');
        }
        // 更新配置以包含环境变量值
        context.config = {
            ...context.config,
            apiKey,
            webhookSecret,
            environment: context.config.environment || 'test',
            currency: context.config.currency || 'USD',
            captureMethod: context.config.captureMethod || 'automatic',
            enableSavedCards: context.config.enableSavedCards !== undefined ? context.config.enableSavedCards : true
        };
        context.logger.info('Stripe Official Plugin installed successfully');
    }
    async onInstall(context) {
        return this.install(context);
    }
    async uninstall(context) {
        context.logger.info('Uninstalling Stripe Official Plugin...');
        if (this.implementation) {
            await this.implementation.destroy();
        }
        context.logger.info('Stripe Official Plugin uninstalled successfully');
    }
    async onUninstall(context) {
        return this.uninstall(context);
    }
    async activate(context) {
        context.logger.info('Activating Stripe Official Plugin...');
        // 强制使用环境变量中的密钥，忽略数据库配置
        const apiKey = process.env.STRIPE_SECRET_KEY;
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        // 临时调试：记录API密钥的前几个字符
        context.logger.info(`Using env API Key: ${apiKey ? apiKey.substring(0, 15) + '...' : 'undefined'}`);
        context.logger.info(`API Key length: ${apiKey ? apiKey.length : 0}`);
        if (!apiKey) {
            throw new Error('Stripe API key is required for activation. Please provide it in config or set STRIPE_SECRET_KEY environment variable.');
        }
        // 更新配置
        context.config = {
            ...context.config,
            apiKey,
            webhookSecret,
            environment: context.config.environment || 'test',
            currency: context.config.currency || 'USD',
            captureMethod: context.config.captureMethod || 'automatic',
            enableSavedCards: context.config.enableSavedCards !== undefined ? context.config.enableSavedCards : true
        };
        this.implementation = new StripePaymentImplementation(context);
        await this.implementation.initialize();
        // 注册路由处理器
        context.registerRouteHandler?.('createPaymentIntent', this.implementation.createPaymentIntent.bind(this.implementation));
        context.registerRouteHandler?.('createCheckoutSession', this.implementation.createCheckoutSession.bind(this.implementation));
        context.registerRouteHandler?.('confirmPayment', this.implementation.confirmPayment.bind(this.implementation));
        context.registerRouteHandler?.('verifyPayment', this.implementation.verifyPayment.bind(this.implementation));
        context.registerRouteHandler?.('processRefund', this.implementation.processRefund.bind(this.implementation));
        context.registerRouteHandler?.('handleWebhook', this.implementation.handleWebhook.bind(this.implementation));
        context.registerRouteHandler?.('verifySession', this.implementation.verifySession.bind(this.implementation));
        // 插件已激活，实现已初始化
        context.logger.info('Stripe plugin activated successfully');
        context.logger.info('Stripe Official Plugin activated successfully');
    }
    async onActivate(context) {
        return this.activate(context);
    }
    async deactivate(context) {
        context.logger.info('Deactivating Stripe Official Plugin...');
        if (this.implementation) {
            await this.implementation.destroy();
            this.implementation = undefined;
        }
        context.logger.info('Stripe Official Plugin deactivated successfully');
    }
    async onDeactivate(context) {
        return this.deactivate(context);
    }
    getConfigSchema() {
        return this.configSchema;
    }
    async onConfigUpdate(context, newConfig) {
        context.logger.info('Updating Stripe Official Plugin configuration...');
        if (this.implementation) {
            // 重新初始化以应用新配置
            await this.implementation.destroy();
            await this.implementation.initialize();
        }
        context.logger.info('Stripe Official Plugin configuration updated successfully');
    }
    async healthCheck(context) {
        if (!this.implementation) {
            return { healthy: false, details: { error: 'Plugin not activated' } };
        }
        try {
            const healthy = await this.implementation.healthCheck();
            return {
                healthy,
                details: {
                    provider: 'stripe',
                    version: metadata.version,
                    lastCheck: new Date().toISOString()
                }
            };
        }
        catch (error) {
            return {
                healthy: false,
                details: {
                    error: error instanceof Error ? error.message : 'Unknown error'
                }
            };
        }
    }
}
// ==================== 导出 ====================
// 创建插件实例
const stripePlugin = new StripeOfficialPlugin();
exports.default = stripePlugin;
// 兼容性导出 - 支持旧的插件系统
exports.stripePaymentPlugin = {
    metadata,
    configSchema,
    plugin: stripePlugin
};
//# sourceMappingURL=index.js.map