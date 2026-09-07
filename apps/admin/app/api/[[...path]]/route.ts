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

async function proxyToCore(request: NextRequest): Promise<Response> {
  const apiServiceUrl = process.env.API_SERVICE_URL
  if (!apiServiceUrl) {
    return Response.json(
      { success: false, error: { code: 'API_SERVICE_UNAVAILABLE', message: 'API service is not configured' } },
      { status: 503 },
    )
  }

  const incomingUrl = new URL(request.url)
  const upstreamUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, apiServiceUrl)
  const headers = new Headers(request.headers)
  HOP_BY_HOP_HEADERS.forEach((name) => headers.delete(name))
  headers.delete('host')
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
