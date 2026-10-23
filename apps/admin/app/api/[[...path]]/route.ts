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

  const body = request.method === 'GET' || request.method === 'HEAD'
    ? undefined
    : await request.arrayBuffer()

  const upstream = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body,
    redirect: 'manual',
  })

  const responseHeaders = new Headers(upstream.headers)
  HOP_BY_HOP_HEADERS.forEach((name) => responseHeaders.delete(name))
  if (assetRequest) {
    responseHeaders.delete('set-cookie')
    responseHeaders.delete('access-control-allow-credentials')
  }
  return new Response(upstream.body, {
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
