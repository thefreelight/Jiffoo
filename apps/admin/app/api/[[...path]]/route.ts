import type { NextRequest } from 'next/server'

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

/** The default deadline of the headers of the Core. */
const DEFAULT_EDGE_TIMEOUT_MS = 30000
/** The default deadline of the body of the Core, which is longer than the deadline of the headers. */
const DEFAULT_EDGE_BODY_TIMEOUT_MS = 300000
/** The default limit of the request body that the edge buffers. */
const DEFAULT_MAX_REQUEST_BYTES = 33554432

/** The event of every degradation of the edge, so the records can be aggregated. */
const EDGE_DEGRADED_EVENT = 'edge_core_degraded'

/**
 * A positive integer of the environment, or the fallback.
 *
 * A value that is not a positive integer falls back, so a mistyped variable
 * cannot remove the limit or the deadline of the edge.
 */
function positiveInteger(value: string | undefined, fallback: number): number {
  const raw = (value ?? '').trim()
  if (!/^\d+$/.test(raw)) return fallback
  const parsed = Number(raw)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

/** The deadline of the headers of the Core. */
function edgeTimeoutMs(): number {
  return positiveInteger(process.env.CORE_EDGE_TIMEOUT_MS, DEFAULT_EDGE_TIMEOUT_MS)
}

/** The deadline of the body of the Core. */
function edgeBodyTimeoutMs(): number {
  return positiveInteger(process.env.CORE_EDGE_BODY_TIMEOUT_MS, DEFAULT_EDGE_BODY_TIMEOUT_MS)
}

/** The limit of the request body that the edge buffers. */
function maxRequestBytes(): number {
  return positiveInteger(process.env.CORE_EDGE_MAX_REQUEST_BYTES, DEFAULT_MAX_REQUEST_BYTES)
}

/**
 * The record of a degradation of the edge.
 *
 * Every degradation of the edge writes one structured record with the same
 * event, so the operator can aggregate the degradations of the Admin and the
 * Shop by their event, their surface and their reason.
 */
function logEdgeDegraded(record: {
  surface: string
  reason: string
  path: string
  headerDeadlineMs: number
  bodyDeadlineMs: number
  upstreamStatus: number | null
  elapsedMs: number
}): void {
  console.error(JSON.stringify({ event: EDGE_DEGRADED_EVENT, ...record }))
}

/** The Core did not answer within the deadline of the edge. */
class EdgeTimeoutError extends Error {}

/** The request body of the browser exceeded the limit of the edge. */
class RequestBodyTooLargeError extends Error {}

/** An armed deadline of an exchange with the Core. */
type EdgeDeadline = {
  /** The signal that reaches the request of the Core and the body of its answer. */
  signal: AbortSignal
  /** The failure of the deadline of the headers. */
  headerFailure: Promise<never>
  /** Whether the deadline of the headers passed. */
  headerExpired: () => boolean
  /** The failure of the deadline of the body. */
  bodyFailure: Promise<never>
  /** Whether the deadline of the body passed. */
  bodyExpired: () => boolean
  /** The end of the phase of the headers, which hands the exchange to the body. */
  endHeader: () => void
  /** The end of the exchange, which disarms both deadlines. */
  release: () => void
}

/**
 * Arm the deadlines of an exchange with the Core.
 *
 * The exchange has two phases with two deadlines: the headers of the answer
 * must arrive within the deadline of the headers, and the body of the answer
 * must arrive within the longer deadline of the body. A legitimate large
 * transfer therefore survives the deadline of the headers, and a body that
 * stalls is cut at the deadline of the body instead of at the deadline of the
 * headers.
 */
function createEdgeDeadline(headerMs: number, bodyMs: number): EdgeDeadline {
  const controller = new AbortController()
  let headerExpired = false
  let bodyExpired = false
  let failHeader: (error: Error) => void = () => {}
  let failBody: (error: Error) => void = () => {}
  const headerFailure = new Promise<never>((_, reject) => { failHeader = reject })
  const bodyFailure = new Promise<never>((_, reject) => { failBody = reject })
  headerFailure.catch(() => { /* The caller of the deadline observes the failure. */ })
  bodyFailure.catch(() => { /* The caller of the deadline observes the failure. */ })
  const headerTimer = setTimeout(() => {
    headerExpired = true
    const error = new EdgeTimeoutError('The Core API did not answer the headers within the edge deadline')
    controller.abort(error)
    failHeader(error)
  }, headerMs)
  let bodyTimer: ReturnType<typeof setTimeout> | undefined
  return {
    signal: controller.signal,
    headerFailure,
    headerExpired: () => headerExpired,
    bodyFailure,
    bodyExpired: () => bodyExpired,
    endHeader: () => {
      clearTimeout(headerTimer)
      bodyTimer = setTimeout(() => {
        bodyExpired = true
        const error = new EdgeTimeoutError('The Core API did not send the body within the edge deadline')
        controller.abort(error)
        failBody(error)
      }, bodyMs)
    },
    release: () => {
      clearTimeout(headerTimer)
      if (bodyTimer) clearTimeout(bodyTimer)
    },
  }
}

/**
 * Read the request body of the browser within a limit.
 *
 * The signal of the deadline cannot abort the read of the incoming body: that
 * body arrives from the browser and not from the Core, and the signal of the
 * Core only reaches the outgoing request. The edge therefore bounds the read
 * itself, and it checks the declared length before it reads, so an oversized
 * upload is refused with 413 instead of filling the memory of the edge.
 */
async function readBoundedBody(request: NextRequest, limit: number): Promise<ArrayBuffer> {
  const declared = request.headers.get('content-length')
  if (declared !== null) {
    const length = Number(declared)
    if (Number.isFinite(length) && length > limit) throw new RequestBodyTooLargeError('The request body exceeds the limit of the edge')
  }
  const source = request.body
  if (!source) return new ArrayBuffer(0)
  const reader = source.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) break
      total += chunk.value.byteLength
      if (total > limit) {
        await reader.cancel('The request body exceeds the limit of the edge')
        throw new RequestBodyTooLargeError('The request body exceeds the limit of the edge')
      }
      chunks.push(chunk.value)
    }
  } finally {
    reader.releaseLock()
  }
  const body = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return body.buffer
}

