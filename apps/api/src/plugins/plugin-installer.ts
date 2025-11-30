import { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

/**
 * Plugin Installer
 *
 * 提供插件安装和生命周期管理功能：
 * - 安装插件（支持免费和订阅模式）
 * - 卸载插件
 * - 启用/禁用插件
 */
const pluginInstaller: FastifyPluginAsync = async (fastify, _options) => {
  // 装饰器：安装插件
  fastify.decorate('installPlugin', async function(tenantId: number, pluginSlug: string, options: any = {}) {
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

      if (plugin.status !== 'ACTIVE') {
        throw new Error('Plugin is not available for installation')
      }

      // 检查是否已安装
      const existingInstallation = await fastify.prisma.pluginInstallation.findFirst({
        where: {
          tenantId,
          pluginId: plugin.id
        }
      })

      if (existingInstallation) {
        throw new Error('Plugin is already installed')
      }

      // 检查插件是否支持订阅（通过是否有订阅计划判断）
      const subscriptionPlans = await fastify.prisma.subscriptionPlan.findMany({
        where: { pluginId: plugin.id, isActive: true }
      })

      // 根据插件商业模式处理安装逻辑
      if (subscriptionPlans.length > 0) {
        return await this.handleSubscriptionPlugin(tenantId, plugin, options)
      } else {
        return await this.handleFreePlugin(tenantId, plugin, options)
      }
    } catch (error) {
      fastify.log.error('Failed to install plugin:', error)
      throw error
    }
  })

  // 装饰器：处理免费插件安装
  fastify.decorate('handleFreePlugin', async function(tenantId: number, plugin: any, options: any = {}) {
    try {
      // 🎯 业务逻辑：Free Plan也需要有订阅记录，卸载重装不重置使用量

      // 1. 检查是否已有Free订阅记录（可能是暂停状态）
      const existingSubscription = await fastify.prisma.subscription.findFirst({
        where: {
          tenantId,
          pluginId: plugin.id,
          planId: 'free'
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      let subscription = existingSubscription

      // 2. 如果没有订阅记录，创建Free订阅
      if (!existingSubscription) {
        fastify.log.info(`🆕 Creating new Free subscription for tenant ${tenantId}`)
        subscription = await fastify.createSubscription(tenantId, plugin.slug, 'free', {
          trialDays: 0,
          reason: 'Free plan installation',
          eventSource: 'system',
          initiatedBy: 'tenant'
        })
      } else if (existingSubscription.status === 'suspended') {
        // 3. 如果订阅被暂停，恢复它
        fastify.log.info(`🔄 Restoring suspended Free subscription for tenant ${tenantId}`)
        subscription = await fastify.updateSubscription(existingSubscription.id, {
          status: 'active',
          reason: 'Free plan reinstalled - subscription restored',
          eventSource: 'system',
          initiatedBy: 'tenant'
        })
      } else {
        fastify.log.info(`✅ Using existing Free subscription for tenant ${tenantId}`)
      }

      // 4. 检查插件安装历史
      const previousInstallations = await fastify.prisma.pluginInstallation.findMany({
        where: {
          tenantId,
          pluginId: plugin.id
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      let configData = options.configData || {}

      // 5. 记录重装历史（如果是重装）
      if (previousInstallations.length > 0) {
        fastify.log.info(`🔄 Reinstalling Free plugin for tenant ${tenantId}, preserving usage in subscription ${subscription.id}`)

        configData = {
          ...configData,
          subscriptionId: subscription.id,
          reinstallHistory: [
            ...(configData.reinstallHistory || []),
            {
              reinstalledAt: new Date().toISOString(),
              previousInstallCount: previousInstallations.length,
              subscriptionId: subscription.id,
              reason: 'Free plan reinstall - usage preserved per business rules'
            }
          ]
        }
      } else {
        configData = {
          ...configData,
          subscriptionId: subscription.id
        }
      }

      const installation = await fastify.prisma.pluginInstallation.create({
        data: {
          tenantId,
          pluginId: plugin.id,
          status: 'ACTIVE',
          enabled: true,
          installedAt: new Date(),
          configData: JSON.stringify(configData)
        },
        include: {
          plugin: true
        }
      })

      // 更新插件安装计数
      await fastify.prisma.plugin.update({
        where: { id: plugin.id },
        data: {
          installCount: { increment: 1 }
        }
      })

      const isReinstall = previousInstallations.length > 0
      fastify.log.info(`Free plugin ${plugin.slug} ${isReinstall ? 'reinstalled' : 'installed'} for tenant ${tenantId}`)

      return {
        success: true,
        installation: {
          id: installation.id,
          status: installation.status,
          enabled: installation.enabled,
          installedAt: installation.installedAt,
          plugin: {
            id: installation.plugin.id,
            name: installation.plugin.name,
            slug: installation.plugin.slug,
            businessModel: 'free' // 默认为免费模式
          }
        },
        preservedUsage: isReinstall,
        message: isReinstall
          ? `${plugin.name} has been reinstalled successfully (usage history preserved)`
          : `${plugin.name} has been successfully installed`
      }
    } catch (error) {
      fastify.log.error('Failed to handle free plugin installation:', error)
      throw new Error('Failed to install free plugin')
    }
  })

  // 装饰器：处理订阅制插件安装
  fastify.decorate('handleSubscriptionPlugin', async function(tenantId: number, plugin: any, options: any = {}) {
    try {
      const { planId, startTrial = true } = options

      // 🆕 首先检查是否有被暂停的订阅（保护用户付费权益）
      const suspendedSubscription = await fastify.prisma.subscription.findFirst({
        where: {
          tenantId,
          pluginId: plugin.id,
          status: 'suspended'
        },
        orderBy: {
          updatedAt: 'desc'  // 获取最新的暂停订阅
        }
      })

      if (suspendedSubscription) {
        // 🎉 恢复被暂停的订阅，保护用户付费权益
        const restoredSubscription = await fastify.updateSubscription(suspendedSubscription.id, {
          status: 'active',
          reason: 'Plugin reinstalled - subscription restored',
          eventSource: 'system',
          initiatedBy: 'tenant'
        })

        fastify.log.info(`Restored suspended subscription ${suspendedSubscription.id} for tenant ${tenantId}, plugin ${plugin.slug}`)

        // 🆕 同时创建插件安装记录
        const installation = await fastify.prisma.pluginInstallation.create({
          data: {
            tenantId,
            pluginId: plugin.id,
            status: 'ACTIVE',
            enabled: true,
            installedAt: new Date(),
            configData: options.configData ? JSON.stringify(options.configData) : null
          },
          include: {
            plugin: true
          }
        })

        // 更新插件安装计数
        await fastify.prisma.plugin.update({
          where: { id: plugin.id },
          data: {
            installCount: { increment: 1 }
          }
        })

        return {
          success: true,
          requiresPayment: false,  // 不需要重新付费
          subscription: restoredSubscription,
          installation,
          message: `Welcome back! Your ${suspendedSubscription.planId} subscription has been restored.`
        }
      }

      // 如果指定了计划ID，直接创建订阅
      if (planId) {
        const plan = plugin.subscriptionPlans.find((p: any) => p.planId === planId)
        if (!plan) {
          throw new Error('Subscription plan not found')
        }

        // 创建订阅（这里会调用现有的订阅系统）
        const subscription = await fastify.createSubscription(tenantId, plugin.slug, planId, {
          trialDays: 0  // 不启用试用
        })

        return {
          success: true,
          requiresPayment: planId !== 'free',  // Free plan不需要付费
          subscription,
          message: `Subscription to ${plugin.name} has been created`
        }
      }

      // 检查是否有支持试用的计划
      const trialPlan = await fastify.prisma.subscriptionPlan.findFirst({
        where: {
          pluginId: plugin.id,
          isActive: true,
          trialDays: { gt: 0 }
        }
      })

      // 如果支持试用且用户选择试用
      if (startTrial && trialPlan && trialPlan.trialDays > 0) {
        const trialStartDate = new Date()
        const trialEndDate = new Date()
        trialEndDate.setDate(trialStartDate.getDate() + trialPlan.trialDays)

        const installation = await fastify.prisma.pluginInstallation.create({
          data: {
            tenantId,
            pluginId: plugin.id,
            status: 'TRIAL',
            enabled: true,
            installedAt: new Date(),
            trialStartDate,
            trialEndDate,
            configData: options.configData ? JSON.stringify(options.configData) : null
          },
          include: {
            plugin: true
          }
        })

        // 更新插件安装计数
        await fastify.prisma.plugin.update({
          where: { id: plugin.id },
          data: {
            installCount: { increment: 1 }
          }
        })

        fastify.log.info(`Trial for plugin ${plugin.slug} started for tenant ${tenantId}`)

        return {
          success: true,
          installation: {
            id: installation.id,
            status: installation.status,
            enabled: installation.enabled,
            installedAt: installation.installedAt,
            trialStartDate: installation.trialStartDate,
            trialEndDate: installation.trialEndDate,
            plugin: {
              id: installation.plugin.id,
              name: installation.plugin.name,
              slug: installation.plugin.slug,
              businessModel: 'subscription' // 订阅模式
            }
          },
          trialInfo: {
            trialDays: trialPlan.trialDays,
            trialEndDate: trialEndDate
          },
          message: `${plugin.name} trial has been started (${trialPlan.trialDays} days)`
        }
      }

      // 如果不支持试用，返回订阅计划选择
      return {
        success: false,
        requiresSubscription: true,
        plugin: {
          id: plugin.id,
          name: plugin.name,
          slug: plugin.slug,
          description: plugin.description
        },
        subscriptionPlans: plugin.subscriptionPlans,
        message: `${plugin.name} requires a subscription. Please select a plan.`
      }
    } catch (error) {
      fastify.log.error('Failed to handle subscription plugin installation:', error)
      throw error
    }
  })

  // 装饰器：卸载插件
  fastify.decorate('uninstallPlugin', async function(tenantId: number, pluginSlug: string) {
    try {
      const installation = await fastify.prisma.pluginInstallation.findFirst({
        where: {
          tenantId,
          plugin: { slug: pluginSlug }
        },
        include: {
          plugin: true
        }
      })

      if (!installation) {
        throw new Error('Plugin is not installed')
      }

      // 检查是否有活跃订阅，如果有则暂停订阅而不是取消（保护用户付费权益）
      const hasSubscriptionPlans = await fastify.prisma.subscriptionPlan.findFirst({
        where: { pluginId: installation.plugin.id }
      })

      if (hasSubscriptionPlans) {
        const activeSubscription = await fastify.prisma.subscription.findFirst({
          where: {
            tenantId,
            pluginId: installation.plugin.id,
            status: { in: ['active', 'trialing', 'past_due'] }
          }
        })

        if (activeSubscription) {
          // 🆕 暂停订阅而不是取消，保护用户付费权益
          await fastify.updateSubscription(activeSubscription.id, {
            status: 'suspended',
            reason: 'Plugin uninstalled - subscription suspended to preserve user benefits',
            eventSource: 'system',
            initiatedBy: 'tenant'
          })

          fastify.log.info(`Subscription ${activeSubscription.id} suspended due to plugin uninstall (preserving user benefits)`)
        }
      }

      // 删除安装记录
      await fastify.prisma.pluginInstallation.delete({
        where: { id: installation.id }
      })

      // 更新插件安装计数
      await fastify.prisma.plugin.update({
        where: { id: installation.plugin.id },
        data: {
          installCount: { decrement: 1 }
        }
      })

      fastify.log.info(`Plugin ${pluginSlug} uninstalled for tenant ${tenantId}`)

      return {
        success: true,
        message: `${installation.plugin.name} has been successfully uninstalled. Your subscription has been suspended and will be restored when you reinstall the plugin.`
      }
    } catch (error) {
      fastify.log.error('Failed to uninstall plugin:', error)
      throw error
    }
  })

  // 装饰器：启用/禁用插件
  fastify.decorate('togglePlugin', async function(tenantId: number, pluginSlug: string, enabled: boolean) {
    try {
      const installation = await fastify.prisma.pluginInstallation.findFirst({
        where: {
          tenantId,
          plugin: { slug: pluginSlug }
        },
        include: {
          plugin: true
        }
      })

      if (!installation) {
        throw new Error('Plugin is not installed')
      }

      // 检查插件状态
      if (installation.status === 'EXPIRED' && enabled) {
        throw new Error('Cannot enable expired plugin. Please renew subscription.')
      }

      const updatedInstallation = await fastify.prisma.pluginInstallation.update({
        where: { id: installation.id },
        data: { enabled },
        include: {
          plugin: true
        }
      })

      const action = enabled ? 'enabled' : 'disabled'
      fastify.log.info(`Plugin ${pluginSlug} ${action} for tenant ${tenantId}`)

      return {
        success: true,
        installation: {
          id: updatedInstallation.id,
          status: updatedInstallation.status,
          enabled: updatedInstallation.enabled,
          plugin: {
            id: updatedInstallation.plugin.id,
            name: updatedInstallation.plugin.name,
            slug: updatedInstallation.plugin.slug
          }
        },
        message: `${installation.plugin.name} has been ${action}`
      }
    } catch (error) {
      fastify.log.error('Failed to toggle plugin:', error)
      throw error
    }
  })

  // 装饰器：配置插件
  fastify.decorate('configurePlugin', async function(tenantId: number, pluginSlug: string, configData: any) {
    try {
      const installation = await fastify.prisma.pluginInstallation.findFirst({
        where: {
          tenantId,
          plugin: { slug: pluginSlug }
        },
        include: {
          plugin: true
        }
      })

      if (!installation) {
        throw new Error('Plugin is not installed')
      }

      const updatedInstallation = await fastify.prisma.pluginInstallation.update({
        where: { id: installation.id },
        data: {
          configData: JSON.stringify(configData)
        },
        include: {
          plugin: true
        }
      })

      fastify.log.info(`Plugin ${pluginSlug} configured for tenant ${tenantId}`)

      return {
        success: true,
        installation: {
          id: updatedInstallation.id,
          configData: JSON.parse(updatedInstallation.configData || '{}'),
          plugin: {
            id: updatedInstallation.plugin.id,
            name: updatedInstallation.plugin.name,
            slug: updatedInstallation.plugin.slug
          }
        },
        message: `${installation.plugin.name} configuration has been updated`
      }
    } catch (error) {
      fastify.log.error('Failed to configure plugin:', error)
      throw error
    }
  })
}

// ✅ 使用fastify-plugin包装
export default fp(pluginInstaller, {
  name: 'plugin-installer',
  fastify: '5.x',
  decorators: {
    fastify: ['prisma', 'createSubscription', 'cancelSubscription']
  },
  dependencies: ['commercial-support']
})
