import { FastifyPluginAsync } from 'fastify'
import Stripe from 'stripe'
import { withTenantContext } from '@/core/database/tenant-middleware'
import rawBody from 'fastify-raw-body'
import { authMiddleware } from '@/core/auth/middleware'

/**
 * Stripe Payment Plugin Options
 */
interface StripePaymentOptions {
  secretKey?: string;        // 平台级别的 Secret Key（可选）
  webhookSecret?: string;    // 平台级别的 Webhook Secret（可选）
  publishableKey?: string;   // 平台级别的 Publishable Key（可选）
}

/**
 * Stripe Payment Plugin
 *
 * 提供 Stripe 支付集成功能：
 * - 基础支付（创建支付会话、验证支付）
 * - Webhook 处理（订阅、发票、支付方式事件）
 * - 订阅管理（创建、读取、更新、取消）
 * - 退款功能（商业化功能）
 * - 分期付款（商业化功能）
 * - 双模式支持（Platform / BYOK）
 *
 * 注意：此插件不使用 fastify-plugin 包装，保持封装以避免路由泄露
 */
const stripePayment: FastifyPluginAsync<StripePaymentOptions> = async (fastify, options) => {
  /**
   * 获取订阅计划配置
   */
  async function getPlanConfig(pluginId: string, planId: string) {
    const plan = await fastify.prisma.subscriptionPlan.findUnique({
      where: {
        pluginId_planId: {
          pluginId,
          planId
        }
      }
    })

    if (!plan) {
      throw new Error(`Plan ${planId} not found for plugin ${pluginId}`)
    }

    return {
      id: plan.id,
      planId: plan.planId,
      name: plan.name,
      amount: plan.amount,
      currency: plan.currency,
      billingCycle: plan.billingCycle,
      stripePriceId: plan.stripePriceId,
      features: plan.features ? JSON.parse(plan.features) : [],
      limits: plan.limits ? JSON.parse(plan.limits) : {}
    }
  }

  /**
   * 获取插件配置（包含租户的BYOK配置）
   */
  async function getStripeConfig(tenantId: number) {
    const installation = await fastify.prisma.pluginInstallation.findFirst({
      where: {
        tenantId,
        plugin: { slug: 'stripe' },
        status: 'ACTIVE'
      }
    });

    if (!installation) {
      throw new Error('Stripe Payment plugin not installed');
    }

    const config = installation.configData
      ? JSON.parse(installation.configData)
      : {};

    return {
      mode: config.mode || 'platform',  // 'platform' 或 'byok'
      secretKey: config.stripeSecretKey || options.secretKey,
      webhookSecret: config.stripeWebhookSecret || options.webhookSecret,
      publishableKey: config.stripePublishableKey || options.publishableKey
    };
  }

  /**
   * 创建租户专属的 Stripe 实例
   */
  function createStripeInstance(secretKey: string) {
    if (!secretKey) {
      throw new Error('Stripe Secret Key is required');
    }

    return new Stripe(secretKey, {
      apiVersion: '2025-02-24.acacia' as any // 匹配 Stripe CLI 的 API 版本
    });
  }

  // 🔧 创建平台级 Stripe 实例（用于 webhook 验证和无租户上下文的操作）
  // 如果平台没有配置 Secret Key，某些功能（如 webhook）将无法使用
  const platformStripe = options.secretKey
    ? createStripeInstance(options.secretKey)
    : null;

  // 注册 fastify-raw-body 插件，用于 Stripe webhook 签名验证
  await fastify.register(rawBody, {
    field: 'rawBody', // 将原始 body 保存到 request.rawBody
    global: false, // 不全局启用，只在需要的路由上使用
    encoding: 'utf8', // 编码格式
  });

  // 创建支付会话路由
  // 🆕 创建支付会话
  // 前端必须传入 successUrl 和 cancelUrl，以支持多域名场景
  // 例如：bamboi.com 发起支付，成功后回到 bamboi.com/order-success
  fastify.post('/create-checkout-session', {
    schema: {
      hide: true,
      tags: ['plugins', 'stripe'],
      summary: 'Create checkout session',
      description: 'Create a Stripe checkout session. Frontend MUST provide successUrl and cancelUrl to support multi-domain scenarios.',
      body: {
        type: 'object',
        properties: {
          orderId: { type: 'string', description: 'Order ID to pay for' },
          successUrl: { type: 'string', description: 'URL to redirect after successful payment (e.g., https://bamboi.com/order-success?session_id={CHECKOUT_SESSION_ID})' },
          cancelUrl: { type: 'string', description: 'URL to redirect if payment is cancelled (e.g., https://bamboi.com/checkout)' }
        },
        required: ['orderId']
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
        }
      }
    },
    preHandler: async (request: any, reply: any) => {
      // 基础许可证检查
      const licenseCheck = await fastify.checkPluginLicense(
        request.tenant.id,
        'stripe',
        'basic_payments'
      )

      if (!licenseCheck.valid) {
        return reply.status(403).send({
          error: 'License required',
          reason: licenseCheck.reason,
          upgradeUrl: licenseCheck.upgradeUrl
        })
      }

      // 用量检查（API 调用次数）
      const apiCallCheck = await fastify.checkUsageLimit(
        request.tenant.id,
        'stripe',
        'api_calls'
      )
      if (!apiCallCheck.allowed) {
        return reply.status(429).send({
          error: 'API call limit exceeded',
          current: apiCallCheck.current,
          limit: apiCallCheck.limit,
          percentage: apiCallCheck.percentage
        })
      }

      // 记录 API 调用次数
      await fastify.recordPluginUsage(request.tenant.id, 'stripe', 'api_calls')
    }
  }, async (request: any, reply: any) => {
    try {
      const { orderId, successUrl, cancelUrl } = request.body;

      // 1. 获取订单信息
      const order = await fastify.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: {
            include: { product: true }
          }
        }
      });

      if (!order) {
        return reply.status(404).send({
          success: false,
          error: 'Order not found'
        });
      }

      // 2. 检查订单状态
      if (order.paymentStatus !== 'UNPAID') {
        return reply.status(400).send({
          success: false,
          error: 'Order is not in payable state'
        });
      }

      // 3. 检查订单是否过期
      if (order.expiresAt && order.expiresAt < new Date()) {
        return reply.status(400).send({
          success: false,
          error: 'Order has expired'
        });
      }

      // 4. 获取插件信息
      const plugin = await fastify.prisma.plugin.findUnique({
        where: { slug: 'stripe' }
      });

      if (!plugin) {
        return reply.status(500).send({
          success: false,
          error: 'Plugin not found'
        });
      }

      // 5. 获取租户的Stripe配置
      const stripeConfig = await getStripeConfig(request.tenant.id);
      const stripe = createStripeInstance(stripeConfig.secretKey);

      // 6. 构建line_items
      const lineItems = order.items.map(item => ({
        price_data: {
          currency: 'usd',
          product_data: {
            name: item.product.name,
            description: item.product.description || undefined,
          },
          unit_amount: Math.round(item.unitPrice * 100), // Convert to cents
        },
        quantity: item.quantity,
      }));

      // 7. 创建Stripe Checkout Session
      // 🆕 前端应该传入 successUrl 和 cancelUrl 以支持多域名场景
      // 如果没有传入，使用默认值并记录警告
      const shopUrl = process.env.NEXT_PUBLIC_SHOP_URL || 'http://localhost:3004';

      if (!successUrl || !cancelUrl) {
        fastify.log.warn(`⚠️ Missing successUrl or cancelUrl for order ${orderId}. Using default shop URL. Frontend should pass these URLs for multi-domain support.`);
      }

      const finalSuccessUrl = successUrl || `${shopUrl}/order-success?session_id={CHECKOUT_SESSION_ID}`;
      const finalCancelUrl = cancelUrl || `${shopUrl}/checkout`;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        success_url: finalSuccessUrl,
        cancel_url: finalCancelUrl,
        metadata: {
          orderId: order.id,
          tenantId: request.tenant.id.toString(),
        },
        expires_at: Math.floor((Date.now() + 30 * 60 * 1000) / 1000), // 30 minutes
      });

      // 8. 创建支付记录
      await fastify.prisma.payment.create({
        data: {
          orderId: order.id,
          tenantId: request.tenant.id,
          pluginId: plugin.id,
          paymentMethod: 'stripe',
          sessionId: session.id,
          sessionUrl: session.url,
          amount: order.totalAmount,
          currency: 'USD',
          expiresAt: new Date(session.expires_at * 1000),
        }
      });

      // 9. 记录交易使用量
      await fastify.recordPluginUsage(request.tenant.id, 'stripe', 'transactions');

      return reply.send({
        success: true,
        data: {
          sessionId: session.id,
          url: session.url,
          expiresAt: new Date(session.expires_at * 1000).toISOString()
        }
      });

    } catch (error: any) {
      fastify.log.error('Create checkout session failed:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to create checkout session',
        details: error.message
      });
    }
  });

