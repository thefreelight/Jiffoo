/**
 * Trace Context - 请求追踪上下文
 * 
 * 为每个请求生成唯一的 trace_id，贯穿整个请求生命周期。
 * 支持分布式追踪（OpenTelemetry 兼容）和日志关联。
 */

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import { AsyncLocalStorage } from 'async_hooks'

// 追踪上下文存储
const traceStorage = new AsyncLocalStorage<TraceContext>()

/**
 * 追踪上下文接口
 */
export interface TraceContext {
  traceId: string           // 主追踪 ID
  spanId: string            // 当前 span ID
  parentSpanId?: string     // 父 span ID
  serviceName: string       // 服务名称
  startTime: number         // 请求开始时间
  attributes: Record<string, any>  // 自定义属性
}

/**
 * 生成追踪 ID
 * 格式：{timestamp_hex}-{random_hex}-{counter_hex}
 */
let traceCounter = 0
export function generateTraceId(): string {
  const timestamp = Date.now().toString(16)
  const random = Math.random().toString(16).substring(2, 10)
  const counter = (++traceCounter % 0xffff).toString(16).padStart(4, '0')
  return `${timestamp}-${random}-${counter}`
}

/**
 * 生成 Span ID
 */
export function generateSpanId(): string {
  return Math.random().toString(16).substring(2, 18)
}

/**
 * 获取当前追踪上下文
 */
export function getTraceContext(): TraceContext | undefined {
  return traceStorage.getStore()
}

/**
 * 获取当前 trace_id（便捷方法）
 */
export function getTraceId(): string | undefined {
  return getTraceContext()?.traceId
}

/**
 * 在追踪上下文中执行函数
 */
export function withTraceContext<T>(context: TraceContext, fn: () => T): T {
  return traceStorage.run(context, fn)
}

/**
 * 添加追踪属性
 */
export function addTraceAttribute(key: string, value: any): void {
  const context = getTraceContext()
  if (context) {
    context.attributes[key] = value
  }
}

/**
 * 创建子 span
 */
export function createChildSpan(name: string): TraceContext | undefined {
  const parent = getTraceContext()
  if (!parent) return undefined

  return {
    traceId: parent.traceId,
    spanId: generateSpanId(),
    parentSpanId: parent.spanId,
    serviceName: parent.serviceName,
    startTime: Date.now(),
    attributes: { spanName: name }
  }
}

/**
 * Trace Context Fastify 插件
 */
const traceContextPlugin: FastifyPluginAsync<{
  serviceName?: string
  headerName?: string
  generateIfMissing?: boolean
}> = async (fastify, options) => {
  const {
    serviceName = 'jiffoo-backend',
    headerName = 'x-trace-id',
    generateIfMissing = true
  } = options

  // 装饰请求对象
  fastify.decorateRequest('traceId', null)
  fastify.decorateRequest('traceContext', null)

  // 请求入口钩子 - 初始化追踪上下文
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // 从请求头获取或生成 trace_id
    let traceId = request.headers[headerName] as string
    let parentSpanId: string | undefined

    // 支持 W3C Trace Context 格式 (traceparent header)
    const traceparent = request.headers['traceparent'] as string
    if (traceparent) {
      const parts = traceparent.split('-')
      if (parts.length >= 3) {
        traceId = parts[1]
        parentSpanId = parts[2]
      }
    }

    // 如果没有 trace_id 且配置了自动生成
    if (!traceId && generateIfMissing) {
      traceId = generateTraceId()
    }

    // 创建追踪上下文
    const context: TraceContext = {
      traceId: traceId || 'unknown',
      spanId: generateSpanId(),
      parentSpanId,
      serviceName,
      startTime: Date.now(),
      attributes: {
        'http.method': request.method,
        'http.url': request.url,
        'http.host': request.hostname,
        'http.user_agent': request.headers['user-agent'],
        'client.ip': request.ip
      }
    }

    // 注入到请求对象
    ;(request as any).traceId = traceId
    ;(request as any).traceContext = context

    // 设置响应头
    reply.header(headerName, traceId)
    reply.header('x-span-id', context.spanId)

    // 在 AsyncLocalStorage 中运行后续处理
    // 注意：这里不能直接用 traceStorage.run()，因为 Fastify 的异步模型
    // 我们通过 request 对象传递上下文
  })

  // 响应完成钩子 - 记录请求完成
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const context = (request as any).traceContext as TraceContext
    if (!context) return

    const duration = Date.now() - context.startTime

    // 添加响应属性
    context.attributes['http.status_code'] = reply.statusCode
    context.attributes['http.duration_ms'] = duration

    // 日志记录（如果启用了日志插件）
    if (fastify.log && fastify.log.info) {
      fastify.log.info({
        trace_id: context.traceId,
        span_id: context.spanId,
        parent_span_id: context.parentSpanId,
        service: context.serviceName,
        method: request.method,
        url: request.url,
        status: reply.statusCode,
        duration_ms: duration,
        tenant_id: (request as any).tenant?.id,
        user_id: (request as any).user?.id
      }, `${request.method} ${request.url} ${reply.statusCode} ${duration}ms`)
    }
  })

  // 错误钩子 - 记录错误追踪
  fastify.addHook('onError', async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
    const context = (request as any).traceContext as TraceContext
    if (!context) return

    context.attributes['error'] = true
    context.attributes['error.message'] = error.message
    context.attributes['error.name'] = error.name
    context.attributes['error.stack'] = error.stack

    if (fastify.log && fastify.log.error) {
      fastify.log.error({
        trace_id: context.traceId,
        span_id: context.spanId,
        service: context.serviceName,
        error: error.message,
        stack: error.stack,
        method: request.method,
        url: request.url,
        tenant_id: (request as any).tenant?.id,
        user_id: (request as any).user?.id
      }, `Error in ${request.method} ${request.url}: ${error.message}`)
    }
  })

  // 装饰器：获取当前请求的 trace_id
  fastify.decorate('getRequestTraceId', function(request: FastifyRequest): string | undefined {
    return (request as any).traceId
  })

  // 装饰器：获取当前请求的追踪上下文
  fastify.decorate('getRequestTraceContext', function(request: FastifyRequest): TraceContext | undefined {
    return (request as any).traceContext
  })

  // 装饰器：为日志添加追踪信息
  fastify.decorate('logWithTrace', function(
    request: FastifyRequest,
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    meta?: Record<string, any>
  ): void {
    const context = (request as any).traceContext as TraceContext
    const enrichedMeta = {
      ...meta,
      trace_id: context?.traceId,
      span_id: context?.spanId,
      service: context?.serviceName,
      tenant_id: (request as any).tenant?.id,
      user_id: (request as any).user?.id
    }

    if (fastify.log && fastify.log[level]) {
      fastify.log[level](enrichedMeta, message)
    }
  })
}

export default fp(traceContextPlugin, {
  name: 'trace-context',
  fastify: '5.x'
})

/**
 * 日志工具函数 - 为任意日志添加 trace_id
 */
export function enrichLogWithTrace(meta: Record<string, any> = {}): Record<string, any> {
  const context = getTraceContext()
  if (context) {
    return {
      ...meta,
      trace_id: context.traceId,
      span_id: context.spanId,
      service: context.serviceName
    }
  }
  return meta
}

