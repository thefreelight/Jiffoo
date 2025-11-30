import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import { generateSignature } from '../utils/signature'

/**
 * Plugin Gateway Plugin
 *
 * 统一插件网关，负责：
 * - 为外部插件（runtimeType = 'external-http'）动态注册代理路由
 * - 验证插件状态、安装状态、许可证和用量限制
 * - 提供签名和HTTP代理功能
 *
 * 架构说明：
 * - 内部插件（internal-fastify）：直接注册在各自的路由上，不经过此网关
 * - 外部插件（external-http）：通过此网关代理请求到外部服务
 *
 * 这样避免了路由冲突问题
 */
const pluginGateway: FastifyPluginAsync = async (fastify, _options) => {
  // 获取环境变量中的feature flag
  const EXTERNAL_PLUGIN_ENABLED = process.env.EXTERNAL_PLUGIN_ENABLED === 'true'

  // 缓存已注册的外部插件路由，避免重复注册
  const registeredExternalPlugins = new Set<string>()

  /**
   * 外部插件代理处理器
   */
  async function handleExternalPluginRequest(
    request: FastifyRequest,
    reply: FastifyReply,
    plugin: any,
    installation: any
  ) {
    const { slug } = request.params as { slug: string }
    const path = request.url.replace(`/api/plugins/${slug}/api`, '')
    const method = request.method
    const tenantId = request.tenant?.id

    // 检查外部插件是否启用
    if (!EXTERNAL_PLUGIN_ENABLED) {
      return reply.status(503).send({
        success: false,
        error: 'External plugins are currently disabled'
      })
    }

    if (!plugin.externalBaseUrl) {
      return reply.status(500).send({
        success: false,
        error: 'Plugin configuration error: missing externalBaseUrl'
      })
    }

    // 解析integrationSecrets
    let sharedSecret = ''
    if (plugin.integrationSecrets) {
      try {
        const secrets = JSON.parse(plugin.integrationSecrets)
        sharedSecret = secrets.sharedSecret || ''
      } catch (error) {
        fastify.log.error('Failed to parse integration secrets:', error)
        return reply.status(500).send({
          success: false,
          error: 'Plugin configuration error'
        })
      }
    }

    if (!sharedSecret) {
      return reply.status(500).send({
        success: false,
        error: 'Plugin configuration error: missing sharedSecret'
      })
    }

    // 构建外部请求
    const externalUrl = `${plugin.externalBaseUrl}${path}`
    const timestamp = new Date().toISOString()
    const body = request.body ? JSON.stringify(request.body) : ''
    const signature = generateSignature(sharedSecret, method, path, body, timestamp)

    // 准备headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Platform-Id': 'jiffoo',
      'X-Platform-Env': process.env.NODE_ENV || 'development',
      'X-Platform-Timestamp': timestamp,
      'X-Plugin-Slug': slug,
      'X-Tenant-ID': tenantId!.toString(),
      'X-Installation-ID': installation.id,
      'X-Platform-Signature': signature,
      'User-Agent': 'Jiffoo-Plugin-Gateway/1.0'
    }

    // 添加用户ID（如果有）
    if (request.user?.id) {
      headers['X-User-ID'] = request.user.id
    }

    // 转发请求
    try {
      const response = await fetch(externalUrl, {
        method,
        headers,
        body: method !== 'GET' && method !== 'HEAD' ? body : undefined,
        signal: AbortSignal.timeout(30000) // 30秒超时
      })

      // 获取响应内容
      const responseText = await response.text()
      let responseData

      try {
        responseData = JSON.parse(responseText)
      } catch {
        responseData = responseText
      }

      // 记录日志
      fastify.log.info({
        tenantId,
        pluginSlug: slug,
        path,
        method,
        statusCode: response.status,
        latency: Date.now() - Date.parse(timestamp),
        runtimeType: 'external-http'
      })

      // 返回响应
      return reply
        .status(response.status)
        .send(responseData)

    } catch (error) {
      fastify.log.error('External plugin request failed:', {
        pluginSlug: slug,
        externalUrl,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      return reply.status(502).send({
        success: false,
        error: 'External plugin service unavailable',
        details: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * 动态注册外部插件的代理路由
   * 只为 runtimeType = 'external-http' 的插件注册路由
   */
  fastify.decorate('registerExternalPluginRoutes', async function() {
    try {
      // 查询所有外部插件
      const externalPlugins = await fastify.prisma.plugin.findMany({
        where: {
          runtimeType: 'external-http',
          status: 'ACTIVE'
        }
      })

      for (const plugin of externalPlugins) {
        if (registeredExternalPlugins.has(plugin.slug)) {
          continue // 已注册，跳过
        }

        // 为每个外部插件注册路由
        const routePath = `/api/plugins/${plugin.slug}/api/*`

        fastify.all(routePath, {
          schema: {
            hide: true,
            tags: ['External Plugin Gateway']
          }
        }, async (request, reply) => {
          const slug = plugin.slug
          const tenantId = request.tenant?.id

          // 1. 验证租户上下文
          if (!tenantId) {
            return reply.status(401).send({
              success: false,
              error: 'Tenant context required'
            })
          }

          // 2. 重新查询插件信息（确保最新状态）
          const currentPlugin = await fastify.prisma.plugin.findUnique({
            where: { slug },
            include: {
              installations: {
                where: {
                  tenantId,
                  status: 'ACTIVE',
                  enabled: true
                }
              }
            }
          })

          if (!currentPlugin) {
            return reply.status(404).send({
              success: false,
              error: 'Plugin not found'
            })
          }

          if (currentPlugin.status !== 'ACTIVE') {
            return reply.status(403).send({
              success: false,
              error: 'Plugin is not active'
            })
          }

          // 3. 验证插件安装状态
          const installation = currentPlugin.installations[0]
          if (!installation) {
            return reply.status(403).send({
              success: false,
              error: 'Plugin not installed for this tenant'
            })
          }

          // 4. 商业化检查（许可证 + 订阅 + 用量）
          const licenseCheck = await fastify.checkPluginLicense(tenantId, slug)
          if (!licenseCheck.valid) {
            return reply.status(402).send({
              success: false,
              error: 'License required',
              reason: licenseCheck.reason,
              upgradeUrl: licenseCheck.upgradeUrl
            })
          }

          const subscriptionCheck = await fastify.checkSubscriptionAccess(tenantId, slug)
          if (!subscriptionCheck.allowed) {
            return reply.status(402).send({
              success: false,
              error: 'Subscription required',
              reason: subscriptionCheck.reason,
              upgradeUrl: subscriptionCheck.upgradeUrl
            })
          }

          // 用量检查
          const usageCheck = await fastify.checkUsageLimit(tenantId, slug, 'api_calls')
          if (!usageCheck.allowed) {
            return reply.status(429).send({
              success: false,
              error: 'API call limit exceeded',
              current: usageCheck.current,
              limit: usageCheck.limit,
              percentage: usageCheck.percentage
            })
          }

          // 记录API调用
          await fastify.recordPluginUsage(tenantId, slug, 'api_calls')

          // 5. 代理请求到外部服务
          return handleExternalPluginRequest(request, reply, currentPlugin, installation)
        })

        registeredExternalPlugins.add(plugin.slug)
        fastify.log.info(`✅ Registered external plugin route: ${routePath}`)
      }

      return { registeredCount: externalPlugins.length }
    } catch (error) {
      fastify.log.error('Failed to register external plugin routes:', error)
      throw error
    }
  })

  // 在服务器启动后自动注册外部插件路由
  fastify.addHook('onReady', async () => {
    try {
      const result = await fastify.registerExternalPluginRoutes()
      fastify.log.info(`🔌 Plugin Gateway initialized: ${result.registeredCount} external plugins`)
    } catch (error) {
      fastify.log.error('Failed to initialize plugin gateway:', error)
    }
  })
}

// 使用fastify-plugin包装，使其成为全局插件
export default fp(pluginGateway, {
  name: 'plugin-gateway',
  dependencies: ['tenant-context', 'commercial-support']
})
