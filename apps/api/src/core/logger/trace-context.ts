/**
 * Trace Context - Request tracing context
 * 
 * Generates a unique requestId (X-Request-Id) for each request, persisting throughout the request lifecycle.
 * Supports distributed tracing and log correlation.
 */

import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import { AsyncLocalStorage } from 'async_hooks'
import { v4 as uuidv4 } from 'uuid'

export const REQUEST_ID_HEADER = 'X-Request-Id'
export const REQUEST_ID_HEADER_LOWERCASE = 'x-request-id'
export const LEGACY_TRACE_ID_HEADER = 'x-trace-id'

// Trace context storage
const traceStorage = new AsyncLocalStorage<TraceContext>()

/**
 * Trace context interface
 */
export interface TraceContext {
  requestId: string         // Main Request ID (X-Request-Id)
  traceId: string           // Alias for requestId (for legacy compatibility)
  spanId: string            // Current span ID
  parentSpanId?: string     // Parent span ID
  serviceName: string       // Service name
  startTime: number         // Request start time
  attributes: Record<string, any>  // Custom attributes
}

/**
 * Generate Span ID
 */
export function generateSpanId(): string {
  return Math.random().toString(16).substring(2, 18)
}

/**
 * Get current trace context
 */
export function getTraceContext(): TraceContext | undefined {
  return traceStorage.getStore()
}

/**
 * Get current request ID
 */
export function getRequestId(request?: FastifyRequest): string {
  if (request) {
    return (request as any).requestId || 'unknown'
  }
  return getTraceContext()?.requestId || 'unknown'
}

/**
 * Get current trace_id (legacy alias)
 */
export function getTraceId(): string | undefined {
  return getTraceContext()?.requestId
}

/**
 * Get request ID from headers (for use in workers/jobs)
 */
export function getRequestIdFromHeaders(
  headers: Record<string, string | string[] | undefined>
): string | null {
  const requestId =
    headers[REQUEST_ID_HEADER_LOWERCASE] ||
    headers[REQUEST_ID_HEADER] ||
    headers[LEGACY_TRACE_ID_HEADER]

  if (Array.isArray(requestId)) {
    return requestId[0] || null
  }

  return requestId || null
}

/**
 * Execute function in trace context
 */
export function withTraceContext<T>(context: TraceContext, fn: () => T): T {
  return traceStorage.run(context, fn)
}

/**
 * Add trace attribute
 */
export function addTraceAttribute(key: string, value: any): void {
  const context = getTraceContext()
  if (context) {
    context.attributes[key] = value
  }
}

/**
 * Create child span
 */
export function createChildSpan(name: string): TraceContext | undefined {
  const parent = getTraceContext()
  if (!parent) return undefined

  return {
    requestId: parent.requestId,
    traceId: parent.requestId,
    spanId: generateSpanId(),
    parentSpanId: parent.spanId,
    serviceName: parent.serviceName,
    startTime: Date.now(),
    attributes: { spanName: name }
  }
}

/**
 * Trace Context Fastify plugin
 */
