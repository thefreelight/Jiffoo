import { FastifyInstance } from 'fastify';

/**
 * 🔥 完全重建Plugin.pricing
 * 从SubscriptionPlan表完全镜像同步
 * 
 * 这个函数确保Plugin.pricing和SubscriptionPlan表的数据完全一致
 * 每次创建、更新、删除SubscriptionPlan时都会调用此函数
 * 
 * @param fastify - Fastify实例
 * @param pluginId - 插件ID
 * @returns 更新后的pricing对象
 */
export async function syncPluginPricingFromSubscriptionPlans(
  fastify: FastifyInstance,
  pluginId: string
) {
  fastify.log.info(`🔄 Syncing Plugin.pricing from SubscriptionPlan for plugin: ${pluginId}`);

  try {
    // 1. 获取所有活跃的SubscriptionPlan
    const subscriptionPlans = await fastify.prisma.subscriptionPlan.findMany({
      where: {
        pluginId,
        isActive: true
      },
      orderBy: [
        { sortOrder: 'asc' },
        { amount: 'asc' }
      ]
    });

    fastify.log.debug(`Found ${subscriptionPlans.length} active subscription plans`);

    // 2. 转换为Plugin.pricing格式
    const pricing = {
      model: 'subscription',
      plans: subscriptionPlans.map(plan => {
        // 转换billingCycle为interval格式
        let interval = 'month';
        if (plan.billingCycle === 'yearly') {
          interval = 'year';
        } else if (plan.billingCycle === 'quarterly') {
          interval = 'quarter';
        }

        return {
          id: plan.planId,  // 🔥 完全使用SubscriptionPlan的planId
          name: plan.name,
          price: plan.amount,
          currency: plan.currency,
          interval,
          features: JSON.parse(plan.features),
          limits: JSON.parse(plan.limits),
          description: plan.description || undefined,
          trialDays: plan.trialDays || 0
        };
      })
    };

    // 3. 更新Plugin记录（移除pricing字段，因为已经使用subscription_plans表）
    await fastify.prisma.plugin.update({
      where: { id: pluginId },
      data: {
        updatedAt: new Date()
      }
    });

    fastify.log.info(`✅ Plugin subscription plans synced successfully: ${subscriptionPlans.length} plans`);
    
    return pricing;
  } catch (error) {
    fastify.log.error('Failed to sync Plugin.pricing from SubscriptionPlan:', error);
    throw error;
  }
}

/**
 * 验证SubscriptionPlan数据的一致性
 * 确保同一插件的所有计划数据格式正确
 * 
 * @param features - 功能列表（JSON字符串）
 * @param limits - 限制配置（JSON字符串）
 * @returns 验证结果
 */
export function validateSubscriptionPlanData(
  features: string,
  limits: string
): { valid: boolean; error?: string } {
  try {
    // 验证features格式
    const parsedFeatures = JSON.parse(features);
    if (!Array.isArray(parsedFeatures)) {
      return {
        valid: false,
        error: 'Features must be a JSON array'
      };
    }

    // 验证limits格式
    const parsedLimits = JSON.parse(limits);
    if (typeof parsedLimits !== 'object' || parsedLimits === null) {
      return {
        valid: false,
        error: 'Limits must be a JSON object'
      };
    }

    // 验证limits中的值都是数字
    for (const [key, value] of Object.entries(parsedLimits)) {
      if (typeof value !== 'number') {
        return {
          valid: false,
          error: `Limit value for "${key}" must be a number`
        };
      }
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: 'Invalid JSON format'
    };
  }
}