// 🆕 查询当前计划状态
fastify.get('/plan/current', {
  schema: {
    hide: true,
    tags: ['plugins', 'stripe'],
    summary: 'Get current Stripe plan',
    response: {
      200: {
        type: 'object',
        additionalProperties: true
      },
      '4xx': { type: 'object', additionalProperties: true },
      '5xx': { type: 'object', additionalProperties: true }
    }
  },
  preHandler: async (request: any, reply: any) => {
    // 基础许可证检查
    const licenseCheck = await fastify.checkPluginLicense(
      request.tenant.id,
      'stripe',
      'basic_payments'
    )

    if (!licenseCheck.valid) {
      return reply.status(403).send({
        error: 'License required',
        reason: licenseCheck.reason,
        upgradeUrl: licenseCheck.upgradeUrl
      })
    }
  }
}, async (request: any, reply: any) => {
  try {
    // 🆕 Step 0: 懒加载 - 检查并在需要时重置使用量
    await fastify.checkAndResetUsageIfNeeded(request.tenant.id, 'stripe')

    // 1. 获取插件安装信息
    const installation = await fastify.prisma.pluginInstallation.findFirst({
      where: {
        tenantId: request.tenant.id,
        plugin: { slug: 'stripe' },
        status: 'ACTIVE'
      },
      include: { plugin: true }
    })

    if (!installation) {
      return reply.status(404).send({
        error: 'Plugin not installed'
      })
    }

    // 🔧 修复：统一数据源 - 查找活跃订阅获取当前计划
    const subscription = await fastify.prisma.subscription.findFirst({
      where: {
        tenantId: request.tenant.id,
        pluginId: installation.pluginId,
        status: { in: ['active', 'trialing', 'past_due'] }  // ✅ 包含past_due（宽限期）
      }
    })

    // 获取当前计划
    const currentPlan = subscription?.planId || 'free'
    // 🔧 阶段3优化：不再需要读取configData，统一使用subscription_plans表

    // 3. 获取当前计划配置
    const planConfig = await getPlanConfig(installation.pluginId, currentPlan)

    // 4. 确定 period
    let period: string
    if (subscription) {
      // 使用订阅周期作为 period
      const startDate = subscription.currentPeriodStart.toISOString().split('T')[0]
      period = `${subscription.id}:${startDate}`
    } else {
      // Free Plan：使用自然月
      period = new Date().toISOString().slice(0, 7)
    }

    // 4. 获取使用量
    const usage = await fastify.prisma.pluginUsage.findMany({
      where: {
        tenantId: request.tenant.id,
        pluginSlug: 'stripe',
        period: period
      }
    })

    const usageMap: any = {}
    usage.forEach(u => {
      usageMap[u.metricName] = u.value
    })

    // 4. 查找待生效的变更
    let pendingChange = null
    if (subscription) {
      const change = await fastify.prisma.subscriptionChange.findFirst({
        where: {
          subscriptionId: subscription.id,
          changeType: 'downgraded',
          effectiveDate: { gt: new Date() }
        },
        orderBy: { createdAt: 'desc' }
      })

      if (change) {
        pendingChange = {
          type: 'downgrade',
          fromPlan: change.fromPlanId,
          targetPlan: change.toPlanId,
          effectiveDate: change.effectiveDate.toISOString(),
          daysRemaining: Math.ceil((change.effectiveDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        }
      }
    }

    return {
      plan: currentPlan,
      features: planConfig?.features || [],
      limits: planConfig?.limits || {},
      usage: {
        transactions: usageMap.transactions || 0,
        api_calls: usageMap.api_calls || 0
      },
      subscription: subscription ? {
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart.toISOString(),
        currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        amount: subscription.amount,
        currency: subscription.currency,
        stripeSubscriptionId: subscription.stripeSubscriptionId  // 🔑 添加订阅 ID
      } : null,
      pendingChange: pendingChange
    }
  } catch (error: any) {
    fastify.log.error('Failed to get current plan:', {
      error: error.message,
      stack: error.stack
    })
    return reply.status(500).send({
      error: 'Failed to get current plan',
      details: error.message
    })
  }
})

// 验证支付会话 - 免费版本 (支持未认证访问)
fastify.get('/verify-session', {
  schema: {
    tags: ['plugins', 'stripe'],
    summary: 'Verify Stripe Session',
    querystring: {
      type: 'object',
      required: ['session_id'],
      properties: {
        session_id: { type: 'string' }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          orderId: { type: 'string' },
          paymentStatus: { type: 'string' },
          alreadyProcessed: { type: 'boolean' }
        }
      },
      '4xx': { type: 'object', additionalProperties: true },
      '5xx': { type: 'object', additionalProperties: true }
    }
  }
}, async (request: any, reply: any) => {
  const { session_id } = request.query

  if (!session_id) {
    return reply.status(400).send({
      success: false,
      error: 'session_id is required'
    })
  }

  try {
    // 🔧 注意：这个路由不依赖认证，需要先用平台级 Stripe 获取 session，再获取租户配置
    // 1. 先用平台级 Stripe 获取 session 信息（获取 tenantId）
    if (!platformStripe) {
      return reply.status(500).send({
        success: false,
        error: 'Platform Stripe not configured'
      })
    }

    const session = await platformStripe.checkout.sessions.retrieve(session_id)

    // 2. 从session metadata获取tenantId (不依赖认证)
    const tenantId = parseInt(session.metadata?.tenantId)
    if (!tenantId) {
      return reply.status(400).send({
        success: false,
        error: 'Invalid session: missing tenantId'
      })
    }

    // 3. 获取租户的 Stripe 配置并重新获取 session（使用租户的 Stripe 账号）
    const stripeConfig = await getStripeConfig(tenantId);
    const tenantStripe = createStripeInstance(stripeConfig.secretKey);
    const tenantSession = await tenantStripe.checkout.sessions.retrieve(session_id);

    // 4. 检查API调用限制 (使用从session获取的tenantId)
    const apiCallCheck = await fastify.checkUsageLimit(
      tenantId,
      'stripe',
      'api_calls'
    )

    if (!apiCallCheck.allowed) {
      return reply.status(429).send({
        error: 'API call limit exceeded',
        current: apiCallCheck.current,
        limit: apiCallCheck.limit,
        percentage: apiCallCheck.percentage,
        upgradeUrl: `/plugins/stripe/upgrade`
      })
    }

    // 5. 记录API调用次数
    await fastify.recordPluginUsage(tenantId, 'stripe', 'api_calls')

    // 6. 如果支付成功,更新数据库
    if (tenantSession.payment_status === 'paid') {
      const orderId = tenantSession.metadata?.orderId

      if (!orderId) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid session: missing orderId'
        })
      }

      // 幂等性检查 - 检查订单的paymentStatus是否已经是PAID
      // 这是最可靠的幂等性标志，因为它代表整个支付流程已完成
      const existingOrder = await fastify.prisma.order.findUnique({
        where: { id: orderId }
      })

      if (!existingOrder) {
        return reply.status(404).send({
          success: false,
          error: 'Order not found'
        })
      }

      if (existingOrder.paymentStatus === 'PAID') {
        fastify.log.info(`Order ${orderId} payment already completed, skipping`)
        return {
          success: true,
          orderId,
          paymentStatus: 'paid',
          alreadyProcessed: true
        }
      }

      // 🆕 检查订单是否过期（30分钟）
      if (existingOrder.expiresAt && new Date() > existingOrder.expiresAt) {
        fastify.log.error(`Order ${orderId} has expired at ${existingOrder.expiresAt}`)
        return reply.status(400).send({
          success: false,
          error: 'Order has expired',
          message: 'This order has expired. Please create a new order.'
        })
      }

      // 获取Stripe插件ID
      const stripePlugin = await fastify.prisma.plugin.findUnique({
        where: { slug: 'stripe' }
      })

      // 使用事务处理所有数据库操作（保证原子性）
      await fastify.prisma.$transaction(async (tx: any) => {
        // 1. 更新支付记录
        await tx.payment.updateMany({
          where: {
            sessionId: session_id,
            tenantId: tenantId
          },
          data: {
            status: 'SUCCEEDED',
            paymentIntentId: typeof tenantSession.payment_intent === 'string' ? tenantSession.payment_intent : tenantSession.payment_intent?.id,
            pluginId: stripePlugin?.id,
            updatedAt: new Date()
          }
        })

        // 2. 更新订单状态（包括paymentStatus）
        await tx.order.update({
          where: { id: orderId },
          data: {
            status: 'PAID',
            paymentStatus: 'PAID',  // 🆕 更新支付状态
            updatedAt: new Date()
          }
        })

        // 🆕 3. 确认库存预留并扣减实际库存
        const reservations = await tx.inventoryReservation.findMany({
          where: { orderId, status: 'ACTIVE' }
        })

        for (const reservation of reservations) {
          // 扣减实际库存
          await tx.product.update({
            where: {
              id: reservation.productId,
              tenantId: tenantId
            },
            data: {
              stock: {
                decrement: reservation.quantity
              },
              updatedAt: new Date()
            }
          })

          // 标记预留为已确认
          await tx.inventoryReservation.update({
            where: { id: reservation.id },
            data: {
              status: 'CONFIRMED',
              updatedAt: new Date()
            }
          })

          fastify.log.info(`Stock confirmed for product ${reservation.productId}: -${reservation.quantity} (order: ${orderId})`)
        }
      })

      fastify.log.info(`✅ Payment verified and processed for order ${orderId} (tenant: ${tenantId})`)

      // 🆕 计算分销佣金（异步，不阻塞支付流程）
      try {
        if (typeof (fastify as any).calculateAffiliateCommission === 'function') {
          await (fastify as any).calculateAffiliateCommission(orderId, tenantId);
          fastify.log.info(`✅ Affiliate commission calculated for order ${orderId}`);
        }
      } catch (error) {
        fastify.log.error(`Failed to calculate affiliate commission for order ${orderId}:`, error);
        // 不抛出错误，避免影响支付流程
      }

      // 🆕 计算代理佣金（三级代理分润）
      try {
        if (existingOrder.agentId && typeof (fastify as any).calculateAgentCommission === 'function') {
          await (fastify as any).calculateAgentCommission(orderId, tenantId, existingOrder.agentId);
          fastify.log.info(`✅ Agent commission calculated for order ${orderId} (agent: ${existingOrder.agentId})`);
        }
      } catch (error) {
        fastify.log.error(`Failed to calculate agent commission for order ${orderId}:`, error);
        // 不抛出错误，避免影响支付流程
      }

      // 记录成功的交易次数
      await fastify.recordPluginUsage(tenantId, 'stripe', 'transactions')

      return {
        success: true,
        orderId,
        paymentStatus: 'paid'
      }
    }

    return {
      success: false,
      paymentStatus: tenantSession.payment_status
    }
  } catch (error) {
    fastify.log.error('Session verification failed:', error)
    return reply.status(500).send({
      success: false,
      error: 'Failed to verify payment session'
    })
  }
})

// 🆕 增强的Webhook处理 - 支持订阅和支付事件
fastify.post('/webhook', {
  schema: {
    tags: ['plugins', 'stripe'],
    summary: 'Stripe Webhook',
    hide: true, // Hide webhook from Swagger as it's for internal/external service use
    response: {
      200: {
        type: 'object',
        properties: {
          received: { type: 'boolean' }
        }
      }
    }
  },
  onRequest: [], // Skip all middleware including auth for webhooks
  config: {
    // 启用 rawBody 以便进行 Stripe 签名验证
    rawBody: true
  }
}, async (request: any, reply: any) => {
  const sig = request.headers['stripe-signature']

  // 添加调试日志
  fastify.log.info('Webhook received:', {
    hasSignature: !!sig,
    hasWebhookSecret: !!options.webhookSecret,
    webhookSecretLength: options.webhookSecret?.length,
    hasRawBody: !!request.rawBody,
    bodyType: typeof request.body,
    headers: Object.keys(request.headers)
  })

  try {
    // 获取原始请求体用于签名验证
    const rawBody = request.rawBody || JSON.stringify(request.body)

    // 验证webhook签名
    let event
    if (options.webhookSecret && sig && platformStripe) {
      fastify.log.info('Attempting webhook signature verification...')
      event = platformStripe.webhooks.constructEvent(rawBody, sig, options.webhookSecret)
      fastify.log.info('Webhook signature verification successful')
    } else {
      // 开发环境下如果没有配置webhook secret，直接使用请求体
      fastify.log.warn('Webhook signature verification skipped - no webhook secret configured', {
        hasWebhookSecret: !!options.webhookSecret,
        hasSignature: !!sig,
        hasPlatformStripe: !!platformStripe
      })
      event = request.body
    }

    fastify.log.info(`Received Stripe webhook: ${event.type} (ID: ${event.id})`)

    // 处理不同类型的事件
    switch (event.type) {
      // 支付会话完成
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object, fastify)
        break

      // 🆕 支付会话过期
      case 'checkout.session.expired':
        await handleCheckoutSessionExpired(event.data.object, fastify)
        break

      // 订阅相关事件
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object, fastify)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object, fastify)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object, fastify)
        break

      // 发票相关事件
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object, fastify)
        break

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object, fastify)
        break

      case 'invoice.created':
        await handleInvoiceCreated(event.data.object, fastify)
        break

      // 支付方式相关事件
      case 'payment_method.attached':
        await handlePaymentMethodAttached(event.data.object, fastify)
        break

      default:
        fastify.log.info(`Unhandled webhook event type: ${event.type}`)
    }

    return { received: true }
  } catch (error) {
    fastify.log.error('Webhook error:', error)
    return reply.status(400).send({ error: 'Webhook signature verification failed' })
  }
})

