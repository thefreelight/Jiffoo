/**
 * Super Admin Plugin Management Routes
 *
 * Provides endpoints for managing plugins at the platform level,
 * including creating, updating, and configuring external plugins.
 */
import { FastifyInstance } from 'fastify'
import crypto from 'crypto'
import { authMiddleware, superAdminMiddleware } from '@/core/auth/middleware'
import { syncPluginPricingFromSubscriptionPlans } from './sync-helper'

/**
 * Validate URL format for external plugin base URLs
 * @param url - URL string to validate
 * @returns true if valid URL, false otherwise
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol)
  } catch {
    return false
  }
}

/**
 * Generate a cryptographically secure shared secret
 * @returns 64-character hex string
 */
function generateSharedSecret(): string {
  return crypto.randomBytes(32).toString('hex')
}

export default async function pluginManagementRoutes(fastify: FastifyInstance) {
  // 应用中间件到所有路由
  fastify.addHook('preHandler', authMiddleware);
  fastify.addHook('preHandler', superAdminMiddleware);

  // 获取插件统计信息（用于仪表板）
  fastify.get('/stats', {
    schema: {
      hide: true,
      tags: ['Super Admin - Plugin Management'],
      summary: 'Get Plugin System Statistics',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                totalPlugins: { type: 'number' },
                activePlugins: { type: 'number' },
                totalInstallations: { type: 'number' },
                totalRevenue: { type: 'number' },
                monthlyActiveUsers: { type: 'number' },
                topPlugins: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      slug: { type: 'string' },
                      name: { type: 'string' },
                      installations: { type: 'number' },
                      revenue: { type: 'number' }
                    }
                  }
                }
              }
            }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const totalPlugins = await fastify.prisma.plugin.count()
      const activePlugins = await fastify.prisma.plugin.count({
        where: { status: 'ACTIVE' }
      })
      const totalInstallations = await fastify.prisma.pluginInstallation.count()

      // 计算总收入（来自订阅）
      const revenueData = await fastify.prisma.subscription.aggregate({
        where: { status: { in: ['active', 'trialing'] } },
        _sum: { amount: true }
      })
      const totalRevenue = revenueData._sum.amount || 0

      // 计算月活跃用户（使用插件的用户数）
      const monthlyActiveUsers = await fastify.prisma.pluginInstallation.count({
        where: {
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      })

      // 获取热门插件
      const topPluginsData = await fastify.prisma.plugin.findMany({
        select: {
          slug: true,
          name: true,
          _count: {
            select: {
              installations: true
            }
          }
        },
        orderBy: {
          installations: {
            _count: 'desc'
          }
        },
        take: 5
      })

      const topPlugins = topPluginsData.map(plugin => ({
        slug: plugin.slug,
        name: plugin.name,
        installations: plugin._count.installations,
        revenue: 0 // 暂时设为0，后续可以根据实际业务逻辑计算
      }))

      return reply.send({
        success: true,
        data: {
          totalPlugins,
          activePlugins,
          totalInstallations,
          totalRevenue,
          monthlyActiveUsers,
          topPlugins
        }
      })
    } catch (error) {
      fastify.log.error('Failed to get plugin stats:', error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to get plugin statistics'
      })
    }
  })

  // ============================================
  // 🆕 插件健康监控API端点
  // ============================================

  /**
   * GET /health - Get plugin health statistics and error counts
   * Returns health status for all plugins including error counts and response times
   */
  fastify.get('/health', {
    schema: {
      hide: true,
      tags: ['Super Admin - Plugin Management'],
      summary: 'Get Plugin Health Statistics',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                totalPlugins: { type: 'number' },
                healthyPlugins: { type: 'number' },
                degradedPlugins: { type: 'number' },
                errorPlugins: { type: 'number' },
                plugins: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      slug: { type: 'string' },
                      name: { type: 'string' },
                      status: { type: 'string' },
                      errorCount: { type: 'number' },
                      lastError: { type: 'string' },
                      lastErrorTime: { type: 'string' },
                      avgResponseTime: { type: 'number' },
                      rateLimitHits: { type: 'number' },
                      tenantCount: { type: 'number' }
                    }
                  }
                },
                systemHealth: {
                  type: 'object',
                  properties: {
                    database: { type: 'object' },
                    redis: { type: 'object' },
                    uptime_seconds: { type: 'number' }
                  }
                }
              }
            }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      // Import health check utilities
      const { performHealthCheck } = await import('@/utils/health-check')
      const healthData = await performHealthCheck(fastify)

      // Get all plugins with their installation counts
      const plugins = await fastify.prisma.plugin.findMany({
        select: {
          slug: true,
          name: true,
          status: true,
          _count: {
            select: {
              installations: true
            }
          }
        }
      })

      // Get error metrics from Redis if available (simulated for now)
      const pluginHealthData = plugins.map(plugin => {
        // In a real implementation, these would come from Prometheus/metrics
        // For now, derive health status from plugin status
        const isActive = plugin.status === 'ACTIVE'
        const randomResponseTime = Math.floor(Math.random() * 200) + 50 // 50-250ms

        return {
          slug: plugin.slug,
          name: plugin.name,
          status: isActive ? 'healthy' : 'degraded',
          errorCount: 0, // Would come from error tracking
          lastError: undefined,
          lastErrorTime: undefined,
          avgResponseTime: randomResponseTime,
          rateLimitHits: 0, // Would come from rate limit tracking
          tenantCount: plugin._count.installations
        }
      })

      // Calculate health summary
      const totalPlugins = pluginHealthData.length
      const healthyPlugins = pluginHealthData.filter(p => p.status === 'healthy').length
      const degradedPlugins = pluginHealthData.filter(p => p.status === 'degraded').length
      const errorPlugins = pluginHealthData.filter(p => p.status === 'error').length

      return reply.send({
        success: true,
        data: {
          totalPlugins,
          healthyPlugins,
          degradedPlugins,
          errorPlugins,
          plugins: pluginHealthData,
          systemHealth: {
            database: healthData.checks.database,
            redis: healthData.checks.redis,
            uptime_seconds: healthData.uptime_seconds
          }
        }
      })
    } catch (error) {
      fastify.log.error('Failed to get plugin health stats:', error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to get plugin health statistics'
      })
    }
  })

  // ============================================
  // 🆕 插件基本管理API端点（阶段1：数据模型与配置层）
  // ============================================

  // 获取所有插件列表
  fastify.get('/plugins', {
    schema: {
      hide: true,
      tags: ['Super Admin - Plugin Management'],
      summary: 'Get All Plugins List',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1 },
          limit: { type: 'number', default: 20 },
          status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
          runtimeType: { type: 'string', enum: ['internal-fastify', 'external-http'] }
        }
      }
    }
  }, async (request, reply) => {
    const { page = 1, limit = 20, status, runtimeType } = request.query as any
    const skip = (page - 1) * limit

    try {
      const where: any = {}
      if (status) where.status = status
      if (runtimeType) where.runtimeType = runtimeType

      const plugins = await fastify.prisma.plugin.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              installations: true,
              subscriptions: true
            }
          }
        }
      })

      const total = await fastify.prisma.plugin.count({ where })

      return reply.send({
        success: true,
        data: {
          plugins: plugins.map(plugin => ({
            id: plugin.id,
            slug: plugin.slug,
            name: plugin.name,
            category: plugin.category,
            status: plugin.status,
            runtimeType: plugin.runtimeType,
            externalBaseUrl: plugin.externalBaseUrl,
            version: plugin.version,
            createdAt: plugin.createdAt,
            installationsCount: plugin._count.installations,
            subscriptionsCount: plugin._count.subscriptions
          })),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      })
    } catch (error) {
      fastify.log.error('Failed to get plugins list:', error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to get plugins list'
      })
    }
  })

  // 创建新插件
  fastify.post('/plugins', {
    schema: {
      hide: true,
      tags: ['Super Admin - Plugin Management'],
      summary: 'Create New Plugin',
      body: {
        type: 'object',
        properties: {
          slug: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          category: { type: 'string', enum: ['payment', 'email', 'integration', 'theme', 'analytics', 'marketing'] },
          runtimeType: { type: 'string', enum: ['internal-fastify', 'external-http'], default: 'internal-fastify' },
          externalBaseUrl: { type: 'string' },
          oauthConfig: {
            type: 'object',
            properties: {
              installUrl: { type: 'string' },
              tokenUrl: { type: 'string' },
              redirectUri: { type: 'string' },
              scopes: { type: 'string' }
            }
          },
          integrationSecrets: {
            type: 'object',
            properties: {
              sharedSecret: { type: 'string' }
            }
          },
          autoGenerateSecret: { type: 'boolean', default: false },
          tags: { type: 'string' },
          iconUrl: { type: 'string' },
          status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' }
        },
        required: ['slug', 'name', 'category']
      }
    }
  }, async (request, reply) => {
    const {
      slug,
      name,
      description,
      category,
      runtimeType = 'internal-fastify',
      externalBaseUrl,
      oauthConfig,
      integrationSecrets,
      autoGenerateSecret = false,
      tags,
      iconUrl,
      status = 'ACTIVE'
    } = request.body as any

    try {
      // 检查slug是否已存在
      const existingPlugin = await fastify.prisma.plugin.findUnique({
        where: { slug }
      })

      if (existingPlugin) {
        return reply.status(400).send({
          success: false,
          error: 'Plugin with this slug already exists'
        })
      }

      // 验证外部插件的必填字段
      let finalIntegrationSecrets = integrationSecrets
      if (runtimeType === 'external-http') {
        // 验证 externalBaseUrl
        if (!externalBaseUrl) {
          return reply.status(400).send({
            success: false,
            error: 'externalBaseUrl is required for external plugins'
          })
        }
        if (!isValidUrl(externalBaseUrl)) {
          return reply.status(400).send({
            success: false,
            error: 'externalBaseUrl must be a valid HTTP/HTTPS URL'
          })
        }

        // 验证或生成 sharedSecret
        if (autoGenerateSecret) {
          finalIntegrationSecrets = {
            ...integrationSecrets,
            sharedSecret: generateSharedSecret()
          }
        } else if (!integrationSecrets?.sharedSecret) {
          return reply.status(400).send({
            success: false,
            error: 'integrationSecrets.sharedSecret is required for external plugins (or set autoGenerateSecret=true)'
          })
        }

        // 验证 oauthConfig URLs（如果提供）
        if (oauthConfig) {
          if (oauthConfig.installUrl && !isValidUrl(oauthConfig.installUrl)) {
            return reply.status(400).send({
              success: false,
              error: 'oauthConfig.installUrl must be a valid URL'
            })
          }
          if (oauthConfig.tokenUrl && !isValidUrl(oauthConfig.tokenUrl)) {
            return reply.status(400).send({
              success: false,
              error: 'oauthConfig.tokenUrl must be a valid URL'
            })
          }
          if (oauthConfig.redirectUri && !isValidUrl(oauthConfig.redirectUri)) {
            return reply.status(400).send({
              success: false,
              error: 'oauthConfig.redirectUri must be a valid URL'
            })
          }
        }
      }

      const plugin = await fastify.prisma.plugin.create({
        data: {
          slug,
          name,
          description,
          category,
          runtimeType,
          externalBaseUrl: runtimeType === 'external-http' ? externalBaseUrl : null,
          oauthConfig: oauthConfig ? JSON.stringify(oauthConfig) : null,
          integrationSecrets: finalIntegrationSecrets ? JSON.stringify(finalIntegrationSecrets) : null,
          tags,
          iconUrl,
          status
        }
      })

      // 返回时解析JSON字段
      return reply.send({
        success: true,
        data: {
          plugin: {
            ...plugin,
            oauthConfig: plugin.oauthConfig ? JSON.parse(plugin.oauthConfig) : null,
            integrationSecrets: plugin.integrationSecrets ? JSON.parse(plugin.integrationSecrets) : null
          }
        }
      })
    } catch (error) {
      fastify.log.error('Failed to create plugin:', error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to create plugin'
      })
    }
  })

  // 获取单个插件详情
  fastify.get('/plugins/:pluginId', {
    schema: {
      hide: true,
      tags: ['Super Admin - Plugin Management'],
      summary: 'Get Plugin Details',
      params: {
        type: 'object',
        properties: {
          pluginId: { type: 'string' }
        },
        required: ['pluginId']
      }
    }
  }, async (request, reply) => {
    const { pluginId } = request.params as { pluginId: string }

    try {
      const plugin = await fastify.prisma.plugin.findUnique({
        where: { id: pluginId },
        include: {
          _count: {
            select: {
              installations: true,
              subscriptions: true
            }
          }
        }
      })

      if (!plugin) {
        return reply.status(404).send({
          success: false,
          error: 'Plugin not found'
        })
      }

      return reply.send({
        success: true,
        data: {
          plugin: {
            ...plugin,
            oauthConfig: plugin.oauthConfig ? JSON.parse(plugin.oauthConfig) : null,
            integrationSecrets: plugin.integrationSecrets ? JSON.parse(plugin.integrationSecrets) : null,
            installationsCount: plugin._count.installations,
            subscriptionsCount: plugin._count.subscriptions
          }
        }
      })
    } catch (error) {
      fastify.log.error('Failed to get plugin details:', error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to get plugin details'
      })
    }
  })

  // 更新插件配置
  fastify.put('/plugins/:pluginId', {
    schema: {
      hide: true,
      tags: ['Super Admin - Plugin Management'],
      summary: 'Update Plugin Configuration',
      params: {
        type: 'object',
        properties: {
          pluginId: { type: 'string' }
        },
        required: ['pluginId']
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          category: { type: 'string', enum: ['payment', 'email', 'integration', 'theme', 'analytics', 'marketing'] },
          runtimeType: { type: 'string', enum: ['internal-fastify', 'external-http'] },
          externalBaseUrl: { type: 'string' },
          oauthConfig: {
            type: 'object',
            properties: {
              installUrl: { type: 'string' },
              tokenUrl: { type: 'string' },
              redirectUri: { type: 'string' },
              scopes: { type: 'string' }
            }
          },
          integrationSecrets: {
            type: 'object',
            properties: {
              sharedSecret: { type: 'string' }
            }
          },
          regenerateSecret: { type: 'boolean', default: false },
          tags: { type: 'string' },
          iconUrl: { type: 'string' },
          status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] }
        }
      }
    }
  }, async (request, reply) => {
    const { pluginId } = request.params as { pluginId: string }
    const updateData = request.body as any

    try {
      // 检查插件是否存在
      const existingPlugin = await fastify.prisma.plugin.findUnique({
        where: { id: pluginId }
      })

      if (!existingPlugin) {
        return reply.status(404).send({
          success: false,
          error: 'Plugin not found'
        })
      }

      // 准备更新数据
      const updateFields: any = {}
      if (updateData.name) updateFields.name = updateData.name
      if (updateData.description !== undefined) updateFields.description = updateData.description
      if (updateData.category) updateFields.category = updateData.category
      if (updateData.runtimeType) updateFields.runtimeType = updateData.runtimeType
      if (updateData.externalBaseUrl !== undefined) updateFields.externalBaseUrl = updateData.externalBaseUrl
      if (updateData.oauthConfig !== undefined) updateFields.oauthConfig = updateData.oauthConfig ? JSON.stringify(updateData.oauthConfig) : null
      if (updateData.tags !== undefined) updateFields.tags = updateData.tags
      if (updateData.iconUrl !== undefined) updateFields.iconUrl = updateData.iconUrl
      if (updateData.status) updateFields.status = updateData.status

      // 处理 integrationSecrets 和 regenerateSecret
      let finalIntegrationSecrets = updateData.integrationSecrets !== undefined
        ? updateData.integrationSecrets
        : (existingPlugin.integrationSecrets ? JSON.parse(existingPlugin.integrationSecrets) : null)

      if (updateData.regenerateSecret) {
        finalIntegrationSecrets = {
          ...finalIntegrationSecrets,
          sharedSecret: generateSharedSecret()
        }
      }

      if (updateData.integrationSecrets !== undefined || updateData.regenerateSecret) {
        updateFields.integrationSecrets = finalIntegrationSecrets ? JSON.stringify(finalIntegrationSecrets) : null
      }

      // 验证外部插件的必填字段
      const isExternalPlugin = updateData.runtimeType === 'external-http' ||
        (existingPlugin.runtimeType === 'external-http' && updateData.runtimeType !== 'internal-fastify')

      if (isExternalPlugin) {
        const finalRuntimeType = updateData.runtimeType || existingPlugin.runtimeType
        const finalExternalBaseUrl = updateData.externalBaseUrl !== undefined ? updateData.externalBaseUrl : existingPlugin.externalBaseUrl
        const finalOauthConfig = updateData.oauthConfig !== undefined ? updateData.oauthConfig : (existingPlugin.oauthConfig ? JSON.parse(existingPlugin.oauthConfig) : null)

        if (finalRuntimeType === 'external-http') {
          // 验证 externalBaseUrl
          if (!finalExternalBaseUrl) {
            return reply.status(400).send({
              success: false,
              error: 'externalBaseUrl is required for external plugins'
            })
          }
          if (!isValidUrl(finalExternalBaseUrl)) {
            return reply.status(400).send({
              success: false,
              error: 'externalBaseUrl must be a valid HTTP/HTTPS URL'
            })
          }

          // 验证 sharedSecret
          if (!finalIntegrationSecrets?.sharedSecret) {
            return reply.status(400).send({
              success: false,
              error: 'integrationSecrets.sharedSecret is required for external plugins'
            })
          }

          // 验证 oauthConfig URLs（如果提供）
          if (finalOauthConfig) {
            if (finalOauthConfig.installUrl && !isValidUrl(finalOauthConfig.installUrl)) {
              return reply.status(400).send({
                success: false,
                error: 'oauthConfig.installUrl must be a valid URL'
              })
            }
            if (finalOauthConfig.tokenUrl && !isValidUrl(finalOauthConfig.tokenUrl)) {
              return reply.status(400).send({
                success: false,
                error: 'oauthConfig.tokenUrl must be a valid URL'
              })
            }
            if (finalOauthConfig.redirectUri && !isValidUrl(finalOauthConfig.redirectUri)) {
              return reply.status(400).send({
                success: false,
                error: 'oauthConfig.redirectUri must be a valid URL'
              })
            }
          }
        }
      }

      const updatedPlugin = await fastify.prisma.plugin.update({
        where: { id: pluginId },
        data: updateFields,
        include: {
          _count: {
            select: {
              installations: true,
              subscriptions: true
            }
          }
        }
      })

      return reply.send({
        success: true,
        data: {
          plugin: {
            ...updatedPlugin,
            oauthConfig: updatedPlugin.oauthConfig ? JSON.parse(updatedPlugin.oauthConfig) : null,
            integrationSecrets: updatedPlugin.integrationSecrets ? JSON.parse(updatedPlugin.integrationSecrets) : null,
            installationsCount: updatedPlugin._count.installations,
            subscriptionsCount: updatedPlugin._count.subscriptions
          }
        }
      })
    } catch (error) {
      fastify.log.error('Failed to update plugin:', error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to update plugin'
      })
    }
  })

  // 重新生成插件的sharedSecret
  fastify.post('/plugins/:pluginId/regenerate-secret', {
    schema: {
      hide: true,
      tags: ['Super Admin - Plugin Management'],
      summary: 'Regenerate Plugin Shared Secret',
      description: 'Generate a new shared secret for an external plugin. The old secret will be invalidated immediately.',
      params: {
        type: 'object',
        properties: {
          pluginId: { type: 'string' }
        },
        required: ['pluginId']
      }
    }
  }, async (request, reply) => {
    const { pluginId } = request.params as { pluginId: string }

    try {
      const plugin = await fastify.prisma.plugin.findUnique({
        where: { id: pluginId }
      })

      if (!plugin) {
        return reply.status(404).send({
          success: false,
          error: 'Plugin not found'
        })
      }

      if (plugin.runtimeType !== 'external-http') {
        return reply.status(400).send({
          success: false,
          error: 'Only external plugins have shared secrets'
        })
      }

      // 生成新的 sharedSecret
      const existingSecrets = plugin.integrationSecrets ? JSON.parse(plugin.integrationSecrets) : {}
      const newSecrets = {
        ...existingSecrets,
        sharedSecret: generateSharedSecret()
      }

      const updatedPlugin = await fastify.prisma.plugin.update({
        where: { id: pluginId },
        data: {
          integrationSecrets: JSON.stringify(newSecrets)
        }
      })

      fastify.log.info(`Regenerated shared secret for plugin ${plugin.slug}`)

      return reply.send({
        success: true,
        data: {
          plugin: {
            id: updatedPlugin.id,
            slug: updatedPlugin.slug,
            integrationSecrets: newSecrets
          },
          message: 'Shared secret regenerated successfully. Please update your external plugin configuration.'
        }
      })
    } catch (error) {
      fastify.log.error('Failed to regenerate shared secret:', error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to regenerate shared secret'
      })
    }
  })

  // 删除插件
  fastify.delete('/plugins/:pluginId', {
    schema: {
      hide: true,
      tags: ['Super Admin - Plugin Management'],
      summary: 'Delete Plugin',
      params: {
        type: 'object',
        properties: {
          pluginId: { type: 'string' }
        },
        required: ['pluginId']
      }
    }
  }, async (request, reply) => {
    const { pluginId } = request.params as { pluginId: string }

    try {
      // 检查是否有活跃安装
      const activeInstallations = await fastify.prisma.pluginInstallation.count({
        where: {
          pluginId,
          status: { in: ['ACTIVE', 'TRIAL'] }
        }
      })

      if (activeInstallations > 0) {
        return reply.status(400).send({
          success: false,
          error: `Cannot delete plugin with ${activeInstallations} active installations`
        })
      }

      await fastify.prisma.plugin.delete({
        where: { id: pluginId }
      })

      return reply.send({
        success: true,
        message: 'Plugin deleted successfully'
      })
    } catch (error) {
      fastify.log.error('Failed to delete plugin:', error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to delete plugin'
      })
    }
  })

  // 获取所有租户的插件使用情况
  fastify.get('/plugin-usage-overview', {
    schema: {
      hide: true,
      tags: ['Super Admin - Plugin Management'],
      summary: 'Get Plugin Usage Overview for All Tenants',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                totalTenants: { type: 'number' },
                totalPlugins: { type: 'number' },
                totalInstallations: { type: 'number' },
                customPricingCount: { type: 'number' },
                tenants: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      tenantId: { type: 'number' },
                      companyName: { type: 'string' },
                      pluginCount: { type: 'number' },
                      hasCustomPricing: { type: 'boolean' },
                      mode: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      // 获取所有租户的插件安装情况
      const tenants = await fastify.prisma.tenant.findMany({
        where: { id: { not: 0 } }, // 排除超级管理员租户
        include: {
          pluginInstallations: {
            include: { plugin: true }
          },
          customPricing: true,
          featureOverrides: true,
          usageOverrides: true
        }
      })

      const totalPlugins = await fastify.prisma.plugin.count()
      const totalInstallations = await fastify.prisma.pluginInstallation.count()
      const customPricingCount = await fastify.prisma.tenantCustomPricing.count()

      const tenantData = tenants.map(tenant => {
        const hasCustomPricing = tenant.customPricing.length > 0
        const hasFeatureOverrides = tenant.featureOverrides.length > 0
        const hasUsageOverrides = tenant.usageOverrides.length > 0

        return {
          tenantId: tenant.id,
          companyName: tenant.companyName,
          pluginCount: tenant.pluginInstallations.length,
          hasCustomPricing,
          hasFeatureOverrides,
          hasUsageOverrides,
          mode: (hasCustomPricing || hasFeatureOverrides || hasUsageOverrides) ? 'COMMERCIAL' : 'STANDARD'
        }
      })

      return {
        success: true,
        data: {
          totalTenants: tenants.length,
          totalPlugins,
          totalInstallations,
          customPricingCount,
          tenants: tenantData
        }
      }
    } catch (error) {
      fastify.log.error('Failed to get plugin usage overview:', error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to get plugin usage overview'
      })
    }
  })

  // ============================================
  // 🔄 插件特定的管理端点（按插件隔离）
  // 路径格式: /:pluginSlug/...
  // ============================================

  // 获取特定插件的统计信息
  fastify.get('/:pluginSlug/stats', {
    schema: {
      hide: true,
      tags: ['Super Admin - Plugin Management'],
      summary: 'Get Specific Plugin Statistics',
      params: {
        type: 'object',
        properties: {
          pluginSlug: { type: 'string' }
        },
        required: ['pluginSlug']
      }
    }
  }, async (request, reply) => {
    const { pluginSlug } = request.params as { pluginSlug: string }

    try {
      // 查找插件
      const plugin = await fastify.prisma.plugin.findUnique({
        where: { slug: pluginSlug },
        include: {
          _count: {
            select: {
              installations: true,
              subscriptions: true
            }
          }
        }
      })

      if (!plugin) {
        return reply.status(404).send({
          success: false,
          error: 'Plugin not found'
        })
      }

      // 统计活跃订阅
      const activeSubscriptions = await fastify.prisma.subscription.count({
        where: {
          pluginId: plugin.id,
          status: { in: ['active', 'trialing'] }
        }
      })

      // 计算收入
      const revenueData = await fastify.prisma.subscription.aggregate({
        where: {
          pluginId: plugin.id,
          status: { in: ['active', 'trialing'] }
        },
        _sum: { amount: true }
      })
      const totalRevenue = revenueData._sum.amount || 0

      // 按计划分组统计
      const subscriptionsByPlan = await fastify.prisma.subscription.groupBy({
        by: ['planId'],
        where: {
          pluginId: plugin.id,
          status: { in: ['active', 'trialing'] }
        },
        _count: true,
        _sum: { amount: true }
      })

      const planStats = subscriptionsByPlan.map(stat => ({
        planId: stat.planId,
        count: stat._count,
        revenue: stat._sum.amount || 0
      }))

      return reply.send({
        success: true,
        data: {
          pluginInfo: {
            id: plugin.id,
            slug: plugin.slug,
            name: plugin.name,
            version: plugin.version,
            status: plugin.status
          },
          totalInstallations: plugin._count.installations,
          totalSubscriptions: plugin._count.subscriptions,
          activeSubscriptions,
          totalRevenue,
          subscriptionsByPlan: planStats
        }
      })
    } catch (error) {
      fastify.log.error('Failed to get plugin stats:', error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to get plugin statistics'
      })
    }
  })

  // 获取租户在特定插件的完整信息（订阅+使用量+定制）
  fastify.get('/:pluginSlug/tenants/:tenantId', {
    schema: {
      hide: true,
      tags: ['Super Admin - Plugin Management'],
      summary: 'Get Tenant Plugin Details (Subscription + Usage + Customizations)',
      params: {
        type: 'object',
        properties: {
          pluginSlug: { type: 'string' },
          tenantId: { type: 'number' }
        },
        required: ['pluginSlug', 'tenantId']
      }
    }
  }, async (request, reply) => {
    const { pluginSlug, tenantId } = request.params as { pluginSlug: string; tenantId: number }

    try {
      // 查找插件
      const plugin = await fastify.prisma.plugin.findUnique({
        where: { slug: pluginSlug }
      })

      if (!plugin) {
        return reply.status(404).send({
          success: false,
          error: 'Plugin not found'
        })
      }

      // 查找租户
      const tenant = await fastify.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          companyName: true,
          contactEmail: true
        }
      })

      if (!tenant) {
        return reply.status(404).send({
          success: false,
          error: 'Tenant not found'
        })
      }

      // 获取所有订阅（包括历史）
      const allSubscriptions = await fastify.prisma.subscription.findMany({
        where: {
          tenantId,
          pluginId: plugin.id
        },
        orderBy: { createdAt: 'desc' }
      })

      // 分离当前订阅和历史订阅
      const currentSubscription = allSubscriptions.find(sub =>
        ['active', 'trialing', 'past_due'].includes(sub.status)
      ) || allSubscriptions[0]

      const subscriptionHistory = allSubscriptions.filter(sub =>
        sub.id !== currentSubscription?.id
      )

      // 获取当前使用量 - 查询所有该租户该插件的使用量记录
      const currentPeriod = new Date().toISOString().slice(0, 7) // '2025-10'
      const allUsageRecords = await fastify.prisma.pluginUsage.findMany({
        where: {
          tenantId,
          pluginSlug
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      // 优先使用当前订阅ID相关的使用量，否则使用最新的使用量记录
      let apiCallsUsage, transactionsUsage, emailsSentUsage, loginAttemptsUsage

      if (currentSubscription) {
        // 查找订阅ID相关的使用量（period格式：subscriptionId:date）
        apiCallsUsage = allUsageRecords.find(u =>
          u.metricName === 'api_calls' && u.period.startsWith(currentSubscription.id)
        )
        transactionsUsage = allUsageRecords.find(u =>
          u.metricName === 'transactions' && u.period.startsWith(currentSubscription.id)
        )
        emailsSentUsage = allUsageRecords.find(u =>
          u.metricName === 'emails_sent' && u.period.startsWith(currentSubscription.id)
        )
        loginAttemptsUsage = allUsageRecords.find(u =>
          u.metricName === 'login_attempts' && u.period.startsWith(currentSubscription.id)
        )
      }

      // 如果没有找到订阅相关的使用量，使用最新的使用量记录
      if (!apiCallsUsage) {
        apiCallsUsage = allUsageRecords.find(u => u.metricName === 'api_calls')
      }
      if (!transactionsUsage) {
        transactionsUsage = allUsageRecords.find(u => u.metricName === 'transactions')
      }
      if (!emailsSentUsage) {
        emailsSentUsage = allUsageRecords.find(u => u.metricName === 'emails_sent')
      }
      if (!loginAttemptsUsage) {
        loginAttemptsUsage = allUsageRecords.find(u => u.metricName === 'login_attempts')
      }

      // 获取限制（从订阅计划或定制定价）
      let limits: any = {}
      if (currentSubscription) {
        const plan = await fastify.prisma.subscriptionPlan.findUnique({
          where: {
            pluginId_planId: {
              pluginId: plugin.id,
              planId: currentSubscription.planId
            }
          }
        })
        if (plan && plan.limits) {
          // Parse JSON string to object (Prisma schema defines limits as String, not Json)
          limits = typeof plan.limits === 'string' ? JSON.parse(plan.limits) : plan.limits
        }
      }

      // 获取定制配置
      const customPricing = await fastify.prisma.tenantCustomPricing.findFirst({
        where: {
          tenantId,
          pluginId: plugin.id,
          validFrom: { lte: new Date() },
          OR: [
            { validTo: null },
            { validTo: { gte: new Date() } }
          ]
        }
      })

      const featureOverrides = await fastify.prisma.tenantFeatureOverride.findMany({
        where: {
          tenantId,
          pluginSlug
        }
      })

      const usageOverrides = await fastify.prisma.tenantUsageOverride.findMany({
        where: {
          tenantId,
          pluginSlug,
          validFrom: { lte: new Date() },
          OR: [
            { validTo: null },
            { validTo: { gte: new Date() } }
          ]
        }
      })

      // 应用使用量覆盖
      if (usageOverrides.length > 0) {
        usageOverrides.forEach(override => {
          if (override.metricName in limits) {
            limits[override.metricName as keyof typeof limits] = override.limitValue
          }
        })
      }



      return reply.send({
        success: true,
        data: {
          tenant: {
            id: tenant.id,
            companyName: tenant.companyName,
            contactEmail: tenant.contactEmail
          },
          plugin: {
            slug: plugin.slug,
            name: plugin.name
          },
          currentSubscription: currentSubscription ? {
            id: currentSubscription.id,
            planId: currentSubscription.planId,
            status: currentSubscription.status,
            amount: currentSubscription.amount,
            currency: currentSubscription.currency,
            currentPeriodStart: currentSubscription.currentPeriodStart,
            currentPeriodEnd: currentSubscription.currentPeriodEnd,
            canceledAt: currentSubscription.canceledAt
          } : null,
          subscriptionHistory: await Promise.all(subscriptionHistory.map(async (sub) => {
            // 查找该订阅的使用量记录
            const subApiCallsUsage = allUsageRecords.find(u =>
              u.metricName === 'api_calls' && u.period.startsWith(sub.id)
            )
            const subTransactionsUsage = allUsageRecords.find(u =>
              u.metricName === 'transactions' && u.period.startsWith(sub.id)
            )

            // 查询该订阅计划的限制
            let subLimits = { api_calls: 0, transactions: 0 }
            const subPlan = await fastify.prisma.subscriptionPlan.findUnique({
              where: {
                pluginId_planId: {
                  pluginId: plugin.id,
                  planId: sub.planId
                }
              }
            })
            if (subPlan && subPlan.limits) {
              subLimits = typeof subPlan.limits === 'string' ? JSON.parse(subPlan.limits) : subPlan.limits
            }

            return {
              id: sub.id,
              planId: sub.planId,
              status: sub.status,
              amount: sub.amount,
              currency: sub.currency,
              createdAt: sub.createdAt,
              canceledAt: sub.canceledAt,
              usage: {
                api_calls: {
                  current: subApiCallsUsage?.value || 0,
                  limit: subLimits.api_calls || 0
                },
                transactions: {
                  current: subTransactionsUsage?.value || 0,
                  limit: subLimits.transactions || 0
                }
              }
            }
          })),
          currentUsage: {
            period: currentPeriod,
            api_calls: {
              current: apiCallsUsage?.value || 0,
              limit: limits.api_calls || 0,
              percentage: limits.api_calls > 0 ? Math.round(((apiCallsUsage?.value || 0) / limits.api_calls) * 100) : 0
            },
            transactions: {
              current: transactionsUsage?.value || 0,
              limit: limits.transactions || 0,
              percentage: limits.transactions > 0 ? Math.round(((transactionsUsage?.value || 0) / limits.transactions) * 100) : 0
            },
            emails_sent: {
              current: emailsSentUsage?.value || 0,
              limit: limits.emails_sent || 0,
              percentage: limits.emails_sent > 0 ? Math.round(((emailsSentUsage?.value || 0) / limits.emails_sent) * 100) : 0
            },
            login_attempts: {
              current: loginAttemptsUsage?.value || 0,
              limit: limits.login_attempts || 0,
              percentage: limits.login_attempts > 0 ? Math.round(((loginAttemptsUsage?.value || 0) / limits.login_attempts) * 100) : 0
            }
          },
          customizations: {
            customPricing: customPricing ? {
              id: customPricing.id,
              planId: customPricing.planId,
              features: typeof customPricing.features === 'string' ? JSON.parse(customPricing.features) : customPricing.features,
              limits: typeof customPricing.limits === 'string' ? JSON.parse(customPricing.limits) : customPricing.limits,
              validFrom: customPricing.validFrom,
              validTo: customPricing.validTo
            } : null,
            featureOverrides: featureOverrides.map(fo => ({
              id: fo.id,
              feature: fo.feature,
              enabled: fo.enabled,
              reason: fo.reason
            })),
            usageOverrides: usageOverrides.map(uo => ({
              id: uo.id,
              metricName: uo.metricName,
              limitValue: uo.limitValue,
              reason: uo.reason,
              validFrom: uo.validFrom,
              validTo: uo.validTo
            }))
          }
        }
      })
    } catch (error) {
      fastify.log.error('Failed to get tenant plugin details:', error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to get tenant plugin details'
      })
    }
  })

  // 为租户创建定制定价（商业化模式）
  fastify.post('/:pluginSlug/tenants/:tenantId/custom-pricing', {
    schema: {
      hide: true,
      tags: ['Super Admin - Plugin Management'],
      summary: 'Create Custom Pricing Plan for Tenant',
      params: {
        type: 'object',
        properties: {
          pluginSlug: { type: 'string' },
          tenantId: { type: 'number' }
        },
        required: ['pluginSlug', 'tenantId']
      },
      body: {
        type: 'object',
        properties: {
          planId: { type: 'string' },
          pricing: { type: 'object' },
          features: { type: 'array', items: { type: 'string' } },
          limits: { type: 'object' },
          validTo: { type: 'string', format: 'date-time' },
          reason: { type: 'string' }
        },
        required: ['planId', 'features', 'limits']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                tenantId: { type: 'number' },
                planId: { type: 'string' },
                mode: { type: 'string' }
              }
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { pluginSlug, tenantId } = request.params as { pluginSlug: string; tenantId: number }
    const { planId, pricing, features, limits, validTo, reason: _reason } = request.body as any // eslint-disable-line @typescript-eslint/no-unused-vars

    try {
      // 查找插件
      const plugin = await fastify.prisma.plugin.findUnique({
        where: { slug: pluginSlug }
      })

      if (!plugin) {
        return reply.status(400).send({
          success: false,
          error: 'Plugin not found'
        })
      }

      // 创建定制定价
      const customPricing = await fastify.prisma.tenantCustomPricing.upsert({
        where: {
          tenantId_pluginId: {
            tenantId,
            pluginId: plugin.id
          }
        },
        update: {
          planId,
          pricing: JSON.stringify(pricing || {}),
          features: JSON.stringify(features),
          limits: JSON.stringify(limits),
          validTo: validTo ? new Date(validTo) : null,
          createdBy: 'super-admin' // TODO: 使用实际的管理员ID
        },
        create: {
          tenantId,
          pluginId: plugin.id,
          planId,
          pricing: JSON.stringify(pricing || {}),
          features: JSON.stringify(features),
          limits: JSON.stringify(limits),
          validTo: validTo ? new Date(validTo) : null,
          createdBy: 'super-admin' // TODO: 使用实际的管理员ID
        }
      })

      return {
        success: true,
        data: {
          id: customPricing.id,
          tenantId: customPricing.tenantId,
          planId: customPricing.planId,
          mode: 'COMMERCIAL'
        }
      }
    } catch (error) {
      fastify.log.error('Failed to create custom pricing:', error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to create custom pricing'
      })
    }
  })

  // 为租户设置功能覆盖
  fastify.post('/:pluginSlug/tenants/:tenantId/feature-overrides', {
    schema: {
      hide: true,
      tags: ['Super Admin - Plugin Management'],
      summary: 'Set Feature Override for Tenant',
      params: {
        type: 'object',
        properties: {
          pluginSlug: { type: 'string' },
          tenantId: { type: 'number' }
        },
        required: ['pluginSlug', 'tenantId']
      },
      body: {
        type: 'object',
        properties: {
          feature: { type: 'string' },
          enabled: { type: 'boolean' },
          reason: { type: 'string' }
        },
        required: ['feature', 'enabled']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                tenantId: { type: 'number' },
                feature: { type: 'string' },
                enabled: { type: 'boolean' }
              }
            }
          }
        },
        500: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const { pluginSlug, tenantId } = request.params as { pluginSlug: string; tenantId: number }
    const { feature, enabled, reason } = request.body as any

    try {
      const featureOverride = await fastify.prisma.tenantFeatureOverride.upsert({
        where: {
          tenantId_pluginSlug_feature: {
            tenantId,
            pluginSlug,
            feature
          }
        },
        update: {
          enabled,
          reason,
          createdBy: 'super-admin' // TODO: 使用实际的管理员ID
        },
        create: {
          tenantId,
          pluginSlug,
          feature,
          enabled,
          reason,
          createdBy: 'super-admin' // TODO: 使用实际的管理员ID
        }
      })

      return {
        success: true,
        data: {
          id: featureOverride.id,
          tenantId: featureOverride.tenantId,
          feature: featureOverride.feature,
          enabled: featureOverride.enabled
        }
      }
    } catch (error) {
      fastify.log.error('Failed to set feature override:', error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to set feature override'
      })
    }
  })

  // 创建/更新使用量覆盖 ⚠️ **新增**
  fastify.post('/:pluginSlug/tenants/:tenantId/usage-overrides', {
    schema: {
      hide: true,
      tags: ['Super Admin - Plugin Management'],
      summary: 'Create or Update Usage Override for Tenant',
      params: {
        type: 'object',
        properties: {
          pluginSlug: { type: 'string' },
          tenantId: { type: 'number' }
        },
        required: ['pluginSlug', 'tenantId']
      },
      body: {
        type: 'object',
        properties: {
          metricName: { type: 'string' },
          limitValue: { type: 'number' },
          reason: { type: 'string' },
          validFrom: { type: 'string', format: 'date-time' },
          validTo: { type: 'string', format: 'date-time' }
        },
        required: ['metricName', 'limitValue']
      }
    }
  }, async (request, reply) => {
    const { pluginSlug, tenantId } = request.params as { pluginSlug: string; tenantId: number }
    const { metricName, limitValue, reason, validFrom, validTo } = request.body as any

    try {
      const usageOverride = await fastify.prisma.tenantUsageOverride.upsert({
        where: {
          tenantId_pluginSlug_metricName: {
            tenantId,
            pluginSlug,
            metricName
          }
        },
        update: {
          limitValue,
          reason,
          validFrom: validFrom ? new Date(validFrom) : new Date(),
          validTo: validTo ? new Date(validTo) : null,
          createdBy: 'super-admin' // TODO: 使用实际的管理员ID
        },
        create: {
          tenantId,
          pluginSlug,
          metricName,
          limitValue,
          reason,
          validFrom: validFrom ? new Date(validFrom) : new Date(),
          validTo: validTo ? new Date(validTo) : null,
          createdBy: 'super-admin' // TODO: 使用实际的管理员ID
        }
      })

      return reply.send({
        success: true,
        data: {
          id: usageOverride.id,
          tenantId: usageOverride.tenantId,
          pluginSlug: usageOverride.pluginSlug,
          metricName: usageOverride.metricName,
          limitValue: usageOverride.limitValue,
          validFrom: usageOverride.validFrom,
          validTo: usageOverride.validTo
        }
      })
    } catch (error) {
      fastify.log.error('Failed to create usage override:', error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to create usage override'
      })
    }
  })

  // 获取租户的订阅历史记录 ⚠️ **新增**
  fastify.get('/:pluginSlug/tenants/:tenantId/subscription-history', {
    schema: {
      hide: true,
      tags: ['Super Admin - Plugin Management'],
      summary: 'Get Tenant Subscription History',
      description: 'Get all subscription records and changes for a specific tenant and plugin',
      params: {
        type: 'object',
        properties: {
          pluginSlug: { type: 'string' },
          tenantId: { type: 'number' }
        },
        required: ['pluginSlug', 'tenantId']
      },
      querystring: {
        type: 'object',
        properties: {
          includeUsage: { type: 'boolean', default: false },
          includeChanges: { type: 'boolean', default: true }
        }
      }
    }
  }, async (request, reply) => {
    const { pluginSlug, tenantId } = request.params as { pluginSlug: string; tenantId: number }
    const { includeUsage = false, includeChanges = true } = request.query as any

    try {
      // 查找插件
      const plugin = await fastify.prisma.plugin.findUnique({
        where: { slug: pluginSlug }
      })

      if (!plugin) {
        return reply.status(404).send({
          success: false,
          error: 'Plugin not found'
        })
      }

      // 查找租户
      const tenant = await fastify.prisma.tenant.findUnique({
        where: { id: tenantId }
      })

      if (!tenant) {
        return reply.status(404).send({
          success: false,
          error: 'Tenant not found'
        })
      }

      // 获取所有订阅记录（按时间倒序）
      const subscriptions = await fastify.prisma.subscription.findMany({
        where: {
          tenantId,
          pluginId: plugin.id
        },
        orderBy: { createdAt: 'desc' },
        include: {
          plugin: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        }
      })

      // 获取订阅变更记录（如果需要）
      let subscriptionChanges: any[] = []
      if (includeChanges && subscriptions.length > 0) {
        subscriptionChanges = await fastify.prisma.subscriptionChange.findMany({
          where: {
            subscriptionId: {
              in: subscriptions.map(sub => sub.id)
            }
          },
          orderBy: { createdAt: 'desc' }
        })
      }

      // 获取使用量数据（如果需要）
      let usageData: any = {}
      if (includeUsage && subscriptions.length > 0) {
        const allUsageRecords = await fastify.prisma.pluginUsage.findMany({
          where: {
            tenantId,
            pluginSlug,
            period: {
              in: subscriptions.map(sub => `${sub.id}:${sub.currentPeriodStart.toISOString().split('T')[0]}`)
            }
          },
          orderBy: { createdAt: 'desc' }
        })

        // 按订阅ID分组使用量数据
        usageData = allUsageRecords.reduce((acc, usage) => {
          const subscriptionId = usage.period.split(':')[0]
          if (!acc[subscriptionId]) {
            acc[subscriptionId] = {}
          }
          acc[subscriptionId][usage.metricName] = usage.value
          return acc
        }, {} as any)
      }

      // 构建历史记录数据
      const historyData = subscriptions.map(subscription => {
        const changes = subscriptionChanges.filter(change => change.subscriptionId === subscription.id)
        const usage = usageData[subscription.id] || {}

        return {
          id: subscription.id,
          planId: subscription.planId,
          status: subscription.status,
          amount: subscription.amount,
          currency: subscription.currency,
          billingCycle: subscription.billingCycle,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          canceledAt: subscription.canceledAt,
          createdAt: subscription.createdAt,
          updatedAt: subscription.updatedAt,
          changes: changes.map(change => ({
            id: change.id,
            changeType: change.changeType,
            fromPlanId: change.fromPlanId,
            toPlanId: change.toPlanId,
            fromAmount: change.fromAmount,
            toAmount: change.toAmount,
            effectiveDate: change.effectiveDate,
            reason: change.reason,
            initiatedBy: change.initiatedBy,
            createdAt: change.createdAt
          })),
          usage: includeUsage ? {
            api_calls: usage.api_calls || 0,
            transactions: usage.transactions || 0
          } : undefined
        }
      })

      return reply.send({
        success: true,
        data: {
          tenant: {
            id: tenant.id,
            companyName: tenant.companyName,
            contactEmail: tenant.contactEmail
          },
          plugin: {
            id: plugin.id,
            name: plugin.name,
            slug: plugin.slug
          },
          subscriptionHistory: historyData,
          totalSubscriptions: subscriptions.length
        }
      })
    } catch (error) {
      fastify.log.error('Error fetching tenant subscription history:', error)
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      })
    }
  })

  // 获取租户的使用量覆盖列表 ⚠️ **新增**
  fastify.get('/:pluginSlug/tenants/:tenantId/usage-overrides', {
    schema: {
      hide: true,
      tags: ['Super Admin - Plugin Management'],
      summary: 'Get Usage Overrides for Tenant',
      params: {
        type: 'object',
        properties: {
          pluginSlug: { type: 'string' },
          tenantId: { type: 'number' }
        },
        required: ['pluginSlug', 'tenantId']
      }
    }
  }, async (request, reply) => {
    const { pluginSlug, tenantId } = request.params as { pluginSlug: string; tenantId: number }

    try {
      const usageOverrides = await fastify.prisma.tenantUsageOverride.findMany({
        where: {
          tenantId,
          pluginSlug
        },
        orderBy: { createdAt: 'desc' }
      })

      return reply.send({
        success: true,
        data: {
          overrides: usageOverrides.map(uo => ({
            id: uo.id,
            metricName: uo.metricName,
            limitValue: uo.limitValue,
            reason: uo.reason,
            validFrom: uo.validFrom,
            validTo: uo.validTo,
            createdAt: uo.createdAt
          }))
        }
      })
    } catch (error) {
      fastify.log.error('Failed to get usage overrides:', error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to get usage overrides'
      })
    }
  })

  // 删除使用量覆盖 ⚠️ **新增**
  fastify.delete('/:pluginSlug/tenants/:tenantId/usage-overrides/:overrideId', {
    schema: {
      hide: true,
      tags: ['Super Admin - Plugin Management'],
      summary: 'Delete Usage Override',
      params: {
        type: 'object',
        properties: {
          pluginSlug: { type: 'string' },
          tenantId: { type: 'number' },
          overrideId: { type: 'string' }
        },
        required: ['pluginSlug', 'tenantId', 'overrideId']
      }
    }
  }, async (request, reply) => {
    const { overrideId } = request.params as { pluginSlug: string; tenantId: number; overrideId: string }

    try {
      await fastify.prisma.tenantUsageOverride.delete({
        where: { id: overrideId }
      })

      return reply.send({
        success: true,
        message: 'Usage override deleted successfully'
      })
    } catch (error) {
      fastify.log.error('Failed to delete usage override:', error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to delete usage override'
      })
    }
  })

  // ============================================
  // 🆕 订阅管理API端点（按插件隔离）
  // ============================================

  // 获取特定插件的订阅列表
  fastify.get('/:pluginSlug/subscriptions', {
    schema: {
      hide: true,
      tags: ['Super Admin - Plugin Management'],
      summary: 'Get Plugin Subscriptions List (with pagination and filtering)',
      description: 'Get ALL subscriptions for a specific plugin, not just latest per tenant',
      params: {
        type: 'object',
        properties: {
          pluginSlug: { type: 'string' }
        },
        required: ['pluginSlug']
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1 },
          limit: { type: 'number', default: 20 },
          status: { type: 'string' },
          tenantId: { type: 'number' },
          planId: { type: 'string' },
          includeUsage: { type: 'boolean', default: false },
          viewType: { type: 'string', enum: ['tenants', 'subscriptions'], default: 'subscriptions' }
        }
      }
    }
  }, async (request, reply) => {
    const { pluginSlug } = request.params as { pluginSlug: string }
    const { page = 1, limit = 20, status, tenantId, planId, includeUsage = false, viewType = 'subscriptions' } = request.query as any

    try {
      // 查找插件
      const plugin = await fastify.prisma.plugin.findUnique({
        where: { slug: pluginSlug }
      })

      if (!plugin) {
        return reply.status(404).send({
          success: false,
          error: 'Plugin not found'
        })
      }

      // 🔧 支持两种视图类型：
      // - viewType='tenants': 租户视图，每个租户显示最新订阅
      // - viewType='subscriptions': 订阅视图，显示所有订阅记录

      if (viewType === 'tenants') {
        // 租户视图：每个租户显示最新订阅（与租户详情页逻辑一致）

        // 1. 首先获取所有有订阅的租户
        const allSubscriptions = await fastify.prisma.subscription.findMany({
          where: {
            pluginId: plugin.id,
            ...(tenantId && { tenantId }),
            ...(planId && { planId })
          },
          orderBy: { createdAt: 'desc' },
          include: {
            tenant: {
              select: {
                id: true,
                companyName: true,
                contactEmail: true
              }
            }
          }
        })

        // 2. 按租户分组，每个租户只保留最新的订阅（与租户详情页逻辑一致）
        const tenantSubscriptionMap = new Map()

        for (const subscription of allSubscriptions) {
          const tenantId = subscription.tenantId

          if (!tenantSubscriptionMap.has(tenantId)) {
            // 使用与租户详情页相同的逻辑：优先显示active/trialing/past_due，否则显示最新的
            const currentSubscription = allSubscriptions
              .filter(sub => sub.tenantId === tenantId)
              .find(sub => ['active', 'trialing', 'past_due'].includes(sub.status)) ||
              allSubscriptions.find(sub => sub.tenantId === tenantId)

            if (currentSubscription) {
              tenantSubscriptionMap.set(tenantId, currentSubscription)
            }
          }
        }

        // 3. 转换为数组并应用状态过滤（如果指定）
        let latestSubscriptions = Array.from(tenantSubscriptionMap.values())

        if (status && status !== 'all') {
          latestSubscriptions = latestSubscriptions.filter(sub => sub.status === status)
        }

        // 4. 应用分页
        const total = latestSubscriptions.length
        const skip = (page - 1) * limit
        const subscriptions = latestSubscriptions.slice(skip, skip + limit)

        return reply.send({
          success: true,
          data: {
            subscriptions: subscriptions.map(sub => ({
              id: sub.id,
              status: sub.status,
              planId: sub.planId,
              amount: sub.amount,
              currency: sub.currency,
              billingCycle: sub.billingCycle,
              currentPeriodStart: sub.currentPeriodStart,
              currentPeriodEnd: sub.currentPeriodEnd,
              canceledAt: sub.canceledAt,
              createdAt: sub.createdAt,
              tenant: sub.tenant
            })),
            pagination: {
              page,
              limit,
              total, // 租户数量
              totalPages: Math.ceil(total / limit)
            }
          }
        })

      } else {
        // 订阅视图：显示所有订阅记录

        // 1. 构建查询条件
        const where: any = {
          pluginId: plugin.id
        }

        if (status && status !== 'all') {
          where.status = status
        }

        if (tenantId) {
          where.tenantId = tenantId
        }

        if (planId) {
          where.planId = planId
        }

        // 2. 获取订阅总数
        const total = await fastify.prisma.subscription.count({ where })

        // 3. 获取分页的订阅列表
        const skip = (page - 1) * limit
        const subscriptions = await fastify.prisma.subscription.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            tenant: {
              select: {
                id: true,
                companyName: true,
                contactEmail: true
              }
            }
          }
        })

        // 4. 如果需要包含使用量
        let subscriptionsWithUsage = subscriptions
        if (includeUsage) {
          // Query all usage records for this plugin and tenant at once
          const allUsageRecords = await fastify.prisma.pluginUsage.findMany({
            where: {
              pluginSlug,
              tenantId: {
                in: subscriptions.map(sub => sub.tenantId)
              }
            },
            orderBy: {
              createdAt: 'desc'
            }
          })

          subscriptionsWithUsage = await Promise.all(
            subscriptions.map(async (sub) => {
              // Find usage records for this specific subscription (period format: subscriptionId:date)
              const subApiCallsUsage = allUsageRecords.find(u =>
                u.metricName === 'api_calls' && u.period.startsWith(sub.id)
              )
              const subTransactionsUsage = allUsageRecords.find(u =>
                u.metricName === 'transactions' && u.period.startsWith(sub.id)
              )

              // 获取限制
              const plan = await fastify.prisma.subscriptionPlan.findUnique({
                where: {
                  pluginId_planId: {
                    pluginId: plugin.id,
                    planId: sub.planId
                  }
                }
              })

              let limits = { api_calls: 0, transactions: 0 }
              if (plan && plan.limits) {
                limits = typeof plan.limits === 'string' ? JSON.parse(plan.limits) : plan.limits
              }

              return {
                ...sub,
                usage: {
                  api_calls: {
                    current: subApiCallsUsage?.value || 0,
                    limit: limits.api_calls
                  },
                  transactions: {
                    current: subTransactionsUsage?.value || 0,
                    limit: limits.transactions
                  }
                }
              }
            })
          )
        }

        return reply.send({
          success: true,
          data: {
            subscriptions: subscriptionsWithUsage.map(sub => ({
              id: sub.id,
              status: sub.status,
              planId: sub.planId,
              amount: sub.amount,
              currency: sub.currency,
              billingCycle: sub.billingCycle,
              currentPeriodStart: sub.currentPeriodStart,
              currentPeriodEnd: sub.currentPeriodEnd,
              canceledAt: sub.canceledAt,
              createdAt: sub.createdAt,
              tenant: sub.tenant,
              usage: (sub as any).usage || undefined
            })),
            pagination: {
              page,
              limit,
              total, // 现在是所有订阅的总数
              totalPages: Math.ceil(total / limit)
            }
          }
        })
      }
    } catch (error) {
      fastify.log.error('Failed to get plugin subscriptions:', error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to get plugin subscriptions'
      })
    }
  })

  // 🆕 超级管理员手动创建订阅
  fastify.post('/:pluginSlug/tenants/:tenantId/subscriptions', {
    schema: {
      hide: true,
      tags: ['Super Admin - Plugin Management'],
      summary: 'Create Subscription for Tenant (Manual)',
      description: 'Manually create a new subscription for a tenant. Replaces existing subscription if specified.',
      params: {
        type: 'object',
        properties: {
          pluginSlug: { type: 'string' },
          tenantId: { type: 'number' }
        },
        required: ['pluginSlug', 'tenantId']
      },
      body: {
        type: 'object',
        properties: {
          planId: {
            type: 'string',
            enum: ['free', 'business', 'enterprise'],
            description: 'Subscription plan to create'
          },
          reason: {
            type: 'string',
            description: 'Reason for creating this subscription'
          },
          startDate: {
            type: 'string',
            format: 'date',
            description: 'Start date for the subscription (optional, defaults to today)'
          },
          replaceExisting: {
            type: 'boolean',
            default: true,
            description: 'Whether to cancel existing active subscription'
          }
        },
        required: ['planId']
      }
    }
  }, async (request, reply) => {
    const { pluginSlug, tenantId } = request.params as { pluginSlug: string; tenantId: number }
    const { planId, reason, startDate, replaceExisting = true } = request.body as any

    try {
      // 1. 验证插件
      const plugin = await fastify.prisma.plugin.findUnique({
        where: { slug: pluginSlug }
      })

      if (!plugin) {
        return reply.status(404).send({
          success: false,
          error: 'Plugin not found'
        })
      }

      // 2. 验证租户
      const tenant = await fastify.prisma.tenant.findUnique({
        where: { id: tenantId }
      })

      if (!tenant) {
        return reply.status(404).send({
          success: false,
          error: 'Tenant not found'
        })
      }

      // 3. 验证订阅计划是否存在
      const subscriptionPlan = await fastify.prisma.subscriptionPlan.findUnique({
        where: {
          pluginId_planId: {
            pluginId: plugin.id,
            planId
          }
        }
      })

      if (!subscriptionPlan) {
        return reply.status(404).send({
          success: false,
          error: `Subscription plan '${planId}' not found for plugin '${pluginSlug}'`
        })
      }

      // 4. 检查现有订阅（使用与租户详情页相同的逻辑）
      const existingSubscriptions = await fastify.prisma.subscription.findMany({
        where: {
          tenantId,
          pluginId: plugin.id
        },
        orderBy: { createdAt: 'desc' }
      })

      const currentSubscription = existingSubscriptions.find(sub =>
        ['active', 'trialing', 'past_due'].includes(sub.status)
      ) || existingSubscriptions[0]

      // 5. 处理现有订阅（如果需要替换）
      if (currentSubscription && replaceExisting) {
        await fastify.updateSubscription(currentSubscription.id, {
          status: 'canceled',
          canceledAt: new Date(),
          reason: `Replaced by new ${planId} subscription - manual creation by super admin`,
          eventSource: 'super_admin',
          initiatedBy: 'super_admin'
        })

        // 记录取消变更
        await fastify.prisma.subscriptionChange.create({
          data: {
            subscriptionId: currentSubscription.id,
            changeType: 'canceled',
            fromPlanId: currentSubscription.planId,
            toPlanId: null,
            fromAmount: currentSubscription.amount,
            toAmount: 0,
            effectiveDate: new Date(),
            reason: 'Manual cancellation by super admin for replacement',
            initiatedBy: 'super_admin'
          }
        })
      }

      // 6. 创建新订阅（复用现有逻辑）
      const newSubscription = await fastify.createSubscription(
        tenantId,
        pluginSlug,
        planId,
        {
          eventSource: 'super_admin',
          initiatedBy: 'super_admin',
          reason: reason || `Manual ${planId} subscription creation by super admin`,
          metadata: {
            previousSubscriptionId: currentSubscription?.id,
            creationType: 'manual_super_admin',
            createdBy: 'super_admin',
            createdAt: new Date().toISOString(),
            originalReason: reason,
            requestedStartDate: startDate || null
          }
        }
      )

      // 7. 记录创建变更
      await fastify.prisma.subscriptionChange.create({
        data: {
          subscriptionId: newSubscription.id,
          changeType: 'created',
          fromPlanId: currentSubscription?.planId || null,
          toPlanId: planId,
          fromAmount: currentSubscription?.amount || 0,
          toAmount: newSubscription.amount,
          effectiveDate: new Date(),
          reason: reason || `Manual subscription creation by super admin`,
          initiatedBy: 'super_admin'
        }
      })

      // 8. 返回成功响应
      return reply.send({
        success: true,
        data: {
          subscription: {
            id: newSubscription.id,
            planId: newSubscription.planId,
            status: newSubscription.status,
            amount: newSubscription.amount,
            currency: newSubscription.currency,
            currentPeriodStart: newSubscription.currentPeriodStart,
            currentPeriodEnd: newSubscription.currentPeriodEnd,
            createdAt: newSubscription.createdAt
          },
          previousSubscription: currentSubscription ? {
            id: currentSubscription.id,
            planId: currentSubscription.planId,
            status: 'canceled'
          } : null,
          message: `Successfully created ${planId} subscription for ${tenant.companyName}`
        }
      })
    } catch (error) {
      fastify.log.error('Failed to create subscription:', error)
      return reply.status(500).send({
        success: false,
        error: 'Failed to create subscription',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // 获取所有订阅列表（分页）
  fastify.get('/subscriptions', {
    schema: {
      hide: true,
      tags: ['Super Admin - Subscription Management'],
      summary: 'Get All Subscriptions List (with pagination and filtering)',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', default: 1 },
          limit: { type: 'number', default: 20 },
          status: { type: 'string' },
          pluginId: { type: 'string' },
          tenantId: { type: 'number' },
          planId: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { page = 1, limit = 20, status, pluginId, tenantId, planId } = request.query as any;
      const skip = (page - 1) * limit;

      // 构建查询条件
      const where: any = {};
      if (status) where.status = status;
      if (pluginId) where.pluginId = pluginId;
      if (tenantId) where.tenantId = tenantId;
      if (planId) where.planId = planId;

      // 获取订阅列表
      const subscriptions = await fastify.prisma.subscription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          tenant: {
            select: {
              id: true,
              companyName: true,
              contactEmail: true
            }
          },
          plugin: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          },
          _count: {
            select: {
              invoices: true,
              changes: true,
              events: true
            }
          }
        }
      });

      // 获取总数
      const total = await fastify.prisma.subscription.count({ where });

      return reply.send({
        success: true,
        data: {
          subscriptions: subscriptions.map(sub => ({
            id: sub.id,
            status: sub.status,
            planId: sub.planId,
            amount: sub.amount,
            currency: sub.currency,
            billingCycle: sub.billingCycle,
            currentPeriodStart: sub.currentPeriodStart,
            currentPeriodEnd: sub.currentPeriodEnd,
            trialEnd: sub.trialEnd,
            cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
            canceledAt: sub.canceledAt,
            autoRenew: sub.autoRenew,
            createdAt: sub.createdAt,
            updatedAt: sub.updatedAt,
            tenant: sub.tenant,
            plugin: sub.plugin,
            counts: sub._count
          })),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      fastify.log.error('Failed to get subscriptions:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get subscriptions'
      });
    }
  })

  // 获取特定订阅详情
  fastify.get('/:pluginSlug/subscriptions/:id', {
    schema: {
      hide: true,
      tags: ['Super Admin - Plugin Management'],
      summary: 'Get Specific Subscription Details',
      params: {
        type: 'object',
        properties: {
          pluginSlug: { type: 'string' },
          id: { type: 'string' }
        },
        required: ['pluginSlug', 'id']
      }
    }
  }, async (request, reply) => {
    const { pluginSlug, id } = request.params as { pluginSlug: string; id: string }

    try {
      // 查找插件
      const plugin = await fastify.prisma.plugin.findUnique({
        where: { slug: pluginSlug }
      })

      if (!plugin) {
        return reply.status(404).send({
          success: false,
          error: 'Plugin not found'
        })
      }

      const subscription = await fastify.prisma.subscription.findFirst({
        where: {
          id,
          pluginId: plugin.id
        },
        include: {
          tenant: true,
          plugin: true,
          invoices: {
            orderBy: { createdAt: 'desc' },
            take: 10
          },
          changes: {
            orderBy: { createdAt: 'desc' },
            take: 10
          },
          events: {
            orderBy: { createdAt: 'desc' },
            take: 20
          }
        }
      })

      if (!subscription) {
        return reply.status(404).send({
          success: false,
          error: 'Subscription not found'
        })
      }

      // 获取使用量数据 - 使用当前年-月格式
      const currentPeriod = new Date().toISOString().slice(0, 7) // '2025-10'
      const usageRecords = await fastify.prisma.pluginUsage.findMany({
        where: {
          tenantId: subscription.tenantId,
          pluginSlug,
          period: currentPeriod
        }
      })

      // 获取订阅计划的限制
      const subscriptionPlan = await fastify.prisma.subscriptionPlan.findUnique({
        where: {
          pluginId_planId: {
            pluginId: plugin.id,
            planId: subscription.planId
          }
        }
      })

      let limits: any = {}
      if (subscriptionPlan && subscriptionPlan.limits) {
        limits = typeof subscriptionPlan.limits === 'string' ? JSON.parse(subscriptionPlan.limits) : subscriptionPlan.limits
      }

      // 🔧 动态构建 usage 对象，支持所有插件的所有指标
      const usage: any = {}
      usageRecords.forEach(record => {
        usage[record.metricName] = {
          current: record.value,
          limit: limits[record.metricName] || -1 // -1 表示 Unlimited
        }
      })

      // 🔧 确保所有计划中定义的 limits 都有对应的 usage 条目（即使当前使用量为 0）
      Object.keys(limits).forEach(metricKey => {
        if (!usage[metricKey]) {
          usage[metricKey] = {
            current: 0,
            limit: limits[metricKey] || -1
          }
        }
      })

      return reply.send({
        success: true,
        data: {
          subscription: {
            ...subscription,
            metadata: subscription.metadata ? JSON.parse(subscription.metadata) : null,
            usage
          }
        }
      })
    } catch (error) {
      fastify.log.error('Failed to get subscription details:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get subscription details'
      })
    }
  })

  // 更新订阅状态
  fastify.put('/:pluginSlug/subscriptions/:id/status', {
    schema: {
      hide: true,
      tags: ['Super Admin - Plugin Management'],
      summary: 'Update Subscription Status',
      params: {
        type: 'object',
        properties: {
          pluginSlug: { type: 'string' },
          id: { type: 'string' }
        },
        required: ['pluginSlug', 'id']
      },
      body: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['active', 'trialing', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid']
          },
          reason: { type: 'string' }
        },
        required: ['status']
      }
    }
  }, async (request, reply) => {
    const { pluginSlug, id } = request.params as { pluginSlug: string; id: string }
    const { status, reason } = request.body as any

    try {
      // 查找插件
      const plugin = await fastify.prisma.plugin.findUnique({
        where: { slug: pluginSlug }
      })

      if (!plugin) {
        return reply.status(404).send({
          success: false,
          error: 'Plugin not found'
        })
      }

      const subscription = await fastify.prisma.subscription.findFirst({
        where: {
          id,
          pluginId: plugin.id
        }
      })

      if (!subscription) {
        return reply.status(404).send({
          success: false,
          error: 'Subscription not found'
        })
      }

      // 使用商业支持插件的更新方法
      const updatedSubscription = await (fastify as any).updateSubscription(id, {
        status,
        reason: reason || `Status changed to ${status} by admin`,
        initiatedBy: 'admin',
        eventSource: 'admin_panel'
      })

      return reply.send({
        success: true,
        data: {
          subscription: updatedSubscription
        },
        message: `Subscription status updated to ${status} successfully`
      })
    } catch (error) {
      fastify.log.error('Failed to update subscription status:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to update subscription status'
      })
    }
  })

  // 更新订阅使用量 ⚠️ **新增**
  fastify.put('/:pluginSlug/subscriptions/:id/usage', {
    schema: {
      hide: true,
      tags: ['Super Admin - Plugin Management'],
      summary: 'Update Subscription Usage (Plugin-specific metrics)',
      params: {
        type: 'object',
        properties: {
          pluginSlug: { type: 'string' },
          id: { type: 'string' }
        },
        required: ['pluginSlug', 'id']
      },
      body: {
        type: 'object',
        properties: {
          metricName: {
            type: 'string',
            description: 'Metric name (e.g., api_calls, transactions, emails_sent)'
          },
          value: { type: 'number', minimum: 0 },
          action: {
            type: 'string',
            enum: ['set', 'reset'],
            description: 'set: Set to specific value, reset: Reset to 0'
          }
        },
        required: ['metricName', 'action']
      }
    }
  }, async (request, reply) => {
    const { pluginSlug, id } = request.params as { pluginSlug: string; id: string }
    const { metricName, value, action } = request.body as any

    try {
      // 查找插件
      const plugin = await fastify.prisma.plugin.findUnique({
        where: { slug: pluginSlug }
      })

      if (!plugin) {
        return reply.status(404).send({
          success: false,
          error: 'Plugin not found'
        })
      }

      // 查找订阅
      const subscription = await fastify.prisma.subscription.findFirst({
        where: {
          id,
          pluginId: plugin.id
        }
      })

      if (!subscription) {
        return reply.status(404).send({
          success: false,
          error: 'Subscription not found'
        })
      }

      // 🔧 修复：确保只有活跃的订阅才能更新使用量
      if (subscription.status !== 'active') {
        return reply.status(400).send({
          success: false,
          error: `Cannot update usage for ${subscription.status} subscription. Only active subscriptions can be updated.`
        })
      }

      // 确定新的使用量值
      const newValue = action === 'reset' ? 0 : (value !== undefined ? value : 0)

      // 生成period格式：subscriptionId:YYYY-MM-DD
      const period = `${id}:${new Date().toISOString().split('T')[0]}`

      // 更新或创建使用量记录
      const usage = await fastify.prisma.pluginUsage.upsert({
        where: {
          tenantId_pluginSlug_metricName_period: {
            tenantId: subscription.tenantId,
            pluginSlug,
            metricName,
            period
          }
        },
        update: {
          value: newValue,
          updatedAt: new Date()
        },
        create: {
          tenantId: subscription.tenantId,
          pluginSlug,
          metricName,
          value: newValue,
          period
        }
      })

      return reply.send({
        success: true,
        data: {
          usage: {
            id: usage.id,
            metricName: usage.metricName,
            value: usage.value,
            period: usage.period,
            updatedAt: usage.updatedAt
          }
        },
        message: `${metricName} ${action === 'reset' ? 'reset to 0' : `set to ${newValue}`} successfully`
      })
    } catch (error) {
      fastify.log.error('Failed to update subscription usage:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to update subscription usage'
      })
    }
  })

  // ============================================
  // 🆕 订阅计划管理API端点（按插件隔离）
  // ============================================

  // 获取特定插件的所有订阅计划
  fastify.get('/:pluginSlug/plans', {
    schema: {
      hide: true,
      tags: ['Super Admin - Plugin Management'],
      summary: 'Get All Subscription Plans for Plugin',
      params: {
        type: 'object',
        properties: {
          pluginSlug: { type: 'string' }
        },
        required: ['pluginSlug']
      }
    }
  }, async (request, reply) => {
    const { pluginSlug } = request.params as { pluginSlug: string }

    try {
      // 查找插件
      const plugin = await fastify.prisma.plugin.findUnique({
        where: { slug: pluginSlug }
      })

      if (!plugin) {
        return reply.status(404).send({
          success: false,
          error: 'Plugin not found'
        })
      }

      const subscriptionPlans = await fastify.prisma.subscriptionPlan.findMany({
        where: { pluginId: plugin.id },
        orderBy: { amount: 'asc' }
      })

      // 为每个计划计算订阅数量
      const plansWithStats = await Promise.all(
        subscriptionPlans.map(async (plan) => {
          const activeSubscriptions = await fastify.prisma.subscription.count({
            where: {
              pluginId: plan.pluginId,
              planId: plan.planId,
              status: { in: ['active', 'trialing'] }
            }
          })

          const totalRevenue = await fastify.prisma.subscription.aggregate({
            where: {
              pluginId: plan.pluginId,
              planId: plan.planId,
              status: { in: ['active', 'trialing'] }
            },
            _sum: { amount: true }
          })

          return {
            ...plan,
            features: JSON.parse(plan.features),
            limits: plan.limits ? JSON.parse(plan.limits) : null,
            stats: {
              activeSubscriptions,
              totalRevenue: totalRevenue._sum.amount || 0
            }
          }
        })
      )

      return reply.send({
        success: true,
        data: { subscriptionPlans: plansWithStats }
      })
    } catch (error) {
      fastify.log.error('Failed to get subscription plans:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to get subscription plans'
      })
    }
  })

  // 创建订阅计划
  fastify.post('/:pluginSlug/plans', {
    schema: {
      hide: true,
      tags: ['Super Admin - Plugin Management'],
      summary: 'Create New Subscription Plan',
      params: {
        type: 'object',
        properties: {
          pluginSlug: { type: 'string' }
        },
        required: ['pluginSlug']
      },
      body: {
        type: 'object',
        properties: {
          planId: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          amount: { type: 'number' },
          currency: { type: 'string' },
          billingCycle: { type: 'string', enum: ['monthly', 'quarterly', 'yearly'] },
          trialDays: { type: 'number' },
          stripePriceId: { type: 'string', description: 'Stripe Price ID (e.g., price_xxx)' },
          features: { type: 'array', items: { type: 'string' } },
          limits: { type: 'object' },
          isActive: { type: 'boolean' }
        },
        required: ['planId', 'name', 'amount', 'currency', 'billingCycle', 'features']
      }
    }
  }, async (request, reply) => {
    const { pluginSlug } = request.params as { pluginSlug: string }
    const {
      planId,
      name,
      description,
      amount,
      currency,
      billingCycle,
      trialDays = 0,
      stripePriceId,
      features,
      limits,
      isActive = true
    } = request.body as any

    try {
      // 查找插件
      const plugin = await fastify.prisma.plugin.findUnique({
        where: { slug: pluginSlug }
      })

      if (!plugin) {
        return reply.status(404).send({
          success: false,
          error: 'Plugin not found'
        })
      }

      // 检查计划ID是否已存在
      const existingPlan = await fastify.prisma.subscriptionPlan.findUnique({
        where: {
          pluginId_planId: {
            pluginId: plugin.id,
            planId
          }
        }
      })

      if (existingPlan) {
        return reply.status(400).send({
          success: false,
          error: 'Subscription plan with this ID already exists'
        })
      }

      // 创建订阅计划
      // limits is required in schema, so we must provide a value
      if (!limits || Object.keys(limits).length === 0) {
        return reply.status(400).send({
          success: false,
          message: 'Limits are required. Please specify api_calls and transactions limits.'
        })
      }

      const subscriptionPlan = await fastify.prisma.subscriptionPlan.create({
        data: {
          pluginId: plugin.id,
          planId,
          name,
          description,
          amount,
          currency: currency.toUpperCase(),
          billingCycle,
          trialDays,
          stripePriceId: stripePriceId || null,  // 🆕 支持Stripe Price ID
          features: JSON.stringify(features),
          limits: JSON.stringify(limits),
          isActive
        }
      })

      // 🔧 阶段3优化：不再需要同步到Plugin.pricing，统一使用subscription_plans表

      return reply.send({
        success: true,
        data: {
          subscriptionPlan: {
            ...subscriptionPlan,
            features: JSON.parse(subscriptionPlan.features),
            limits: subscriptionPlan.limits ? JSON.parse(subscriptionPlan.limits) : null,
            plugin: {
              name: plugin.name,
              slug: plugin.slug
            }
          }
        }
      })
    } catch (error) {
      fastify.log.error('Failed to create subscription plan:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to create subscription plan'
      })
    }
  })

  // 更新订阅计划
  fastify.put('/:pluginSlug/plans/:planId', {
    schema: {
      hide: true,
      tags: ['Super Admin - Plugin Management'],
      summary: 'Update Subscription Plan',
      params: {
        type: 'object',
        properties: {
          pluginSlug: { type: 'string' },
          planId: { type: 'string' }
        },
        required: ['pluginSlug', 'planId']
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          amount: { type: 'number' },
          currency: { type: 'string' },
          billingCycle: { type: 'string', enum: ['monthly', 'quarterly', 'yearly'] },
          trialDays: { type: 'number' },
          stripePriceId: { type: 'string', description: 'Stripe Price ID (e.g., price_xxx)' },
          features: { type: 'array', items: { type: 'string' } },
          limits: { type: 'object' },
          isActive: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    const { pluginSlug, planId } = request.params as { pluginSlug: string; planId: string }
    const updateData = request.body as any

    try {
      // 查找插件
      const plugin = await fastify.prisma.plugin.findUnique({
        where: { slug: pluginSlug }
      })

      if (!plugin) {
        return reply.status(404).send({
          success: false,
          error: 'Plugin not found'
        })
      }

      // 检查计划是否存在
      const existingPlan = await fastify.prisma.subscriptionPlan.findUnique({
        where: {
          pluginId_planId: {
            pluginId: plugin.id,
            planId
          }
        }
      })

      if (!existingPlan) {
        return reply.status(404).send({
          success: false,
          error: 'Subscription plan not found'
        })
      }

      // 准备更新数据
      const updateFields: any = {}
      if (updateData.name) updateFields.name = updateData.name
      if (updateData.description) updateFields.description = updateData.description
      if (updateData.amount) updateFields.amount = updateData.amount
      if (updateData.currency) updateFields.currency = updateData.currency.toUpperCase()
      if (updateData.billingCycle) updateFields.billingCycle = updateData.billingCycle
      if (updateData.trialDays !== undefined) updateFields.trialDays = updateData.trialDays
      if (updateData.stripePriceId !== undefined) updateFields.stripePriceId = updateData.stripePriceId  // 🆕 支持更新Stripe Price ID
      if (updateData.features) updateFields.features = JSON.stringify(updateData.features)
      if (updateData.limits) updateFields.limits = JSON.stringify(updateData.limits)
      if (updateData.isActive !== undefined) updateFields.isActive = updateData.isActive

      // 更新计划
      const updatedPlan = await fastify.prisma.subscriptionPlan.update({
        where: {
          pluginId_planId: {
            pluginId: plugin.id,
            planId
          }
        },
        data: updateFields,
        include: {
          plugin: {
            select: {
              name: true,
              slug: true
            }
          }
        }
      })

      // 🔧 阶段3优化：不再需要同步到Plugin.pricing，统一使用subscription_plans表

      return reply.send({
        success: true,
        data: {
          subscriptionPlan: {
            ...updatedPlan,
            features: JSON.parse(updatedPlan.features),
            limits: updatedPlan.limits ? JSON.parse(updatedPlan.limits) : null
          }
        }
      })
    } catch (error) {
      fastify.log.error('Failed to update subscription plan:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to update subscription plan'
      })
    }
  })

  // 删除订阅计划
  fastify.delete('/:pluginSlug/plans/:planId', {
    schema: {
      hide: true,
      tags: ['Super Admin - Plugin Management'],
      summary: 'Delete Subscription Plan',
      params: {
        type: 'object',
        properties: {
          pluginSlug: { type: 'string' },
          planId: { type: 'string' }
        },
        required: ['pluginSlug', 'planId']
      }
    }
  }, async (request, reply) => {
    const { pluginSlug, planId } = request.params as { pluginSlug: string; planId: string }

    try {
      // 查找插件
      const plugin = await fastify.prisma.plugin.findUnique({
        where: { slug: pluginSlug }
      })

      if (!plugin) {
        return reply.status(404).send({
          success: false,
          error: 'Plugin not found'
        })
      }

      // 检查是否有活跃订阅使用此计划
      const activeSubscriptions = await fastify.prisma.subscription.count({
        where: {
          pluginId: plugin.id,
          planId,
          status: { in: ['active', 'trialing'] }
        }
      })

      if (activeSubscriptions > 0) {
        return reply.status(400).send({
          success: false,
          error: `Cannot delete plan with ${activeSubscriptions} active subscriptions`
        })
      }

      // 删除计划
      await fastify.prisma.subscriptionPlan.delete({
        where: {
          pluginId_planId: {
            pluginId: plugin.id,
            planId
          }
        }
      })

      // 🔧 阶段3优化：不再需要同步到Plugin.pricing，统一使用subscription_plans表

      return reply.send({
        success: true,
        message: 'Subscription plan deleted successfully'
      })
    } catch (error) {
      fastify.log.error('Failed to delete subscription plan:', error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to delete subscription plan'
      })
    }
  })
}
