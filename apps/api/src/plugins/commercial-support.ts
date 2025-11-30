import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

/**
 * Commercial Support Plugin
 *
 * 提供插件商业化支持功能：
 * - 许可证验证（支持标准模式和商业化定制模式）
 * - 使用量记录和限制检查
 * - 订阅管理（创建、更新、取消、暂停、恢复）
 * - 订阅访问权限检查
 * - Webhook 事件处理
 */
const commercialSupport: FastifyPluginAsync = async (fastify, _options) => {
  // 装饰器：许可证验证 - 支持双模式（普通模式 + 商业化模式）
  fastify.decorate('checkPluginLicense', async function(tenantId: number, pluginSlug: string, feature?: string) {
    const installation = await fastify.prisma.pluginInstallation.findFirst({
      where: {
        tenantId,
        plugin: { slug: pluginSlug },
        status: 'ACTIVE'
      },
      include: { plugin: true }
    })

    if (!installation) {
      return {
        valid: false,
        reason: 'PLUGIN_NOT_INSTALLED',
        upgradeUrl: `/plugins/${pluginSlug}/install`
      }
    }

    if (feature) {
      // 🔥 商业化模式：优先检查租户级别的功能覆盖
      const featureOverride = await fastify.prisma.tenantFeatureOverride.findFirst({
        where: {
          tenantId,
          pluginSlug,
          feature
        }
      })

      if (featureOverride) {
        // 如果有覆盖设置，直接使用覆盖结果
        return {
          valid: featureOverride.enabled,
          reason: featureOverride.enabled ? 'CUSTOM_ENABLED' : 'CUSTOM_DISABLED',
          customReason: featureOverride.reason,
          mode: 'COMMERCIAL'
        }
      }

      // 🔥 商业化模式：检查租户定制定价
      const customPricing = await fastify.prisma.tenantCustomPricing.findFirst({
        where: {
          tenantId,
          pluginId: installation.pluginId,
          validFrom: { lte: new Date() },
          OR: [
            { validTo: null },
            { validTo: { gte: new Date() } }
          ]
        }
      })

      if (customPricing) {
        // 使用定制定价的功能列表
        const customFeatures = JSON.parse(customPricing.features)
        const hasFeature = customFeatures.includes(feature) || customFeatures.includes('all_features')

        return {
          valid: hasFeature,
          reason: hasFeature ? 'CUSTOM_PLAN_INCLUDED' : 'CUSTOM_PLAN_NOT_INCLUDED',
          currentPlan: customPricing.planId,
          mode: 'COMMERCIAL',
          upgradeUrl: hasFeature ? undefined : `/plugins/${pluginSlug}/upgrade`
        }
      }

      // 🔧 修复：统一数据源 - 从subscriptions表获取当前计划
      const activeSubscription = await fastify.prisma.subscription.findFirst({
        where: {
          tenantId,
          pluginId: installation.plugin.id,
          status: { in: ['active', 'trialing', 'past_due'] }
        },
        orderBy: { createdAt: 'desc' }
      })
      const currentPlan = activeSubscription?.planId || 'free'

      // 📋 普通模式：使用标准定价检查
      // 🔧 修复：使用subscription_plans表替代plugin.pricing
      const subscriptionPlan = await fastify.prisma.subscriptionPlan.findUnique({
        where: {
          pluginId_planId: {
            pluginId: installation.plugin.id,
            planId: currentPlan
          }
        }
      })

      // 获取计划功能列表
      let planFeatures: string[] = []
      if (subscriptionPlan) {
        planFeatures = JSON.parse(subscriptionPlan.features || '[]')
      }

      if (!planFeatures.includes(feature) && !planFeatures.includes('all_features')) {
        return {
          valid: false,
          reason: 'FEATURE_NOT_INCLUDED',
          upgradeUrl: `/plugins/${pluginSlug}/upgrade`,
          currentPlan,
          requiredFeature: feature,
          mode: 'STANDARD'
        }
      }
    }

    return { valid: true, installation, mode: 'STANDARD' }
  })

  // 装饰器：Affiliate 插件许可证检查（买断制模型）
  fastify.decorate('checkAffiliateLicense', async function(tenantId: number) {
    const license = await fastify.prisma.pluginLicense.findFirst({
      where: {
        tenantId,
        plugin: { slug: 'affiliate' },
        status: 'ACTIVE'
      },
      include: { plugin: true }
    })

    if (!license) {
      return {
        valid: false,
        reason: 'LICENSE_NOT_FOUND',
        message: 'Affiliate Commission plugin license not found or not active',
        upgradeUrl: '/plugins/affiliate/install'
      }
    }

    return {
      valid: true,
      license,
      mode: 'BUYOUT' // 买断制模式
    }
  })

  // 装饰器：通用使用量重置（支持 Free Plan 和 Paid Plan）
  // 注意：不删除旧记录，保留历史数据用于审计和报告
  fastify.decorate('resetPluginUsageForPeriod', async function(
    tenantId: number,
    pluginSlug: string,
    newPeriod: string,
    metrics?: string[]
  ) {
    // 根据插件类型确定使用量指标
    if (!metrics) {
      if (pluginSlug === 'stripe') {
        metrics = ['transactions', 'api_calls', 'refunds']
      } else if (pluginSlug === 'resend') {
        metrics = ['api_calls', 'emails_sent']
      } else if (pluginSlug === 'google') {
        metrics = ['api_calls', 'login_attempts']
      } else if (pluginSlug === 'affiliate') {
        // Affiliate 插件使用量指标（买断制，无限制）
        metrics = ['referral_codes_generated', 'commissions_calculated', 'payouts_processed']
      } else {
        // 默认：只有api_calls
        metrics = ['api_calls']
      }
    }
    try {
      fastify.log.info(`🔄 Resetting usage for tenant ${tenantId}, plugin ${pluginSlug}, period: ${newPeriod}`)

      // 1. 检查是否已经重置过（幂等性）
      const existingUsage = await fastify.prisma.pluginUsage.findFirst({
        where: { tenantId, pluginSlug, period: newPeriod }
      })

      if (existingUsage) {
        fastify.log.info(`✅ Usage already reset for period ${newPeriod}, skipping`)
        return
      }

      // 2. 创建新周期的使用量记录（从 0 开始）
      // 旧记录保留在数据库中，用于历史查询和审计
      const usageData = metrics.map(metric => ({
        tenantId,
        pluginSlug,
        metricName: metric,
        value: 0,
        period: newPeriod
      }))

      await fastify.prisma.pluginUsage.createMany({
        data: usageData,
        skipDuplicates: true
      })

      fastify.log.info(`✅ Usage reset completed for period ${newPeriod} (historical records preserved)`)
    } catch (error: any) {
      fastify.log.error('Failed to reset plugin usage:', error)
      throw error
    }
  })

  // 装饰器：检查并处理过期订阅（懒加载续费）
  fastify.decorate('checkAndRenewExpiredSubscription', async function(
    tenantId: number,
    pluginSlug: string
  ) {
    try {
      const now = new Date()

      // 1. 查找当前活跃订阅（包含宽限期状态）
      const subscription = await fastify.prisma.subscription.findFirst({
        where: {
          tenantId: tenantId,
          plugin: { slug: pluginSlug },
          status: { in: ['active', 'trialing', 'past_due'] }  // ✅ 包含past_due（宽限期）
        },
        include: {
          plugin: true
        }
      })

      if (!subscription) {
        fastify.log.warn(`No active subscription found for tenant ${tenantId}, plugin ${pluginSlug}`)
        return null
      }

      // 2. 检查订阅是否过期，如果过期则触发续费
      if (subscription.currentPeriodEnd < now) {
        fastify.log.info(`🔄 Subscription ${subscription.id} expired (${subscription.currentPeriodEnd}), triggering lazy loading renewal...`)

        if (subscription.planId === 'free') {
          // Free计划过期：创建新的Free订阅
          try {
            // 2.1 标记旧订阅为完成
            await fastify.updateSubscription(subscription.id, {
              status: 'canceled',
              canceledAt: now,
              reason: 'Free subscription expired - renewed via lazy loading',
              eventSource: 'lazy_loading',
              initiatedBy: 'system'
            })

            // 2.2 创建新订阅周期（相同Free计划）
            const newSubscription = await fastify.createSubscription(
              subscription.tenantId,
              subscription.plugin.slug,
              'free',
              {
                autoRenew: true,
                eventSource: 'lazy_loading',
                initiatedBy: 'system',
                reason: 'Free subscription renewed via lazy loading',
                metadata: {
                  previousSubscriptionId: subscription.id,
                  renewalType: 'lazy_loading_free',
                  renewedAt: now.toISOString()
                }
              }
            )

            // 2.3 记录续费变更
            await fastify.prisma.subscriptionChange.create({
              data: {
                subscriptionId: newSubscription.id,
                changeType: 'renewed',
                fromPlanId: 'free',
                toPlanId: 'free',
                fromAmount: 0,
                toAmount: 0,
                effectiveDate: now,
                reason: 'Free subscription renewed via lazy loading',
                initiatedBy: 'system'
              }
            })

            fastify.log.info(`✅ Free subscription renewed via lazy loading: ${subscription.id} → ${newSubscription.id}`)
            return newSubscription // 返回新订阅

          } catch (renewalError) {
            fastify.log.error(`Failed to renew free subscription ${subscription.id}:`, renewalError)
            return subscription // 续费失败，返回原订阅
          }
        } else {
          // 付费计划过期：记录警告，但不自动续费（应该由Stripe webhook处理）
          fastify.log.warn(`⚠️ Paid subscription ${subscription.id} expired but no webhook received. Manual intervention may be required.`)
          return subscription
        }
      }

      return subscription // 订阅未过期，返回原订阅
    } catch (error) {
      fastify.log.error('Failed to check and renew expired subscription:', error)
      return null
    }
  })

  // 装饰器：检查并在需要时重置使用量（懒加载）
  fastify.decorate('checkAndResetUsageIfNeeded', async function(
    tenantId: number,
    pluginSlug: string
  ) {
    try {
      // 1. 首先检查并处理过期订阅
      const subscription = await fastify.checkAndRenewExpiredSubscription(tenantId, pluginSlug)

      if (!subscription) {
        return
      }

      // 2. 确定当前应该使用的 period
      let currentPeriod: string
      let startDate: string
      if (subscription.planId === 'free') {
        // Free Plan: 使用月度周期 (YYYY-MM)
        startDate = subscription.currentPeriodStart.toISOString().slice(0, 7) // '2025-01'
        currentPeriod = `${subscription.id}:${startDate}`
      } else {
        // Paid Plan: 使用日期周期 (YYYY-MM-DD)
        startDate = subscription.currentPeriodStart.toISOString().split('T')[0] // '2025-01-15'
        currentPeriod = `${subscription.id}:${startDate}`
      }

      // 3. 查找最新的使用量记录
      const latestUsage = await fastify.prisma.pluginUsage.findFirst({
        where: {
          tenantId: tenantId,
          pluginSlug: pluginSlug
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      // 4. 如果最新记录的 period 与当前 period 不一致，说明周期已变化
      if (latestUsage && latestUsage.period !== currentPeriod) {
        fastify.log.info(`🔄 Period changed from ${latestUsage.period} to ${currentPeriod}, resetting usage...`)

        // 检查新 period 是否已有记录（幂等性检查）
        const newPeriodUsage = await fastify.prisma.pluginUsage.findFirst({
          where: {
            tenantId: tenantId,
            pluginSlug: pluginSlug,
            period: currentPeriod
          }
        })

        if (!newPeriodUsage) {
          // 新 period 还没有记录，执行重置
          await fastify.resetPluginUsageForPeriod(tenantId, pluginSlug, currentPeriod)
        }
      }
    } catch (error) {
      fastify.log.error('Failed to check and reset usage:', error)
      // 不抛出错误，避免影响主流程
    }
  })

  // 装饰器：使用量记录
  fastify.decorate('recordPluginUsage', async function(tenantId: number, pluginSlug: string, metric: string, value: number = 1) {
    // 异步记录，不阻塞主流程
    setImmediate(async () => {
      try {
        // 🆕 懒加载：检查并在需要时重置使用量
        await fastify.checkAndResetUsageIfNeeded(tenantId, pluginSlug)

        // 🆕 查找当前活跃订阅（关联到具体插件，包含宽限期状态）
        const subscription = await fastify.prisma.subscription.findFirst({
          where: {
            tenantId: tenantId,
            plugin: { slug: pluginSlug },
            status: { in: ['active', 'trialing', 'past_due'] }  // ✅ 包含past_due（宽限期）
          },
          include: {
            plugin: true
          }
        })

        let period: string
        if (subscription) {
          // 🎯 所有计划（包括Free）都使用订阅周期作为 period
          // 格式：'subscriptionId:YYYY-MM-DD' (付费计划) 或 'subscriptionId:YYYY-MM' (Free计划)
          let startDate: string
          if (subscription.planId === 'free') {
            // Free Plan：使用月度周期
            startDate = subscription.currentPeriodStart.toISOString().slice(0, 7) // '2025-01'
          } else {
            // 付费计划：使用日期周期
            startDate = subscription.currentPeriodStart.toISOString().split('T')[0] // '2025-01-15'
          }
          period = `${subscription.id}:${startDate}`
          fastify.log.debug(`Recording usage for ${subscription.planId} plan period: ${period}`)
        } else {
          // 🚨 这种情况不应该存在，所有计划都应该有订阅记录
          throw new Error(`No subscription found for tenant ${tenantId}, plugin ${pluginSlug}`)
        }

        await fastify.prisma.pluginUsage.upsert({
          where: {
            tenantId_pluginSlug_metricName_period: {
              tenantId, pluginSlug, metricName: metric, period
            }
          },
          update: { value: { increment: value } },
          create: { tenantId, pluginSlug, metricName: metric, value, period }
        })

        fastify.log.debug(`Usage recorded: ${pluginSlug}.${metric} += ${value} (tenant: ${tenantId}, period: ${period})`)
      } catch (error) {
        fastify.log.error('Failed to record plugin usage:', error)
      }
    })
  })

  // 装饰器：使用量限制检查 - 支持双模式
  fastify.decorate('checkUsageLimit', async function(tenantId: number, pluginSlug: string, metric: string) {
    // 🆕 懒加载：检查并在需要时重置使用量
    await fastify.checkAndResetUsageIfNeeded(tenantId, pluginSlug)

    const installation = await fastify.prisma.pluginInstallation.findFirst({
      where: { tenantId, plugin: { slug: pluginSlug }, status: 'ACTIVE' },
      include: { plugin: true }
    })

    // 检查插件是否有订阅计划（如果没有则为免费插件）
    const hasSubscriptionPlans = await fastify.prisma.subscriptionPlan.findFirst({
      where: { pluginId: installation.plugin.id }
    })

    if (!hasSubscriptionPlans) {
      return { allowed: true, mode: 'FREE' as const } // 免费插件无限制
    }

    // 🆕 查找当前活跃订阅以确定 period（包含宽限期状态）
    const subscription = await fastify.prisma.subscription.findFirst({
      where: {
        tenantId: tenantId,
        plugin: { slug: pluginSlug },
        status: { in: ['active', 'trialing', 'past_due'] }  // ✅ 包含past_due（宽限期）
      },
      include: {
        plugin: true
      }
    })

    let period: string
    if (subscription) {
      // 🎯 所有计划都使用订阅周期格式
      let startDate: string
      if (subscription.planId === 'free') {
        // Free Plan：使用月度周期
        startDate = subscription.currentPeriodStart.toISOString().slice(0, 7) // '2025-01'
      } else {
        // 付费计划：使用日期周期
        startDate = subscription.currentPeriodStart.toISOString().split('T')[0] // '2025-01-15'
      }
      period = `${subscription.id}:${startDate}`
      fastify.log.info(`🔍 [checkUsageLimit] Using ${subscription.planId} plan period: ${period} for tenant ${tenantId}, plugin ${pluginSlug}, metric ${metric}`)
    } else {
      // 🚨 这种情况不应该存在，所有计划都应该有订阅记录
      throw new Error(`No subscription found for tenant ${tenantId}, plugin ${pluginSlug}`)
    }

    // 🔥 商业化模式：优先检查租户使用量覆盖
    const usageOverride = await fastify.prisma.tenantUsageOverride.findFirst({
      where: {
        tenantId,
        pluginSlug,
        metricName: metric,
        validFrom: { lte: new Date() },
        OR: [
          { validTo: null },
          { validTo: { gte: new Date() } }
        ]
      }
    })

    if (usageOverride) {
      if (usageOverride.limitValue === -1) {
        return {
          allowed: true,
          unlimited: true,
          mode: 'COMMERCIAL' as const,
          customReason: usageOverride.reason
        }
      }

      const usage = await fastify.prisma.pluginUsage.findFirst({
        where: { tenantId, pluginSlug, metricName: metric, period }
      })

      const current = usage?.value || 0
      return {
        allowed: current < usageOverride.limitValue,
        current,
        limit: usageOverride.limitValue,
        percentage: Math.round((current / usageOverride.limitValue) * 100),
        mode: 'COMMERCIAL' as const,
        customReason: usageOverride.reason
      }
    }

    // 🔥 商业化模式：检查租户定制定价的限制
    const customPricing = await fastify.prisma.tenantCustomPricing.findFirst({
      where: {
        tenantId,
        pluginId: installation.pluginId,
        validFrom: { lte: new Date() },
        OR: [
          { validTo: null },
          { validTo: { gte: new Date() } }
        ]
      }
    })

    if (customPricing) {
      const customLimits = JSON.parse(customPricing.limits) as Record<string, number>
      const limit = customLimits[metric]

      if (limit === -1 || !limit) {
        return { allowed: true, unlimited: true, mode: 'COMMERCIAL' as const }
      }

      const usage = await fastify.prisma.pluginUsage.findFirst({
        where: { tenantId, pluginSlug, metricName: metric, period }
      })

      const current = usage?.value || 0
      return {
        allowed: current < limit,
        current,
        limit,
        percentage: Math.round((current / limit) * 100),
        mode: 'COMMERCIAL' as const
      }
    }

    // 📋 普通模式：使用标准定价限制
    // 🔧 修复：统一数据源 - 从subscriptions表获取当前计划
    const activeSubscription = await fastify.prisma.subscription.findFirst({
      where: {
        tenantId,
        pluginId: installation.plugin.id,
        status: { in: ['active', 'trialing', 'past_due'] }
      },
      orderBy: { createdAt: 'desc' }
    })
    const currentPlan = activeSubscription?.planId || 'free'

    // 🔧 修复：使用subscription_plans表替代plugin.pricing
    const subscriptionPlan = await fastify.prisma.subscriptionPlan.findUnique({
      where: {
        pluginId_planId: {
          pluginId: installation.plugin.id,
          planId: currentPlan
        }
      }
    })

    let planLimits: any = {}
    if (subscriptionPlan) {
      planLimits = JSON.parse(subscriptionPlan.limits || '{}')
    }

    const limit = planLimits[metric]

    if (limit === -1 || !limit) {
      return { allowed: true, unlimited: true, mode: 'STANDARD' as const }
    }

    const usage = await fastify.prisma.pluginUsage.findFirst({
      where: { tenantId, pluginSlug, metricName: metric, period }
    })

    const current = usage?.value || 0
    const result = {
      allowed: current < limit,
      current,
      limit,
      percentage: Math.round((current / limit) * 100),
      mode: 'STANDARD' as const
    }

    fastify.log.info(`🔍 [checkUsageLimit] Result for tenant ${tenantId}, plugin ${pluginSlug}, metric ${metric}: ${JSON.stringify(result)}`)

    return result
  })

  // ============================================
  // 🆕 订阅管理装饰器
  // ============================================

  // 装饰器：创建订阅
  fastify.decorate('createSubscription', async function(tenantId: number, pluginSlug: string, planId: string, options: any = {}) {
    const plugin = await fastify.prisma.plugin.findUnique({
      where: { slug: pluginSlug }
    })

    if (!plugin) {
      throw new Error(`Plugin ${pluginSlug} not found`)
    }

    // 检查插件是否支持订阅（通过是否有订阅计划判断）
    const subscriptionPlans = await fastify.prisma.subscriptionPlan.findMany({
      where: { pluginId: plugin.id, isActive: true }
    })

    if (subscriptionPlans.length === 0) {
      throw new Error(`Plugin ${pluginSlug} does not support subscriptions`)
    }

    // 注意：续费场景下允许创建新订阅（旧订阅会被标记为canceled）
    // 不再检查现有活跃订阅，因为续费流程会先取消旧订阅再创建新订阅

    // 获取订阅计划
    const subscriptionPlan = await fastify.prisma.subscriptionPlan.findUnique({
      where: {
        pluginId_planId: {
          pluginId: plugin.id,
          planId
        }
      }
    })

    if (!subscriptionPlan) {
      throw new Error(`Subscription plan ${planId} not found for plugin ${pluginSlug}`)
    }

    // 计算订阅周期
    const now = new Date()
    const trialDays = options.trialDays || subscriptionPlan.trialDays || 0
    const trialEnd = trialDays > 0 ? new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000) : null

    let currentPeriodEnd: Date
    if (subscriptionPlan.billingCycle === 'yearly') {
      currentPeriodEnd = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate())
    } else if (subscriptionPlan.billingCycle === 'quarterly') {
      currentPeriodEnd = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)
    } else {
      // monthly
      currentPeriodEnd = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate())
    }

    // 创建订阅
    const subscription = await fastify.prisma.subscription.create({
      data: {
        tenantId,
        pluginId: plugin.id,
        planId,
        status: trialDays > 0 ? 'trialing' : 'active',
        billingCycle: subscriptionPlan.billingCycle,
        currentPeriodStart: now,
        currentPeriodEnd,
        trialStart: trialDays > 0 ? now : null,
        trialEnd,
        amount: subscriptionPlan.amount,
        currency: subscriptionPlan.currency,
        autoRenew: options.autoRenew !== false,
        stripeSubscriptionId: options.stripeSubscriptionId || null,
        stripeCustomerId: options.stripeCustomerId || null,
        metadata: JSON.stringify(options.metadata || {})
      }
    })

    // 记录订阅变更
    await fastify.prisma.subscriptionChange.create({
      data: {
        subscriptionId: subscription.id,
        changeType: 'created',
        toPlanId: planId,
        toAmount: subscriptionPlan.amount,
        effectiveDate: now,
        reason: options.reason || 'Subscription created',
        initiatedBy: options.initiatedBy || 'system',
        createdBy: options.createdBy || null
      }
    })

    // 记录订阅事件
    await fastify.prisma.subscriptionEvent.create({
      data: {
        subscriptionId: subscription.id,
        eventType: 'created',
        eventSource: options.eventSource || 'system',
        eventData: JSON.stringify({
          planId,
          amount: subscriptionPlan.amount,
          currency: subscriptionPlan.currency,
          trialDays,
          billingCycle: subscriptionPlan.billingCycle
        }),
        processingStatus: 'processed',
        processedAt: now
      }
    })

    // 🆕 创建插件安装记录（如果不存在）
    const existingInstallation = await fastify.prisma.pluginInstallation.findFirst({
      where: {
        tenantId,
        pluginId: plugin.id
      }
    })

    if (!existingInstallation) {
      await fastify.prisma.pluginInstallation.create({
        data: {
          tenantId,
          pluginId: plugin.id,
          status: subscription.status === 'trialing' ? 'TRIAL' : 'ACTIVE',
          enabled: true,
          installedAt: now,
          trialStartDate: subscription.trialStart,
          trialEndDate: subscription.trialEnd,
          configData: options.configData ? JSON.stringify(options.configData) : null
        }
      })

      // 更新插件安装计数
      await fastify.prisma.plugin.update({
        where: { id: plugin.id },
        data: {
          installCount: { increment: 1 }
        }
      })
    }

    // 🔧 修复 Bug 2：为每个订阅创建使用量记录（根据插件类型）
    const startDate = subscription.currentPeriodStart.toISOString().split('T')[0]
    const period = `${subscription.id}:${startDate}`

    // 根据插件类型确定使用量指标
    let usageMetrics: Array<{ tenantId: number; pluginSlug: string; metricName: string; value: number; period: string }>

    if (pluginSlug === 'stripe') {
      // Stripe插件：api_calls + transactions
      usageMetrics = [
        {
          tenantId: tenantId,
          pluginSlug: pluginSlug,
          metricName: 'api_calls',
          value: 0,
          period: period
        },
        {
          tenantId: tenantId,
          pluginSlug: pluginSlug,
          metricName: 'transactions',
          value: 0,
          period: period
        }
      ]
    } else if (pluginSlug === 'resend') {
      // Resend插件：api_calls + emails_sent
      usageMetrics = [
        {
          tenantId: tenantId,
          pluginSlug: pluginSlug,
          metricName: 'api_calls',
          value: 0,
          period: period
        },
        {
          tenantId: tenantId,
          pluginSlug: pluginSlug,
          metricName: 'emails_sent',
          value: 0,
          period: period
        }
      ]
    } else if (pluginSlug === 'google') {
      // Google OAuth插件：api_calls + login_attempts
      usageMetrics = [
        {
          tenantId: tenantId,
          pluginSlug: pluginSlug,
          metricName: 'api_calls',
          value: 0,
          period: period
        },
        {
          tenantId: tenantId,
          pluginSlug: pluginSlug,
          metricName: 'login_attempts',
          value: 0,
          period: period
        }
      ]
    } else {
      // 默认：api_calls + transactions
      usageMetrics = [
        {
          tenantId: tenantId,
          pluginSlug: pluginSlug,
          metricName: 'api_calls',
          value: 0,
          period: period
        }
      ]
    }

    await fastify.prisma.pluginUsage.createMany({
      data: usageMetrics,
      skipDuplicates: true
    })

    fastify.log.info(`✅ Usage records created for subscription: ${planId}, period: ${period}, metrics: ${usageMetrics.map(m => m.metricName).join(', ')}`)

    return subscription
  })

  // 装饰器：获取活跃订阅
  fastify.decorate('getActiveSubscription', async function(tenantId: number, pluginSlug: string) {
    const plugin = await fastify.prisma.plugin.findUnique({
      where: { slug: pluginSlug }
    })

    if (!plugin) {
      return null
    }

    return await fastify.prisma.subscription.findFirst({
      where: {
        tenantId,
        pluginId: plugin.id,
        status: { in: ['active', 'trialing', 'past_due'] }
      },
      include: {
        plugin: true,
        tenant: true
      }
    })
  })

  // 装饰器：更新订阅
  fastify.decorate('updateSubscription', async function(subscriptionId: string, updateData: any) {
    const subscription = await fastify.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { plugin: true }
    })

    if (!subscription) {
      throw new Error('Subscription not found')
    }

    const oldStatus = subscription.status
    const oldPlanId = subscription.planId
    const oldAmount = subscription.amount

    // 从 updateData 中提取 eventSource 和 initiatedBy，它们不属于 subscription 表
    const { eventSource, initiatedBy, reason, createdBy, ...subscriptionUpdateData } = updateData

    // 更新订阅
    const updatedSubscription = await fastify.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        ...subscriptionUpdateData,
        updatedAt: new Date()
      }
    })

    // 如果有重要变更，记录变更历史
    // 🔧 修复：避免为webhook更新创建多余的updated记录
    const shouldCreateChangeRecord = (
      updateData.status === 'canceled' || // 取消状态变更
      (updateData.planId && updateData.planId !== oldPlanId) || // 计划变更
      (updateData.amount && updateData.amount !== oldAmount && updateData.planId) // 金额变更且有计划变更
    )

    if (shouldCreateChangeRecord) {
      let changeType = 'updated'
      if (updateData.status === 'canceled') {
        changeType = 'canceled'
      } else if (updateData.planId && updateData.planId !== oldPlanId) {
        changeType = oldAmount && updateData.amount > oldAmount ? 'upgraded' : 'downgraded'
      }

      await fastify.prisma.subscriptionChange.create({
        data: {
          subscriptionId,
          changeType,
          fromPlanId: oldPlanId,
          toPlanId: updateData.planId || oldPlanId,
          fromAmount: oldAmount,
          toAmount: updateData.amount || oldAmount,
          effectiveDate: new Date(),
          reason: updateData.reason || 'Subscription updated',
          initiatedBy: updateData.initiatedBy || 'system',
          createdBy: updateData.createdBy || null
        }
      })

      // 记录事件
      await fastify.prisma.subscriptionEvent.create({
        data: {
          subscriptionId,
          eventType: changeType,
          eventSource: updateData.eventSource || 'system',
          eventData: JSON.stringify({
            oldStatus,
            newStatus: updateData.status || oldStatus,
            oldPlanId,
            newPlanId: updateData.planId || oldPlanId,
            oldAmount,
            newAmount: updateData.amount || oldAmount
          }),
          processingStatus: 'processed',
          processedAt: new Date()
        }
      })
    }

    return updatedSubscription
  })

  // 装饰器：取消订阅
  fastify.decorate('cancelSubscription', async function(subscriptionId: string, cancelAtPeriodEnd: boolean = true, reason?: string) {
    const subscription = await fastify.prisma.subscription.findUnique({
      where: { id: subscriptionId }
    })

    if (!subscription) {
      throw new Error('Subscription not found')
    }

    if (subscription.status === 'canceled') {
      throw new Error('Subscription is already canceled')
    }

    const now = new Date()
    const updateData: any = {
      cancelAtPeriodEnd,
      canceledAt: cancelAtPeriodEnd ? null : now,
      updatedAt: now
    }

    if (!cancelAtPeriodEnd) {
      updateData.status = 'canceled'
    }

    const updatedSubscription = await fastify.prisma.subscription.update({
      where: { id: subscriptionId },
      data: updateData
    })

    // 记录取消变更
    await fastify.prisma.subscriptionChange.create({
      data: {
        subscriptionId,
        changeType: 'canceled',
        effectiveDate: cancelAtPeriodEnd ? subscription.currentPeriodEnd : now,
        reason: reason || 'Subscription canceled',
        initiatedBy: 'system'
      }
    })

    // 记录取消事件
    await fastify.prisma.subscriptionEvent.create({
      data: {
        subscriptionId,
        eventType: 'canceled',
        eventSource: 'system',
        eventData: JSON.stringify({
          cancelAtPeriodEnd,
          canceledAt: updateData.canceledAt,
          reason
        }),
        processingStatus: 'processed',
        processedAt: now
      }
    })

    return updatedSubscription
  })

  // 装饰器：暂停订阅
  fastify.decorate('pauseSubscription', async function(subscriptionId: string, resumeAt?: Date) {
    const subscription = await fastify.prisma.subscription.findUnique({
      where: { id: subscriptionId }
    })

    if (!subscription) {
      throw new Error('Subscription not found')
    }

    if (subscription.status !== 'active') {
      throw new Error('Only active subscriptions can be paused')
    }

    const now = new Date()
    const updatedSubscription = await fastify.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        pausedAt: now,
        resumeAt: resumeAt || null,
        updatedAt: now
      }
    })

    // 记录暂停事件
    await fastify.prisma.subscriptionEvent.create({
      data: {
        subscriptionId,
        eventType: 'paused',
        eventSource: 'system',
        eventData: JSON.stringify({
          pausedAt: now,
          resumeAt
        }),
        processingStatus: 'processed',
        processedAt: now
      }
    })

    return updatedSubscription
  })

  // 装饰器：恢复订阅
  fastify.decorate('resumeSubscription', async function(subscriptionId: string) {
    const subscription = await fastify.prisma.subscription.findUnique({
      where: { id: subscriptionId }
    })

    if (!subscription) {
      throw new Error('Subscription not found')
    }

    if (!subscription.pausedAt) {
      throw new Error('Subscription is not paused')
    }

    const now = new Date()
    const updatedSubscription = await fastify.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        pausedAt: null,
        resumeAt: null,
        updatedAt: now
      }
    })

    // 记录恢复事件
    await fastify.prisma.subscriptionEvent.create({
      data: {
        subscriptionId,
        eventType: 'resumed',
        eventSource: 'system',
        eventData: JSON.stringify({
          resumedAt: now
        }),
        processingStatus: 'processed',
        processedAt: now
      }
    })

    return updatedSubscription
  })

  // 装饰器：检查订阅访问权限
  fastify.decorate('checkSubscriptionAccess', async function(tenantId: number, pluginSlug: string, feature?: string) {
    const subscription = await this.getActiveSubscription(tenantId, pluginSlug)

    if (!subscription) {
      return {
        allowed: false,
        reason: 'SUBSCRIPTION_REQUIRED',
        upgradeUrl: `/subscriptions/plans/${pluginSlug}`
      }
    }

    // 检查订阅状态
    // 🔑 宽限期（Grace Period）：past_due状态下允许访问，但返回警告
    if (subscription.status === 'past_due') {
      return {
        allowed: true,  // ✅ 允许访问（宽限期）
        warning: 'PAYMENT_OVERDUE',
        gracePeriod: true,
        subscription,
        mode: 'SUBSCRIPTION',
        message: 'Your payment is overdue. Please update your payment method to avoid service interruption.'
      }
    }

    if (subscription.status === 'canceled') {
      return {
        allowed: false,
        reason: 'SUBSCRIPTION_CANCELED',
        upgradeUrl: `/subscriptions/plans/${pluginSlug}`
      }
    }

    // 如果指定了功能，检查功能权限
    if (feature) {
      const subscriptionPlan = await fastify.prisma.subscriptionPlan.findUnique({
        where: {
          pluginId_planId: {
            pluginId: subscription.pluginId,
            planId: subscription.planId
          }
        }
      })

      if (subscriptionPlan) {
        const features = JSON.parse(subscriptionPlan.features)
        if (!features.includes(feature)) {
          return {
            allowed: false,
            reason: 'FEATURE_NOT_INCLUDED',
            upgradeUrl: `/subscriptions/${subscription.id}/upgrade`
          }
        }
      }
    }

    return {
      allowed: true,
      subscription,
      mode: 'SUBSCRIPTION'
    }
  })

  // 装饰器：处理订阅事件
  fastify.decorate('handleSubscriptionEvent', async function(eventType: string, eventData: any, subscriptionId?: string) {
    try {
      const event = await fastify.prisma.subscriptionEvent.create({
        data: {
          subscriptionId: subscriptionId || eventData.subscriptionId,
          eventType,
          eventSource: eventData.source || 'stripe',
          eventData: JSON.stringify(eventData),
          processingStatus: 'pending'
        }
      })

      // 根据事件类型处理不同逻辑
      switch (eventType) {
        case 'subscription.created':
        case 'subscription.updated':
        case 'subscription.deleted':
          // 这些事件由Stripe插件处理
          break

        case 'invoice.payment_succeeded':
          if (subscriptionId) {
            await this.updateSubscription(subscriptionId, {
              status: 'active',
              renewalNotificationSent: false
            })
          }
          break

        case 'invoice.payment_failed':
          if (subscriptionId) {
            await this.updateSubscription(subscriptionId, {
              status: 'past_due'
            })
          }
          break
      }

      // 标记事件为已处理
      await fastify.prisma.subscriptionEvent.update({
        where: { id: event.id },
        data: {
          processingStatus: 'processed',
          processedAt: new Date()
        }
      })

      return event
    } catch (error) {
      // 记录处理失败
      if (subscriptionId) {
        await fastify.prisma.subscriptionEvent.create({
          data: {
            subscriptionId,
            eventType,
            eventSource: eventData.source || 'stripe',
            eventData: JSON.stringify(eventData),
            processingStatus: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          }
        })
      }
      throw error
    }
  })
}

// ✅ 使用fastify-plugin包装
export default fp(commercialSupport, {
  name: 'commercial-support',
  fastify: '5.x',
  decorators: {
    fastify: ['prisma']
  },
  dependencies: []
})