// Webhook事件处理函数
async function handleCheckoutSessionCompleted(session: any, fastify: any) {
  const tenantId = parseInt(session.metadata?.tenantId)

  if (!tenantId) {
    fastify.log.error('Missing tenantId in webhook metadata', { session })
    return
  }

  // 🔧 获取租户的 Stripe 配置
  let stripeConfig, tenantStripe
  try {
    stripeConfig = await getStripeConfig(tenantId);
    tenantStripe = createStripeInstance(stripeConfig.secretKey);
  } catch (error) {
    fastify.log.error(`Failed to get Stripe config for tenant ${tenantId}:`, error)
    return
  }

  // 🆕 检查是否是升级支付
  if (session.metadata?.isUpgrade === 'true') {
    return await handleUpgradePayment(session, fastify)
  }

  // 普通商品支付流程
  const orderId = session.metadata?.orderId

  if (!orderId) {
    fastify.log.error('Missing orderId in webhook metadata', { session })
    return
  }

  try {
    // 1. 验证订单存在且属于正确租户（多租户安全检查）
    const order = await fastify.prisma.order.findFirst({
      where: {
        id: orderId,
        tenantId: tenantId
      },
      include: {
        items: {
          include: {
            product: true
          }
        },
        user: {
          select: {
            id: true,
            email: true,
            username: true
          }
        }
      }
    })

    if (!order) {
      fastify.log.error(`Order not found or tenant mismatch: ${orderId}, tenant: ${tenantId}`)
      return
    }

    // 2. 幂等性检查 - 防止重复处理同一个 webhook 事件
    const existingPayment = await fastify.prisma.payment.findFirst({
      where: {
        sessionId: session.id,
        tenantId: tenantId,
        status: 'SUCCEEDED'
      }
    })

    if (existingPayment) {
      fastify.log.info(`Payment already processed for session ${session.id}, skipping`)
      return
    }

    // 3. 检查订单状态
    if (order.status === 'PAID') {
      fastify.log.info(`Order ${orderId} already marked as PAID, skipping`)
      return
    }

    // 🆕 4. 检查订单是否过期（30分钟）
    if (order.expiresAt && new Date() > order.expiresAt) {
      fastify.log.error(`Order ${orderId} has expired at ${order.expiresAt}, refusing payment`)

      // 尝试退款（如果支付已完成）
      try {
        if (session.payment_intent) {
          await tenantStripe.refunds.create({
            payment_intent: session.payment_intent as string,
            reason: 'requested_by_customer',
            metadata: {
              reason: 'Order expired before payment completion',
              orderId: orderId,
              tenantId: tenantId.toString()
            }
          })
          fastify.log.info(`Refund created for expired order ${orderId}`)
        }
      } catch (refundError) {
        fastify.log.error(`Failed to refund expired order ${orderId}:`, refundError)
      }

      return
    }

    // 🆕 获取Stripe插件ID
    const stripePlugin = await fastify.prisma.plugin.findUnique({
      where: { slug: 'stripe' }
    })

    // 4. 使用事务处理所有数据库操作（保证原子性）
    await fastify.prisma.$transaction(async (tx: any) => {
      // 4.1 更新支付状态
      await tx.payment.updateMany({
        where: {
          sessionId: session.id,
          tenantId: tenantId
        },
        data: {
          status: 'SUCCEEDED',
          paymentIntentId: session.payment_intent,
          pluginId: stripePlugin?.id,  // 🆕 关联插件
          updatedAt: new Date()
        }
      })

      // 4.2 更新订单状态
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: 'PAID',
          paymentStatus: 'PAID',  // 🆕 更新支付状态
          updatedAt: new Date()
        }
      })

      // 🆕 4.3 确认库存预留并扣减实际库存
      const reservations = await tx.inventoryReservation.findMany({
        where: { orderId, status: 'ACTIVE' }
      })

      for (const reservation of reservations) {
        // 扣减实际库存
        await tx.product.update({
          where: {
            id: reservation.productId,
            tenantId: tenantId // 确保租户隔离
          },
          data: {
            stock: {
              decrement: reservation.quantity
            },
            updatedAt: new Date()
          }
        })

        // 标记预留为已确认
        await tx.inventoryReservation.update({
          where: { id: reservation.id },
          data: { status: 'CONFIRMED' }
        })

        fastify.log.info(`Stock confirmed for product ${reservation.productId}: -${reservation.quantity} (order: ${orderId})`)
      }
    })

    // 🆕 计算分销佣金（异步，不阻塞支付流程）
    try {
      if (typeof (fastify as any).calculateAffiliateCommission === 'function') {
        await (fastify as any).calculateAffiliateCommission(orderId, tenantId);
        fastify.log.info(`✅ Affiliate commission calculated for order ${orderId}`);
      }
    } catch (error) {
      fastify.log.error(`Failed to calculate affiliate commission for order ${orderId}:`, error);
      // 不抛出错误，避免影响支付流程
    }

    // 🆕 计算代理佣金（三级代理分润）
    try {
      if (order.agentId && typeof (fastify as any).calculateAgentCommission === 'function') {
        await (fastify as any).calculateAgentCommission(orderId, tenantId, order.agentId);
        fastify.log.info(`✅ Agent commission calculated for order ${orderId} (agent: ${order.agentId})`);
      }
    } catch (error) {
      fastify.log.error(`Failed to calculate agent commission for order ${orderId}:`, error);
      // 不抛出错误，避免影响支付流程
    }

    fastify.log.info(`✅ Payment completed successfully for order ${orderId} (tenant: ${tenantId}, amount: ${order.totalAmount})`)

    // 6. 记录成功的交易次数
    await fastify.recordPluginUsage(tenantId, 'stripe', 'transactions')

    // 7. 发送支付成功通知（异步，不影响主流程）
    // TODO: 实现邮件/站内信通知
    // await sendPaymentSuccessNotification(order)

  } catch (error: any) {
    fastify.log.error(`Failed to process payment for order ${orderId}:`, {
      error: error.message,
      stack: error.stack,
      orderId,
      tenantId,
      sessionId: session.id
    })
    throw error // 让 Stripe 知道处理失败，会重试
  }
}

// 🆕 处理支付会话过期
async function handleCheckoutSessionExpired(session: any, fastify: any) {
  const orderId = session.metadata?.orderId

  if (!orderId) {
    fastify.log.warn('Session expired but no orderId in metadata')
    return
  }

  fastify.log.info(`Stripe session expired for order ${orderId}`)

  try {
    // 更新支付记录状态
    await fastify.prisma.payment.updateMany({
      where: { sessionId: session.id },
      data: {
        status: 'FAILED',
        failureReason: 'Session expired'
      }
    })

    // 注意：不取消订单，因为用户可以重新支付
    // 订单过期由定时任务处理
  } catch (error: any) {
    fastify.log.error(`Failed to handle session expiration for order ${orderId}:`, error)
  }
}


/**
 * Reset Plugin Usage for Upgrade
 *
 * 🎯 业务需求：
 * 1. Free → Business/Enterprise: 重置使用量 + 保存Free历史记录
 * 2. Business ↔ Enterprise: 重置使用量 + 保存历史记录
 * 3. Free Plan: 卸载重装不重置使用量（只能自然月重置）
 * 4. Paid Plan: 卸载重装保护（服务周期内保持权益）
 *
 * @param fastify - Fastify instance
 * @param tenantId - Tenant ID
 * @param pluginSlug - Plugin identifier
 * @param newSubscription - 新的订阅记录（本地数据库记录）
 * @param upgradeContext - 升级上下文信息
 */
async function resetPluginUsageForUpgrade(
  fastify: any,
  tenantId: number,
  pluginSlug: string,
  newSubscription: any,
  upgradeContext: {
    fromPlan: string;
    toPlan: string;
    upgradeType: 'free_to_paid' | 'paid_to_paid';
    sessionId?: string;
  }
) {
  try {
    fastify.log.info(`🔄 Creating usage records for new subscription: ${upgradeContext.fromPlan} → ${upgradeContext.toPlan}`)

    // 只创建新订阅的使用量记录（从0开始），不删除任何历史记录
    const startDate = newSubscription.currentPeriodStart.toISOString().split('T')[0]
    const newPeriod = `${newSubscription.id}:${startDate}`

    // 根据插件类型确定使用量指标
    let metrics: string[]
    if (pluginSlug === 'stripe') {
      metrics = ['transactions', 'api_calls', 'refunds']
    } else if (pluginSlug === 'resend') {
      metrics = ['api_calls', 'emails_sent']
    } else if (pluginSlug === 'google') {
      metrics = ['api_calls', 'login_attempts']
    } else {
      metrics = ['api_calls']
    }

    const usageData = metrics.map(metric => ({
      tenantId: tenantId,
      pluginSlug: pluginSlug,
      metricName: metric,
      value: 0,
      period: newPeriod
    }))

    await fastify.prisma.pluginUsage.createMany({
      data: usageData,
      skipDuplicates: true
    })

    fastify.log.info(`✅ Usage records created for new subscription: ${upgradeContext.fromPlan} → ${upgradeContext.toPlan}, period: ${newPeriod}`)
  } catch (error: any) {
    fastify.log.error('Failed to create usage records for upgrade:', error)
    throw error
  }
}

/**
 * 保存升级前的使用量历史记录
 */
async function saveUsageHistoryForUpgrade(
  fastify: any,
  tenantId: number,
  pluginSlug: string,
  upgradeContext: any
) {
  try {
    // 获取当前所有使用量记录
    const currentUsage = await fastify.prisma.pluginUsage.findMany({
      where: {
        tenantId: tenantId,
        pluginSlug: pluginSlug
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    if (currentUsage.length === 0) {
      fastify.log.info('No usage records to save for upgrade history')
      return
    }

    // 创建使用量历史快照
    const historyData = currentUsage.map(usage => ({
      tenantId: tenantId,
      pluginSlug: pluginSlug,
      metricName: usage.metricName,
      value: usage.value,
      period: usage.period,
      originalCreatedAt: usage.createdAt,
      originalUpdatedAt: usage.updatedAt,
      upgradeContext: JSON.stringify({
        fromPlan: upgradeContext.fromPlan,
        toPlan: upgradeContext.toPlan,
        upgradeType: upgradeContext.upgradeType,
        sessionId: upgradeContext.sessionId,
        upgradeDate: new Date().toISOString()
      })
    }))

    // 保存到历史表（如果存在）或者在metadata中记录
    await fastify.prisma.pluginUsageHistory.createMany({
      data: historyData,
      skipDuplicates: true
    }).catch(async (error: any) => {
      // 如果历史表不存在，记录到订阅变更中
      fastify.log.warn('PluginUsageHistory table not found, saving to subscription metadata:', error.message)

      // 将使用量历史记录到订阅的metadata中
      const subscription = await fastify.prisma.subscription.findFirst({
        where: {
          tenantId: tenantId,
          pluginId: (await fastify.prisma.plugin.findUnique({ where: { slug: pluginSlug } }))?.id
        },
        orderBy: { createdAt: 'desc' }
      })

      if (subscription) {
        const existingMetadata = subscription.metadata ? JSON.parse(subscription.metadata) : {}
        existingMetadata.upgradeHistory = existingMetadata.upgradeHistory || []
        existingMetadata.upgradeHistory.push({
          upgradeDate: new Date().toISOString(),
          fromPlan: upgradeContext.fromPlan,
          toPlan: upgradeContext.toPlan,
          usageSnapshot: currentUsage
        })

        await fastify.prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            metadata: JSON.stringify(existingMetadata)
          }
        })
      }
    })

    fastify.log.info(`📊 Saved usage history for upgrade: ${currentUsage.length} records`)
  } catch (error: any) {
    fastify.log.error('Failed to save usage history for upgrade:', error)
    // 不抛出错误，历史记录失败不应该阻止升级
  }
}

/**
 * 清理所有相关的使用量记录（统一的订阅格式）
 */
async function cleanupAllUsageRecords(
  fastify: any,
  tenantId: number,
  pluginSlug: string,
  upgradeContext: any
) {
  try {
    // 🎯 新的业务逻辑：所有计划都使用 subscriptionId:period 格式
    // 清理该租户该插件的所有使用量记录（因为要升级到新订阅）
    const deletedCount = await fastify.prisma.pluginUsage.deleteMany({
      where: {
        tenantId: tenantId,
        pluginSlug: pluginSlug
      }
    })

    fastify.log.info(`🗑️  Deleted ${deletedCount.count} usage records for upgrade from ${upgradeContext.fromPlan} to ${upgradeContext.toPlan}`)
  } catch (error: any) {
    fastify.log.error('Failed to cleanup usage records:', error)
    throw error
  }
}

/**
 * 兼容性包装函数：保持向后兼容
 * 用于其他地方调用的旧版resetPluginUsage函数
 */
async function resetPluginUsage(
  fastify: any,
  tenantId: number,
  pluginSlug: string,
  stripeSubscription: any,
  forceReset: boolean = false
) {
  try {
    // 查找本地订阅记录
    const subscription = await fastify.prisma.subscription.findFirst({
      where: {
        tenantId: tenantId,
        stripeSubscriptionId: stripeSubscription.id
      }
    })

    if (!subscription) {
      fastify.log.warn(`No local subscription found for Stripe subscription ${stripeSubscription.id}`)
      return
    }

    // 计算新的period标识符
    const startDate = new Date(stripeSubscription.current_period_start * 1000)
      .toISOString()
      .split('T')[0]
    const newPeriod = `${subscription.id}:${startDate}`

    fastify.log.info(`🔄 Resetting usage for new period: ${newPeriod}${forceReset ? ' (forced)' : ''}`)

    // 幂等性检查
    if (!forceReset) {
      const existingUsage = await fastify.prisma.pluginUsage.findFirst({
        where: {
          tenantId: tenantId,
          pluginSlug: pluginSlug,
          period: newPeriod
        }
      })

      if (existingUsage) {
        fastify.log.info(`✅ Usage already reset for period ${newPeriod}, skipping`)
        return
      }
    }

    // 删除旧的使用量记录
    const deletedCount = await fastify.prisma.pluginUsage.deleteMany({
      where: {
        tenantId: tenantId,
        pluginSlug: pluginSlug,
        period: {
          startsWith: `${subscription.id}:`
        }
      }
    })

    fastify.log.info(`🗑️  Deleted ${deletedCount.count} old usage records`)

    // 根据插件类型确定使用量指标
    let metrics: string[]
    if (pluginSlug === 'stripe') {
      metrics = ['transactions', 'api_calls', 'refunds']
    } else if (pluginSlug === 'resend') {
      metrics = ['api_calls', 'emails_sent']
    } else if (pluginSlug === 'google') {
      metrics = ['api_calls', 'login_attempts']
    } else {
      metrics = ['api_calls']
    }

    const usageData = metrics.map(metric => ({
      tenantId: tenantId,
      pluginSlug: pluginSlug,
      metricName: metric,
      value: 0,
      period: newPeriod
    }))

    // 初始化新的使用量记录
    await fastify.prisma.pluginUsage.createMany({
      data: usageData,
      skipDuplicates: true
    })

    fastify.log.info(`✅ Usage reset completed for tenant ${tenantId}, period ${newPeriod}`)
  } catch (error: any) {
    fastify.log.error('Failed to reset plugin usage:', error)
    throw error
  }
}

