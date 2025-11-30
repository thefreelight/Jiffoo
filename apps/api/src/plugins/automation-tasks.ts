import { prisma } from '@/config/database';

// ============================================
// 佣金结算辅助函数
// ============================================

const CommissionStatus = {
  PENDING: 'PENDING',
  SETTLED: 'SETTLED',
  PAID: 'PAID',
  REFUNDED: 'REFUNDED'
} as const;

/**
 * 定时任务：结算到期的佣金
 */
async function settlePendingCommissions(): Promise<number> {
  const now = new Date();

  const pendingCommissions = await prisma.commission.findMany({
    where: {
      status: CommissionStatus.PENDING,
      settleAt: { lte: now }
    }
  });

  let settledCount = 0;

  for (const commission of pendingCommissions) {
    try {
      await prisma.$transaction([
        prisma.commission.update({
          where: { id: commission.id },
          data: {
            status: CommissionStatus.SETTLED,
            settledAt: now
          }
        }),

        prisma.user.update({
          where: { id: commission.userId },
          data: {
            pendingBalance: { decrement: commission.amount },
            availableBalance: { increment: commission.amount }
          }
        })
      ]);

      settledCount++;
    } catch (error) {
      console.error(`Failed to settle commission ${commission.id}:`, error);
    }
  }

  return settledCount;
}

