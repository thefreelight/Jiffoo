import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

/**
 * Plugin Registry
 *
 * 提供插件注册表功能：
 * - 获取所有可用插件列表
 * - 获取租户已安装插件
 * - 获取插件详情
 * - 获取插件分类
 * - 搜索插件
 */
const pluginRegistry: FastifyPluginAsync = async (fastify, _options) => {
  // 装饰器：获取所有可用插件
  fastify.decorate('getAvailablePlugins', async function() {
    try {
      const plugins = await fastify.prisma.plugin.findMany({
        where: { 
          status: 'ACTIVE' 
        },
        include: {
          subscriptionPlans: {
            where: { isActive: true },
            orderBy: { amount: 'asc' }
          }
        },
        orderBy: [
          { category: 'asc' },
          { name: 'asc' }
        ]
      })

      return plugins.map(plugin => ({
        id: plugin.id,
        name: plugin.name,
        slug: plugin.slug,
        description: plugin.description,
        category: plugin.category || 'general',
        tags: plugin.tags ? JSON.parse(plugin.tags) : [],
        iconUrl: plugin.iconUrl,
        screenshots: plugin.screenshots ? JSON.parse(plugin.screenshots) : [],
        businessModel: plugin.subscriptionPlans?.length > 0 ? 'subscription' : 'free',
        supportsSubscription: plugin.subscriptionPlans?.length > 0,
        trialDays: plugin.subscriptionPlans?.find(p => p.trialDays > 0)?.trialDays || 0,
        version: plugin.version || '1.0.0',
        developer: plugin.developer || 'Jiffoo',
        rating: plugin.rating || 0,
        installCount: plugin.installCount || 0,
        subscriptionPlans: plugin.subscriptionPlans,
        createdAt: plugin.createdAt,
        updatedAt: plugin.updatedAt
      }))
    } catch (error) {
      fastify.log.error('Failed to get available plugins:', error)
      throw new Error('Failed to retrieve available plugins')
    }
  })

  // 装饰器：获取租户已安装插件
  fastify.decorate('getTenantPlugins', async function(tenantId: number) {
    try {
      const installations = await fastify.prisma.pluginInstallation.findMany({
        where: { tenantId },
        include: {
          plugin: {
            include: {
              subscriptionPlans: {
                where: { isActive: true }
              }
            }
          }
        },
        orderBy: { installedAt: 'desc' }
      })

      return installations.map(installation => ({
        id: installation.id,
        plugin: {
          id: installation.plugin.id,
          name: installation.plugin.name,
          slug: installation.plugin.slug,
          description: installation.plugin.description,
          category: installation.plugin.category || 'general',
          iconUrl: installation.plugin.iconUrl,
          businessModel: installation.plugin.subscriptionPlans?.length > 0 ? 'subscription' : 'free',
          supportsSubscription: installation.plugin.subscriptionPlans?.length > 0,
          subscriptionPlans: installation.plugin.subscriptionPlans
        },
        status: installation.status,
        enabled: installation.enabled,
        installedAt: installation.installedAt,
        trialStartDate: installation.trialStartDate,
        trialEndDate: installation.trialEndDate,
        configData: installation.configData ? JSON.parse(installation.configData) : null
      }))
    } catch (error) {
      fastify.log.error('Failed to get tenant plugins:', error)
      throw new Error('Failed to retrieve tenant plugins')
    }
  })

  // 装饰器：获取插件详情
  fastify.decorate('getPluginDetails', async function(pluginSlug: string, tenantId?: number) {
    try {
      const plugin = await fastify.prisma.plugin.findUnique({
        where: { slug: pluginSlug },
        include: {
          subscriptionPlans: {
            where: { isActive: true },
            orderBy: { amount: 'asc' }
          }
        }
      })

      if (!plugin) {
        throw new Error('Plugin not found')
      }

      let installation = null
      let subscription = null

      if (tenantId) {
        // 获取安装信息
        installation = await fastify.prisma.pluginInstallation.findFirst({
          where: {
            tenantId,
            pluginId: plugin.id
          }
        })

        // 获取订阅信息（如果支持订阅）
        if (plugin.subscriptionPlans?.length > 0) {
          subscription = await fastify.prisma.subscription.findFirst({
            where: {
              tenantId,
              pluginId: plugin.id,
              status: { in: ['active', 'trialing', 'past_due'] }
            }
          })

          // 如果有订阅，获取对应的订阅计划信息
          if (subscription) {
            const subscriptionPlan = await fastify.prisma.subscriptionPlan.findFirst({
              where: {
                pluginId: plugin.id,
                planId: subscription.planId
              }
            })
            subscription.plan = subscriptionPlan
          }
        }
      }

      return {
        id: plugin.id,
        name: plugin.name,
        slug: plugin.slug,
        description: plugin.description,
        longDescription: plugin.longDescription,
        category: plugin.category || 'general',
        tags: plugin.tags ? JSON.parse(plugin.tags) : [],
        iconUrl: plugin.iconUrl,
        screenshots: plugin.screenshots ? JSON.parse(plugin.screenshots) : [],
        businessModel: plugin.subscriptionPlans?.length > 0 ? 'subscription' : 'free',
        supportsSubscription: plugin.subscriptionPlans?.length > 0,
        trialDays: plugin.subscriptionPlans?.find(p => p.trialDays > 0)?.trialDays || 0,
        version: plugin.version || '1.0.0',
        developer: plugin.developer || 'Jiffoo',
        rating: plugin.rating || 0,
        installCount: plugin.installCount || 0,
        subscriptionPlans: plugin.subscriptionPlans,
        installation: installation ? {
          id: installation.id,
          status: installation.status,
          enabled: installation.enabled,
          installedAt: installation.installedAt,
          trialStartDate: installation.trialStartDate,
          trialEndDate: installation.trialEndDate,
          configData: installation.configData ? JSON.parse(installation.configData) : null
        } : null,
        subscription: subscription ? {
          id: subscription.id,
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          plan: subscription.plan
        } : null,
        createdAt: plugin.createdAt,
        updatedAt: plugin.updatedAt
      }
    } catch (error) {
      fastify.log.error('Failed to get plugin details:', error)
      throw error
    }
  })

  // 装饰器：获取插件分类
  fastify.decorate('getPluginCategories', async function() {
    try {
      const categories = await fastify.prisma.plugin.groupBy({
        by: ['category'],
        where: {
          status: 'ACTIVE',
          category: { not: null }
        },
        _count: {
          id: true
        }
      })

      // 预定义的分类信息
      const categoryInfo = {
        'payment': { name: 'Payment', description: 'Payment processing and gateways', icon: '💳' },
        'marketing': { name: 'Marketing', description: 'Marketing and promotion tools', icon: '📢' },
        'analytics': { name: 'Analytics', description: 'Data analysis and reporting', icon: '📊' },
        'shipping': { name: 'Shipping', description: 'Shipping and logistics', icon: '🚚' },
        'inventory': { name: 'Inventory', description: 'Inventory management', icon: '📦' },
        'customer': { name: 'Customer Service', description: 'Customer support tools', icon: '🎧' },
        'security': { name: 'Security', description: 'Security and fraud protection', icon: '🔒' },
        'integration': { name: 'Integration', description: 'Third-party integrations', icon: '🔗' },
        'general': { name: 'General', description: 'General utilities', icon: '⚙️' }
      }

      return categories.map(cat => ({
        slug: cat.category || 'general',
        name: categoryInfo[cat.category as keyof typeof categoryInfo]?.name || cat.category || 'General',
        description: categoryInfo[cat.category as keyof typeof categoryInfo]?.description || 'General category',
        icon: categoryInfo[cat.category as keyof typeof categoryInfo]?.icon || '⚙️',
        pluginCount: cat._count.id
      }))
    } catch (error) {
      fastify.log.error('Failed to get plugin categories:', error)
      throw new Error('Failed to retrieve plugin categories')
    }
  })

  // 装饰器：搜索插件
  fastify.decorate('searchPlugins', async function(query: string, category?: string) {
    try {
      const whereCondition: any = {
        status: 'ACTIVE',
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { tags: { contains: query, mode: 'insensitive' } }
        ]
      }

      if (category && category !== 'all') {
        whereCondition.category = category
      }

      const plugins = await fastify.prisma.plugin.findMany({
        where: whereCondition,
        include: {
          subscriptionPlans: {
            where: { isActive: true },
            orderBy: { amount: 'asc' }
          }
        },
        orderBy: [
          { installCount: 'desc' },
          { rating: 'desc' },
          { name: 'asc' }
        ]
      })

      return plugins.map(plugin => ({
        id: plugin.id,
        name: plugin.name,
        slug: plugin.slug,
        description: plugin.description,
        category: plugin.category || 'general',
        iconUrl: plugin.iconUrl,
        businessModel: plugin.subscriptionPlans?.length > 0 ? 'subscription' : 'free',
        supportsSubscription: plugin.subscriptionPlans?.length > 0,
        rating: plugin.rating || 0,
        installCount: plugin.installCount || 0,
        subscriptionPlans: plugin.subscriptionPlans
      }))
    } catch (error) {
      fastify.log.error('Failed to search plugins:', error)
      throw new Error('Failed to search plugins')
    }
  })
}

// ✅ 使用fastify-plugin包装
export default fp(pluginRegistry, {
  name: 'plugin-registry',
  fastify: '5.x',
  decorators: {
    fastify: ['prisma']
  },
  dependencies: []
})