/**
 * Handle Proration Upgrade (Paid → Paid)
 *
 * This function handles upgrades between paid plans (e.g., Business → Enterprise).
 * It uses Stripe's proration feature to:
 * - Credit unused time on the old plan
 * - Charge prorated amount for the new plan
 * - Start a new billing cycle immediately
 *
 * @param stripeSubscription - Updated Stripe subscription object
 * @param fastify - Fastify instance
 * @param tenantId - Tenant ID
 * @param targetPlan - Target plan ID (e.g., 'enterprise')
 */
async function handleProrationUpgrade(
  stripeSubscription: any,
  fastify: any,
  tenantId: number,
  targetPlan: string
) {
  try {
    // 1. Get plugin and plan configuration
    const plugin = await fastify.prisma.plugin.findUnique({
      where: { slug: 'stripe' }
    })

    if (!plugin) {
      throw new Error('Plugin not found')
    }

    // 🔧 修复：使用subscription_plans表替代plugin.pricing
    const planConfig = await getPlanConfig(plugin.id, targetPlan)

    if (!planConfig) {
      throw new Error(`Plan not found: ${targetPlan}`)
    }

    // 2. Get current subscription to determine old plan
    const currentSubscription = await fastify.prisma.subscription.findFirst({
      where: {
        tenantId: tenantId,
        stripeSubscriptionId: stripeSubscription.id
      }
    })

    if (!currentSubscription) {
      throw new Error('Current subscription not found')
    }

    const oldPlanId = currentSubscription.planId

    // 3. Cancel old subscription record (mark as canceled)
    await fastify.prisma.subscription.update({
      where: { id: currentSubscription.id },
      data: {
        status: 'canceled',
        canceledAt: new Date(),
        updatedAt: new Date()
      }
    })

    // 3.1. 创建旧订阅的取消记录
    await fastify.prisma.subscriptionChange.create({
      data: {
        subscriptionId: currentSubscription.id,
        changeType: 'canceled',
        fromPlanId: oldPlanId,
        toPlanId: oldPlanId,
        fromAmount: currentSubscription.amount || 0,
        toAmount: currentSubscription.amount || 0,
        effectiveDate: new Date(),
        reason: `${oldPlanId} subscription canceled due to upgrade to ${targetPlan}`,
        initiatedBy: 'tenant'
      }
    })

    // 4. Create new subscription record for target plan
    // Now that we removed the unique constraint on stripeSubscriptionId,
    // we can have multiple subscription records with the same Stripe ID
    const newSubscription = await fastify.prisma.subscription.create({
      data: {
        tenantId: tenantId,
        pluginId: plugin.id,
        planId: targetPlan,
        stripeSubscriptionId: stripeSubscription.id,
        stripeItemId: currentSubscription.stripeItemId,
        stripeCustomerId: currentSubscription.stripeCustomerId,
        status: 'active',  // 🔧 修复：新订阅应该是 active 状态，不是 past_due
        billingCycle: 'monthly',
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        amount: planConfig.amount,
        currency: 'USD',
        autoRenew: true
      }
    })

    // 🔧 阶段3优化：不再需要更新configData，统一使用subscription_plans表
    fastify.log.info(`🔧 Proration upgrade completed for tenant ${tenantId}`, {
      targetPlan,
      planConfigFeatures: planConfig.features,
      planConfigLimits: planConfig.limits,
      pluginId: plugin.id
    })

    // 6. Create new usage records for new subscription (从0开始，不删除历史记录)
    await resetPluginUsageForUpgrade(
      fastify,
      tenantId,
      'stripe',
      newSubscription,
      {
        fromPlan: oldPlanId,
        toPlan: targetPlan,
        upgradeType: 'paid_to_paid',
        sessionId: undefined
      }
    )

    // 7. 创建新订阅的创建记录
    await fastify.prisma.subscriptionChange.create({
      data: {
        subscriptionId: newSubscription.id,
        changeType: 'created',
        fromPlanId: null,
        toPlanId: targetPlan,
        fromAmount: 0,
        toAmount: planConfig.amount,
        effectiveDate: new Date(),
        reason: `Created ${targetPlan} subscription after upgrade from ${oldPlanId}`,
        initiatedBy: 'tenant'
      }
    })

    // 8. Record upgrade event
    await fastify.prisma.subscriptionChange.create({
      data: {
        subscriptionId: newSubscription.id,
        changeType: 'upgraded',
        fromPlanId: oldPlanId,
        toPlanId: targetPlan,
        fromAmount: currentSubscription.amount || 0,
        toAmount: planConfig.amount,
        effectiveDate: new Date(),
        reason: 'Proration upgrade - immediate billing with new subscription record',
        initiatedBy: 'tenant'
      }
    })

    fastify.log.info(`✅ Proration upgrade completed: tenant ${tenantId}, ${oldPlanId} → ${targetPlan}`)
  } catch (error: any) {
    fastify.log.error('Failed to handle proration upgrade:', {
      message: error.message,
      stack: error.stack,
      tenantId: tenantId,
      targetPlan: targetPlan,
      stripeSubscriptionId: stripeSubscription?.id
    })
    throw error
  }
}

// 🆕 处理升级支付
async function handleUpgradePayment(session: any, fastify: any) {
  const tenantId = parseInt(session.metadata?.tenantId)
  const targetPlan = session.metadata?.targetPlan
  const pluginSlug = session.metadata?.pluginSlug || 'stripe'

  if (!tenantId || !targetPlan) {
    fastify.log.error('Missing tenantId or targetPlan in upgrade webhook metadata', { session })
    return
  }

  // 🔧 获取租户的 Stripe 配置
  let stripeConfig, tenantStripe
  try {
    stripeConfig = await getStripeConfig(tenantId);
    tenantStripe = createStripeInstance(stripeConfig.secretKey);
  } catch (error) {
    fastify.log.error(`Failed to get Stripe config for tenant ${tenantId}:`, error)
    return
  }

  try {
    // 1. 获取插件信息
    const plugin = await fastify.prisma.plugin.findUnique({
      where: { slug: pluginSlug }
    })

    if (!plugin) {
      fastify.log.error(`Plugin not found: ${pluginSlug}`)
      return
    }

    // 🔧 修复：使用subscription_plans表替代plugin.pricing
    const planConfig = await getPlanConfig(plugin.id, targetPlan)

    if (!planConfig) {
      fastify.log.error(`Plan not found: ${targetPlan}`)
      return
    }

    // 2. 获取插件安装记录
    const installation = await fastify.prisma.pluginInstallation.findFirst({
      where: {
        tenantId: tenantId,
        pluginId: plugin.id,
        status: 'ACTIVE'
      }
    })

    if (!installation) {
      fastify.log.error(`Plugin installation not found for tenant ${tenantId}`)
      return
    }

    // 🔧 阶段3优化：不再需要更新configData，统一使用subscription_plans表
    fastify.log.info(`✅ Plan upgraded successfully for tenant ${tenantId}: free → ${targetPlan}`)

    // 4. 创建本地订阅记录并重置使用量（使用事务确保原子性）
    if (session.subscription) {
      try {
        // 获取 Stripe 订阅详情
        const stripeSubscription = await tenantStripe.subscriptions.retrieve(session.subscription)

        // 使用事务确保订阅创建和使用量重置的原子性
        const subscriptionRecord = await fastify.prisma.$transaction(async (tx: any) => {
          // 🔧 修复：由于stripeSubscriptionId不是唯一的（付费计划间升降级复用同一个ID），
          // 不能使用upsert，改用findFirst + update/create的组合

          // 首先查找现有的订阅记录
          let subscription = await tx.subscription.findFirst({
            where: {
              stripeSubscriptionId: session.subscription,
              tenantId: tenantId,
              pluginId: plugin.id
            },
            orderBy: { createdAt: 'desc' }
          })

          if (subscription) {
            // 如果记录已存在（可能由 customer.subscription.created 创建），更新必要字段
            subscription = await tx.subscription.update({
              where: { id: subscription.id },
              data: {
                planId: targetPlan,
                status: stripeSubscription.status,
                stripeItemId: stripeSubscription.items.data[0]?.id || null,
                currentPeriodStart: new Date((stripeSubscription as any).current_period_start * 1000),
                currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000),
                amount: planConfig.amount,
                currency: planConfig.currency || 'USD',
                metadata: JSON.stringify({
                  sessionId: session.id,
                  targetPlan: targetPlan
                }),
                updatedAt: new Date()
              }
            })
          } else {
            // 如果记录不存在，创建新记录
            subscription = await tx.subscription.create({
              data: {
                tenantId: tenantId,
                pluginId: plugin.id,
                planId: targetPlan,
                stripeSubscriptionId: session.subscription,
                stripeItemId: stripeSubscription.items.data[0]?.id || null,
                stripeCustomerId: session.customer,
                status: stripeSubscription.status,
                billingCycle: stripeSubscription.items.data[0]?.plan?.interval || 'month',
                currentPeriodStart: new Date((stripeSubscription as any).current_period_start * 1000),
                currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000),
                amount: planConfig.amount,
                currency: planConfig.currency || 'USD',
                autoRenew: true,
                cancelAtPeriodEnd: false,
                metadata: JSON.stringify({
                  sessionId: session.id,
                  targetPlan: targetPlan
                })
              }
            })
          }

          return subscription
        })

        fastify.log.info(`✅ Subscription record upserted for tenant ${tenantId}: ${session.subscription}`)

        // 🔧 修复：创建升级变更记录
        // 1. 取消所有旧的活跃订阅（不仅仅是Free订阅）
        const oldActiveSubscriptions = await fastify.prisma.subscription.findMany({
          where: {
            tenantId: tenantId,
            pluginId: plugin.id,
            status: 'active',
            id: { not: subscriptionRecord.id } // 排除刚创建的新订阅
          }
        })

        for (const oldSubscription of oldActiveSubscriptions) {
          // 更新旧订阅状态为canceled
          await fastify.prisma.subscription.update({
            where: { id: oldSubscription.id },
            data: {
              status: 'canceled',
              canceledAt: new Date(),
              updatedAt: new Date()
            }
          })

          // 创建订阅取消记录
          await fastify.prisma.subscriptionChange.create({
            data: {
              subscriptionId: oldSubscription.id,
              changeType: 'canceled',
              fromPlanId: oldSubscription.planId,
              toPlanId: oldSubscription.planId,
              fromAmount: oldSubscription.amount,
              toAmount: oldSubscription.amount,
              effectiveDate: new Date(),
              reason: `Canceled due to upgrade to ${targetPlan} plan`,
              initiatedBy: 'tenant'
            }
          })

          fastify.log.info(`✅ Canceled old ${oldSubscription.planId} subscription: ${oldSubscription.id}`)
        }

        // 2. 创建升级变更记录（从任何计划升级到目标计划）
        const fromPlan = oldActiveSubscriptions.length > 0 ? oldActiveSubscriptions[0].planId : 'free'
        const fromAmount = oldActiveSubscriptions.length > 0 ? oldActiveSubscriptions[0].amount : 0

        await fastify.prisma.subscriptionChange.create({
          data: {
            subscriptionId: subscriptionRecord.id,
            changeType: 'upgraded',
            fromPlanId: fromPlan,
            toPlanId: targetPlan,
            fromAmount: fromAmount,
            toAmount: planConfig.amount,
            effectiveDate: new Date(),
            reason: `Upgraded from ${fromPlan} to ${targetPlan} plan via Stripe Checkout`,
            initiatedBy: 'tenant'
          }
        })

        // 3. 创建新订阅的创建记录
        await fastify.prisma.subscriptionChange.create({
          data: {
            subscriptionId: subscriptionRecord.id,
            changeType: 'created',
            fromPlanId: null,
            toPlanId: targetPlan,
            fromAmount: 0,
            toAmount: planConfig.amount,
            effectiveDate: new Date(),
            reason: `Created ${targetPlan} subscription after upgrade from ${fromPlan}`,
            initiatedBy: 'tenant'
          }
        })

        // 5. Reset usage for upgrade (在事务外执行，避免长事务)
        const upgradeType = fromPlan === 'free' ? 'free_to_paid' : 'paid_to_paid'
        await resetPluginUsageForUpgrade(fastify, tenantId, pluginSlug, subscriptionRecord, {
          fromPlan: fromPlan,
          toPlan: targetPlan,
          upgradeType: upgradeType,
          sessionId: session.id
        })
        fastify.log.info(`✅ Usage reset completed for ${fromPlan} → ${targetPlan} upgrade`)

      } catch (error: any) {
        fastify.log.error(`Failed to process subscription and usage reset: ${error.message}`)
        fastify.log.error(`Error details:`, error)
        fastify.log.error(`Subscription ID: ${session.subscription}`)
        fastify.log.error(`Plugin ID: ${plugin.id}`)
        fastify.log.error(`Tenant ID: ${tenantId}`)
        // 抛出错误，让 Stripe 重试 Webhook
        throw error
      }
    }

  } catch (error: any) {
    fastify.log.error(`Failed to process upgrade payment for tenant ${tenantId}:`, {
      error: error.message,
      stack: error.stack,
      tenantId,
      targetPlan,
      sessionId: session.id
    })
    throw error // 让 Stripe 知道处理失败，会重试
  }
}

