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

/** The default deadline of a call from the Admin edge to the Core. */
const DEFAULT_EDGE_TIMEOUT_MS = 30000

/**
 * The deadline of a call from the Admin edge to the Core.
 *
 * The deadline comes from the environment, and a value that is not a positive
 * integer falls back to the default, so a mistyped variable cannot remove the
 * deadline of the edge.
 */
function edgeTimeoutMs(): number {
  const raw = (process.env.CORE_EDGE_TIMEOUT_MS ?? '').trim()
  if (!/^\d+$/.test(raw)) return DEFAULT_EDGE_TIMEOUT_MS
  const value = Number(raw)
  return Number.isSafeInteger(value) && value > 0 ? value : DEFAULT_EDGE_TIMEOUT_MS
}

/** The Core did not answer within the deadline of the edge. */
class EdgeTimeoutError extends Error {}

/**
 * Arm the deadline of an exchange with the Core.
 *
 * The deadline covers the whole exchange: the request of the Core, the headers
 * of its answer and the body of that answer. A Core that answers the headers
 * and then stalls the body therefore cannot hold the edge request open, and
 * the caller disarms the deadline when the answer is complete.
 */
type EdgeDeadline = {
  /** The signal that reaches the request of the Core and the body of its answer. */
  signal: AbortSignal;
  /** The failure of the deadline, for the caller that waits for the Core. */
  failure: Promise<never>;
  /** Whether the deadline passed. */
  expired: () => boolean;
  /** The end of the exchange, which disarms the deadline. */
  release: () => void;
};

function armEdgeDeadline(timeoutMs: number): EdgeDeadline {
  const controller = new AbortController()
  let expired = false
  let fail: (error: Error) => void = () => {}
  const failure = new Promise<never>((_, reject) => { fail = reject })
  failure.catch(() => { /* The caller of the deadline observes the failure. */ })
  const timer = setTimeout(() => {
    expired = true
    const error = new EdgeTimeoutError('The Core API did not answer within the edge deadline')
    controller.abort(error)
    fail(error)
  }, timeoutMs)
  return {
    signal: controller.signal,
    failure,
    expired: () => expired,
    release: () => clearTimeout(timer),
  }
}

/**
 * Stream the body of the Core under the deadline.
 *
 * The deadline stays armed until the stream ends: a Core that stalls the body
 * aborts the stream, and the client receives a truncated answer instead of a
 * request that never ends. The deadline is disarmed when the stream is done,
 * so an abort after the answer never reaches a finished exchange.
 */
function deadlineBody(source: ReadableStream<Uint8Array> | null, deadline: EdgeDeadline): ReadableStream<Uint8Array> | null {
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
      } catch { /* The API refuses HTML without valid public-origin configuration. */ }
    }
  }
  headers.delete('content-length')

  const deadline = armEdgeDeadline(edgeTimeoutMs())
  let upstream: Response
  try {
    upstream = await Promise.race([
      (async () => {
        const body = request.method === 'GET' || request.method === 'HEAD'
          ? undefined
          : await request.arrayBuffer()
        return fetch(upstreamUrl, {
          method: request.method,
          headers,
          body,
          redirect: 'manual',
          signal: deadline.signal,
        })
      })(),
      deadline.failure,
    ])
  } catch (error) {
    deadline.release()
    if (deadline.expired()) {
      return Response.json(
        { success: false, error: { code: 'API_SERVICE_UNAVAILABLE', message: 'The Core API did not answer in time' } },
        { status: 503 },
      )
    }
    throw error
  }

  const responseHeaders = new Headers(upstream.headers)
  HOP_BY_HOP_HEADERS.forEach((name) => responseHeaders.delete(name))
  if (assetRequest) {
    responseHeaders.delete('set-cookie')
    responseHeaders.delete('access-control-allow-credentials')
  }
  return new Response(deadlineBody(upstream.body, deadline), {
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
