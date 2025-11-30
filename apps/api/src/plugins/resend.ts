/**
 * Resend Email Plugin
 * 
 * 提供Resend邮件服务集成功能：
 * - 基础邮件发送（单封、批量）
 * - 邮件状态查询
 * - Webhook处理
 * - 双模式支持（Platform / BYOK）
 * 
 * 注意：此插件不使用 fastify-plugin 包装，保持封装以避免路由泄露
 */

import { FastifyPluginAsync } from 'fastify';
import { ResendProvider } from './email-providers/resend-provider';
import { authMiddleware } from '@/core/auth/middleware';
import rawBody from 'fastify-raw-body';
import { Webhook } from 'svix';
import Stripe from 'stripe';

interface ResendEmailOptions {
  apiKey?: string;  // 平台级别的API Key（可选）
  stripeSecretKey?: string;  // 平台级别的 Stripe Secret Key（用于订阅管理）
  stripeWebhookSecret?: string;  // 平台级别的 Stripe Webhook Secret
}

const resendEmail: FastifyPluginAsync<ResendEmailOptions> = async (fastify, options) => {
  // 注册 fastify-raw-body 插件，用于 Webhook 签名验证
  await fastify.register(rawBody, {
    field: 'rawBody',
    global: false,
    encoding: 'utf8',
    runFirst: true
  });

  /**
   * 获取插件配置（包含租户的BYOK配置）
   */
  async function getProviderConfig(tenantId: number) {
    const installation = await fastify.prisma.pluginInstallation.findFirst({
      where: {
        tenantId,
        plugin: { slug: 'resend' },
        status: 'ACTIVE'
      }
    });

    if (!installation) {
      throw new Error('Resend Email plugin not installed');
    }

    const config = installation.configData
      ? JSON.parse(installation.configData)
      : {};

    return {
      mode: config.mode || 'platform',
      apiKey: config.resendApiKey || options.apiKey,
      customSettings: config.customSettings || {}
    };
  }

  /**
   * 获取租户邮件设置
   */
  async function getTenantEmailSettings(tenantId: number) {
    const tenant = await fastify.prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    return tenant?.emailSettings
      ? JSON.parse(tenant.emailSettings)
      : {};
  }

  /**
   * 获取Stripe配置（用于订阅管理）
   */
  async function getStripeConfig(tenantId: number) {
    const installation = await fastify.prisma.pluginInstallation.findFirst({
      where: {
        tenantId,
        plugin: { slug: 'resend' },
        status: 'ACTIVE'
      }
    });

    if (!installation) {
      throw new Error('Resend Email plugin not installed');
    }

    const config = installation.configData
      ? JSON.parse(installation.configData)
      : {};

    return {
      mode: config.mode || 'platform',
      secretKey: config.stripeSecretKey || options.stripeSecretKey,
      webhookSecret: config.stripeWebhookSecret || options.stripeWebhookSecret
    };
  }

  /**
   * 创建Stripe实例（用于订阅管理）
   */
  function createStripeInstance(secretKey: string) {
    if (!secretKey) {
      throw new Error('Stripe Secret Key is required');
    }

    return new Stripe(secretKey, {
      apiVersion: '2025-02-24.acacia' as any
    });
  }

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
    });

    if (!plan) {
      return null;
    }

    return {
      name: plan.name,
      amount: plan.amount,
      currency: plan.currency,
      billingCycle: plan.billingCycle,
      trialDays: plan.trialDays,
      features: plan.features ? JSON.parse(plan.features) : [],
      limits: plan.limits ? JSON.parse(plan.limits) : {},
      stripePriceId: plan.stripePriceId
    };
  }

  // ============================================
  // 健康检查
  // ============================================

  fastify.get('/health', {
    schema: {
      tags: ['plugins', 'resend'],
      summary: 'Resend Plugin Health Check',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            plugin: { type: 'string' },
            version: { type: 'string' },
            tenant: { type: 'number' },
            timestamp: { type: 'string' }
          }
        }
      }
    }
  }, async (request: any) => {
    return {
      status: 'healthy',
      plugin: 'resend',
      version: '1.0.0',
      tenant: request.tenant?.id,
      timestamp: new Date().toISOString()
    };
  });

  // ============================================
  // 发送单封邮件
  // ============================================

  fastify.post('/send', {
    schema: {
      tags: ['plugins', 'resend'],
      summary: 'Send Email',
      body: {
        type: 'object',
        required: ['to', 'subject', 'html'],
        properties: {
          to: { type: 'string' },
          from: { type: 'string' },
          fromName: { type: 'string' },
          subject: { type: 'string' },
          html: { type: 'string' },
          text: { type: 'string' },
          replyTo: { type: 'string' },
          cc: { type: 'array', items: { type: 'string' } },
          bcc: { type: 'array', items: { type: 'string' } },
          attachments: { type: 'array', items: { type: 'object', additionalProperties: true } },
          tags: { type: 'array', items: { type: 'object', additionalProperties: true } },
          metadata: { type: 'object', additionalProperties: true }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            messageId: { type: 'string' },
            provider: { type: 'string' }
          }
        },
        '4xx': { type: 'object', additionalProperties: true },
        '5xx': { type: 'object', additionalProperties: true }
      }
    },
    preHandler: async (request: any, reply: any) => {
      // 商业化检查：许可证验证
      const licenseCheck = await fastify.checkPluginLicense(
        request.tenant.id,
        'resend',
        'basic_email'
      );

      if (!licenseCheck.valid) {
        return reply.status(403).send({
          error: 'License required',
          reason: licenseCheck.reason,
          upgradeUrl: licenseCheck.upgradeUrl
        });
      }

      // 商业化检查：邮件发送量限制
      const emailCheck = await fastify.checkUsageLimit(
        request.tenant.id,
        'resend',
        'emails_sent'
      );

      if (!emailCheck.allowed) {
        return reply.status(429).send({
          error: 'Email limit exceeded',
          current: emailCheck.current,
          limit: emailCheck.limit,
          percentage: emailCheck.percentage,
          upgradeUrl: '/plugins/resend/upgrade'
        });
      }

      // 记录API调用次数
      await fastify.recordPluginUsage(request.tenant.id, 'resend', 'api_calls');
    }
  }, async (request: any, reply: any) => {
    const {
      to, from, fromName, subject, html, text,
      replyTo, cc, bcc, attachments, tags, metadata
    } = request.body;

    try {
      // 获取租户配置
      const config = await getProviderConfig(request.tenant.id);
      const emailSettings = await getTenantEmailSettings(request.tenant.id);

      // 创建Provider实例
      const provider = new ResendProvider(config);

      // 发送邮件
      const result = await provider.send({
        to,
        from: from || emailSettings.fromEmail || 'noreply@chentsimo.top',
        fromName: fromName || emailSettings.fromName || 'PaaS Jiffoo',
        replyTo: replyTo || emailSettings.replyTo,
        cc,
        bcc,
        subject,
        html,
        text,
        attachments,
        tags,
        metadata
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      // 获取插件ID
      const plugin = await fastify.prisma.plugin.findUnique({
        where: { slug: 'resend' }
      });

      // 记录邮件日志
      await fastify.prisma.emailLog.create({
        data: {
          tenantId: request.tenant.id,
          pluginId: plugin?.id,
          provider: 'resend',
          messageId: result.messageId,
          to: JSON.stringify(Array.isArray(to) ? to : [to]),
          from: from || emailSettings.fromEmail || 'noreply@jiffoo.com',
          fromName: fromName || emailSettings.fromName,
          replyTo: replyTo || emailSettings.replyTo,
          cc: cc ? JSON.stringify(cc) : null,
          bcc: bcc ? JSON.stringify(bcc) : null,
          subject,
          html,
          text,
          attachments: attachments ? JSON.stringify(attachments) : null,
          status: 'sent',
          sentAt: new Date(),
          tags: tags ? JSON.stringify(tags) : null,
          metadata: metadata ? JSON.stringify(metadata) : null
        }
      });

      // 记录邮件发送量
      await fastify.recordPluginUsage(request.tenant.id, 'resend', 'emails_sent');

      fastify.log.info(`✅ Email sent successfully: ${result.messageId} (tenant: ${request.tenant.id})`);

      return {
        success: true,
        messageId: result.messageId,
        provider: 'resend'
      };
    } catch (error: any) {
      fastify.log.error('Resend email failed:', error);

      // 记录失败日志
      const plugin = await fastify.prisma.plugin.findUnique({
        where: { slug: 'resend' }
      });

      await fastify.prisma.emailLog.create({
        data: {
          tenantId: request.tenant.id,
          pluginId: plugin?.id,
          provider: 'resend',
          to: JSON.stringify(Array.isArray(to) ? to : [to]),
          from: from || 'noreply@chentsimo.top',
          subject,
          status: 'failed',
          errorMessage: error.message
        }
      });

      return reply.status(500).send({
        success: false,
        error: 'Failed to send email',
        details: error.message
      });
    }
  });

  // ============================================
  // 批量发送邮件
  // ============================================

  fastify.post('/send-batch', {
    schema: {
      tags: ['plugins', 'resend'],
      summary: 'Send Batch Emails',
      body: {
        type: 'object',
        required: ['emails'],
        properties: {
          emails: {
            type: 'array',
            items: {
              type: 'object',
              required: ['to', 'subject', 'html'],
              properties: {
                to: { type: 'string' },
                subject: { type: 'string' },
                html: { type: 'string' }
              },
              additionalProperties: true
            }
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            total: { type: 'number' },
            sent: { type: 'number' },
            failed: { type: 'number' },
            results: { type: 'array', items: { type: 'object', additionalProperties: true } }
          }
        },
        '4xx': { type: 'object', additionalProperties: true },
        '5xx': { type: 'object', additionalProperties: true }
      }
    },
    preHandler: async (request: any, reply: any) => {
      // 商业化检查：批量发送功能
      const licenseCheck = await fastify.checkPluginLicense(
        request.tenant.id,
        'resend',
        'batch_email'
      );

      if (!licenseCheck.valid) {
        return reply.status(403).send({
          error: 'Batch email feature not available in your plan',
          upgradeUrl: '/plugins/resend/upgrade'
        });
      }
    }
  }, async (request: any, reply: any) => {
    const { emails } = request.body;  // Array of email objects

    if (!Array.isArray(emails) || emails.length === 0) {
      return reply.status(400).send({
        error: 'Invalid request',
        message: 'emails must be a non-empty array'
      });
    }

    try {
      const config = await getProviderConfig(request.tenant.id);
      const provider = new ResendProvider(config);

      const results = await provider.sendBatch(emails);

      const successCount = results.filter(r => r.success).length;

      // 记录邮件发送量
      await fastify.recordPluginUsage(
        request.tenant.id,
        'resend',
        'emails_sent',
        successCount
      );

      fastify.log.info(`✅ Batch email sent: ${successCount}/${emails.length} (tenant: ${request.tenant.id})`);

      return {
        success: true,
        total: emails.length,
        sent: successCount,
        failed: emails.length - successCount,
        results
      };
    } catch (error: any) {
      fastify.log.error('Batch email failed:', error);
      return reply.status(500).send({
        success: false,
        error: 'Batch send failed',
        details: error.message
      });
    }
  });

  // ============================================
  // 获取邮件状态
  // ============================================

  fastify.get('/status/:messageId', {
    schema: {
      tags: ['plugins', 'resend'],
      summary: 'Get Email Status',
      params: {
        type: 'object',
        required: ['messageId'],
        properties: {
          messageId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            status: { type: 'string' }
          },
          additionalProperties: true
        },
        '4xx': { type: 'object', additionalProperties: true },
        '5xx': { type: 'object', additionalProperties: true }
      }
    }
  }, async (request: any, reply: any) => {
    const { messageId } = request.params;

    try {
      const config = await getProviderConfig(request.tenant.id);
      const provider = new ResendProvider(config);

      const status = await provider.getStatus(messageId);

      return {
        success: true,
        ...status
      };
    } catch (error: any) {
      fastify.log.error('Failed to get email status:', error);
      return reply.status(404).send({
        success: false,
        error: 'Email not found',
        details: error.message
      });
    }
  });

  // ============================================
  // 计划管理
  // ============================================

  /**
   * GET /plan/current
   * 获取当前计划详情
   *
   * 返回：
   * - 当前计划名称和配置
   * - 功能列表和使用限制
   * - 当前使用量（emails_sent, api_calls）
   * - 订阅信息（周期、金额、状态）
   * - 待生效的降级信息
   * - 可用的升级计划列表
   */
  fastify.get('/plan/current', {
    schema: {
      hide: true,
      tags: ['plugins', 'resend'],
      summary: 'Get Current Plan',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                plan: { type: 'string' },
                features: { type: 'array', items: { type: 'string' } },
                limits: { type: 'object', additionalProperties: true },
                usage: { type: 'object', additionalProperties: true },
                subscription: { type: 'object', additionalProperties: true },
                pendingChange: { type: 'object', additionalProperties: true },
                availablePlans: { type: 'array', items: { type: 'object', additionalProperties: true } }
              }
            }
          }
        },
        '4xx': { type: 'object', additionalProperties: true },
        '5xx': { type: 'object', additionalProperties: true }
      }
    },
    preHandler: [
      authMiddleware,
      async (request: any, reply: any) => {
        const licenseCheck = await fastify.checkPluginLicense(
          request.tenant.id,
          'resend',
          'basic_email'
        );

        if (!licenseCheck.valid) {
          return reply.status(403).send({
            error: 'License required',
            reason: licenseCheck.reason,
            upgradeUrl: licenseCheck.upgradeUrl
          });
        }
      }
    ]
  }, async (request: any, reply: any) => {
    try {
      // 🆕 Step 0: 懒加载 - 检查并在需要时重置使用量
      await fastify.checkAndResetUsageIfNeeded(request.tenant.id, 'resend');

      // 1. 获取插件安装信息
      const installation = await fastify.prisma.pluginInstallation.findFirst({
        where: {
          tenantId: request.tenant.id,
          plugin: { slug: 'resend' },
          status: 'ACTIVE'
        },
        include: { plugin: true }
      });

      if (!installation) {
        return reply.status(404).send({
          error: 'Plugin not installed'
        });
      }

      // 2. 查找活跃订阅获取当前计划
      const subscription = await fastify.prisma.subscription.findFirst({
        where: {
          tenantId: request.tenant.id,
          pluginId: installation.pluginId,
          status: { in: ['active', 'trialing', 'past_due'] }
        }
      });

      // 获取当前计划
      const currentPlan = subscription?.planId || 'free';

      // 3. 获取当前计划配置
      const planConfig = await fastify.prisma.subscriptionPlan.findUnique({
        where: {
          pluginId_planId: {
            pluginId: installation.pluginId,
            planId: currentPlan
          }
        }
      });

      // 4. 确定 period
      let period: string;
      if (subscription) {
        // 使用订阅周期作为 period
        const startDate = subscription.currentPeriodStart.toISOString().split('T')[0];
        period = `${subscription.id}:${startDate}`;
      } else {
        // Free Plan：使用自然月
        period = new Date().toISOString().slice(0, 7);
      }

      // 5. 获取使用量
      const usage = await fastify.prisma.pluginUsage.findMany({
        where: {
          tenantId: request.tenant.id,
          pluginSlug: 'resend',
          period: period
        }
      });

      const usageMap: any = {};
      usage.forEach(u => {
        usageMap[u.metricName] = u.value;
      });

      // 6. 查找待生效的变更
      let pendingChange = null;
      if (subscription) {
        const change = await fastify.prisma.subscriptionChange.findFirst({
          where: {
            subscriptionId: subscription.id,
            changeType: 'downgraded',
            effectiveDate: { gt: new Date() }
          },
          orderBy: { createdAt: 'desc' }
        });

        if (change) {
          pendingChange = {
            type: 'downgrade',
            fromPlan: change.fromPlanId,
            targetPlan: change.toPlanId,
            effectiveDate: change.effectiveDate.toISOString(),
            daysRemaining: Math.ceil((change.effectiveDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          };
        }
      }

      // 7. 获取可用的升级计划
      const availablePlans = await fastify.prisma.subscriptionPlan.findMany({
        where: {
          pluginId: installation.pluginId,
          isActive: true,
          isPublic: true
        },
        orderBy: { sortOrder: 'asc' }
      });

      // 8. 构建usage对象，包含current、limit和percentage
      const planLimits = planConfig?.limits ? JSON.parse(planConfig.limits) : {};
      const usageObject: any = {};

      // 为所有定义的metrics构建usage对象
      Object.keys(planLimits).forEach(metricKey => {
        const current = usageMap[metricKey] || 0;
        const limit = planLimits[metricKey] || -1;
        const percentage = limit === -1 ? 0 : Math.round((current / limit) * 100);

        usageObject[metricKey] = {
          current,
          limit,
          percentage
        };
      });

      return {
        success: true,
        data: {
          plan: currentPlan,
          features: planConfig?.features ? JSON.parse(planConfig.features) : [],
          limits: planLimits,
          usage: usageObject,
          subscription: subscription ? {
            status: subscription.status,
            currentPeriodStart: subscription.currentPeriodStart.toISOString(),
            currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
            amount: subscription.amount,
            currency: subscription.currency,
            stripeSubscriptionId: subscription.stripeSubscriptionId
          } : null,
          pendingChange: pendingChange,
          availablePlans: availablePlans.map(p => ({
            planId: p.planId,
            name: p.name,
            description: p.description,
            amount: p.amount,
            currency: p.currency,
            billingCycle: p.billingCycle,
            features: p.features ? JSON.parse(p.features) : [],
            limits: p.limits ? JSON.parse(p.limits) : {}
          }))
        }
      };
    } catch (error: any) {
      fastify.log.error('Failed to get current plan:', {
        error: error.message,
        stack: error.stack
      });
      return reply.status(500).send({
        error: 'Failed to get current plan',
        details: error.message
      });
    }
  });

  /**
   * POST /plan/upgrade-preview
   * 获取升级费用预览
   *
   * 功能：
   * - 计算从当前计划升级到目标计划的费用
   * - Free → Paid: 显示完整价格
   * - Paid → Paid: 计算按比例计费金额
   * - 显示升级类型和下次计费日期
   */
  fastify.post('/plan/upgrade-preview', {
    schema: {
      hide: true,
      tags: ['plugins', 'resend'],
      summary: 'Upgrade Preview',
      body: {
        type: 'object',
        required: ['targetPlan'],
        properties: {
          targetPlan: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true }
          }
        },
        '4xx': { type: 'object', additionalProperties: true },
        '5xx': { type: 'object', additionalProperties: true }
      }
    },
    preHandler: [
      authMiddleware,
      async (request: any, reply: any) => {
        const licenseCheck = await fastify.checkPluginLicense(
          request.tenant.id,
          'resend',
          'basic_email'
        );

        if (!licenseCheck.valid) {
          return reply.status(403).send({
            error: 'License required',
            reason: licenseCheck.reason,
            details: 'Plugin not installed or inactive'
          });
        }
      }
    ]
  }, async (request: any, reply: any) => {
    const { targetPlan } = request.body as { targetPlan: string };

    if (!targetPlan) {
      return reply.code(400).send({
        success: false,
        error: 'targetPlan is required'
      });
    }

    try {
      // Get plugin configuration
      const plugin = await fastify.prisma.plugin.findUnique({
        where: { slug: 'resend' }
      });

      if (!plugin) {
        return reply.code(404).send({
          success: false,
          error: 'Resend Email plugin not found'
        });
      }

      // Get target plan config
      const planConfig = await fastify.prisma.subscriptionPlan.findUnique({
        where: {
          pluginId_planId: {
            pluginId: plugin.id,
            planId: targetPlan
          }
        }
      });

      if (!planConfig) {
        return reply.code(400).send({
          success: false,
          error: `Plan ${targetPlan} not found`
        });
      }

      // Get current subscription
      const installation = await fastify.prisma.pluginInstallation.findFirst({
        where: {
          tenantId: request.tenant.id,
          pluginId: plugin.id,
          status: 'ACTIVE'
        }
      });

      if (!installation) {
        return reply.code(404).send({
          success: false,
          error: 'Plugin not installed'
        });
      }

      // Get current active subscription to determine current plan
      const activeSubscription = await fastify.prisma.subscription.findFirst({
        where: {
          tenantId: request.tenant.id,
          pluginId: plugin.id,
          status: { in: ['active', 'trialing', 'past_due'] }
        },
        orderBy: { createdAt: 'desc' }
      });

      const currentPlan = activeSubscription?.planId || 'free';

      // Get current plan config
      const currentPlanConfig = await fastify.prisma.subscriptionPlan.findUnique({
        where: {
          pluginId_planId: {
            pluginId: plugin.id,
            planId: currentPlan
          }
        }
      });

      if (!currentPlanConfig) {
        return reply.code(400).send({
          success: false,
          error: `Current plan ${currentPlan} not found`
        });
      }

      // Calculate upgrade preview
      let upgradePreview: any = {
        upgradeType: 'immediate',
        prorationAmount: 0,
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        immediateCharge: false
      };

      // Case 1: Free → Paid (requires payment)
      if (currentPlan === 'free' && targetPlan !== 'free') {
        upgradePreview = {
          upgradeType: 'payment',
          prorationAmount: planConfig.amount,
          nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          immediateCharge: true
        };
      }
      // Case 2: Paid → Paid (proration)
      else if (currentPlan !== 'free' && targetPlan !== 'free') {
        // Get existing subscription
        const existingSubscription = await fastify.prisma.subscription.findFirst({
          where: {
            tenantId: request.tenant.id,
            pluginId: plugin.id,
            status: { in: ['active', 'trialing', 'past_due'] }
          }
        });

        if (existingSubscription) {
          // Calculate prorated amount (simplified calculation)
          const currentPeriodEnd = new Date(existingSubscription.currentPeriodEnd);
          const now = new Date();
          const remainingDays = Math.max(0, Math.ceil((currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
          const totalDays = 30; // Assuming monthly billing

          // Credit for unused time on current plan
          const unusedCredit = (currentPlanConfig.amount * remainingDays) / totalDays;

          // Charge for new plan
          const newPlanCharge = planConfig.amount;

          // Prorated amount
          const prorationAmount = Math.max(0, newPlanCharge - unusedCredit);

          upgradePreview = {
            upgradeType: 'proration',
            prorationAmount: Math.round(prorationAmount * 100) / 100,
            nextBillingDate: new Date().toISOString(),
            immediateCharge: true
          };
        }
      }

      return reply.send({
        success: true,
        data: {
          currentPlan: {
            name: currentPlanConfig.name,
            amount: currentPlanConfig.amount,
            currency: currentPlanConfig.currency || 'USD',
            billingCycle: currentPlanConfig.billingCycle
          },
          targetPlan: {
            name: planConfig.name,
            amount: planConfig.amount,
            currency: planConfig.currency || 'USD',
            billingCycle: planConfig.billingCycle,
            features: planConfig.features ? JSON.parse(planConfig.features) : [],
            limits: planConfig.limits ? JSON.parse(planConfig.limits) : {}
          },
          upgradePreview
        }
      });

    } catch (error) {
      fastify.log.error('Upgrade preview failed:', error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to generate upgrade preview'
      });
    }
  });

  // ============================================
  // 自助升级流程
  // ============================================

  /**
   * POST /plan/upgrade
   * 创建Stripe Checkout Session用于订阅升级
   *
   * 功能：
   * - 从Free升级到Business/Enterprise（需要支付）
   * - 从Business升级到Enterprise（需要支付）
   * - 使用Stripe Checkout处理支付
   *
   * 注意：不检查使用量限制，即使用户超限也必须能够升级
   */
  fastify.post('/plan/upgrade', {
    schema: {
      hide: true,
      tags: ['plugins', 'resend'],
      summary: 'Upgrade Plan',
      body: {
        type: 'object',
        required: ['targetPlan'],
        properties: {
          targetPlan: { type: 'string' },
          successUrl: { type: 'string' },
          cancelUrl: { type: 'string' }
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
    preHandler: [
      authMiddleware,
      async (request: any, reply: any) => {
        // 只检查基础许可证（插件是否已安装）
        // ⚠️ 关键：不检查使用量限制！用户即使用完额度也必须能够购买升级
        const licenseCheck = await fastify.checkPluginLicense(
          request.tenant.id,
          'resend',
          'basic_email'
        );

        if (!licenseCheck.valid) {
          return reply.status(403).send({
            error: 'License required',
            reason: licenseCheck.reason,
            upgradeUrl: licenseCheck.upgradeUrl
          });
        }
      }
    ]
  }, async (request: any, reply: any) => {
    const { targetPlan, successUrl, cancelUrl } = request.body;

    // 验证目标计划
    if (!['business', 'enterprise'].includes(targetPlan)) {
      return reply.status(400).send({
        error: 'Invalid target plan',
        message: 'Target plan must be "business" or "enterprise"'
      });
    }

    try {
      // 1. 获取插件信息
      const plugin = await fastify.prisma.plugin.findUnique({
        where: { slug: 'resend' }
      });

      if (!plugin) {
        return reply.status(404).send({ error: 'Plugin not found' });
      }

      // 2. 获取目标订阅计划配置
      const planConfig = await fastify.prisma.subscriptionPlan.findUnique({
        where: {
          pluginId_planId: {
            pluginId: plugin.id,
            planId: targetPlan
          }
        }
      });

      if (!planConfig) {
        return reply.status(404).send({ error: 'Plan not found' });
      }

      // 3. 验证stripePriceId是否配置
      if (!planConfig.stripePriceId) {
        fastify.log.error(`Stripe Price ID not configured for plan: ${targetPlan}`);
        return reply.status(500).send({
          error: 'Plan configuration error',
          message: 'Stripe Price ID not configured. Please contact support.'
        });
      }

      // 4. 获取用户邮箱（用于Stripe Checkout预填）
      const user = await fastify.prisma.user.findUnique({
        where: { id: request.user.id },
        select: { email: true }
      });

      const customerEmail = user?.email;

      // 5. 创建Stripe Checkout Session
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

      const sessionConfig: any = {
        payment_method_types: ['card'],
        line_items: [{
          price: planConfig.stripePriceId,
          quantity: 1
        }],
        mode: 'subscription',
        success_url: successUrl
          ? `${successUrl}${successUrl.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`
          : `${process.env.NEXT_PUBLIC_SHOP_URL || 'http://localhost:3004'}/plugins/resend/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_SHOP_URL || 'http://localhost:3004'}/plugins/resend/upgrade/cancel`,
        metadata: {
          isUpgrade: 'true',
          targetPlan: targetPlan,
          planId: targetPlan,
          tenantId: request.tenant.id.toString(),
          pluginSlug: 'resend'
        }
      };

      // 添加客户邮箱（如果存在）
      if (customerEmail && customerEmail.trim()) {
        sessionConfig.customer_email = customerEmail;
        fastify.log.info(`✅ Email added to Stripe session: ${customerEmail}`);
      }

      // 创建Checkout Session
      const session = await stripe.checkout.sessions.create(sessionConfig);

      fastify.log.info(`✅ Upgrade checkout session created: ${session.id} for tenant ${request.tenant.id} to plan ${targetPlan}`);

      return {
        success: true,
        sessionId: session.id,
        url: session.url,
        targetPlan: targetPlan,
        price: planConfig.amount,
        currency: planConfig.currency,
        billingCycle: planConfig.billingCycle
      };

    } catch (error: any) {
      fastify.log.error('Failed to create upgrade checkout session:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to create checkout session',
        details: error.message
      });
    }
  });

  // ============================================
  // 降级计划
  // ============================================

  /**
   * POST /plan/downgrade
   * 降级订阅计划（延期生效，不需要支付）
   *
   * 功能：
   * - 从Enterprise降级到Business/Free（延期到周期结束）
   * - 从Business降级到Free（延期到周期结束）
   * - 付费→付费：立即生效，按比例退款
   * - 付费→Free：周期结束时取消订阅
   */
  fastify.post('/plan/downgrade', {
    schema: {
      hide: true,
      tags: ['plugins', 'resend'],
      summary: 'Downgrade Plan',
      body: {
        type: 'object',
        required: ['targetPlan'],
        properties: {
          targetPlan: { type: 'string', enum: ['free', 'business'] }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            currentPlan: { type: 'string' },
            targetPlan: { type: 'string' },
            effectiveDate: { type: 'string' },
            immediate: { type: 'boolean' },
            message: { type: 'string' },
            daysRemaining: { type: 'number' }
          }
        },
        '4xx': { type: 'object', additionalProperties: true },
        '5xx': { type: 'object', additionalProperties: true }
      }
    },
    preHandler: [
      authMiddleware,
      async (request: any, reply: any) => {
        // 只检查基础许可证
        const licenseCheck = await fastify.checkPluginLicense(
          request.tenant.id,
          'resend',
          'basic_email'
        );

        if (!licenseCheck.valid) {
          return reply.status(403).send({
            error: 'License required',
            reason: licenseCheck.reason,
            upgradeUrl: licenseCheck.upgradeUrl
          });
        }
      }
    ]
  }, async (request: any, reply: any) => {
    const { targetPlan } = request.body;

    // 验证目标计划
    if (!['free', 'business'].includes(targetPlan)) {
      return reply.status(400).send({
        error: 'Invalid target plan',
        message: 'Target plan must be "free" or "business"'
      });
    }

    try {
      // 1. 获取插件信息
      const plugin = await fastify.prisma.plugin.findUnique({
        where: { slug: 'resend' }
      });

      if (!plugin) {
        return reply.status(404).send({ error: 'Plugin not found' });
      }

      // 2. 获取当前活跃订阅
      const activeSubscription = await fastify.prisma.subscription.findFirst({
        where: {
          tenantId: request.tenant.id,
          pluginId: plugin.id,
          status: { in: ['active', 'trialing', 'past_due'] }
        },
        orderBy: { createdAt: 'desc' }
      });

      const currentPlan = activeSubscription?.planId || 'free';

      // 3. 验证是否是降级
      const planHierarchy = { free: 0, business: 1, enterprise: 2 };
      if (planHierarchy[targetPlan] >= planHierarchy[currentPlan]) {
        return reply.status(400).send({
          error: 'Invalid downgrade',
          message: `Cannot downgrade from ${currentPlan} to ${targetPlan}. Use /upgrade for upgrades.`
        });
      }

      // 4. 如果没有订阅，直接降级
      if (!activeSubscription) {
        return {
          success: true,
          currentPlan: currentPlan,
          targetPlan: targetPlan,
          effectiveDate: new Date().toISOString(),
          immediate: true,
          message: 'Plan downgraded immediately'
        };
      }

      // 5. 有订阅，根据目标计划选择降级策略
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

      if (activeSubscription.stripeSubscriptionId) {
        if (targetPlan === 'free') {
          // 降级到Free：设置订阅在周期结束时取消
          await stripe.subscriptions.update(activeSubscription.stripeSubscriptionId, {
            cancel_at_period_end: true
          });

          fastify.log.info(`🆓 Scheduled cancellation for Free downgrade: ${currentPlan} → ${targetPlan}`);
        } else {
          // 付费计划之间的降级：立即修改价格
          const targetPlanConfig = await fastify.prisma.subscriptionPlan.findUnique({
            where: {
              pluginId_planId: {
                pluginId: plugin.id,
                planId: targetPlan
              }
            }
          });

          if (!targetPlanConfig || !targetPlanConfig.stripePriceId) {
            return reply.status(400).send({
              success: false,
              error: `Target plan ${targetPlan} configuration not found`
            });
          }

          // 获取当前Stripe订阅详情
          const stripeSubscription = await stripe.subscriptions.retrieve(activeSubscription.stripeSubscriptionId);
          if (!stripeSubscription.items.data[0]) {
            return reply.status(400).send({
              success: false,
              error: 'Stripe subscription has no items'
            });
          }

          // 立即修改Stripe订阅价格
          await stripe.subscriptions.update(activeSubscription.stripeSubscriptionId, {
            items: [{
              id: stripeSubscription.items.data[0].id,
              price: targetPlanConfig.stripePriceId
            }],
            proration_behavior: 'create_prorations',
            metadata: {
              ...stripeSubscription.metadata,
              targetPlan: targetPlan,
              lastDowngrade: new Date().toISOString(),
              downgradedFrom: currentPlan,
              downgradeType: 'paid_to_paid'
            }
          });

          fastify.log.info(`💰 Immediate paid plan downgrade: ${currentPlan} → ${targetPlan}`);

          return {
            success: true,
            currentPlan: currentPlan,
            targetPlan: targetPlan,
            effectiveDate: new Date().toISOString(),
            immediate: true,
            message: `Plan downgraded from ${currentPlan} to ${targetPlan} with immediate effect and prorated billing.`
          };
        }
      }

      // 6. 更新本地订阅
      await fastify.prisma.subscription.update({
        where: { id: activeSubscription.id },
        data: {
          cancelAtPeriodEnd: true,
          updatedAt: new Date()
        }
      });

      // 7. 创建降级变更记录
      await fastify.prisma.subscriptionChange.create({
        data: {
          subscriptionId: activeSubscription.id,
          changeType: 'downgraded',
          fromPlanId: currentPlan,
          toPlanId: targetPlan,
          fromAmount: activeSubscription.amount,
          toAmount: 0,
          effectiveDate: activeSubscription.currentPeriodEnd,
          reason: 'User initiated downgrade',
          initiatedBy: 'tenant',
          createdBy: request.user?.id?.toString()
        }
      });

      fastify.log.info(`✅ Downgrade scheduled: ${currentPlan} → ${targetPlan} (effective: ${activeSubscription.currentPeriodEnd})`);

      const effectiveDate = activeSubscription.currentPeriodEnd.toISOString().split('T')[0];
      const daysRemaining = Math.ceil((activeSubscription.currentPeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      return {
        success: true,
        currentPlan: currentPlan,
        targetPlan: targetPlan,
        effectiveDate: activeSubscription.currentPeriodEnd.toISOString(),
        immediate: false,
        message: `Downgrade will take effect at the end of the current billing cycle (${effectiveDate})`,
        daysRemaining: daysRemaining
      };

    } catch (error: any) {
      fastify.log.error('Downgrade failed:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to downgrade plan',
        details: error.message
      });
    }
  });

  // ============================================
  // 取消降级
  // ============================================

  /**
   * POST /plan/cancel-downgrade
   * 取消待生效的降级（恢复订阅）
   */
  fastify.post('/plan/cancel-downgrade', {
    schema: {
      hide: true,
      tags: ['plugins', 'resend'],
      summary: 'Cancel Downgrade',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            currentPlan: { type: 'string' },
            subscriptionId: { type: 'string' }
          }
        },
        '4xx': { type: 'object', additionalProperties: true },
        '5xx': { type: 'object', additionalProperties: true }
      }
    },
    preHandler: [
      authMiddleware,
      async (request: any, reply: any) => {
        const licenseCheck = await fastify.checkPluginLicense(
          request.tenant.id,
          'resend',
          'basic_email'
        );

        if (!licenseCheck.valid) {
          return reply.status(403).send({
            error: 'License required',
            reason: licenseCheck.reason,
            upgradeUrl: licenseCheck.upgradeUrl
          });
        }
      }
    ]
  }, async (request: any, reply: any) => {
    try {
      // 1. 获取插件信息
      const plugin = await fastify.prisma.plugin.findUnique({
        where: { slug: 'resend' }
      });

      if (!plugin) {
        return reply.status(404).send({
          success: false,
          error: 'Plugin not found'
        });
      }

      // 2. 查找活跃订阅
      const subscription = await fastify.prisma.subscription.findFirst({
        where: {
          tenantId: request.tenant.id,
          pluginId: plugin.id,
          status: { in: ['active', 'trialing', 'past_due'] }
        }
      });

      if (!subscription) {
        return reply.status(404).send({
          success: false,
          error: 'No active subscription found'
        });
      }

      // 3. 检查是否有待生效的降级
      if (!subscription.cancelAtPeriodEnd) {
        return reply.status(400).send({
          success: false,
          error: 'No pending downgrade found'
        });
      }

      // 4. 检查订阅是否已到期
      if (subscription.currentPeriodEnd < new Date()) {
        return reply.status(400).send({
          success: false,
          error: 'Subscription has already expired, cannot cancel downgrade'
        });
      }

      // 5. 在Stripe中恢复订阅
      if (subscription.stripeSubscriptionId) {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          cancel_at_period_end: false
        });
      }

      // 6. 更新本地订阅
      await fastify.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          cancelAtPeriodEnd: false,
          autoRenew: true,
          updatedAt: new Date()
        }
      });

      // 7. 删除待生效的降级记录
      await fastify.prisma.subscriptionChange.deleteMany({
        where: {
          subscriptionId: subscription.id,
          changeType: 'downgraded',
          effectiveDate: { gt: new Date() }
        }
      });

      // 8. 记录取消降级事件
      await fastify.prisma.subscriptionChange.create({
        data: {
          subscriptionId: subscription.id,
          changeType: 'downgrade_canceled',
          fromPlanId: subscription.planId,
          toPlanId: subscription.planId,
          fromAmount: subscription.amount,
          toAmount: subscription.amount,
          effectiveDate: new Date(),
          reason: 'User canceled downgrade',
          initiatedBy: 'tenant',
          createdBy: request.user?.id?.toString()
        }
      });

      fastify.log.info(`✅ Downgrade canceled for subscription ${subscription.id}`);

      return {
        success: true,
        message: 'Downgrade canceled successfully',
        currentPlan: subscription.planId,
        subscriptionId: subscription.id
      };

    } catch (error: any) {
      fastify.log.error('Cancel downgrade failed:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to cancel downgrade',
        details: error.message
      });
    }
  });

  // ============================================
  // Webhook处理
  // ============================================

  fastify.post('/webhook', {
    schema: {
      tags: ['plugins', 'resend'],
      summary: 'Resend Webhook',
      hide: true, // Hide webhook from Swagger as it's for internal/external service use
      response: {
        200: {
          type: 'object',
          properties: {
            received: { type: 'boolean' },
            eventType: { type: 'string' },
            emailId: { type: 'string' }
          }
        }
      }
    },
    config: {
      rawBody: true  // 需要原始body用于签名验证
    }
  }, async (request: any, reply: any) => {
    // 获取webhook签名相关的headers
    const svixId = request.headers['svix-id'] as string;
    const svixTimestamp = request.headers['svix-timestamp'] as string;
    const svixSignature = request.headers['svix-signature'] as string;

    console.log('🎯 [WEBHOOK] Received Resend webhook request');
    console.log('🎯 [WEBHOOK] Headers:', {
      hasSvixId: !!svixId,
      hasSvixTimestamp: !!svixTimestamp,
      hasSvixSignature: !!svixSignature,
      hasRawBody: !!request.rawBody,
      bodyType: typeof request.body
    });

    fastify.log.info('📨 Received Resend webhook request', {
      hasSvixId: !!svixId,
      hasSvixTimestamp: !!svixTimestamp,
      hasSvixSignature: !!svixSignature,
      hasRawBody: !!request.rawBody,
      bodyType: typeof request.body,
      headers: Object.keys(request.headers)
    });

    try {
      // 获取原始请求体
      const rawBody = request.rawBody || JSON.stringify(request.body);
      console.log('🎯 [WEBHOOK] Raw body length:', rawBody.length);

      // 验证webhook签名（使用Svix）
      let event: any;
      const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
      console.log('🎯 [WEBHOOK] Webhook secret configured:', !!webhookSecret);

      if (webhookSecret && svixId && svixTimestamp && svixSignature) {
        console.log('🎯 [WEBHOOK] Starting signature verification...');
        fastify.log.info('🔐 Verifying webhook signature...');

        try {
          const wh = new Webhook(webhookSecret);
          event = wh.verify(rawBody, {
            'svix-id': svixId,
            'svix-timestamp': svixTimestamp,
            'svix-signature': svixSignature
          }) as any;

          console.log('🎯 [WEBHOOK] Signature verified successfully!');
          fastify.log.info('✅ Webhook signature verified successfully');
        } catch (err: any) {
          console.log('🎯 [WEBHOOK] Signature verification FAILED:', err.message);
          fastify.log.error('❌ Webhook signature verification failed:', err.message);
          return reply.status(401).send({
            error: 'Invalid signature',
            details: err.message
          });
        }
      } else {
        // 开发环境：如果没有配置webhook secret，直接使用请求体
        console.log('🎯 [WEBHOOK] Skipping signature verification');
        fastify.log.warn('⚠️  Webhook signature verification skipped - no webhook secret configured');
        event = request.body;
      }

      console.log('🎯 [WEBHOOK] Event type:', event.type);
      console.log('🎯 [WEBHOOK] Email ID:', event.data?.email_id);

      // 记录接收到的事件
      fastify.log.info(`📧 Resend webhook event: ${event.type}`, {
        type: event.type,
        emailId: event.data?.email_id,
        createdAt: event.created_at,
        data: event.data
      });

      // 更新邮件日志状态
      if (event.data?.email_id) {
        const updateData: any = {
          updatedAt: new Date()
        };

        switch (event.type) {
          case 'email.sent':
            updateData.status = 'sent';
            updateData.sentAt = new Date();
            fastify.log.info(`✉️  Email sent: ${event.data.email_id}`);
            break;

          case 'email.delivered':
            updateData.status = 'delivered';
            updateData.deliveredAt = new Date();
            fastify.log.info(`✅ Email delivered: ${event.data.email_id}`);
            break;

          case 'email.delivery_delayed':
            fastify.log.warn(`⏰ Email delivery delayed: ${event.data.email_id}`);
            // 不更新状态，保持当前状态
            break;

          case 'email.opened':
            updateData.status = 'opened';
            updateData.openedAt = updateData.openedAt || new Date();
            updateData.openCount = { increment: 1 };
            fastify.log.info(`👀 Email opened: ${event.data.email_id}`);
            break;

          case 'email.clicked':
            updateData.status = 'clicked';
            updateData.clickedAt = updateData.clickedAt || new Date();
            updateData.clickCount = { increment: 1 };
            fastify.log.info(`🖱️  Email link clicked: ${event.data.email_id}`);
            break;

          case 'email.bounced':
            updateData.status = 'bounced';
            updateData.bouncedAt = new Date();
            updateData.errorMessage = event.data?.reason || 'Email bounced';
            fastify.log.error(`❌ Email bounced: ${event.data.email_id}`, {
              reason: event.data?.reason
            });
            break;

          case 'email.complained':
            updateData.status = 'spam';
            fastify.log.warn(`🚫 Email marked as spam: ${event.data.email_id}`);
            break;

          default:
            fastify.log.info(`ℹ️  Unhandled webhook event type: ${event.type}`);
        }

        // 只有在有更新数据时才执行数据库更新
        if (Object.keys(updateData).length > 1) {
          const result = await fastify.prisma.emailLog.updateMany({
            where: { messageId: event.data.email_id },
            data: updateData
          });

          fastify.log.info(`💾 Updated ${result.count} email log(s) for ${event.data.email_id}`);
        }
      }

      return {
        received: true,
        eventType: event.type,
        emailId: event.data?.email_id
      };
    } catch (error: any) {
      fastify.log.error('💥 Webhook processing error:', {
        error: error.message,
        stack: error.stack
      });
      return reply.status(400).send({
        error: 'Webhook processing failed',
        details: error.message
      });
    }
  });

  // ============================================
  // 获取插件能力
  // ============================================

  fastify.get('/capabilities', {
    schema: {
      hide: true,
      tags: ['plugins', 'resend'],
      summary: 'Get Plugin Capabilities',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            capabilities: { type: 'object', additionalProperties: true }
          }
        }
      }
    }
  }, async (request: any) => {
    try {
      const config = await getProviderConfig(request.tenant.id);
      const provider = new ResendProvider(config);

      return {
        success: true,
        capabilities: provider.getCapabilities()
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  });

  // ============================================
  // 订阅CRUD端点（用于Super Admin直接管理）
  // ============================================

  /**
   * 创建订阅
   * POST /subscriptions
   *
   * 用途：Super Admin直接为租户创建订阅（不需要支付流程）
   */
  fastify.post('/subscriptions', {
    schema: {
      tags: ['plugins', 'resend', 'admin'],
      summary: 'Create Subscription (Admin)',
      hide: true, // Internal admin route
      body: {
        type: 'object',
        required: ['planId'],
        properties: {
          planId: { type: 'string' },
          customerId: { type: 'string' },
          trialDays: { type: 'number' },
          paymentMethodId: { type: 'string' },
          metadata: { type: 'object', additionalProperties: true }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            subscription: { type: 'object', additionalProperties: true }
          }
        }
      }
    },
    preHandler: async (request: any, reply: any) => {
      // API 调用次数限制检查
      const apiCallCheck = await fastify.checkUsageLimit(
        request.tenant.id,
        'resend',
        'api_calls'
      )

      if (!apiCallCheck.allowed) {
        return reply.status(429).send({
          error: 'API call limit exceeded',
          current: apiCallCheck.current,
          limit: apiCallCheck.limit,
          percentage: apiCallCheck.percentage,
          upgradeUrl: `/plugins/resend/upgrade`
        })
      }

      // 记录 API 调用次数
      await fastify.recordPluginUsage(request.tenant.id, 'resend', 'api_calls')

      const subscriptionCheck = await fastify.checkSubscriptionAccess(
        request.tenant.id,
        'resend',
        'subscriptions'
      )

      if (!subscriptionCheck.allowed) {
        return reply.status(402).send({
          error: 'Subscription required',
          reason: subscriptionCheck.reason,
          upgradeUrl: subscriptionCheck.upgradeUrl
        })
      }

      await fastify.recordPluginUsage(request.tenant.id, 'resend', 'subscriptions')
    }
  }, async (request: any, reply: any) => {
    const { planId, customerId, trialDays, paymentMethodId, metadata } = request.body

    try {
      // 获取租户的 Stripe 配置
      const stripeConfig = await getStripeConfig(request.tenant.id);
      const stripe = createStripeInstance(stripeConfig.secretKey);

      // 获取订阅计划
      const plugin = await fastify.prisma.plugin.findUnique({
        where: { slug: 'resend' }
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
            pluginSlug: 'resend'
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
          pluginSlug: 'resend',
          planId,
          ...metadata
        }
      })

      // 创建本地订阅记录
      const localSubscription = await fastify.createSubscription(
        request.tenant.id,
        'resend',
        planId,
        {
          stripeSubscriptionId: stripeSubscription.id,
          stripeCustomerId,
          trialDays: trialDays || subscriptionPlan.trialDays,
          initiatedBy: 'admin',
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

  /**
   * 获取订阅详情
   * GET /subscriptions/:id
   *
   * 用途：Super Admin查询订阅详细信息（包含发票和历史记录）
   */
  fastify.get('/subscriptions/:id', {
    schema: {
      tags: ['plugins', 'resend', 'admin'],
      summary: 'Get Subscription Details (Admin)',
      hide: true, // Internal admin route
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            subscription: { type: 'object', additionalProperties: true }
          }
        }
      }
    },
    preHandler: async (request: any, reply: any) => {
      // API 调用次数限制检查
      const apiCallCheck = await fastify.checkUsageLimit(
        request.tenant.id,
        'resend',
        'api_calls'
      )

      if (!apiCallCheck.allowed) {
        return reply.status(429).send({
          error: 'API call limit exceeded',
          current: apiCallCheck.current,
          limit: apiCallCheck.limit,
          percentage: apiCallCheck.percentage,
          upgradeUrl: `/plugins/resend/upgrade`
        })
      }

      // 记录 API 调用次数
      await fastify.recordPluginUsage(request.tenant.id, 'resend', 'api_calls')

      const subscriptionCheck = await fastify.checkSubscriptionAccess(
        request.tenant.id,
        'resend'
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
      // 获取租户的 Stripe 配置
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

  /**
   * 更新订阅
   * PUT /subscriptions/:id
   *
   * 用途：Super Admin直接修改订阅计划（立即生效）
   */
  fastify.put('/subscriptions/:id', {
    schema: {
      tags: ['plugins', 'resend', 'admin'],
      summary: 'Update Subscription (Admin)',
      hide: true, // Internal admin route
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['planId'],
        properties: {
          planId: { type: 'string' },
          prorationBehavior: { type: 'string', enum: ['create_prorations', 'none', 'always_invoice'] }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            subscription: { type: 'object', additionalProperties: true }
          }
        }
      }
    },
    preHandler: async (request: any, reply: any) => {
      // API 调用次数限制检查
      const apiCallCheck = await fastify.checkUsageLimit(
        request.tenant.id,
        'resend',
        'api_calls'
      )

      if (!apiCallCheck.allowed) {
        return reply.status(429).send({
          error: 'API call limit exceeded',
          current: apiCallCheck.current,
          limit: apiCallCheck.limit,
          percentage: apiCallCheck.percentage,
          upgradeUrl: `/plugins/resend/upgrade`
        })
      }

      // 记录 API 调用次数
      await fastify.recordPluginUsage(request.tenant.id, 'resend', 'api_calls')

      const subscriptionCheck = await fastify.checkSubscriptionAccess(
        request.tenant.id,
        'resend',
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
      // 获取租户的 Stripe 配置
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
        initiatedBy: 'admin',
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

  /**
   * 取消订阅
   * DELETE /subscriptions/:id
   *
   * 用途：Super Admin直接取消订阅（支持立即取消或延期取消）
   */
  fastify.delete('/subscriptions/:id', {
    schema: {
      tags: ['plugins', 'resend', 'admin'],
      summary: 'Cancel Subscription (Admin)',
      hide: true, // Internal admin route
      params: {
        type: 'object',
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
          properties: {
            success: { type: 'boolean' },
            subscription: { type: 'object', additionalProperties: true }
          }
        }
      }
    },
    preHandler: async (request: any, reply: any) => {
      // API 调用次数限制检查
      const apiCallCheck = await fastify.checkUsageLimit(
        request.tenant.id,
        'resend',
        'api_calls'
      )

      if (!apiCallCheck.allowed) {
        return reply.status(429).send({
          error: 'API call limit exceeded',
          current: apiCallCheck.current,
          limit: apiCallCheck.limit,
          percentage: apiCallCheck.percentage,
          upgradeUrl: `/plugins/resend/upgrade`
        })
      }

      // 记录 API 调用次数
      await fastify.recordPluginUsage(request.tenant.id, 'resend', 'api_calls')

      const subscriptionCheck = await fastify.checkSubscriptionAccess(
        request.tenant.id,
        'resend'
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
      // 获取租户的 Stripe 配置
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
        reason || 'Canceled by admin'
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
};

export default resendEmail;