async function handleSubscriptionCreated(stripeSubscription: any, fastify: any) {
  const tenantId = parseInt(stripeSubscription.metadata?.tenantId)
  const pluginSlug = stripeSubscription.metadata?.pluginSlug
  const planId = stripeSubscription.metadata?.planId

  if (tenantId && pluginSlug && planId) {
    try {
      // 获取插件信息
      const plugin = await fastify.prisma.plugin.findUnique({
        where: { slug: pluginSlug }
      })

      if (!plugin) {
        fastify.log.error(`Plugin not found: ${pluginSlug}`)
        return
      }

      // 🔧 修复：使用subscription_plans表替代plugin.pricing
      const planConfig = await getPlanConfig(plugin.id, planId)
      if (!planConfig) {
        fastify.log.error(`Plan not found: ${planId}`)
        return
      }

      // Delete old canceled subscriptions to avoid unique constraint conflicts
      // Since we removed @@unique([tenantId, pluginId]), we need to clean up old records
      await fastify.prisma.subscription.deleteMany({
        where: {
          tenantId: tenantId,
          pluginId: plugin.id,
          status: 'canceled'
        }
      })

      // 使用 upsert 创建或更新本地订阅记录，避免竞态条件
      // 如果 checkout.session.completed webhook 先到达，记录已存在，则更新
      // 如果 customer.subscription.created webhook 先到达，记录不存在，则创建
      const subscriptionRecord = await fastify.prisma.subscription.upsert({
        where: {
          stripeSubscriptionId: stripeSubscription.id
        },
        update: {
          // 如果记录已存在（可能由 checkout.session.completed 创建），更新必要字段
          status: stripeSubscription.status,
          stripeItemId: stripeSubscription.items.data[0]?.id || null,
          currentPeriodStart: new Date((stripeSubscription as any).current_period_start * 1000),
          currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000),
          updatedAt: new Date()
        },
        create: {
          // 如果记录不存在，创建新记录
          tenantId: tenantId,
          pluginId: plugin.id,
          planId: planId,
          stripeSubscriptionId: stripeSubscription.id,
          stripeItemId: stripeSubscription.items.data[0]?.id || null,
          stripeCustomerId: stripeSubscription.customer,
          status: stripeSubscription.status,
          billingCycle: stripeSubscription.items.data[0]?.plan?.interval || 'month',
          currentPeriodStart: new Date((stripeSubscription as any).current_period_start * 1000),
          currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000),
          amount: planConfig.amount || 0,
          currency: planConfig.currency || 'USD',
          autoRenew: true,
          cancelAtPeriodEnd: false,
          metadata: JSON.stringify({
            source: 'stripe_webhook',
            eventType: 'customer.subscription.created'
          })
        }
      })

      fastify.log.info(`✅ Subscription upserted via webhook: ${stripeSubscription.id}`)
    } catch (error) {
      fastify.log.error('Failed to handle subscription created:', error)
      // 抛出错误，让 Stripe 重试 Webhook
      throw error
    }
  }
}

async function handleSubscriptionUpdated(stripeSubscription: any, fastify: any) {
  try {
    const localSubscription = await fastify.prisma.subscription.findFirst({
      where: {
        stripeSubscriptionId: stripeSubscription.id
      },
      include: {
        plugin: true
      }
    })

    if (localSubscription) {
      // Detect if this is a plan change (upgrade or paid plan downgrade)
      const oldPlanId = localSubscription.planId
      const newPlanId = stripeSubscription.metadata?.targetPlan || oldPlanId

      const isUpgrade = (
        newPlanId !== oldPlanId &&
        stripeSubscription.metadata?.upgradeType === 'proration'
      )

      const isPaidPlanDowngrade = (
        newPlanId !== oldPlanId &&
        stripeSubscription.metadata?.downgradeType === 'paid_to_paid'
      )

      const isPlanChange = isUpgrade || isPaidPlanDowngrade

      if (isPlanChange) {
        // 🔧 修复：检查是否已经有目标计划的订阅记录存在
        // 如果前端已经处理过计划变更，就不要重复创建
        // 检查任何状态的目标订阅记录，不仅仅是 active
        const existingTargetSubscription = await fastify.prisma.subscription.findFirst({
          where: {
            tenantId: localSubscription.tenantId,
            pluginId: localSubscription.pluginId,
            planId: newPlanId,
            stripeSubscriptionId: stripeSubscription.id
          }
        })

        if (existingTargetSubscription) {
          const changeType = isUpgrade ? 'upgrade' : 'downgrade'
          fastify.log.info(`🔄 Plan ${changeType} already processed by frontend: ${oldPlanId} → ${newPlanId}, skipping webhook processing`)

          // 只更新现有订阅的状态和时间信息，不创建新记录
          await fastify.updateSubscription(existingTargetSubscription.id, {
            status: stripeSubscription.status,
            currentPeriodStart: new Date((stripeSubscription as any).current_period_start * 1000),
            currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000),
            cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
            canceledAt: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000) : null,
            eventSource: 'stripe',
            initiatedBy: 'stripe'
          })

          return
        }

        // 如果没有找到目标订阅，说明是纯 webhook 触发的计划变更
        const changeType = isUpgrade ? 'upgrade' : 'downgrade'
        fastify.log.info(`🔄 Processing plan ${changeType} via webhook: ${oldPlanId} → ${newPlanId}`)

        // 1. 将现有订阅标记为canceled，但保持原有planId
        await fastify.updateSubscription(localSubscription.id, {
          status: 'canceled',
          canceledAt: new Date(),
          eventSource: 'stripe',
          initiatedBy: 'stripe'
        })

        // 2. 获取目标计划配置
        const targetPlanConfig = await fastify.prisma.subscriptionPlan.findFirst({
          where: {
            pluginId: localSubscription.pluginId,
            planId: newPlanId,
            isActive: true
          }
        })

        if (!targetPlanConfig) {
          fastify.log.error(`Target plan ${newPlanId} not found for plugin ${localSubscription.pluginId}`)
          return
        }

        // 3. 创建新的订阅记录
        const newSubscription = await fastify.prisma.subscription.create({
          data: {
            tenantId: localSubscription.tenantId,
            pluginId: localSubscription.pluginId,
            planId: newPlanId,
            stripeSubscriptionId: stripeSubscription.id, // 同一个Stripe订阅ID
            stripeItemId: stripeSubscription.items.data[0].id,
            stripeCustomerId: localSubscription.stripeCustomerId,
            status: stripeSubscription.status,
            billingCycle: 'monthly',
            currentPeriodStart: new Date((stripeSubscription as any).current_period_start * 1000),
            currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000),
            amount: targetPlanConfig.amount,
            currency: targetPlanConfig.currency,
            autoRenew: true,
            metadata: JSON.stringify({
              upgradedFrom: oldPlanId,
              originalSubscriptionId: localSubscription.id,
              upgradedAt: new Date().toISOString(),
              changeType: 'proration_upgrade_via_webhook'
            })
          }
        })

        // 4. 创建使用量记录
        await resetPluginUsageForUpgrade(
          fastify,
          localSubscription.tenantId,
          localSubscription.plugin.slug,
          newSubscription,
          {
            fromPlan: oldPlanId,
            toPlan: newPlanId,
            upgradeType: 'paid_to_paid'
          }
        )

        // 5. 记录订阅变更
        const changeTypeForRecord = isUpgrade ? 'upgraded' : 'downgraded'
        const reasonPrefix = isUpgrade ? 'upgrade' : 'downgrade'

        await fastify.prisma.subscriptionChange.create({
          data: {
            subscriptionId: newSubscription.id,
            changeType: changeTypeForRecord,
            fromPlanId: oldPlanId,
            toPlanId: newPlanId,
            fromAmount: localSubscription.amount,
            toAmount: targetPlanConfig.amount,
            effectiveDate: new Date(),
            reason: `proration_${reasonPrefix}_via_webhook`,
            initiatedBy: 'stripe'
          }
        })

        fastify.log.info(`✅ Subscription ${changeType}d via webhook: ${oldPlanId} → ${newPlanId}`)
      } else {
        // 非升级的普通更新，只更新状态和时间信息，不修改planId
        await fastify.updateSubscription(localSubscription.id, {
          status: stripeSubscription.status,
          currentPeriodStart: new Date((stripeSubscription as any).current_period_start * 1000),
          currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000),
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          canceledAt: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000) : null,
          eventSource: 'stripe',
          initiatedBy: 'stripe'
        })

        fastify.log.info(`Subscription updated: ${stripeSubscription.id}`)
      }
    }
  } catch (error) {
    fastify.log.error('Failed to handle subscription updated:', error)
    throw error
  }
}

async function handleSubscriptionDeleted(stripeSubscription: any, fastify: any) {
  try {
    fastify.log.info(`🗑️ Processing subscription deletion: ${stripeSubscription.id}`)

    // 🔧 简化逻辑：只查找活跃的订阅记录
    const localSubscription = await fastify.prisma.subscription.findFirst({
      where: {
        stripeSubscriptionId: stripeSubscription.id,
        status: 'active' // 只处理活跃的订阅
      },
      include: {
        plugin: true
      },
      orderBy: { createdAt: 'desc' }
    })

    if (!localSubscription) {
      fastify.log.warn(`⚠️ No active subscription found for Stripe ID: ${stripeSubscription.id}`)
      return
    }

    const previousPlan = localSubscription.planId
    fastify.log.info(`📋 Processing Free downgrade: ${previousPlan} → free (tenant: ${localSubscription.tenantId})`)

    // 🔧 检查是否已经存在活跃的Free订阅，避免重复创建
    const existingFreeSubscription = await fastify.prisma.subscription.findFirst({
      where: {
        tenantId: localSubscription.tenantId,
        pluginId: localSubscription.pluginId,
        planId: 'free',
        status: 'active'
      }
    })

    if (existingFreeSubscription) {
      fastify.log.info(`✅ Free subscription already exists: ${existingFreeSubscription.id}, skipping creation`)
    } else {
      // 创建新的Free订阅记录（无Stripe关联）
      const newFreeSubscription = await fastify.prisma.subscription.create({
        data: {
          tenantId: localSubscription.tenantId,
          pluginId: localSubscription.pluginId,
          planId: 'free',
          stripeSubscriptionId: null, // Free计划没有Stripe订阅
          stripeItemId: null,
          stripeCustomerId: localSubscription.stripeCustomerId,
          status: 'active',
          billingCycle: 'monthly',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30天后
          amount: 0,
          currency: 'USD',
          autoRenew: true,
          metadata: JSON.stringify({
            downgradedFrom: previousPlan,
            originalSubscriptionId: localSubscription.id,
            downgradedAt: new Date().toISOString(),
            changeType: 'downgrade_to_free'
          })
        }
      })

      // 创建新订阅的创建记录
      await fastify.prisma.subscriptionChange.create({
        data: {
          subscriptionId: newFreeSubscription.id,
          changeType: 'created',
          fromPlanId: null,
          toPlanId: 'free',
          fromAmount: 0,
          toAmount: 0,
          effectiveDate: new Date(),
          reason: `Free subscription created after downgrade from ${previousPlan}`,
          initiatedBy: 'system'
        }
      })

      fastify.log.info(`✅ Free subscription created: ${newFreeSubscription.id}`)

      // 🔑 为Free计划创建使用量记录
      const startDate = newFreeSubscription.currentPeriodStart.toISOString().split('T')[0]
      const newPeriod = `${newFreeSubscription.id}:${startDate}`

      // 为Free订阅创建使用量记录（需要手动生成UUID）
      const { randomUUID } = await import('crypto')
      await fastify.prisma.pluginUsage.createMany({
        data: [
          {
            id: randomUUID(),
            tenantId: localSubscription.tenantId,
            pluginSlug: localSubscription.plugin.slug,
            metricName: 'transactions',
            value: 0,
            period: newPeriod
          },
          {
            id: randomUUID(),
            tenantId: localSubscription.tenantId,
            pluginSlug: localSubscription.plugin.slug,
            metricName: 'api_calls',
            value: 0,
            period: newPeriod
          }
        ],
        skipDuplicates: true
      })

      fastify.log.info(`✅ Usage records created for Free subscription: ${newFreeSubscription.id}`)
    }

    // 更新订阅状态（updateSubscription会自动创建变更记录，无需手动创建）
    await fastify.updateSubscription(localSubscription.id, {
      status: 'canceled',
      canceledAt: new Date(),
      eventSource: 'stripe',
      initiatedBy: 'stripe'
    })

    fastify.log.info(`✅ Subscription deleted: ${stripeSubscription.id}`)
  } catch (error) {
    fastify.log.error('Failed to handle subscription deleted:', error)
  }
}