const traceContextPlugin: FastifyPluginAsync<{
  serviceName?: string
  headerName?: string
  generateIfMissing?: boolean
}> = async (fastify, options) => {
  const {
    serviceName = 'jiffoo-backend',
    generateIfMissing = true
  } = options

  // Decorate request object
  fastify.decorateRequest('requestId', null)
  fastify.decorateRequest('traceId', null) // Legacy
  fastify.decorateRequest('traceContext', null)

  // Request entry hook - Initialize trace context
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Get or generate requestId from request headers
    let requestId = getRequestIdFromHeaders(request.headers)
    let parentSpanId: string | undefined

    // Support W3C Trace Context format (traceparent header)
    const traceparent = request.headers['traceparent'] as string
    if (traceparent) {
      const parts = traceparent.split('-')
      if (parts.length >= 3) {
        // Use traceId from traceparent if no X-Request-Id present, or just as correlation
        if (!requestId) requestId = parts[1]
        parentSpanId = parts[2]
      }
    }

    // If no requestId and auto-generation is configured
    if (!requestId && generateIfMissing) {
      requestId = uuidv4()
    }

    // Create trace context
    const context: TraceContext = {
      requestId: requestId || 'unknown',
      traceId: requestId || 'unknown', // Map requestId to traceId for compatibility
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

      // Inject into request object
      ; (request as any).requestId = requestId
      ; (request as any).traceId = requestId // Legacy support
      ; (request as any).traceContext = context

    // Set response headers
    reply.header(REQUEST_ID_HEADER, requestId)
    // Legacy support (optional, can be removed if strict cleanup desired)
    // reply.header(LEGACY_TRACE_ID_HEADER, requestId) 

    // Set logger context
    request.log = request.log.child({ requestId })

    // Run subsequent processing in AsyncLocalStorage
    // Note: traceStorage.run() cannot be used directly here due to Fastify's async model
    // We pass the context through the request object
  })

  // Response completion hook - Record request completion
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const context = (request as any).traceContext as TraceContext
    if (!context) return

    const duration = Date.now() - context.startTime

    // Add response attributes
    context.attributes['http.status_code'] = reply.statusCode
    context.attributes['http.duration_ms'] = duration

    // Logging (if logging plugin is enabled)
    if (fastify.log && fastify.log.info) {
      fastify.log.info({
        requestId: context.requestId,
        trace_id: context.traceId, // Keep for legacy log parsers if needed
        span_id: context.spanId,
        parent_span_id: context.parentSpanId,
        service: context.serviceName,
        method: request.method,
        url: request.url,
        status: reply.statusCode,
        duration_ms: duration,
        user_id: (request as any).user?.id
      }, `${request.method} ${request.url} ${reply.statusCode} ${duration}ms`)
    }
  })

  // Error hook - Record error trace
  fastify.addHook('onError', async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
    const context = (request as any).traceContext as TraceContext
    if (!context) return

    context.attributes['error'] = true
    context.attributes['error.message'] = error.message
    context.attributes['error.name'] = error.name
    context.attributes['error.stack'] = error.stack

    if (fastify.log && fastify.log.error) {
      fastify.log.error({
        requestId: context.requestId,
        trace_id: context.traceId,
        span_id: context.spanId,
        service: context.serviceName,
        error: error.message,
        stack: error.stack,
        method: request.method,
        url: request.url,
        user_id: (request as any).user?.id
      }, `Error in ${request.method} ${request.url}: ${error.message}`)
    }
  })

  // Decorator: Get the requestId of the current request
  fastify.decorate('getRequestId', function (request: FastifyRequest): string | undefined {
    return (request as any).requestId
  })

  // Legacy Decorator: Get the trace_id
  fastify.decorate('getRequestTraceId', function (request: FastifyRequest): string | undefined {
    return (request as any).requestId
  })

  // Decorator: Get the trace context of the current request
  fastify.decorate('getRequestTraceContext', function (request: FastifyRequest): TraceContext | undefined {
    return (request as any).traceContext
  })

  // Decorator: Add trace info to logs
  fastify.decorate('logWithTrace', function (
    request: FastifyRequest,
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    meta?: Record<string, any>
  ): void {
    const context = (request as any).traceContext as TraceContext
    const enrichedMeta = {
      ...meta,
      requestId: context?.requestId,
      trace_id: context?.traceId,
      span_id: context?.spanId,
      service: context?.serviceName,
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
 * Log utility function - Add requestId to any log
 */
export function enrichLogWithTrace(meta: Record<string, any> = {}): Record<string, any> {
  const context = getTraceContext()
  if (context) {
    return {
      ...meta,
      requestId: context.requestId,
      trace_id: context.traceId,
      span_id: context.spanId,
      service: context.serviceName
    }
  }
  return meta
}