/**
 * Stream the body of the Core under the deadline of the body.
 *
 * The deadline stays armed until the stream ends: a Core that stalls the body
 * aborts the stream, and the client receives a failed and truncated answer
 * instead of a request that never ends. The stream is never closed cleanly
 * after a truncation, and the length of the Core is kept in the answer, so
 * the client can tell a truncated answer from a complete one.
 */
function deadlineBody(
  source: ReadableStream<Uint8Array> | null,
  deadline: EdgeDeadline,
  context: { path: string; headerDeadlineMs: number; bodyDeadlineMs: number; started: number; upstreamStatus: number },
): ReadableStream<Uint8Array> | null {
  if (!source) {
    deadline.release()
    return null
  }
  const reader = source.getReader()
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const chunk = await reader.read()
        if (chunk.done) {
          deadline.release()
          controller.close()
          return
        }
        controller.enqueue(chunk.value)
      } catch (error) {
        deadline.release()
        logEdgeDegraded({
          surface: 'admin_proxy',
          reason: deadline.bodyExpired() ? 'body_timeout' : 'body_error',
          path: context.path,
          headerDeadlineMs: context.headerDeadlineMs,
          bodyDeadlineMs: context.bodyDeadlineMs,
          upstreamStatus: context.upstreamStatus,
          elapsedMs: Date.now() - context.started,
        })
        controller.error(error)
      }
    },
    cancel(reason) {
      deadline.release()
      void reader.cancel(reason)
    },
  })
}

/**
 * fetch() cannot send a Host header, so the public host travels as x-forwarded-host.
 * Next.js records the incoming host there, and the request URL is the last resort.
 */
function incomingHost(request: NextRequest): string {
  return request.headers.get('x-forwarded-host') || request.headers.get('host') || new URL(request.url).host;
}

