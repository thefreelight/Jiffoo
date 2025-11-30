import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'

/**
 * Plugin Tenant Isolation Middleware
 *
 * 提供插件路由的租户隔离保护：
 * 1. 租户ID强校验 - 确保所有插件请求有有效的 tenantId
 * 2. 速率限制 - 基于租户的请求限制（防止单个租户耗尽资源）
 * 3. 错误边界隔离 - 插件错误不影响其他服务
 */

// 速率限制配置
interface RateLimitConfig {
  maxRequests: number     // 最大请求数
  windowMs: number        // 时间窗口（毫秒）
  keyPrefix: string       // 缓存键前缀
}

// 租户速率限制存储（内存版本，生产环境应使用 Redis）
const tenantRateLimits = new Map<string, { count: number; resetAt: number }>()

// 默认速率限制配置
const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  // 插件 API 路由
  'plugin-api': {
    maxRequests: 1000,  // 每分钟 1000 请求
    windowMs: 60 * 1000,
    keyPrefix: 'rl:plugin-api'
  },
  // 外部插件代理
  'external-plugin': {
    maxRequests: 500,   // 每分钟 500 请求（外部调用更昂贵）
    windowMs: 60 * 1000,
    keyPrefix: 'rl:ext-plugin'
  },
  // 高频端点（如轮询）
  'high-frequency': {
    maxRequests: 100,   // 每分钟 100 请求
    windowMs: 60 * 1000,
    keyPrefix: 'rl:high-freq'
  }
}