async function handleInvoicePaymentSucceeded(invoice: any, fastify: any) {
  try {
    const subscriptionId = invoice.subscription
    if (subscriptionId) {
      // 🔧 先查找本地订阅记录以获取 tenantId
      const localSubscription = await fastify.prisma.subscription.findFirst({
        where: {
          stripeSubscriptionId: subscriptionId
        },
        include: {
          plugin: true
        }
      })

      if (!localSubscription) {
        fastify.log.warn(`Local subscription not found for Stripe subscription ${subscriptionId}`)
        return
      }

      // 🔧 获取租户的 Stripe 配置
      let stripeConfig, tenantStripe
      try {
        stripeConfig = await getStripeConfig(localSubscription.tenantId);
        tenantStripe = createStripeInstance(stripeConfig.secretKey);
      } catch (error) {
        fastify.log.error(`Failed to get Stripe config for tenant ${localSubscription.tenantId}:`, error)
        return
      }

      // 获取Stripe订阅的最新信息
      const stripeSubscription = await tenantStripe.subscriptions.retrieve(subscriptionId)

      if (localSubscription) {
        // 🔧 修复：区分初始订阅创建和真正的续费
        const now = new Date()
        const subscriptionAge = now.getTime() - localSubscription.createdAt.getTime()
        const fiveMinutesInMs = 5 * 60 * 1000 // 5分钟

        // 如果订阅是最近创建的（5分钟内），这可能是初始订阅创建，不是续费
        if (subscriptionAge < fiveMinutesInMs) {
          fastify.log.info(`⏭️ Skipping renewal for recently created subscription: ${localSubscription.planId} (${localSubscription.id}), age: ${Math.round(subscriptionAge / 1000)}s`)

          // 只更新发票记录，不执行续费逻辑
          if (invoice.id) {
            await fastify.prisma.subscriptionInvoice.upsert({
              where: {
                stripeInvoiceId: invoice.id
              },
              update: {
                status: 'paid',
                paidAt: new Date(invoice.status_transitions?.paid_at * 1000 || Date.now())
              },
              create: {
                subscriptionId: localSubscription.id,
                stripeInvoiceId: invoice.id,
                invoiceNumber: invoice.number || `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                amount: invoice.amount_paid / 100,
                totalAmount: invoice.amount_paid / 100,
                currency: invoice.currency,
                status: 'paid',
                periodStart: new Date(invoice.period_start * 1000),
                periodEnd: new Date(invoice.period_end * 1000),
                issueDate: new Date(invoice.created * 1000),
                paidAt: new Date(invoice.status_transitions?.paid_at * 1000 || Date.now()),
                paymentMethod: 'stripe',
                lineItems: JSON.stringify(invoice.lines.data.map((line: any) => ({
                  description: line.description,
                  quantity: line.quantity,
                  unitPrice: line.price.unit_amount / 100,
                  amount: line.amount / 100
                })))
              }
            })
          }
          return
        }

        fastify.log.info(`🔄 Processing subscription renewal: ${localSubscription.planId} (${localSubscription.id})`)

        // 🆕 方案B：创建新订阅模式
        // 1. 标记旧订阅为完成
        await fastify.updateSubscription(localSubscription.id, {
          status: 'canceled',
          canceledAt: new Date(),
          eventSource: 'stripe',
          initiatedBy: 'stripe',
          reason: 'Subscription cycle completed - renewed to new cycle'
        })

        // 2. 创建新订阅周期（相同计划）
        const newSubscription = await fastify.createSubscription(
          localSubscription.tenantId,
          localSubscription.plugin.slug,
          localSubscription.planId, // 相同计划
          {
            stripeSubscriptionId: stripeSubscription.id,
            stripeCustomerId: localSubscription.stripeCustomerId,
            autoRenew: localSubscription.autoRenew,
            eventSource: 'stripe',
            initiatedBy: 'stripe',
            reason: 'Subscription renewed - new billing cycle',
            metadata: {
              previousSubscriptionId: localSubscription.id,
              renewalType: 'automatic',
              renewedAt: new Date().toISOString(),
              invoiceId: invoice.id
            }
          }
        )

        // 3. 记录续费变更
        await fastify.prisma.subscriptionChange.create({
          data: {
            subscriptionId: newSubscription.id,
            changeType: 'renewed',
            fromPlanId: localSubscription.planId,
            toPlanId: localSubscription.planId,
            fromAmount: localSubscription.amount,
            toAmount: localSubscription.amount,
            effectiveDate: new Date(),
            reason: 'Automatic subscription renewal',
            initiatedBy: 'stripe'
          }
        })

        // 4. 创建或更新发票记录（关联到新订阅）
        await fastify.prisma.subscriptionInvoice.upsert({
          where: {
            stripeInvoiceId: invoice.id
          },
          update: {
            subscriptionId: newSubscription.id, // 关联到新订阅
            status: 'paid',
            paidAt: new Date(invoice.status_transitions.paid_at * 1000),
            paymentMethod: 'stripe'
          },
          create: {
            subscriptionId: newSubscription.id, // 关联到新订阅
            stripeInvoiceId: invoice.id,
            invoiceNumber: `INV-${invoice.number}`,
            amount: invoice.amount_due / 100,
            taxAmount: (invoice.tax || 0) / 100,
            totalAmount: invoice.total / 100,
            currency: invoice.currency.toUpperCase(),
            status: 'paid',
            periodStart: new Date(invoice.period_start * 1000),
            periodEnd: new Date(invoice.period_end * 1000),
            issueDate: new Date(invoice.created * 1000),
            paidAt: new Date(invoice.status_transitions.paid_at * 1000),
            paymentMethod: 'stripe',
            lineItems: JSON.stringify(invoice.lines.data.map((line: any) => ({
              description: line.description,
              quantity: line.quantity,
              unitPrice: line.price.unit_amount / 100,
              amount: line.amount / 100
            })))
          }
        })

        fastify.log.info(`✅ Subscription renewed successfully: ${localSubscription.id} → ${newSubscription.id}`)
        fastify.log.info(`Invoice payment succeeded: ${invoice.id}`)
      }
    }
  } catch (error) {
    fastify.log.error('Failed to handle invoice payment succeeded:', error)
    // 抛出错误，让 Stripe 重试 Webhook
    throw error
  }
}

async function handleInvoicePaymentFailed(invoice: any, fastify: any) {
  try {
    const subscriptionId = invoice.subscription
    if (subscriptionId) {
      const localSubscription = await fastify.prisma.subscription.findFirst({
        where: {
          stripeSubscriptionId: subscriptionId
        }
      })

      if (localSubscription) {
        // 更新订阅状态为逾期
        await fastify.updateSubscription(localSubscription.id, {
          status: 'past_due',
          eventSource: 'stripe',
          initiatedBy: 'stripe'
        })

        // 更新发票状态
        await fastify.prisma.subscriptionInvoice.upsert({
          where: {
            stripeInvoiceId: invoice.id
          },
          update: {
            status: 'payment_failed'
          },
          create: {
            subscriptionId: localSubscription.id,
            stripeInvoiceId: invoice.id,
            invoiceNumber: `INV-${invoice.number}`,
            amount: invoice.amount_due / 100,
            taxAmount: (invoice.tax || 0) / 100,
            totalAmount: invoice.total / 100,
            currency: invoice.currency.toUpperCase(),
            status: 'payment_failed',
            periodStart: new Date(invoice.period_start * 1000),
            periodEnd: new Date(invoice.period_end * 1000),
            issueDate: new Date(invoice.created * 1000),
            dueDate: new Date(invoice.due_date * 1000),
            paymentMethod: 'stripe',
            lineItems: JSON.stringify(invoice.lines.data.map((line: any) => ({
              description: line.description,
              quantity: line.quantity,
              unitPrice: line.price.unit_amount / 100,
              amount: line.amount / 100
            })))
          }
        })

        fastify.log.info(`Invoice payment failed: ${invoice.id}`)
      }
    }
  } catch (error) {
    fastify.log.error('Failed to handle invoice payment failed:', error)
  }
}

async function handleInvoiceCreated(invoice: any, fastify: any) {
  try {
    const subscriptionId = invoice.subscription
    if (subscriptionId) {
      const localSubscription = await fastify.prisma.subscription.findFirst({
        where: {
          stripeSubscriptionId: subscriptionId
        }
      })

      if (localSubscription) {
        // 创建发票记录
        await fastify.prisma.subscriptionInvoice.upsert({
          where: {
            stripeInvoiceId: invoice.id
          },
          update: {
            status: invoice.status,
            dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null
          },
          create: {
            subscriptionId: localSubscription.id,
            stripeInvoiceId: invoice.id,
            invoiceNumber: `INV-${invoice.number || Date.now()}`,
            amount: invoice.amount_due / 100,
            taxAmount: (invoice.tax || 0) / 100,
            totalAmount: invoice.total / 100,
            currency: invoice.currency.toUpperCase(),
            status: invoice.status,
            periodStart: new Date(invoice.period_start * 1000),
            periodEnd: new Date(invoice.period_end * 1000),
            issueDate: new Date(invoice.created * 1000),
            dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
            paymentMethod: 'stripe',
            lineItems: JSON.stringify(invoice.lines.data.map((line: any) => ({
              description: line.description,
              quantity: line.quantity,
              unitPrice: line.price.unit_amount / 100,
              amount: line.amount / 100
            })))
          }
        })

        fastify.log.info(`Invoice created: ${invoice.id}`)
      }
    }
  } catch (error) {
    fastify.log.error('Failed to handle invoice created:', error)
  }
}

async function handlePaymentMethodAttached(paymentMethod: any, fastify: any) {
  try {
    fastify.log.info(`Payment method attached: ${paymentMethod.id} to customer ${paymentMethod.customer}`)

    // 更新客户的默认支付方式
    const subscriptions = await fastify.prisma.subscription.findMany({
      where: {
        stripeCustomerId: paymentMethod.customer,
        status: { in: ['active', 'trialing', 'past_due'] }
      }
    })

    // 记录支付方式变更事件
    for (const subscription of subscriptions) {
      await fastify.prisma.subscriptionEvent.create({
        data: {
          subscriptionId: subscription.id,
          eventType: 'payment_method_updated',
          eventSource: 'stripe',
          eventData: JSON.stringify({
            paymentMethodId: paymentMethod.id,
            paymentMethodType: paymentMethod.type,
            customerId: paymentMethod.customer
          }),
          processingStatus: 'processed',
          processedAt: new Date()
        }
      })
    }
  } catch (error) {
    fastify.log.error('Failed to handle payment method attached:', error)
  }
}

// ============================================
// 🆕 Webhook错误恢复和重试机制
// ============================================

// 装饰器：重试失败的webhook事件
fastify.decorate('retryFailedWebhookEvents', async function (maxRetries: number = 3) {
  try {
    const failedEvents = await fastify.prisma.subscriptionEvent.findMany({
      where: {
        processingStatus: 'failed',
        retryCount: { lt: maxRetries }
      },
      orderBy: { createdAt: 'asc' },
      take: 50 // 一次处理50个失败事件
    })

    fastify.log.info(`🔄 Retrying ${failedEvents.length} failed webhook events`)

    let successCount = 0
    let failCount = 0

    for (const event of failedEvents) {
      try {
        const eventData = JSON.parse(event.eventData)

        // 重新处理事件
        await fastify.handleSubscriptionEvent(
          event.eventType,
          eventData,
          event.subscriptionId
        )

        // 标记为成功
        await fastify.prisma.subscriptionEvent.update({
          where: { id: event.id },
          data: {
            processingStatus: 'processed',
            processedAt: new Date(),
            retryCount: (event.retryCount || 0) + 1,
            errorMessage: null
          }
        })

        successCount++
      } catch (error) {
        // 增加重试次数
        await fastify.prisma.subscriptionEvent.update({
          where: { id: event.id },
          data: {
            retryCount: (event.retryCount || 0) + 1,
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
            // 注意：lastRetryAt 字段不存在于 schema 中，已移除
          }
        })

        failCount++
        fastify.log.error(`Failed to retry event ${event.id}:`, error)
      }
    }

    fastify.log.info(`✅ Webhook retry completed: ${successCount} successful, ${failCount} failed`)
    return { successCount, failCount, totalProcessed: failedEvents.length }
  } catch (error) {
    fastify.log.error('Failed to retry webhook events:', error)
    throw error
  }
})

// 装饰器：清理旧的webhook事件
fastify.decorate('cleanupOldWebhookEvents', async function (daysToKeep: number = 30) {
  try {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    const deletedCount = await fastify.prisma.subscriptionEvent.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
        processingStatus: 'processed'
      }
    })

    fastify.log.info(`🧹 Cleaned up ${deletedCount.count} old webhook events`)
    return { deletedCount: deletedCount.count }
  } catch (error) {
    fastify.log.error('Failed to cleanup old webhook events:', error)
    throw error
  }
})

// 装饰器：获取webhook统计信息
fastify.decorate('getWebhookStats', async function (days: number = 7) {
  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const stats = await fastify.prisma.subscriptionEvent.groupBy({
      by: ['eventType', 'processingStatus'],
      where: {
        createdAt: { gte: startDate }
      },
      _count: true
    })

    const summary = {
      totalEvents: 0,
      processedEvents: 0,
      failedEvents: 0,
      pendingEvents: 0,
      eventTypes: {} as Record<string, number>
    }

    for (const stat of stats) {
      summary.totalEvents += stat._count

      if (stat.processingStatus === 'processed') {
        summary.processedEvents += stat._count
      } else if (stat.processingStatus === 'failed') {
        summary.failedEvents += stat._count
      } else if (stat.processingStatus === 'pending') {
        summary.pendingEvents += stat._count
      }

      summary.eventTypes[stat.eventType] = (summary.eventTypes[stat.eventType] || 0) + stat._count
    }

    return summary
  } catch (error) {
    fastify.log.error('Failed to get webhook stats:', error)
    throw error
  }
})

// ============================================
// 商业化版本功能 - 需要付费计划
// ============================================

// ============================================
// 🆕 完整的订阅管理API
// ============================================

// 创建订阅
fastify.post('/subscriptions', {
  schema: {
    hide: true,
    tags: ['plugins', 'stripe'],
    summary: 'Create subscription',
    body: {
      type: 'object',
      properties: {
        planId: { type: 'string' },
        customerId: { type: 'string' },
        trialDays: { type: 'number' },
        paymentMethodId: { type: 'string' },
        metadata: { type: 'object', additionalProperties: true }
      },
      required: ['planId']
    },
    response: {
      200: {
        type: 'object',
        additionalProperties: true
      },
      '4xx': { type: 'object', additionalProperties: true },
      '5xx': { type: 'object', additionalProperties: true }
    }
  },
  preHandler: async (request: any, reply: any) => {
    // API 调用次数限制检查
    const apiCallCheck = await fastify.checkUsageLimit(
      request.tenant.id,
      'stripe',
      'api_calls'
    )

    if (!apiCallCheck.allowed) {
      return reply.status(429).send({
        error: 'API call limit exceeded',
        current: apiCallCheck.current,
        limit: apiCallCheck.limit,
        percentage: apiCallCheck.percentage,
        upgradeUrl: `/plugins/stripe/upgrade`
      })
    }

    // 记录 API 调用次数
    await fastify.recordPluginUsage(request.tenant.id, 'stripe', 'api_calls')

    const subscriptionCheck = await fastify.checkSubscriptionAccess(
      request.tenant.id,
      'stripe',
      'subscriptions'
    )

    if (!subscriptionCheck.allowed) {
      return reply.status(402).send({
        error: 'Subscription required',
        reason: subscriptionCheck.reason,
        upgradeUrl: subscriptionCheck.upgradeUrl
      })
    }

    await fastify.recordPluginUsage(request.tenant.id, 'stripe', 'subscriptions')
  }
}, async (request: any, reply: any) => {
  const { planId, customerId, trialDays, paymentMethodId, metadata } = request.body

  try {
    // 🔧 获取租户的 Stripe 配置
    const stripeConfig = await getStripeConfig(request.tenant.id);
    const stripe = createStripeInstance(stripeConfig.secretKey);

    // 获取订阅计划
    const plugin = await fastify.prisma.plugin.findUnique({
      where: { slug: 'stripe' }
    })

    const subscriptionPlan = await fastify.prisma.subscriptionPlan.findUnique({
      where: {
        pluginId_planId: {
          pluginId: plugin.id,
          planId
        }
      }
    })

    if (!subscriptionPlan) {
      return reply.status(400).send({ error: 'Subscription plan not found' })
    }

    // 创建或获取Stripe客户
    let stripeCustomerId = customerId
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: request.tenant.contactEmail,
        name: request.tenant.companyName,
        metadata: {
          tenantId: request.tenant.id.toString(),
          pluginSlug: 'stripe'
        }
      })
      stripeCustomerId = customer.id
    }

    // 如果提供了支付方式，附加到客户
    if (paymentMethodId) {
      await stripe.paymentMethods.attach(paymentMethodId, {
        customer: stripeCustomerId
      })

      await stripe.customers.update(stripeCustomerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId
        }
      })
    }

    // 创建Stripe价格（如果不存在）
    const stripePriceId = `price_${plugin.id}_${planId}`
    let stripePrice
    try {
      stripePrice = await stripe.prices.retrieve(stripePriceId)
    } catch {
      // 价格不存在，创建新的
      const stripeProduct = await stripe.products.create({
        id: `prod_${plugin.id}`,
        name: plugin.name,
        description: plugin.description
      })

      stripePrice = await stripe.prices.create({
        // id: stripePriceId, // Stripe会自动生成ID
        product: stripeProduct.id,
        unit_amount: Math.round(subscriptionPlan.amount * 100),
        currency: subscriptionPlan.currency.toLowerCase(),
        recurring: {
          interval: subscriptionPlan.billingCycle === 'yearly' ? 'year' : 'month'
        }
      })
    }

    // 创建Stripe订阅
    const stripeSubscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: stripePrice.id }],
      trial_period_days: trialDays || subscriptionPlan.trialDays,
      metadata: {
        tenantId: request.tenant.id.toString(),
        pluginSlug: 'stripe',
        planId,
        ...metadata
      }
    })

    // 创建本地订阅记录
    const localSubscription = await fastify.createSubscription(
      request.tenant.id,
      'stripe',
      planId,
      {
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId,
        trialDays: trialDays || subscriptionPlan.trialDays,
        initiatedBy: 'tenant',
        eventSource: 'stripe',
        metadata: {
          stripeSubscriptionId: stripeSubscription.id,
          stripeCustomerId,
          ...metadata
        }
      }
    )

    return {
      success: true,
      subscription: {
        id: localSubscription.id,
        stripeSubscriptionId: stripeSubscription.id,
        status: stripeSubscription.status,
        planId,
        amount: subscriptionPlan.amount,
        currency: subscriptionPlan.currency,
        currentPeriodStart: new Date((stripeSubscription as any).current_period_start * 1000),
        currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000),
        trialEnd: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null
      }
    }
  } catch (error) {
    fastify.log.error('Subscription creation failed:', error)
    return reply.status(500).send({
      error: 'Failed to create subscription',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// 获取订阅详情
fastify.get('/subscriptions/:id', {
  schema: {
    hide: true,
    tags: ['plugins', 'stripe'],
    summary: 'Get subscription details',
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
        additionalProperties: true
      },
      '4xx': { type: 'object', additionalProperties: true },
      '5xx': { type: 'object', additionalProperties: true }
    }
  },
  preHandler: async (request: any, reply: any) => {
    // API 调用次数限制检查
    const apiCallCheck = await fastify.checkUsageLimit(
      request.tenant.id,
      'stripe',
      'api_calls'
    )

    if (!apiCallCheck.allowed) {
      return reply.status(429).send({
        error: 'API call limit exceeded',
        current: apiCallCheck.current,
        limit: apiCallCheck.limit,
        percentage: apiCallCheck.percentage,
        upgradeUrl: `/plugins/stripe/upgrade`
      })
    }

    // 记录 API 调用次数
    await fastify.recordPluginUsage(request.tenant.id, 'stripe', 'api_calls')

    const subscriptionCheck = await fastify.checkSubscriptionAccess(
      request.tenant.id,
      'stripe'
    )

    if (!subscriptionCheck.allowed) {
      return reply.status(402).send({
        error: 'Subscription required',
        reason: subscriptionCheck.reason,
        upgradeUrl: subscriptionCheck.upgradeUrl
      })
    }
  }
}, async (request: any, reply: any) => {
  const { id } = request.params

  try {
    // 🔧 获取租户的 Stripe 配置
    const stripeConfig = await getStripeConfig(request.tenant.id);
    const stripe = createStripeInstance(stripeConfig.secretKey);

    const subscription = await fastify.prisma.subscription.findUnique({
      where: { id },
      include: {
        plugin: true,
        tenant: true,
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 10
        },
        changes: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    })

    if (!subscription || subscription.tenantId !== request.tenant.id) {
      return reply.status(404).send({ error: 'Subscription not found' })
    }

    // 同步Stripe订阅状态
    if (subscription.stripeSubscriptionId) {
      try {
        const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId)

        // 如果状态不同步，更新本地状态
        if (stripeSubscription.status !== subscription.status) {
          await fastify.updateSubscription(subscription.id, {
            status: stripeSubscription.status,
            currentPeriodStart: new Date((stripeSubscription as any).current_period_start * 1000),
            currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000),
            eventSource: 'stripe_sync'
          })
        }
      } catch (error) {
        fastify.log.warn('Failed to sync Stripe subscription:', error)
      }
    }

    return {
      success: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        planId: subscription.planId,
        amount: subscription.amount,
        currency: subscription.currency,
        billingCycle: subscription.billingCycle,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        trialStart: subscription.trialStart,
        trialEnd: subscription.trialEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        canceledAt: subscription.canceledAt,
        autoRenew: subscription.autoRenew,
        plugin: {
          name: subscription.plugin.name,
          slug: subscription.plugin.slug
        },
        recentInvoices: subscription.invoices,
        recentChanges: subscription.changes
      }
    }
  } catch (error) {
    fastify.log.error('Failed to get subscription:', error)
    return reply.status(500).send({ error: 'Failed to get subscription' })
  }
})

// 更新订阅（升级/降级）
fastify.put('/subscriptions/:id', {
  schema: {
    hide: true,
    tags: ['plugins', 'stripe'],
    summary: 'Update subscription',
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string' }
      }
    },
    body: {
      type: 'object',
      properties: {
        planId: { type: 'string' },
        prorationBehavior: { type: 'string' }
      }
    },
    response: {
      200: {
        type: 'object',
        additionalProperties: true
      },
      '4xx': { type: 'object', additionalProperties: true },
      '5xx': { type: 'object', additionalProperties: true }
    }
  },
  preHandler: async (request: any, reply: any) => {
    // API 调用次数限制检查
    const apiCallCheck = await fastify.checkUsageLimit(
      request.tenant.id,
      'stripe',
      'api_calls'
    )

    if (!apiCallCheck.allowed) {
      return reply.status(429).send({
        error: 'API call limit exceeded',
        current: apiCallCheck.current,
        limit: apiCallCheck.limit,
        percentage: apiCallCheck.percentage,
        upgradeUrl: `/plugins/stripe/upgrade`
      })
    }

    // 记录 API 调用次数
    await fastify.recordPluginUsage(request.tenant.id, 'stripe', 'api_calls')

    const subscriptionCheck = await fastify.checkSubscriptionAccess(
      request.tenant.id,
      'stripe',
      'subscriptions'
    )

    if (!subscriptionCheck.allowed) {
      return reply.status(402).send({
        error: 'Subscription required',
        reason: subscriptionCheck.reason,
        upgradeUrl: subscriptionCheck.upgradeUrl
      })
    }
  }
}, async (request: any, reply: any) => {
  const { id } = request.params
  const { planId, prorationBehavior = 'create_prorations' } = request.body

  try {
    // 🔧 获取租户的 Stripe 配置
    const stripeConfig = await getStripeConfig(request.tenant.id);
    const stripe = createStripeInstance(stripeConfig.secretKey);

    const subscription = await fastify.prisma.subscription.findUnique({
      where: { id },
      include: { plugin: true }
    })

    if (!subscription || subscription.tenantId !== request.tenant.id) {
      return reply.status(404).send({ error: 'Subscription not found' })
    }

    if (!subscription.stripeSubscriptionId) {
      return reply.status(400).send({ error: 'Stripe subscription not found' })
    }

    // 获取新的订阅计划
    const newPlan = await fastify.prisma.subscriptionPlan.findUnique({
      where: {
        pluginId_planId: {
          pluginId: subscription.plugin.id,
          planId
        }
      }
    })

    if (!newPlan) {
      return reply.status(400).send({ error: 'Subscription plan not found' })
    }

    // 创建或获取Stripe价格
    const stripePriceId = `price_${subscription.plugin.id}_${planId}`
    let stripePrice
    try {
      stripePrice = await stripe.prices.retrieve(stripePriceId)
    } catch {
      // 价格不存在，创建新的
      stripePrice = await stripe.prices.create({
        // id: stripePriceId, // Stripe会自动生成ID
        product: `prod_${subscription.plugin.id}`,
        unit_amount: Math.round(newPlan.amount * 100),
        currency: newPlan.currency.toLowerCase(),
        recurring: {
          interval: newPlan.billingCycle === 'yearly' ? 'year' : 'month'
        }
      })
    }

    // 更新Stripe订阅
    const stripeSubscription = await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      items: [{
        id: (await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId)).items.data[0].id,
        price: stripePrice.id
      }],
      proration_behavior: prorationBehavior
    })

    // 更新本地订阅
    const updatedSubscription = await fastify.updateSubscription(subscription.id, {
      planId,
      amount: newPlan.amount,
      currency: newPlan.currency,
      billingCycle: newPlan.billingCycle,
      currentPeriodStart: new Date((stripeSubscription as any).current_period_start * 1000),
      currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000),
      reason: `Plan changed from ${subscription.planId} to ${planId}`,
      initiatedBy: 'tenant',
      eventSource: 'stripe'
    })

    return {
      success: true,
      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        planId: updatedSubscription.planId,
        amount: updatedSubscription.amount,
        currency: updatedSubscription.currency,
        currentPeriodStart: updatedSubscription.currentPeriodStart,
        currentPeriodEnd: updatedSubscription.currentPeriodEnd
      }
    }
  } catch (error) {
    fastify.log.error('Failed to update subscription:', error)
    return reply.status(500).send({
      error: 'Failed to update subscription',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// 取消订阅
fastify.delete('/subscriptions/:id', {
  schema: {
    hide: true,
    tags: ['plugins', 'stripe'],
    summary: 'Cancel subscription',
    params: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string' }
      }
    },
    body: {
      type: 'object',
      properties: {
        cancelAtPeriodEnd: { type: 'boolean' },
        reason: { type: 'string' }
      }
    },
    response: {
      200: {
        type: 'object',
        additionalProperties: true
      },
      '4xx': { type: 'object', additionalProperties: true },
      '5xx': { type: 'object', additionalProperties: true }
    }
  },
  preHandler: async (request: any, reply: any) => {
    // API 调用次数限制检查
    const apiCallCheck = await fastify.checkUsageLimit(
      request.tenant.id,
      'stripe',
      'api_calls'
    )

    if (!apiCallCheck.allowed) {
      return reply.status(429).send({
        error: 'API call limit exceeded',
        current: apiCallCheck.current,
        limit: apiCallCheck.limit,
        percentage: apiCallCheck.percentage,
        upgradeUrl: `/plugins/stripe/upgrade`
      })
    }

    // 记录 API 调用次数
    await fastify.recordPluginUsage(request.tenant.id, 'stripe', 'api_calls')

    const subscriptionCheck = await fastify.checkSubscriptionAccess(
      request.tenant.id,
      'stripe'
    )

    if (!subscriptionCheck.allowed) {
      return reply.status(402).send({
        error: 'Subscription required',
        reason: subscriptionCheck.reason,
        upgradeUrl: subscriptionCheck.upgradeUrl
      })
    }
  }
}, async (request: any, reply: any) => {
  const { id } = request.params
  const { cancelAtPeriodEnd = true, reason } = request.body

  try {
    // 🔧 获取租户的 Stripe 配置
    const stripeConfig = await getStripeConfig(request.tenant.id);
    const stripe = createStripeInstance(stripeConfig.secretKey);

    const subscription = await fastify.prisma.subscription.findUnique({
      where: { id }
    })

    if (!subscription || subscription.tenantId !== request.tenant.id) {
      return reply.status(404).send({ error: 'Subscription not found' })
    }

    // 取消Stripe订阅
    if (subscription.stripeSubscriptionId) {
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: cancelAtPeriodEnd
      })

      if (!cancelAtPeriodEnd) {
        await stripe.subscriptions.cancel(subscription.stripeSubscriptionId)
      }
    }

    // 更新本地订阅
    const canceledSubscription = await fastify.cancelSubscription(
      subscription.id,
      cancelAtPeriodEnd,
      reason || 'Canceled by tenant'
    )

    return {
      success: true,
      subscription: {
        id: canceledSubscription.id,
        status: canceledSubscription.status,
        cancelAtPeriodEnd: canceledSubscription.cancelAtPeriodEnd,
        canceledAt: canceledSubscription.canceledAt,
        currentPeriodEnd: canceledSubscription.currentPeriodEnd
      }
    }
  } catch (error) {
    fastify.log.error('Failed to cancel subscription:', error)
    return reply.status(500).send({
      error: 'Failed to cancel subscription',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

// 退款功能 - 商业化版本
fastify.post('/create-refund', {
  schema: {
    hide: true,
    tags: ['plugins', 'stripe'],
    summary: 'Create refund',
    body: {
      type: 'object',
      required: ['paymentIntentId'],
      properties: {
        paymentIntentId: { type: 'string' },
        amount: { type: 'number' },
        reason: { type: 'string' }
      }
    },
    response: {
      200: {
        type: 'object',
        additionalProperties: true
      },
      '4xx': { type: 'object', additionalProperties: true },
      '5xx': { type: 'object', additionalProperties: true }
    }
  },
  preHandler: async (request: any, reply: any) => {
    // API 调用次数限制检查
    const apiCallCheck = await fastify.checkUsageLimit(
      request.tenant.id,
      'stripe',
      'api_calls'
    )

    if (!apiCallCheck.allowed) {
      return reply.status(429).send({
        error: 'API call limit exceeded',
        current: apiCallCheck.current,
        limit: apiCallCheck.limit,
        percentage: apiCallCheck.percentage,
        upgradeUrl: `/plugins/stripe/upgrade`
      })
    }

    // 记录 API 调用次数
    await fastify.recordPluginUsage(request.tenant.id, 'stripe', 'api_calls')

    const licenseCheck = await fastify.checkPluginLicense(
      request.tenant.id,
      'stripe',
      'refunds'
    )

    if (!licenseCheck.valid) {
      return reply.status(402).send({
        error: 'Feature requires upgrade',
        feature: 'refunds',
        upgradeUrl: `/plugins/stripe/upgrade`
      })
    }

    await fastify.recordPluginUsage(request.tenant.id, 'stripe', 'refunds')
  }
}, async (request: any, reply: any) => {
  const { paymentIntentId, amount, reason } = request.body

  try {
    // 🔧 获取租户的 Stripe 配置
    const stripeConfig = await getStripeConfig(request.tenant.id);
    const stripe = createStripeInstance(stripeConfig.secretKey);

    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      amount: amount ? Math.round(amount * 100) : undefined,
      reason: reason || 'requested_by_customer',
      metadata: { tenantId: request.tenant.id.toString() }
    })

    return { refundId: refund.id, status: refund.status, amount: refund.amount / 100 }
  } catch (error) {
    fastify.log.error('Refund creation failed:', error)
    return reply.status(500).send({ error: 'Failed to create refund' })
  }
})

// 分期付款功能 - 商业化版本
fastify.post('/create-installment-plan', {
  schema: {
    hide: true,
    tags: ['plugins', 'stripe'],
    summary: 'Create installment plan',
    body: {
      type: 'object',
      required: ['amount', 'currency', 'installments'],
      properties: {
        amount: { type: 'number' },
        currency: { type: 'string' },
        installments: { type: 'integer' },
        customerId: { type: 'string' }
      }
    },
    response: {
      200: {
        type: 'object',
        additionalProperties: true
      },
      '4xx': { type: 'object', additionalProperties: true },
      '5xx': { type: 'object', additionalProperties: true }
    }
  },
  preHandler: async (request: any, reply: any) => {
    // API 调用次数限制检查
    const apiCallCheck = await fastify.checkUsageLimit(
      request.tenant.id,
      'stripe',
      'api_calls'
    )

    if (!apiCallCheck.allowed) {
      return reply.status(429).send({
        error: 'API call limit exceeded',
        current: apiCallCheck.current,
        limit: apiCallCheck.limit,
        percentage: apiCallCheck.percentage,
        upgradeUrl: `/plugins/stripe/upgrade`
      })
    }

    // 记录 API 调用次数
    await fastify.recordPluginUsage(request.tenant.id, 'stripe', 'api_calls')

    const licenseCheck = await fastify.checkPluginLicense(
      request.tenant.id,
      'stripe',
      'installments'
    )

    if (!licenseCheck.valid) {
      return reply.status(402).send({
        error: 'Feature requires upgrade',
        feature: 'installments',
        upgradeUrl: `/plugins/stripe/upgrade`
      })
    }

    await fastify.recordPluginUsage(request.tenant.id, 'stripe', 'installments')
  }
}, async (request: any, reply: any) => {
  const { amount, currency, installments, customerId } = request.body

  try {
    // 🔧 获取租户的 Stripe 配置
    const stripeConfig = await getStripeConfig(request.tenant.id);
    const stripe = createStripeInstance(stripeConfig.secretKey);

    // 创建分期付款计划
    const installmentAmount = Math.round((amount * 100) / installments)

    // 创建或获取分期付款产品
    let product
    try {
      // 尝试获取已存在的产品
      const products = await stripe.products.list({ limit: 100 })
      product = products.data.find(p => p.metadata?.type === 'installment_payment')

      if (!product) {
        // 如果不存在，创建新产品
        product = await stripe.products.create({
          name: 'Installment Payment Plan',
          description: 'Monthly installment payment plan',
          metadata: {
            type: 'installment_payment'
          }
        })
      }
    } catch (productError) {
      fastify.log.error('Failed to create/get product:', productError)
      throw productError
    }

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{
        price_data: {
          currency: currency || 'usd',
          product: product.id,
          unit_amount: installmentAmount,
          recurring: { interval: 'month' }
        }
      }],
      metadata: {
        tenantId: request.tenant.id.toString(),
        installmentPlan: 'true',
        totalAmount: amount.toString(),
        installments: installments.toString()
      }
    })

    return {
      subscriptionId: subscription.id,
      installmentAmount: installmentAmount / 100,
      totalInstallments: installments
    }
  } catch (error) {
    fastify.log.error('Installment plan creation failed:', error)
    return reply.status(500).send({
      error: 'Failed to create installment plan',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

};

// ✅ 不需要fastify-plugin包装，因为这是业务插件
export default stripePayment