async function proxyToCore(request: NextRequest): Promise<Response> {
  const started = Date.now()
  const headerDeadlineMs = edgeTimeoutMs()
  const bodyDeadlineMs = edgeBodyTimeoutMs()
  const incomingUrl = new URL(request.url)
  const assetRequest = ['GET', 'HEAD'].includes(request.method) &&
    /^\/api\/v1\/plugin-assets\/[^/]+\/[a-f0-9]{64}\/.+$/.test(incomingUrl.pathname)
  // The gateway and plugin-storage paths keep their null-origin exception; only Core decides
  // whether such an operation is admitted, exactly as the deployment edge routing /api/ does.
  const gatewayRequest = /^\/api\/v1\/(?:extensions\/plugin\/[^/]+\/api(?:\/.*)?|plugin-storage\/[^/]+\/.+)$/.test(incomingUrl.pathname)
  const privateFileRequest = ['GET', 'HEAD'].includes(request.method) && /^\/api\/v1\/plugin-files\/[a-f0-9-]{36}$/.test(incomingUrl.pathname)
  if (request.headers.get('origin') === 'null' && !assetRequest && !gatewayRequest && !privateFileRequest) {
    return Response.json({ success: false, error: { code: 'FORBIDDEN', message: 'Request origin is forbidden' } }, { status: 403 });
  }
  const apiServiceUrl = process.env.API_SERVICE_URL
  if (!apiServiceUrl) {
    logEdgeDegraded({
      surface: 'admin_proxy',
      reason: 'core_not_configured',
      path: incomingUrl.pathname,
      headerDeadlineMs,
      bodyDeadlineMs,
      upstreamStatus: null,
      elapsedMs: Date.now() - started,
    })
    return Response.json(
      { success: false, error: { code: 'API_SERVICE_UNAVAILABLE', message: 'API service is not configured' } },
      { status: 503 },
    )
  }

  const upstreamUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, apiServiceUrl)
  const headers = new Headers(request.headers)
  const pageRequest = /^\/api\/v1\/(?:plugin-pages(?:\/|$)|admin\/plugin-pages\/)/.test(incomingUrl.pathname)
  if (pageRequest) {
    const configured = process.env.ADMIN_URL ? new URL(process.env.ADMIN_URL).origin : null
    if (!configured || request.method !== 'GET' && request.headers.get('origin') !== configured) {
      return Response.json({ success: false, error: { code: 'FORBIDDEN', message: 'Request origin is forbidden' } }, { status: 403 })
    }
    headers.delete('cookie')
    if (request.method !== 'GET') headers.set('origin', configured)
  }
  HOP_BY_HOP_HEADERS.forEach((name) => headers.delete(name))
  headers.delete('host')
  if (assetRequest || privateFileRequest) {
    headers.delete('cookie')
    headers.delete('authorization')
    headers.delete('x-forwarded-host')
    if (process.env.ADMIN_URL) {
      try {
        const configured = new URL(process.env.ADMIN_URL)
        if (incomingHost(request) === configured.host) headers.set('x-forwarded-host', configured.host)
      } catch {
        logEdgeDegraded({
          surface: 'admin_proxy',
          reason: 'origin_configuration_invalid',
          path: incomingUrl.pathname,
          headerDeadlineMs,
          bodyDeadlineMs,
          upstreamStatus: null,
          elapsedMs: Date.now() - started,
        })
      }
    }
  }
  headers.delete('content-length')

  // The read of the incoming body happens before the deadline of the Core is
  // armed: the upload of the browser is not an exchange with the Core, and it
  // must not consume the deadline of the Core.
  let body: ArrayBuffer | undefined
  try {
    body = request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : await readBoundedBody(request, maxRequestBytes())
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      logEdgeDegraded({
        surface: 'admin_proxy',
        reason: 'request_body_too_large',
        path: incomingUrl.pathname,
        headerDeadlineMs,
        bodyDeadlineMs,
        upstreamStatus: null,
        elapsedMs: Date.now() - started,
      })
      return Response.json(
        { success: false, error: { code: 'PAYLOAD_TOO_LARGE', message: 'The request body exceeds the limit of the edge' } },
        { status: 413 },
      )
    }
    logEdgeDegraded({
      surface: 'admin_proxy',
      reason: 'request_body_error',
      path: incomingUrl.pathname,
      headerDeadlineMs,
      bodyDeadlineMs,
      upstreamStatus: null,
      elapsedMs: Date.now() - started,
    })
    throw error
  }

  const deadline = createEdgeDeadline(headerDeadlineMs, bodyDeadlineMs)
  let upstream: Response
  try {
    upstream = await Promise.race([
      fetch(upstreamUrl, {
        method: request.method,
        headers,
        body,
        redirect: 'manual',
        signal: deadline.signal,
      }),
      deadline.headerFailure,
    ])
  } catch (error) {
    deadline.release()
    if (deadline.headerExpired()) {
      logEdgeDegraded({
        surface: 'admin_proxy',
        reason: 'header_timeout',
        path: incomingUrl.pathname,
        headerDeadlineMs,
        bodyDeadlineMs,
        upstreamStatus: null,
        elapsedMs: Date.now() - started,
      })
      return Response.json(
        { success: false, error: { code: 'API_SERVICE_UNAVAILABLE', message: 'The Core API did not answer in time' } },
        { status: 503 },
      )
    }
    logEdgeDegraded({
      surface: 'admin_proxy',
      reason: 'upstream_error',
      path: incomingUrl.pathname,
      headerDeadlineMs,
      bodyDeadlineMs,
      upstreamStatus: null,
      elapsedMs: Date.now() - started,
    })
    throw error
  }
  deadline.endHeader()

  const responseHeaders = new Headers(upstream.headers)
  HOP_BY_HOP_HEADERS.forEach((name) => responseHeaders.delete(name))
  if (assetRequest) {
    responseHeaders.delete('set-cookie')
    responseHeaders.delete('access-control-allow-credentials')
  }
  return new Response(deadlineBody(upstream.body, deadline, {
    path: incomingUrl.pathname,
    headerDeadlineMs,
    bodyDeadlineMs,
    started,
    upstreamStatus: upstream.status,
  }), {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  })
}

export const dynamic = 'force-dynamic'

export const GET = proxyToCore
export const POST = proxyToCore
export const PUT = proxyToCore
export const PATCH = proxyToCore
export const DELETE = proxyToCore
export const OPTIONS = proxyToCore