// 自动化任务插件 - 处理订阅生命周期自动化
async function automationTasks(fastify: any, _options: any) { // eslint-disable-line @typescript-eslint/no-unused-vars

  // ============================================
  // 📧 简单通知装饰器（暂时用日志替代）
  // ============================================

  fastify.decorate('sendNotification', async function (tenantId: number, notification: any) {
    // 暂时用日志记录通知，后续可以集成邮件/短信服务
    fastify.log.info(`📧 [Tenant ${tenantId}] ${notification.type}: ${notification.title}`)
    fastify.log.info(`   Message: ${notification.message}`)
    if (notification.actionUrl) {
      fastify.log.info(`   Action: ${notification.actionUrl}`)
    }

    // TODO: 这里可以集成真实的通知服务
    // - 邮件通知
    // - 短信通知
    // - 站内消息
    // - Webhook通知

    return { success: true, notificationId: `log_${Date.now()}` }
  })

  // ============================================
  // 🎯 核心自动化任务函数
  // ============================================

  // 1. 订阅到期自动处理
  fastify.decorate('processExpiredSubscriptions', async function () {
    const now = new Date()
    fastify.log.info('🔄 Processing expired subscriptions...')

    // 查找已到期但状态仍为active的订阅
    const expiredSubscriptions = await fastify.prisma.subscription.findMany({
      where: {
        status: 'active',
        currentPeriodEnd: { lt: now },
        autoRenew: false // 不自动续费的订阅
      },
      include: { tenant: true, plugin: true }
    })

    let processedCount = 0
    let errorCount = 0

    for (const subscription of expiredSubscriptions) {
      try {
        // 更新订阅状态为过期
        await fastify.updateSubscription(subscription.id, {
          status: 'expired',
          reason: 'Subscription expired - auto renewal disabled',
          eventSource: 'automation',
          initiatedBy: 'system'
        })

        // 发送过期通知
        await fastify.sendNotification(subscription.tenantId, {
          type: 'subscription_expired',
          title: `${subscription.plugin.name} Subscription Expired`,
          message: `Your ${subscription.plugin.name} subscription expired on ${subscription.currentPeriodEnd.toLocaleDateString()}. Please renew to continue using the service.`,
          actionUrl: `/subscriptions/renew/${subscription.id}`,
          priority: 'high'
        })

        processedCount++
        fastify.log.info(`✅ Processed expired subscription: ${subscription.id}`)
      } catch (error) {
        errorCount++
        fastify.log.error(`❌ Failed to process expired subscription ${subscription.id}:`, error)
      }
    }

    return { processedCount, errorCount, totalFound: expiredSubscriptions.length }
  })

  // 2. 试用期到期自动转换
  fastify.decorate('processTrialExpirations', async function () {
    const now = new Date()
    fastify.log.info('⏰ Processing trial expirations...')

    // 查找试用期已结束的订阅
    const expiredTrials = await fastify.prisma.subscription.findMany({
      where: {
        status: 'trialing',
        trialEnd: { lt: now }
      },
      include: { tenant: true, plugin: true }
    })

    let convertedCount = 0
    let canceledCount = 0
    let errorCount = 0

    for (const subscription of expiredTrials) {
      try {
        // 检查是否有有效的支付方式
        const hasPaymentMethod = subscription.stripeCustomerId && subscription.stripeSubscriptionId

        if (hasPaymentMethod) {
          // 转换为付费订阅
          await fastify.updateSubscription(subscription.id, {
            status: 'active',
            reason: 'Trial period ended - converted to paid subscription',
            eventSource: 'automation',
            initiatedBy: 'system'
          })

          // 发送转换通知
          await fastify.sendNotification(subscription.tenantId, {
            type: 'trial_converted',
            title: `${subscription.plugin.name} Trial Period Ended`,
            message: `Your ${subscription.plugin.name} trial period has ended and has been automatically converted to a paid subscription.`,
            actionUrl: `/subscriptions/${subscription.id}`,
            priority: 'medium'
          })

          convertedCount++
          fastify.log.info(`✅ Converted trial to paid: ${subscription.id}`)
        } else {
          // 取消订阅
          await fastify.cancelSubscription(subscription.id, false, 'Trial period ended - no payment method')

          // 发送取消通知
          await fastify.sendNotification(subscription.tenantId, {
            type: 'trial_expired',
            title: `${subscription.plugin.name} Trial Period Expired`,
            message: `Your ${subscription.plugin.name} trial period has expired and the subscription has been canceled. Please resubscribe to continue using the service.`,
            actionUrl: `/plugins/${subscription.plugin.slug}/subscribe`,
            priority: 'high'
          })

          canceledCount++
          fastify.log.info(`✅ Canceled expired trial: ${subscription.id}`)
        }
      } catch (error) {
        errorCount++
        fastify.log.error(`❌ Failed to process trial expiration ${subscription.id}:`, error)
      }
    }

    return { convertedCount, canceledCount, errorCount, totalFound: expiredTrials.length }
  })

  // 3. 使用量超限自动处理
  fastify.decorate('processUsageLimitViolations', async function () {
    fastify.log.info('📊 Processing usage limit violations...')

    const tenants = await fastify.prisma.tenant.findMany({
      where: { status: 'active' }
    })

    let warningCount = 0
    let suspendedCount = 0
    let errorCount = 0

    for (const tenant of tenants) {
      try {
        // 获取租户的所有活跃插件安装
        const installations = await fastify.prisma.pluginInstallation.findMany({
          where: {
            tenantId: tenant.id,
            status: 'ACTIVE'
          },
          include: { plugin: true }
        })

        for (const installation of installations) {
          try {
            // 检查主要使用量指标
            const usageCheck = await fastify.checkUsageLimit(tenant.id, installation.plugin.slug, 'general')

            if (usageCheck.percentage >= 100) {
              // 使用量超限，暂停服务
              await fastify.prisma.pluginInstallation.update({
                where: { id: installation.id },
                data: {
                  status: 'SUSPENDED',
                  suspendedAt: new Date(),
                  suspensionReason: `Usage limit exceeded: ${usageCheck.current}/${usageCheck.limit}`
                }
              })

              // 发送超限通知
              await fastify.sendNotification(tenant.id, {
                type: 'usage_limit_exceeded',
                title: `${installation.plugin.name} Usage Limit Exceeded`,
                message: `Your ${installation.plugin.name} usage has exceeded the limit (${usageCheck.current}/${usageCheck.limit}). Service has been suspended. Please upgrade your plan or contact support.`,
                actionUrl: `/plugins/${installation.plugin.slug}/upgrade`,
                priority: 'critical'
              })

              suspendedCount++
              fastify.log.warn(`⚠️ Suspended plugin ${installation.plugin.slug} for tenant ${tenant.id} due to usage limit`)

            } else if (usageCheck.percentage >= 90) {
              // 使用量接近限制，发送警告
              await fastify.sendNotification(tenant.id, {
                type: 'usage_limit_warning',
                title: `${installation.plugin.name} Usage Warning`,
                message: `Your ${installation.plugin.name} usage has reached ${usageCheck.percentage}% (${usageCheck.current}/${usageCheck.limit}). Please consider upgrading your plan.`,
                actionUrl: `/plugins/${installation.plugin.slug}/upgrade`,
                priority: 'medium'
              })

              warningCount++
            }
          } catch (pluginError) {
            fastify.log.error(`Failed to check usage for plugin ${installation.plugin.slug}:`, pluginError)
          }
        }
      } catch (error) {
        errorCount++
        fastify.log.error(`❌ Failed to process usage limits for tenant ${tenant.id}:`, error)
      }
    }

    return { warningCount, suspendedCount, errorCount, totalTenants: tenants.length }
  })

  // 4. 续费提醒任务
  fastify.decorate('sendRenewalReminders', async function () {
    const now = new Date()
    fastify.log.info('🔔 Sending renewal reminders...')

    // 7天提醒
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const subscriptions7Days = await fastify.prisma.subscription.findMany({
      where: {
        status: 'active',
        currentPeriodEnd: {
          gte: now,
          lte: in7Days
        },
        renewalNotificationSent: false,
        autoRenew: true
      },
      include: { tenant: true, plugin: true }
    })

    // 3天提醒
    const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
    const subscriptions3Days = await fastify.prisma.subscription.findMany({
      where: {
        status: 'active',
        currentPeriodEnd: {
          gte: now,
          lte: in3Days
        },
        autoRenew: true
      },
      include: { tenant: true, plugin: true }
    })

    let reminderCount = 0
    let errorCount = 0

    // 处理7天提醒
    for (const subscription of subscriptions7Days) {
      try {
        await fastify.sendNotification(subscription.tenantId, {
          type: 'renewal_reminder_7d',
          title: `${subscription.plugin.name} Subscription Renewal Reminder`,
          message: `Your ${subscription.plugin.name} subscription will automatically renew within 7 days. Renewal amount: ${subscription.currency} ${subscription.amount}.`,
          actionUrl: `/subscriptions/${subscription.id}`,
          priority: 'low'
        })

        // 标记7天提醒已发送
        await fastify.prisma.subscription.update({
          where: { id: subscription.id },
          data: { renewalNotificationSent: true }
        })

        reminderCount++
      } catch (error) {
        errorCount++
        fastify.log.error(`Failed to send 7-day renewal reminder for ${subscription.id}:`, error)
      }
    }

    // 处理3天紧急提醒
    for (const subscription of subscriptions3Days) {
      try {
        await fastify.sendNotification(subscription.tenantId, {
          type: 'renewal_reminder_3d',
          title: `${subscription.plugin.name} Subscription Renewal Reminder`,
          message: `Your ${subscription.plugin.name} subscription will automatically renew within 3 days. If you need to cancel, please take action promptly.`,
          actionUrl: `/subscriptions/${subscription.id}`,
          priority: 'medium'
        })

        reminderCount++
      } catch (error) {
        errorCount++
        fastify.log.error(`Failed to send 3-day renewal reminder for ${subscription.id}:`, error)
      }
    }

    return { reminderCount, errorCount, total7Day: subscriptions7Days.length, total3Day: subscriptions3Days.length }
  })

  // 5. 逾期订阅处理
  fastify.decorate('processPastDueSubscriptions', async function () {
    const now = new Date()
    const gracePeriod = 3 * 24 * 60 * 60 * 1000 // 3天宽限期
    const cutoffDate = new Date(now.getTime() - gracePeriod)

    fastify.log.info('💳 Processing past due subscriptions...')

    // 查找逾期超过宽限期的订阅
    const pastDueSubscriptions = await fastify.prisma.subscription.findMany({
      where: {
        status: 'past_due',
        currentPeriodEnd: { lt: cutoffDate }
      },
      include: { tenant: true, plugin: true }
    })

    let canceledCount = 0
    let errorCount = 0

    for (const subscription of pastDueSubscriptions) {
      try {
        // 取消逾期订阅
        await fastify.cancelSubscription(subscription.id, false, 'Payment overdue - grace period expired')

        // 发送取消通知
        await fastify.sendNotification(subscription.tenantId, {
          type: 'subscription_canceled_overdue',
          title: `${subscription.plugin.name} Subscription Canceled`,
          message: `Your ${subscription.plugin.name} subscription has been canceled due to payment overdue beyond the grace period. To restore service, please resubscribe.`,
          actionUrl: `/plugins/${subscription.plugin.slug}/subscribe`,
          priority: 'critical'
        })

        canceledCount++
        fastify.log.info(`✅ Canceled overdue subscription: ${subscription.id}`)
      } catch (error) {
        errorCount++
        fastify.log.error(`❌ Failed to cancel overdue subscription ${subscription.id}:`, error)
      }
    }

    return { canceledCount, errorCount, totalFound: pastDueSubscriptions.length }
  })

  // 🆕 6. Free计划自动续费处理
  fastify.decorate('processFreeSubscriptionRenewals', async function () {
    const now = new Date()
    fastify.log.info('🆓 Processing Free subscription renewals...')

    // 查找需要续费的Free订阅（已到期且自动续费开启）
    const freeSubscriptions = await fastify.prisma.subscription.findMany({
      where: {
        planId: 'free',
        status: 'active',
        currentPeriodEnd: { lt: now },
        autoRenew: true,
        cancelAtPeriodEnd: false
      },
      include: { plugin: true }
    })

    let renewedCount = 0
    let errorCount = 0

    for (const subscription of freeSubscriptions) {
      try {
        fastify.log.info(`🔄 Processing Free subscription renewal: ${subscription.id}`)

        // 🆕 方案B：创建新订阅模式（与付费计划一致）
        // 1. 标记旧订阅为完成
        await fastify.updateSubscription(subscription.id, {
          status: 'canceled',
          canceledAt: new Date(),
          eventSource: 'automation',
          initiatedBy: 'system',
          reason: 'Free subscription cycle completed - renewed to new cycle'
        })

        // 2. 创建新订阅周期（相同Free计划）
        const newSubscription = await fastify.createSubscription(
          subscription.tenantId,
          subscription.plugin.slug,
          'free', // Free计划
          {
            autoRenew: true,
            eventSource: 'automation',
            initiatedBy: 'system',
            reason: 'Free subscription renewed - new billing cycle',
            metadata: {
              previousSubscriptionId: subscription.id,
              renewalType: 'automatic_free',
              renewedAt: new Date().toISOString()
            }
          }
        )

        // 3. 记录续费变更
        await fastify.prisma.subscriptionChange.create({
          data: {
            subscriptionId: newSubscription.id,
            changeType: 'renewed',
            fromPlanId: 'free',
            toPlanId: 'free',
            fromAmount: 0,
            toAmount: 0,
            effectiveDate: new Date(),
            reason: 'Automatic Free subscription renewal',
            initiatedBy: 'system'
          }
        })

        renewedCount++
        fastify.log.info(`✅ Free subscription renewed successfully: ${subscription.id} → ${newSubscription.id}`)
      } catch (error) {
        errorCount++
        fastify.log.error(`❌ Failed to renew Free subscription ${subscription.id}:`, error)
      }
    }

    return { renewedCount, errorCount, totalFound: freeSubscriptions.length }
  })

  // 🆕 6. 处理过期订单
  fastify.decorate('processExpiredOrders', async function () {
    const now = new Date()
    fastify.log.info('🔄 Processing expired orders...')
    fastify.log.info(`Current time for comparison: ${now.toISOString()} (${now.toString()})`)

    // 查找过期的未支付订单
    const expiredOrders = await fastify.prisma.order.findMany({
      where: {
        status: 'PENDING',
        paymentStatus: 'UNPAID',
        expiresAt: { lt: now }
      },
      include: {
        items: true,
        inventoryReservations: true
      }
    })

    fastify.log.info(`Found ${expiredOrders.length} expired orders`)
    if (expiredOrders.length > 0) {
      fastify.log.info('Expired orders:', expiredOrders.map(o => ({
        id: o.id,
        expiresAt: o.expiresAt,
        status: o.status,
        paymentStatus: o.paymentStatus
      })))
    }

    let processedCount = 0
    let errorCount = 0

    for (const order of expiredOrders) {
      try {
        await fastify.prisma.$transaction(async (tx: any) => {
          // 1. 更新订单状态
          await tx.order.update({
            where: { id: order.id },
            data: {
              status: 'CANCELLED',
              paymentStatus: 'FAILED',
              cancelReason: 'Payment timeout - order expired after 30 minutes',
              cancelledAt: now
            }
          })

          // 2. 释放库存预留
          await tx.inventoryReservation.updateMany({
            where: {
              orderId: order.id,
              status: 'ACTIVE'
            },
            data: {
              status: 'RELEASED'
            }
          })

          fastify.log.info(`✅ Cancelled expired order: ${order.id}`)
          processedCount++
        })
      } catch (error) {
        errorCount++
        fastify.log.error(`❌ Failed to process expired order ${order.id}:`, error)
      }
    }

    return { processedCount, errorCount, totalFound: expiredOrders.length }
  })

  // ============================================
  // 🚀 API端点 - 手动触发自动化任务
  // ============================================

  // 运行所有自动化任务
  fastify.post('/automation/run-all', {
    schema: {
      hide: true,
      tags: ['plugins', 'automation'],
      summary: 'Run All Automation Tasks',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            results: { type: 'object', additionalProperties: true }
          }
        },
        '5xx': { type: 'object', additionalProperties: true }
      }
    }
  }, async (request: any, reply: any) => {
    const startTime = Date.now()
    fastify.log.info('🤖 Running all automation tasks...')

    try {
      const results = {
        expiredSubscriptions: await fastify.processExpiredSubscriptions(),
        trialExpirations: await fastify.processTrialExpirations(),
        usageLimitViolations: await fastify.processUsageLimitViolations(),
        renewalReminders: await fastify.sendRenewalReminders(),
        pastDueSubscriptions: await fastify.processPastDueSubscriptions(),
        freeSubscriptionRenewals: await fastify.processFreeSubscriptionRenewals(), // 🆕 Free订阅续费
        expiredOrders: await fastify.processExpiredOrders(),  // 🆕 过期订单处理
        executionTime: Date.now() - startTime
      }

      fastify.log.info(`✅ All automation tasks completed in ${results.executionTime}ms`)
      return { success: true, results }
    } catch (error) {
      fastify.log.error('❌ Automation tasks failed:', error)
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // 单独运行订阅到期处理
  fastify.post('/automation/expired-subscriptions', {
    schema: {
      hide: true,
      tags: ['plugins', 'automation'],
      summary: 'Run Expired Subscriptions Task',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            result: { type: 'object', additionalProperties: true }
          }
        },
        '5xx': { type: 'object', additionalProperties: true }
      }
    }
  }, async (request: any, reply: any) => {
    try {
      const result = await fastify.processExpiredSubscriptions()
      return { success: true, result }
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // 单独运行试用期处理
  fastify.post('/automation/trial-expirations', {
    schema: {
      hide: true,
      tags: ['plugins', 'automation'],
      summary: 'Run Trial Expirations Task',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            result: { type: 'object', additionalProperties: true }
          }
        },
        '5xx': { type: 'object', additionalProperties: true }
      }
    }
  }, async (request: any, reply: any) => {
    try {
      const result = await fastify.processTrialExpirations()
      return { success: true, result }
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // 单独运行使用量检查
  fastify.post('/automation/usage-limits', {
    schema: {
      hide: true,
      tags: ['plugins', 'automation'],
      summary: 'Run Usage Limits Task',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            result: { type: 'object', additionalProperties: true }
          }
        },
        '5xx': { type: 'object', additionalProperties: true }
      }
    }
  }, async (request: any, reply: any) => {
    try {
      const result = await fastify.processUsageLimitViolations()
      return { success: true, result }
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // 单独发送续费提醒
  fastify.post('/automation/renewal-reminders', {
    schema: {
      hide: true,
      tags: ['plugins', 'automation'],
      summary: 'Run Renewal Reminders Task',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            result: { type: 'object', additionalProperties: true }
          }
        },
        '5xx': { type: 'object', additionalProperties: true }
      }
    }
  }, async (request: any, reply: any) => {
    try {
      const result = await fastify.sendRenewalReminders()
      return { success: true, result }
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // 单独处理逾期订阅
  fastify.post('/automation/past-due-subscriptions', {
    schema: {
      hide: true,
      tags: ['plugins', 'automation'],
      summary: 'Run Past Due Subscriptions Task',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            result: { type: 'object', additionalProperties: true }
          }
        },
        '5xx': { type: 'object', additionalProperties: true }
      }
    }
  }, async (request: any, reply: any) => {
    try {
      const result = await fastify.processPastDueSubscriptions()
      return { success: true, result }
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // 🆕 单独处理Free订阅续费
  fastify.post('/automation/free-subscription-renewals', {
    schema: {
      hide: true,
      tags: ['plugins', 'automation'],
      summary: 'Run Free Subscription Renewals Task',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            result: { type: 'object', additionalProperties: true }
          }
        },
        '5xx': { type: 'object', additionalProperties: true }
      }
    }
  }, async (request: any, reply: any) => {
    try {
      const result = await fastify.processFreeSubscriptionRenewals()
      return { success: true, result }
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // 🆕 单独处理过期订单
  fastify.post('/automation/expired-orders', {
    schema: {
      hide: true,
      tags: ['plugins', 'automation'],
      summary: 'Run Expired Orders Task',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            result: { type: 'object', additionalProperties: true }
          }
        },
        '5xx': { type: 'object', additionalProperties: true }
      }
    }
  }, async (request: any, reply: any) => {
    try {
      const result = await fastify.processExpiredOrders()
      return { success: true, result }
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // 🆕 处理佣金结算
  fastify.post('/automation/settle-commissions', {
    schema: {
      hide: true,
      tags: ['plugins', 'automation'],
      summary: 'Run Settle Commissions Task',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            result: { type: 'object', additionalProperties: true }
          }
        },
        '5xx': { type: 'object', additionalProperties: true }
      }
    }
  }, async (request: any, reply: any) => {
    try {
      const result = await settlePendingCommissions();
      return { success: true, result };
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 获取自动化任务状态
  fastify.get('/automation/status', {
    schema: {
      hide: true,
      tags: ['plugins', 'automation'],
      summary: 'Get Automation Status',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            stats: { type: 'object', additionalProperties: true },
            timestamp: { type: 'string' }
          }
        },
        '5xx': { type: 'object', additionalProperties: true }
      }
    }
  }, async (request: any, reply: any) => {
    try {
      const now = new Date()

      // 统计各种状态的订阅数量
      const stats = {
        activeSubscriptions: await fastify.prisma.subscription.count({
          where: { status: 'active' }
        }),
        trialingSubscriptions: await fastify.prisma.subscription.count({
          where: { status: 'trialing' }
        }),
        expiredSubscriptions: await fastify.prisma.subscription.count({
          where: {
            status: 'active',
            currentPeriodEnd: { lt: now },
            autoRenew: false
          }
        }),
        expiredTrials: await fastify.prisma.subscription.count({
          where: {
            status: 'trialing',
            trialEnd: { lt: now }
          }
        }),
        pastDueSubscriptions: await fastify.prisma.subscription.count({
          where: { status: 'past_due' }
        }),
        pendingRenewalReminders: await fastify.prisma.subscription.count({
          where: {
            status: 'active',
            currentPeriodEnd: {
              gte: now,
              lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
            },
            renewalNotificationSent: false
          }
        }),
        // 🆕 Free订阅续费统计
        pendingFreeRenewals: await fastify.prisma.subscription.count({
          where: {
            planId: 'free',
            status: 'active',
            currentPeriodEnd: { lt: now },
            autoRenew: true,
            cancelAtPeriodEnd: false
          }
        }),
        // 🆕 待结算佣金统计
        pendingCommissions: await fastify.prisma.commission.count({
          where: {
            status: 'PENDING',
            settleAt: { lte: now }
          }
        })
      }

      return { success: true, stats, timestamp: now.toISOString() }
    } catch (error) {
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  fastify.log.info('🤖 Automation Tasks plugin loaded successfully')
}

// 使用fastify-plugin包装，使装饰器在全局可用
import fp from 'fastify-plugin'
export default fp(automationTasks, {
  name: 'automation-tasks',
  fastify: '5.x'
})