const pluginTenantIsolation: FastifyPluginAsync = async (fastify, _options) => {
  /**
   * 装饰器：强制租户校验
   * 用于需要严格租户上下文的路由
   */
  fastify.decorate('requireTenant', async function(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    if (!request.tenant?.id) {
      reply.status(401).send({
        success: false,
        error: 'TENANT_REQUIRED',
        message: 'Valid tenant context is required for this operation',
        code: 'ERR_TENANT_CONTEXT_MISSING'
      })
      throw new Error('Tenant context missing')
    }
  })

  /**
   * 装饰器：速率限制检查
   * 基于租户的请求限制
   */
  fastify.decorate('checkRateLimit', async function(
    request: FastifyRequest,
    reply: FastifyReply,
    limitType: keyof typeof DEFAULT_RATE_LIMITS = 'plugin-api'
  ): Promise<boolean> {
    const tenantId = request.tenant?.id
    if (!tenantId) {
      return true // 无租户上下文，跳过限制
    }

    const config = DEFAULT_RATE_LIMITS[limitType]
    const key = `${config.keyPrefix}:${tenantId}`
    const now = Date.now()

    // 尝试使用 Redis（如果可用）
    if (fastify.redis) {
      try {
        const result = await checkRateLimitRedis(fastify.redis, key, config, now)
        if (!result.allowed) {
          setRateLimitHeaders(reply, result, config)
          reply.status(429).send({
            success: false,
            error: 'RATE_LIMIT_EXCEEDED',
            message: `Too many requests. Limit: ${config.maxRequests} per ${config.windowMs / 1000}s`,
            retryAfter: Math.ceil((result.resetAt - now) / 1000),
            limit: config.maxRequests,
            remaining: 0,
            reset: result.resetAt
          })
          return false
        }
        setRateLimitHeaders(reply, result, config)
        return true
      } catch (error) {
        fastify.log.warn('Redis rate limit check failed, falling back to memory:', error)
      }
    }

    // 内存回退
    const result = checkRateLimitMemory(key, config, now)
    if (!result.allowed) {
      setRateLimitHeaders(reply, result, config)
      reply.status(429).send({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: `Too many requests. Limit: ${config.maxRequests} per ${config.windowMs / 1000}s`,
        retryAfter: Math.ceil((result.resetAt - now) / 1000),
        limit: config.maxRequests,
        remaining: 0,
        reset: result.resetAt
      })
      return false
    }
    setRateLimitHeaders(reply, result, config)
    return true
  })

  /**
   * 装饰器：插件错误边界
   * 捕获插件执行错误，防止影响主服务
   */
  fastify.decorate('withPluginErrorBoundary', function<T>(
    pluginSlug: string,
    operation: () => Promise<T>,
    fallbackValue?: T
  ): Promise<T | undefined> {
    return executeWithErrorBoundary(fastify, pluginSlug, operation, fallbackValue)
  })

  /**
   * 装饰器：安全执行插件操作
   * 带超时和错误隔离的插件执行
   */
  fastify.decorate('safePluginExecute', async function<T>(
    pluginSlug: string,
    operation: () => Promise<T>,
    options: {
      timeoutMs?: number
      fallbackValue?: T
      onError?: (error: Error) => void
    } = {}
  ): Promise<T | undefined> {
    const { timeoutMs = 30000, fallbackValue, onError } = options

    try {
      // 添加超时控制
      const result = await Promise.race([
        operation(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Plugin ${pluginSlug} operation timed out`)), timeoutMs)
        )
      ])
      return result
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      
      fastify.log.error({
        plugin: pluginSlug,
        error: err.message,
        stack: err.stack,
        isolationType: 'safe_execute'
      }, `Plugin execution error isolated: ${pluginSlug}`)

      // 记录插件错误统计
      await recordPluginError(fastify, pluginSlug, err)

      if (onError) {
        onError(err)
      }

      return fallbackValue
    }
  })

  /**
   * 插件路由预处理钩子
   * 为 /api/plugins/* 路由添加租户隔离保护
   */
  fastify.addHook('preHandler', async (request, reply) => {
    // 只处理插件相关路由
    const url = request.routeOptions?.url || ''
    if (!url.startsWith('/api/plugins/') && !url.includes('/plugin')) {
      return
    }

    // 1. 强制租户校验
    if (!request.tenant?.id) {
      return reply.status(401).send({
        success: false,
        error: 'TENANT_REQUIRED',
        message: 'Plugin routes require valid tenant context',
        code: 'ERR_PLUGIN_TENANT_MISSING'
      })
    }

    // 2. 速率限制检查
    const limitType = url.includes('/external') ? 'external-plugin' : 'plugin-api'
    const allowed = await fastify.checkRateLimit(request, reply, limitType)
    if (!allowed) {
      return // 已在 checkRateLimit 中返回响应
    }

    // 3. 添加请求追踪 ID（用于日志关联）
    const traceId = request.headers['x-trace-id'] || 
                    request.headers['x-request-id'] || 
                    generateTraceId()
    request.headers['x-trace-id'] = traceId as string
  })

  /**
   * 插件错误处理钩子
   * 隔离插件错误，防止影响全局
   */
  fastify.addHook('onError', async (request, reply, error) => {
    const url = request.routeOptions?.url || ''
    if (!url.startsWith('/api/plugins/') && !url.includes('/plugin')) {
      return
    }

    // 提取插件 slug
    const pluginMatch = url.match(/\/api\/plugins\/([^\/]+)/)
    const pluginSlug = pluginMatch ? pluginMatch[1] : 'unknown'

    // 记录插件错误（不影响其他租户）
    fastify.log.error({
      plugin: pluginSlug,
      tenantId: request.tenant?.id,
      error: error.message,
      stack: error.stack,
      url,
      method: request.method,
      traceId: request.headers['x-trace-id']
    }, `Plugin error isolated: ${pluginSlug}`)

    // 记录错误统计
    await recordPluginError(fastify, pluginSlug, error)
  })
}

// ================== 辅助函数 ==================

/**
 * Redis 速率限制检查
 */
async function checkRateLimitRedis(
  redis: any,
  key: string,
  config: RateLimitConfig,
  now: number
): Promise<{ allowed: boolean; count: number; resetAt: number }> {
  const multi = redis.multi()
  multi.incr(key)
  multi.pttl(key)
  
  const results = await multi.exec()
  const count = results[0][1] as number
  let ttl = results[1][1] as number

  // 如果是新键，设置过期时间
  if (ttl === -1) {
    await redis.pexpire(key, config.windowMs)
    ttl = config.windowMs
  }

  const resetAt = now + Math.max(ttl, 0)
  return {
    allowed: count <= config.maxRequests,
    count,
    resetAt
  }
}

/**
 * 内存速率限制检查
 */
function checkRateLimitMemory(
  key: string,
  config: RateLimitConfig,
  now: number
): { allowed: boolean; count: number; resetAt: number } {
  let record = tenantRateLimits.get(key)

  // 如果记录过期或不存在，创建新记录
  if (!record || record.resetAt <= now) {
    record = { count: 0, resetAt: now + config.windowMs }
    tenantRateLimits.set(key, record)
  }

  record.count++

  return {
    allowed: record.count <= config.maxRequests,
    count: record.count,
    resetAt: record.resetAt
  }
}

/**
 * 设置速率限制响应头
 */
function setRateLimitHeaders(
  reply: FastifyReply,
  result: { count: number; resetAt: number },
  config: RateLimitConfig
): void {
  reply.header('X-RateLimit-Limit', config.maxRequests)
  reply.header('X-RateLimit-Remaining', Math.max(0, config.maxRequests - result.count))
  reply.header('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000))
}

/**
 * 带错误边界执行
 */
async function executeWithErrorBoundary<T>(
  fastify: any,
  pluginSlug: string,
  operation: () => Promise<T>,
  fallbackValue?: T
): Promise<T | undefined> {
  try {
    return await operation()
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    
    fastify.log.error({
      plugin: pluginSlug,
      error: err.message,
      stack: err.stack,
      isolationType: 'error_boundary'
    }, `Plugin error isolated: ${pluginSlug}`)

    await recordPluginError(fastify, pluginSlug, err)
    
    return fallbackValue
  }
}

/**
 * 记录插件错误统计
 */
async function recordPluginError(
  fastify: any,
  pluginSlug: string,
  error: Error
): Promise<void> {
  try {
    // 异步记录，不阻塞主流程
    setImmediate(async () => {
      const errorKey = `plugin_error:${pluginSlug}:${new Date().toISOString().split('T')[0]}`
      
      if (fastify.redis) {
        await fastify.redis.hincrby(errorKey, 'count', 1)
        await fastify.redis.hset(errorKey, 'lastError', error.message)
        await fastify.redis.hset(errorKey, 'lastOccurred', new Date().toISOString())
        await fastify.redis.expire(errorKey, 7 * 24 * 60 * 60) // 保留 7 天
      }
    })
  } catch (e) {
    // 静默失败，不影响主流程
  }
}

/**
 * 生成追踪 ID
 */
function generateTraceId(): string {
  return `trace_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
}

// 清理过期的内存速率限制记录（每 5 分钟）
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of tenantRateLimits.entries()) {
    if (record.resetAt <= now) {
      tenantRateLimits.delete(key)
    }
  }
}, 5 * 60 * 1000)

export default fp(pluginTenantIsolation, {
  name: 'plugin-tenant-isolation',
  fastify: '5.x',
  dependencies: ['tenant-context']
})

